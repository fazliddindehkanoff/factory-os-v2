import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { users } from "@/db/schema"

type TelegramInlineKeyboardButton = {
  text: string
  web_app: { url: string }
}

type TelegramReplyMarkup =
  | { keyboard: Array<Array<{ text: string; request_contact: true }>>; resize_keyboard: true; one_time_keyboard: true }
  | { remove_keyboard: true }
  | { inline_keyboard: TelegramInlineKeyboardButton[][] }

export function getTelegramWebAppUrl(requestUrl?: string) {
  const configured = process.env.TELEGRAM_WEB_APP_URL?.trim()
  if (configured) return configured
  if (!requestUrl) return null
  return new URL("/uz/telegram", requestUrl).toString()
}

export function localizeTelegramWebAppUrl(webAppUrl: string, languageCode?: string) {
  const locale = languageCode?.startsWith("ru") ? "ru" : languageCode?.startsWith("tr") ? "tr" : "uz"
  const url = new URL(webAppUrl)
  url.pathname = url.pathname.replace(/^\/(uz|ru|tr)(?=\/|$)/, `/${locale}`)
  return url.toString()
}

async function callTelegram(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) throw new Error("Telegram bot is not configured")
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  const result = await response.json() as { ok?: boolean; description?: string }
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram API request failed")
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

export async function requestTelegramContact(chatId: string | number, languageCode?: string) {
  const text = languageCode?.startsWith("ru")
    ? "Чтобы открыть Factory OS, подтвердите рабочий номер телефона."
    : languageCode?.startsWith("tr")
      ? "Factory OS’u açmak için iş telefon numaranızı doğrulayın."
      : "Factory OS’ni ochish uchun ish telefon raqamingizni tasdiqlang."
  const button = languageCode?.startsWith("ru")
    ? "Поделиться номером"
    : languageCode?.startsWith("tr")
      ? "Telefon numaramı paylaş"
      : "Telefon raqamimni ulashish"
  await sendTelegramMessage(chatId, text, {
    keyboard: [[{ text: button, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  })
}

export async function sendTelegramAppAccess(
  chatId: string | number,
  webAppUrl: string,
  languageCode?: string,
) {
  const localizedWebAppUrl = localizeTelegramWebAppUrl(webAppUrl, languageCode)
  const verified = languageCode?.startsWith("ru")
    ? "Номер подтверждён. Factory OS готов к работе."
    : languageCode?.startsWith("tr")
      ? "Numara doğrulandı. Factory OS kullanıma hazır."
      : "Raqam tasdiqlandi. Factory OS ishlashga tayyor."
  const open = languageCode?.startsWith("ru")
    ? "Открыть заказы"
    : languageCode?.startsWith("tr")
      ? "Siparişleri aç"
      : "Buyurtmalarni ochish"

  await sendTelegramMessage(chatId, verified, { remove_keyboard: true })
  await sendTelegramMessage(chatId, open, {
    inline_keyboard: [[{ text: open, web_app: { url: localizedWebAppUrl } }]],
  })
  await callTelegram("setChatMenuButton", {
    chat_id: chatId,
    menu_button: { type: "web_app", text: open, web_app: { url: localizedWebAppUrl } },
  })
}

export async function sendTelegramNotificationForUser(
  userId: string,
  orderNumber: string,
  body: string,
  orderId?: string,
  commentId?: string,
) {
  const [user] = await db.select({ telegramChatId: users.telegramChatId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user?.telegramChatId) return false

  const baseUrl = getTelegramWebAppUrl()
  let webAppUrl = baseUrl
  if (baseUrl && orderId) {
    const url = new URL(baseUrl)
    url.searchParams.set("order", orderId)
    if (commentId) url.searchParams.set("comment", commentId)
    webAppUrl = url.toString()
  }
  await sendTelegramMessage(
    user.telegramChatId,
    `${orderNumber}\n${body}`,
    webAppUrl
      ? { inline_keyboard: [[{ text: "Buyurtmani ochish", web_app: { url: webAppUrl } }]] }
      : undefined,
  )
  return true
}
