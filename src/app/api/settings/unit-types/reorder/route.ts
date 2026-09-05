import { NextResponse } from "next/server"

import { databaseClient } from "@/db/client"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import { parseSettingsRecordOrder } from "@/lib/settings-record-update"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!await userHasPermission(session.userId, "settings.manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-order" }, { status: 400 })
  }
  const ids = parseSettingsRecordOrder(body)
  if (!ids) return NextResponse.json({ error: "invalid-order" }, { status: 400 })

  const placeholders = ids.map(() => "?").join(", ")
  const existing = await databaseClient.execute({
    sql: `SELECT id FROM unit_types WHERE id IN (${placeholders})`,
    args: ids,
  })
  const total = await databaseClient.execute("SELECT count(*) AS count FROM unit_types")
  if (existing.rows.length !== ids.length || Number(total.rows[0]?.count) !== ids.length) {
    return NextResponse.json({ error: "invalid-order" }, { status: 400 })
  }

  await databaseClient.batch(ids.map((id, index) => ({
    sql: "UPDATE unit_types SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [index + 1, id],
  })), "write")

  return NextResponse.json({ updated: ids.length })
}
