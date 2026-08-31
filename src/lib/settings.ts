import type { Locale, Messages } from "@/lib/i18n"
import type { PermissionCode } from "@/lib/rbac"

export const settingsSections = [
  "positions",
  "products",
  "unit-types",
  "product-categories",
  "order-purposes",
  "roles",
  "warehouses",
  "departments",
  "users",
  "branches",
] as const

export type SettingsSection = (typeof settingsSections)[number]

export type LocalizedTitle = {
  titleUz: string
  titleRu: string
  titleTr: string
}

export type BaseRecord = LocalizedTitle & { id: string }
export type Position = BaseRecord
export type ProductCategory = BaseRecord
export type OrderPurpose = BaseRecord
export type Branch = BaseRecord
export type UnitType = BaseRecord & { code: string; order: number }
export type Product = BaseRecord & {
  code: string
  categoryId: string
  unitTypeId?: string
}
export type Role = BaseRecord & {
  code: string
  permissions: PermissionCode[]
  isSystem: boolean
  grantsAll?: boolean
}
export type Warehouse = BaseRecord & {
  branchIds: string[]
  responsibleUserId: string
}
export type Department = BaseRecord & {
  branchIds: string[]
  warehouseIds: string[]
}
export type UserRecord = {
  id: string
  fullName: string
  positionId: string
  username: string
  password: string
  telegramChatId: string
  phoneNumber: string
  departmentIds: string[]
  roleIds: string[]
}

export type SettingsData = {
  positions: Position[]
  products: Product[]
  "unit-types": UnitType[]
  "product-categories": ProductCategory[]
  "order-purposes": OrderPurpose[]
  roles: Role[]
  warehouses: Warehouse[]
  departments: Department[]
  users: UserRecord[]
  branches: Branch[]
}

export function isSettingsSection(value: string): value is SettingsSection {
  return settingsSections.includes(value as SettingsSection)
}

export function getSectionTitle(section: SettingsSection, messages: Messages) {
  const titles: Record<SettingsSection, string> = {
    positions: messages.positions,
    products: messages.productList,
    "unit-types": messages.unitTypes,
    "product-categories": messages.productCategories,
    "order-purposes": messages.orderPurposes,
    roles: messages.roles,
    warehouses: messages.warehouses,
    departments: messages.departments,
    users: messages.users,
    branches: messages.branches,
  }
  return titles[section]
}

export function getLocalizedTitle(item: LocalizedTitle, locale: Locale) {
  if (locale === "ru") return item.titleRu
  if (locale === "tr") return item.titleTr
  return item.titleUz
}
