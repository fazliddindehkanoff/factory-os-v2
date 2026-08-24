import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { rolePermissions, roles, userRoles } from "@/db/schema"
import type { PermissionCode } from "@/lib/rbac"

export async function userHasPermission(userId: string, permission: PermissionCode) {
  const grants = await db.select({
    grantsAll: roles.grantsAll,
    permissionCode: rolePermissions.permissionCode,
  })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .where(eq(userRoles.userId, userId))

  return grants.some(
    (grant) => grant.grantsAll || grant.permissionCode === permission,
  )
}
