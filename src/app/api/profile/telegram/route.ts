import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { users } from "@/db/schema"
import { getSessionUser } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  await db.update(users)
    .set({ telegramChatId: null, updatedAt: new Date().toISOString() })
    .where(eq(users.id, session.userId))

  return NextResponse.json({ ok: true })
}
