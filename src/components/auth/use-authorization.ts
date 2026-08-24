"use client"

import { useSettings } from "@/components/settings/settings-provider"
import {
  hasAnyPermission,
  hasPermission,
  type PermissionCode,
} from "@/lib/rbac"
import type { SettingsSection } from "@/lib/settings"

const orderViewPermissions: PermissionCode[] = ["requests.view", "requests.view_own"]
const dashboardPermissions: PermissionCode[] = [
  "reports.status_summary",
  "reports.view",
  "requests.view",
  "requests.view_own",
]

export function useAuthorization() {
  const { data, currentUserId, setCurrentUserId } = useSettings()
  const currentUser = data.users.find((user) => user.id === currentUserId) ?? data.users[0]
  const roles = data.roles.filter((role) => currentUser?.roleIds.includes(role.id))
  const can = (permission: PermissionCode) => hasPermission(roles, permission)
  const canAny = (permissions: readonly PermissionCode[]) => hasAnyPermission(roles, permissions)

  function canViewSettingsSection(section: SettingsSection) {
    if (section === "roles") return can("roles.manage")
    if (section === "users") return canAny(["users.view", "users.manage"])
    return can("settings.manage")
  }

  function canManageSettingsSection(section: SettingsSection) {
    if (section === "roles") return can("roles.manage")
    if (section === "users") return can("users.manage")
    return can("settings.manage")
  }

  return {
    currentUser,
    currentUserId,
    roles,
    setCurrentUserId,
    can,
    canAny,
    canAccessDashboard: canAny(dashboardPermissions),
    canViewOrders: canAny(orderViewPermissions),
    canViewSettingsSection,
    canManageSettingsSection,
  }
}
