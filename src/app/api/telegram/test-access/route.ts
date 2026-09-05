import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { users } from "@/db/schema"
import { createSession } from "@/lib/auth/session"
import { defaultLocale, isLocale } from "@/lib/i18n"
import { normalizePhoneNumber } from "@/lib/telegram-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const phone = normalizePhoneNumber(url.searchParams.get("phone") ?? "")
  const requestedLocale = url.searchParams.get("lang") ?? ""
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale

  if (!phone) return NextResponse.json({ error: "invalid-phone" }, { status: 400 })

  const candidates = (await db.select({ id: users.id, phoneNumber: users.phoneNumber })
    .from(users)
    .where(eq(users.isActive, true)))
    .filter((user) => normalizePhoneNumber(user.phoneNumber ?? "") === phone)

  if (candidates.length !== 1) {
    return NextResponse.json({ error: "user-not-found" }, { status: 404 })
  }

  await createSession(candidates[0].id)
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host")
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const requestUrl = new URL(request.url)
  const origin = host
    ? `${forwardedProtocol || requestUrl.protocol.slice(0, -1)}://${host}`
    : requestUrl.origin
  const response = NextResponse.redirect(new URL(`/${locale}/telegram/settings`, origin))
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
