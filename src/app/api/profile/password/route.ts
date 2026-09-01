import { and, eq, isNull, ne } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { sessions, users } from "@/db/schema"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { getSessionUser } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-password" }, { status: 400 })
  }
  const currentPassword = typeof body === "object" && body !== null && "currentPassword" in body
    ? String(body.currentPassword)
    : ""
  const newPassword = typeof body === "object" && body !== null && "newPassword" in body
    ? String(body.newPassword)
    : ""
  if (!currentPassword || currentPassword.length > 256 || newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json({ error: "invalid-password" }, { status: 400 })
  }

  const [user] = await db.select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)
  if (!user?.passwordHash || !await verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "incorrect-current-password" }, { status: 400 })
  }

  await db.update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date().toISOString() })
    .where(eq(users.id, session.userId))
  await db.update(sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(
      eq(sessions.userId, session.userId),
      ne(sessions.id, session.sessionId),
      isNull(sessions.revokedAt),
    ))

  return NextResponse.json({ ok: true })
}
