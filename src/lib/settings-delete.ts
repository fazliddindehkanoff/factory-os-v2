import type { PermissionCode } from "@/lib/rbac"
import type { SettingsSection } from "@/lib/settings"

export const settingsDeleteTable = {
  positions: "positions",
  products: "products",
  "unit-types": "unit_types",
  "product-categories": "product_categories",
  "order-purposes": "order_purposes",
  roles: "roles",
  warehouses: "warehouses",
  departments: "departments",
  users: "users",
  branches: "branches",
} as const satisfies Record<SettingsSection, string>

export type SettingsDeleteError =
  | "cannot-delete-current-user"
  | "protected-record"
  | "record-in-use"
  | "record-not-found"
  | "delete-failed"

export function getSettingsDeletePermission(section: SettingsSection): PermissionCode {
  if (section === "roles") return "roles.manage"
  if (section === "users") return "users.manage"
  return "settings.manage"
}

export function classifySettingsDeleteError(error: unknown): SettingsDeleteError {
  const message = error instanceof Error ? error.message.toLocaleLowerCase() : ""
  return message.includes("foreign key constraint failed") ||
    message.includes("sqlite_constraint_foreignkey")
    ? "record-in-use"
    : "delete-failed"
}
