import { NextResponse } from "next/server"

import { databaseClient } from "@/db/client"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import { isSettingsSection } from "@/lib/settings"
import {
  classifySettingsDeleteError,
  getSettingsDeletePermission,
  settingsDeleteTable,
  type SettingsDeleteError,
} from "@/lib/settings-delete"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function errorResponse(error: SettingsDeleteError, status: number) {
  return NextResponse.json({ error }, { status })
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/settings/records/[section]/[id]">,
) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { section, id } = await context.params
  if (!isSettingsSection(section) || !id) {
    return NextResponse.json({ error: "invalid-record" }, { status: 400 })
  }
  if (!await userHasPermission(session.userId, getSettingsDeletePermission(section))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (section === "users" && id === session.userId) {
    return errorResponse("cannot-delete-current-user", 409)
  }

  const table = settingsDeleteTable[section]
  if (section === "roles") {
    const role = await databaseClient.execute({
      sql: "SELECT is_system FROM roles WHERE id = ? LIMIT 1",
      args: [id],
    })
    if (role.rows[0]?.is_system) return errorResponse("protected-record", 409)
  }

  try {
    const result = await databaseClient.execute({
      sql: `DELETE FROM ${table} WHERE id = ?`,
      args: [id],
    })
    if (result.rowsAffected === 0) return errorResponse("record-not-found", 404)
  } catch (error) {
    const code = classifySettingsDeleteError(error)
    return errorResponse(code, code === "record-in-use" ? 409 : 500)
  }

  return NextResponse.json({ deleted: true, id, section })
}
