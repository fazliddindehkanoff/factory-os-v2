import "server-only"

import { createHash, randomBytes, randomUUID } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { db } from "@/db/client"
import { sessions, users } from "@/db/schema"
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants"
import type { Locale } from "@/lib/i18n"

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await db.insert(sessions).values({
    id: randomUUID(),
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt: expiresAt.toISOString(),
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })
}

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const [session] = await db.select({
    sessionId: sessions.id,
    userId: users.id,
    username: users.username,
    fullName: users.fullName,
  })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.tokenHash, hashSessionToken(token)),
      gt(sessions.expiresAt, new Date().toISOString()),
      isNull(sessions.revokedAt),
      eq(users.isActive, true),
    ))
    .limit(1)

  return session ?? null
}

export async function requireSession(lang: Locale) {
  const session = await getSessionUser()
  if (!session) redirect(`/${lang}/login`)
  return session
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await db.update(sessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(sessions.tokenHash, hashSessionToken(token)))
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}
