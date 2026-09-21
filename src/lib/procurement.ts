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
  paymentMethod?: "bank" | "cash"
  orderLineId: string
  quantity: number
  unitPrice: number
  expectedDeliveryDate: string
  ndsIncluded: boolean
}

export type QuotationRecord = {
  id: string
  procurementCaseId: string
  procurementSuborderId?: string
  procurementSuborderNumber?: string
  supplierId: string
  supplierName: string
  supplierPhone: string
  lines: QuotationLineRecord[]
  amount: number
  selected: boolean
  /** Undefined means all lines when selected (legacy quotations). */
  selectedLineIds?: string[]
  createdByUserId: string
  createdAt: string
}

export type ProcurementCase = {
  id: string
  orderId: string
  assigneeId?: string
  assigneeIds?: string[]
  stage: ProcurementStage
  reviewComment?: string
  updatedAt: string
}

export function calculateQuotationTotal(
  lines: readonly Pick<QuotationLineRecord, "quantity" | "unitPrice">[],
) {
  return lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0)
}

type RequiredProcurementLine = {
  id: string
  quantity: number
  availableQuantity?: number
}

export function getRequiredProcurementQuantity(line: RequiredProcurementLine) {
  return Math.max(0, line.quantity - (line.availableQuantity ?? 0))
}

export function quotationLinesCoverRequirements(
  requiredLines: readonly RequiredProcurementLine[],
  quotationLines: readonly Pick<QuotationLineRecord, "orderLineId" | "quantity">[],
  mode: "at-least" | "exact" = "at-least",
) {
  const requirements = new Map(requiredLines.map((line) => [
    line.id,
    getRequiredProcurementQuantity(line),
  ]))
  const coverage = new Map<string, number>()
  for (const line of quotationLines) {
    const required = requirements.get(line.orderLineId)
    if (
      required === undefined ||
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      line.quantity > required
    ) return false
    coverage.set(line.orderLineId, (coverage.get(line.orderLineId) ?? 0) + line.quantity)
  }
  return requiredLines.every((line) => {
    const required = getRequiredProcurementQuantity(line)
    const quoted = coverage.get(line.id) ?? 0
    return mode === "exact"
      ? Math.abs(quoted - required) < 0.000_001
      : quoted + 0.000_001 >= required
  })
}

export function countCoveredProcurementLines(
  requiredLines: readonly RequiredProcurementLine[],
  quotationLines: readonly Pick<QuotationLineRecord, "orderLineId" | "quantity">[],
) {
  return requiredLines.filter((requiredLine) => quotationLinesCoverRequirements(
    [requiredLine],
    quotationLines.filter((quotationLine) => quotationLine.orderLineId === requiredLine.id),
  )).length
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
