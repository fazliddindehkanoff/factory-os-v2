export const procurementStages = [
  "awaiting_assignment",
  "collecting_offers",
  "head_review",
  "changes_requested",
  "approved",
] as const

export type ProcurementStage = (typeof procurementStages)[number]

export type SupplierStatus = "active" | "archived"

export type SupplierRecord = {
  id: string
  name: string
  inn: string
  phone: string
  email: string
  contactPerson: string
  category: string
  status: SupplierStatus
}

export type QuotationLineRecord = {
  orderLineId: string
  quantity: number
  unitPrice: number
  expectedDeliveryDate: string
  ndsIncluded: boolean
}

export type QuotationRecord = {
  id: string
  procurementCaseId: string
  supplierId: string
  supplierName: string
  supplierPhone: string
  lines: QuotationLineRecord[]
  amount: number
  selected: boolean
  createdByUserId: string
  createdAt: string
}

export type ProcurementCase = {
  id: string
  orderId: string
  assigneeId?: string
  stage: ProcurementStage
  reviewComment?: string
  updatedAt: string
}

export function calculateQuotationTotal(
  lines: readonly Pick<QuotationLineRecord, "quantity" | "unitPrice">[],
) {
  return lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0)
}

export function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isExpectedDeliveryDateAllowed(
  value: string,
  today = getLocalDateInputValue(),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(year, month - 1, day)
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day &&
    value >= today
  )
}

export function normalizeSupplierPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("00") ? digits.slice(2) : digits
}

export function supplierPhoneMatches(input: string, storedPhone: string) {
  const inputDigits = normalizeSupplierPhone(input)
  const storedDigits = normalizeSupplierPhone(storedPhone)
  if (inputDigits.length < 7) return false
  return input.trimStart().startsWith("+")
    ? storedDigits === inputDigits
    : storedDigits.endsWith(inputDigits)
}
