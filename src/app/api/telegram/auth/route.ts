import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { users } from "@/db/schema"
import { createSession } from "@/lib/auth/session"
import { validateTelegramInitData } from "@/lib/telegram-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return NextResponse.json({ error: "telegram-not-configured" }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-init-data" }, { status: 400 })
  }
  const initData = body && typeof body === "object" && "initData" in body
    ? String(body.initData)
    : ""
  const validated = validateTelegramInitData(initData, token)
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 401 })

  const [user] = await db.select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.telegramChatId, String(validated.user.id)),
      eq(users.isActive, true),
    ))
    .limit(1)
  if (!user) return NextResponse.json({ error: "telegram-account-not-linked" }, { status: 403 })

  await createSession(user.id)
  return NextResponse.json({ ok: true })
}
