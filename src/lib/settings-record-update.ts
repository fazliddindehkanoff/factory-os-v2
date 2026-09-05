import { PRODUCT_TITLE_MAX_LENGTH } from "./product-constraints.js"
import type { PermissionCode } from "@/lib/rbac"
import type { SettingsSection } from "./settings.js"

type SettingsRecordUpdate = {
  titleUz: string
  titleRu: string
  titleTr: string
  code?: string
  order?: number
  categoryId?: string
  permissions?: PermissionCode[]
  branchIds?: string[]
  responsibleUserId?: string
  warehouseIds?: string[]
}

type ParseResult =
  | { ok: true; value: SettingsRecordUpdate }
  | { ok: false; error: "invalid-record" }

function readString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length <= maxLength ? normalized : null
}

function readIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 500) return null
  const ids = value.map((item) => typeof item === "string" ? item.trim() : "")
  if (ids.some((id) => !id)) return null
  return [...new Set(ids)]
}

export function parseSettingsRecordUpdate(
  section: SettingsSection,
  value: unknown,
): ParseResult {
  if (!value || typeof value !== "object" || section === "users") {
    return { ok: false, error: "invalid-record" }
  }

  const source = value as Record<string, unknown>
  const maxTitleLength = section === "products" ? PRODUCT_TITLE_MAX_LENGTH : 500
  const titleUz = readString(source.titleUz, maxTitleLength)
  const titleRu = readString(source.titleRu, maxTitleLength)
  const titleTr = readString(source.titleTr, maxTitleLength)
  if (titleUz === null || titleRu === null || titleTr === null || ![titleUz, titleRu, titleTr].some(Boolean)) {
    return { ok: false, error: "invalid-record" }
  }
  const localized = { titleUz, titleRu, titleTr }

  if (["positions", "product-categories", "order-purposes", "branches"].includes(section)) {
    return { ok: true, value: localized }
  }

  if (section === "unit-types") {
    const code = readString(source.code, 100)
    const order = Number(source.order)
    return code && Number.isInteger(order) && order > 0
      ? { ok: true, value: { ...localized, code, order } }
      : { ok: false, error: "invalid-record" }
  }

  if (section === "products") {
    const code = readString(source.code, 100)
    const categoryId = readString(source.categoryId, 200)
    return code && categoryId
      ? { ok: true, value: { ...localized, code, categoryId } }
      : { ok: false, error: "invalid-record" }
  }

  if (section === "roles") {
    const code = readString(source.code, 100)
    const rawPermissions = readIds(source.permissions)
    return code && rawPermissions
      ? { ok: true, value: { ...localized, code, permissions: rawPermissions as PermissionCode[] } }
      : { ok: false, error: "invalid-record" }
  }

  if (section === "warehouses") {
    const branchIds = readIds(source.branchIds)
    const responsibleUserId = readString(source.responsibleUserId, 200)
    return branchIds && responsibleUserId !== null
      ? { ok: true, value: { ...localized, branchIds, responsibleUserId } }
      : { ok: false, error: "invalid-record" }
  }

  if (section === "departments") {
    const branchIds = readIds(source.branchIds)
    const warehouseIds = readIds(source.warehouseIds)
    return branchIds && warehouseIds
      ? { ok: true, value: { ...localized, branchIds, warehouseIds } }
      : { ok: false, error: "invalid-record" }
  }

  return { ok: false, error: "invalid-record" }
}

export function parseSettingsRecordOrder(value: unknown) {
  if (!value || typeof value !== "object") return null
  const ids = readIds((value as Record<string, unknown>).ids)
  return ids?.length ? ids : null
}
