import type { OrderRecord, OrderAttachment } from "./orders"
import type { QuotationRecord } from "./procurement"

export type OrderPaymentInput = {
  supplierInn?: string
  quotationId: string
  orderLineId: string
  method: "bank" | "cash"
  prepaidAmount: number
  dueDate: string
  contractNumber: string
}
export type OrderPaymentLine = OrderPaymentInput & {
  placedAt?: string
  placedByUserId?: string
  supplierId: string
  supplierName: string
  quantity: number
  unitPrice: number
  amount: number
  prepaidPercent: number
  contract?: OrderAttachment
}
export type OrderPlacement = {
  createdAt: string
  createdByUserId: string
  lines: OrderPaymentLine[]
}

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export const paymentLineKey = (line: Pick<OrderPaymentInput, "quotationId" | "orderLineId">) => JSON.stringify([line.quotationId, line.orderLineId])

// Payment terms belong to a supplier's accepted position, not to the whole parent order.
export function approvedPaymentLines(order: OrderRecord, quotes: QuotationRecord[]): OrderPaymentLine[] {
  const eligible = new Set(order.lines.filter((line) => (order.procurementProgress?.[line.id]?.step ?? order.currentStep) === "procurement_order").map((line) => line.id))
  const placed = new Set(order.placement?.lines.map(paymentLineKey) ?? [])
  return quotes.filter((quote) => quote.selected && quote.procurementCaseId === `procurement-${order.id}`)
    .flatMap((quote) => quote.lines.filter((line) => eligible.has(line.orderLineId) &&
      (!quote.selectedLineIds || quote.selectedLineIds.includes(line.orderLineId)) &&
      !placed.has(paymentLineKey({ quotationId: quote.id, orderLineId: line.orderLineId }))).map((line) => ({
      quotationId: quote.id, orderLineId: line.orderLineId,
      supplierId: quote.supplierId, supplierName: quote.supplierName,
      quantity: line.quantity, unitPrice: line.unitPrice, amount: roundMoney(line.quantity * line.unitPrice),
      method: line.paymentMethod ?? "bank", prepaidAmount: 0, prepaidPercent: 0, dueDate: "", contractNumber: "",
    })))
}

export function validateOrderPayments(order: OrderRecord, quotes: QuotationRecord[], input: unknown): OrderPaymentLine[] {
  if (!Array.isArray(input) || !input.length) throw new Error("payment-lines-required")
  const selectedIds = new Set(input.map((item: unknown) => item && typeof item === "object" ? (item as OrderPaymentInput).orderLineId : undefined))
  const expected = approvedPaymentLines(order, quotes).filter((line) => selectedIds.has(line.orderLineId))
  const required = order.lines.filter((line) => selectedIds.has(line.id) && line.fulfillmentStatus === "needs_procurement" && line.quantity > (line.availableQuantity ?? 0))
  if (selectedIds.size !== required.length) throw new Error("invalid-payment-position")
  if (!expected.length || expected.some((line) => !required.some((item) => item.id === line.orderLineId) ||
    !Number.isFinite(line.amount) || line.amount <= 0 || !Number.isFinite(line.quantity) || line.quantity <= 0) ||
    required.some((line) => Math.abs(expected.filter((item) => item.orderLineId === line.id).reduce((sum, item) => sum + item.quantity, 0) - (line.quantity - (line.availableQuantity ?? 0))) > 0.000001)) {
    throw new Error("approved-offers-incomplete")
  }
  if (!Array.isArray(input) || input.length !== expected.length) throw new Error("payment-lines-required")
  const seen = new Set<string>()
  return input.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("invalid-payment")
    const item = value as OrderPaymentInput
    const key = paymentLineKey(item)
    const source = expected.find((line) => paymentLineKey(line) === key)
    if (!source || seen.has(key)) throw new Error("invalid-payment-position")
    seen.add(key)
    if (item.method !== "bank" && item.method !== "cash") throw new Error("invalid-payment-method")
    if (typeof item.prepaidAmount !== "number" || !Number.isFinite(item.prepaidAmount) || item.prepaidAmount < 0 || item.prepaidAmount > source.amount || Math.abs(roundMoney(item.prepaidAmount) - item.prepaidAmount) > 0.000001) throw new Error("invalid-prepayment")
    if (typeof item.dueDate !== "string" || (item.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) || !Number.isFinite(Date.parse(item.dueDate)) || new Date(item.dueDate).toISOString().slice(0, 10) !== item.dueDate))) throw new Error("invalid-payment-date")
    if (item.prepaidAmount < source.amount && !item.dueDate) throw new Error("payment-date-required")
    if (typeof item.contractNumber !== "string" || item.contractNumber.length > 150) throw new Error("invalid-contract-number")
    return { ...source, method: item.method, prepaidAmount: item.prepaidAmount, supplierInn: item.supplierInn,
      prepaidPercent: roundMoney(item.prepaidAmount / source.amount * 100), dueDate: item.dueDate, contractNumber: item.contractNumber.trim() }
  })
}
