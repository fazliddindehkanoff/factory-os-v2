import { eq, ne } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { users } from "@/db/schema"
import { getSessionUser } from "@/lib/auth/session"
import { parseProfileUpdateInput } from "@/lib/profile-input"
import { normalizePhoneNumber } from "@/lib/telegram-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-profile" }, { status: 400 })
  }

  const parsed = parseProfileUpdateInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const input = parsed.value
  const otherUsers = await db.select({
    username: users.username,
    phoneNumber: users.phoneNumber,
  })
    .from(users)
    .where(ne(users.id, session.userId))

  if (otherUsers.some((user) => user.username.toLocaleLowerCase() === input.username)) {
    return NextResponse.json({ error: "username-exists" }, { status: 409 })
  }
  if (
    input.phoneNumber &&
    otherUsers.some((user) => normalizePhoneNumber(user.phoneNumber ?? "") === normalizePhoneNumber(input.phoneNumber))
  ) {
    return NextResponse.json({ error: "phone-exists" }, { status: 409 })
  }

  try {
    await db.update(users)
      .set({
        fullName: input.fullName,
        username: input.username,
        phoneNumber: input.phoneNumber || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, session.userId))
  } catch (error) {
    const message = error instanceof Error ? error.message.toLocaleLowerCase() : ""
    if (message.includes("unique constraint failed: users.username")) {
      return NextResponse.json({ error: "username-exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "profile-update-failed" }, { status: 500 })
  }

  return NextResponse.json({ profile: input })
}
