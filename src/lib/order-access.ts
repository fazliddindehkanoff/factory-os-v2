import { canReadOrder, type OrderRecord } from "@/lib/orders"
import { hasPermission } from "@/lib/rbac"
import type { SettingsData } from "@/lib/settings"

export function canReadOrderWithSettings(order: OrderRecord, userId: string, data: SettingsData) {
  const user = data.users.find((item) => item.id === userId)
  if (!user) return false
  const roles = data.roles.filter((role) => user.roleIds.includes(role.id))
  const headRoleIds = data.roles.filter((role) => role.code === "dept_head").map((role) => role.id)
  const applicant = data.users.find((item) => item.id === order.applicantId)
  const supervisor = applicant?.roleIds.some((id) => headRoleIds.includes(id)) ? applicant : data.users.find((item) => item.roleIds.some((id) => headRoleIds.includes(id)) && item.departmentIds.some((id) => order.departmentIds.includes(id)))
  return canReadOrder(order, { userId, canViewAll: hasPermission(roles, "requests.view"), canViewOwn: hasPermission(roles, "requests.view_own"), departmentIds: user.departmentIds, roleCodes: roles.map((role) => role.code), supervisorUserId: supervisor?.id })
}
