import { and, eq, inArray, isNull, ne } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import {
  departments,
  positions,
  roles,
  sessions,
  userDepartments,
  userRoles,
  users,
} from "@/db/schema"
import { userHasPermission } from "@/lib/auth/authorization"
import { hashPassword } from "@/lib/auth/password"
import { getSessionUser } from "@/lib/auth/session"
import { parseSettingsUserUpdateInput } from "@/lib/settings-user-input"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/settings/users/[id]">,
) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!await userHasPermission(session.userId, "users.manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-user" }, { status: 400 })
  }

  const parsed = parseSettingsUserUpdateInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const input = parsed.value

  const [existingUser, matchingPosition, matchingRoles, matchingDepartments] = await Promise.all([
    db.select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.id, id), eq(users.isActive, true)))
      .limit(1),
    db.select({ id: positions.id }).from(positions).where(eq(positions.id, input.positionId)).limit(1),
    input.roleIds.length
      ? db.select({ id: roles.id }).from(roles).where(inArray(roles.id, input.roleIds))
      : Promise.resolve([]),
    input.departmentIds.length
      ? db.select({ id: departments.id }).from(departments).where(inArray(departments.id, input.departmentIds))
      : Promise.resolve([]),
  ])

  if (!existingUser.length) return NextResponse.json({ error: "user-not-found" }, { status: 404 })
  if (
    !matchingPosition.length ||
    matchingRoles.length !== input.roleIds.length ||
    matchingDepartments.length !== input.departmentIds.length
  ) {
    return NextResponse.json({ error: "invalid-user" }, { status: 400 })
  }

  const passwordHash = input.password ? await hashPassword(input.password) : undefined
  const updatedAt = new Date().toISOString()

  try {
    await db.transaction(async (transaction) => {
      await transaction.update(users)
        .set({
          fullName: input.fullName,
          positionId: input.positionId,
          username: input.username,
          ...(passwordHash ? { passwordHash } : {}),
          telegramChatId: input.telegramChatId || null,
          phoneNumber: input.phoneNumber || null,
          updatedAt,
        })
        .where(eq(users.id, id))

      await transaction.delete(userRoles).where(eq(userRoles.userId, id))
      if (input.roleIds.length) {
        await transaction.insert(userRoles).values(
          input.roleIds.map((roleId) => ({ userId: id, roleId })),
        )
      }

      await transaction.delete(userDepartments).where(eq(userDepartments.userId, id))
      if (input.departmentIds.length) {
        await transaction.insert(userDepartments).values(
          input.departmentIds.map((departmentId) => ({ userId: id, departmentId })),
        )
      }

      if (passwordHash) {
        await transaction.update(sessions)
          .set({ revokedAt: updatedAt })
          .where(id === session.userId
            ? and(eq(sessions.userId, id), ne(sessions.id, session.sessionId), isNull(sessions.revokedAt))
            : and(eq(sessions.userId, id), isNull(sessions.revokedAt)))
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.toLocaleLowerCase() : ""
    if (message.includes("unique constraint failed: users.username")) {
      return NextResponse.json({ error: "username-exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "user-update-failed" }, { status: 500 })
  }

  return NextResponse.json({
    user: {
      id,
      fullName: input.fullName,
      positionId: input.positionId,
      username: input.username,
      password: existingUser[0].passwordHash || passwordHash ? "••••••••" : "",
      telegramChatId: input.telegramChatId,
      phoneNumber: input.phoneNumber,
      departmentIds: input.departmentIds,
      roleIds: input.roleIds,
    },
  })
}
