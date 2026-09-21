import type { OrderRecord } from "./orders"
import type { SettingsData } from "./settings"

export function parseOrderChanges(value: unknown, data: SettingsData) {
  if (!value || typeof value !== "object") return null
  const input = value as Partial<OrderRecord>
  const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === "string") && new Set(value).size === value.length
  if (!ids(input.departmentIds) || !ids(input.branchIds) || !["material", "service"].includes(input.type ?? "") || !["normal", "high", "urgent", "critical"].includes(input.urgency ?? "") || typeof input.applicantId !== "string" || typeof input.comment !== "string" || input.comment.length > 10000 || !input.expectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.expectedDate) || !Number.isFinite(Date.parse(input.expectedDate)) || new Date(input.expectedDate).toISOString().slice(0, 10) !== input.expectedDate || !data["order-purposes"].some((item) => item.id === input.purposeId)) return null
  const departments = data.departments.filter((item) => input.departmentIds!.includes(item.id))
  const warehouse = data.warehouses.find((item) => item.id === input.warehouseId)
  if (departments.length !== input.departmentIds.length || !input.branchIds.every((id) => departments.some((item) => item.branchIds.includes(id))) || !warehouse || !departments.some((item) => item.warehouseIds.includes(warehouse.id)) || !warehouse.branchIds.some((id) => input.branchIds!.includes(id))) return null
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 500 || new Set(input.lines.map((line) => line?.id)).size !== input.lines.length) return null
  if (input.lines.some((line) => !line || typeof line.id !== "string" || !line.id || !Number.isFinite(line.quantity) || line.quantity <= 0 || typeof line.note !== "string" || line.note.length > 10000 || !data.products.some((item) => item.id === line.productId) || !data["unit-types"].some((item) => item.id === line.unitTypeId))) return null
  if (!Array.isArray(input.attachments ?? []) || (input.attachments?.length ?? 0) > 20 || input.attachments?.some((file) => !file || typeof file.id !== "string" || typeof file.name !== "string" || typeof file.type !== "string" || !Number.isFinite(file.size) || file.size < 0)) return null
  return { type: input.type!, applicantId: input.applicantId, departmentIds: input.departmentIds, branchIds: input.branchIds, warehouseId: input.warehouseId!, purposeId: input.purposeId!, expectedDate: input.expectedDate, urgency: input.urgency!, comment: input.comment.trim(), lines: input.lines.map(({ id, productId, unitTypeId, quantity, note }) => ({ id, productId, unitTypeId, quantity, note })), attachments: input.attachments ?? [], attachmentNames: (input.attachments ?? []).map((item) => item.name) }
}
