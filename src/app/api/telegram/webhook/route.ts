import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { users } from "@/db/schema"
import { normalizePhoneNumber } from "@/lib/telegram-auth"
import {
  getTelegramWebAppUrl,
  requestTelegramContact,
  sendTelegramAppAccess,
  sendTelegramMessage,
} from "@/lib/telegram-bot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TelegramUpdate = {
  message?: {
    chat?: { id?: number; type?: string }
    from?: { id?: number; language_code?: string }
    text?: string
    contact?: { phone_number?: string; user_id?: number }
  }
}

function validSecret(request: Request) {
  const configured = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  return Boolean(configured && request.headers.get("x-telegram-bot-api-secret-token") === configured)
}

export async function POST(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let update: TelegramUpdate
  try {
    const text = await request.text()
    if (text.length > 1_000_000) return NextResponse.json({ error: "payload-too-large" }, { status: 413 })
    update = JSON.parse(text) as TelegramUpdate
  } catch {
    return NextResponse.json({ error: "invalid-update" }, { status: 400 })
  }

  const message = update.message
  const chatId = message?.chat?.id
  const telegramUserId = message?.from?.id
  const languageCode = message?.from?.language_code
  if (!chatId || !telegramUserId || message.chat?.type !== "private") {
    return NextResponse.json({ ok: true })
  }

  const webAppUrl = getTelegramWebAppUrl(request.url)
  if (!webAppUrl) return NextResponse.json({ error: "telegram-not-configured" }, { status: 503 })

  const [linkedUser] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.telegramChatId, String(telegramUserId)), eq(users.isActive, true)))
    .limit(1)
  if (message.text?.startsWith("/start") && linkedUser) {
    await sendTelegramAppAccess(chatId, webAppUrl, languageCode)
    return NextResponse.json({ ok: true })
  }
  if (message.text?.startsWith("/start")) {
    await requestTelegramContact(chatId, languageCode)
    return NextResponse.json({ ok: true })
  }

  if (!message.contact) {
    await requestTelegramContact(chatId, languageCode)
    return NextResponse.json({ ok: true })
  }
  if (message.contact.user_id !== telegramUserId) {
    await sendTelegramMessage(chatId, "Faqat o‘zingizning telefon raqamingizni yuboring.")
    return NextResponse.json({ ok: true })
  }

  const phone = normalizePhoneNumber(message.contact.phone_number ?? "")
  const candidates = (await db.select({
    id: users.id,
    phoneNumber: users.phoneNumber,
    telegramChatId: users.telegramChatId,
  }).from(users).where(eq(users.isActive, true)))
    .filter((user) => normalizePhoneNumber(user.phoneNumber ?? "") === phone)
  if (!phone || candidates.length !== 1) {
    await sendTelegramMessage(chatId, "Bu raqam faol Factory OS foydalanuvchisiga biriktirilmagan. Administratorga murojaat qiling.")
    return NextResponse.json({ ok: true })
  }

  const matchedUser = candidates[0]
  if (matchedUser.telegramChatId && matchedUser.telegramChatId !== String(telegramUserId)) {
    await sendTelegramMessage(chatId, "Bu hisob boshqa Telegram akkauntiga biriktirilgan. Administratorga murojaat qiling.")
    return NextResponse.json({ ok: true })
  }
  const [collision] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.telegramChatId, String(telegramUserId)), eq(users.isActive, true)))
    .limit(1)
  if (collision && collision.id !== matchedUser.id) {
    await sendTelegramMessage(chatId, "Bu Telegram akkaunti boshqa foydalanuvchiga biriktirilgan.")
    return NextResponse.json({ ok: true })
  }

  if (!matchedUser.telegramChatId) {
    await db.update(users)
      .set({ telegramChatId: String(telegramUserId), updatedAt: new Date().toISOString() })
      .where(eq(users.id, matchedUser.id))
  }
  await sendTelegramAppAccess(chatId, webAppUrl, languageCode)
  return NextResponse.json({ ok: true })
}
