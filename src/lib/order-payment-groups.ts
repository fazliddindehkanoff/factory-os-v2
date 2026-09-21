import type { OrderPaymentLine } from "./order-payment"

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export type SupplierPaymentGroup = {
  supplierId: string
  supplierName: string
  lines: OrderPaymentLine[]
  amount: number
  method: "bank" | "cash" | "original"
  supplierInn: string
  innLocked: boolean
  prepaidPercent: number
  prepaidAmount: number
  dueDate: string
  contractNumber: string
}

export function groupPaymentLines(lines: OrderPaymentLine[]): SupplierPaymentGroup[] {
  const groups = new Map<string, SupplierPaymentGroup>()
  for (const line of lines) {
    let group = groups.get(line.supplierId)
    if (!group) {
      group = { supplierId: line.supplierId, supplierName: line.supplierName, lines: [], amount: 0,
        method: line.method, supplierInn: "", innLocked: false, prepaidPercent: 0, prepaidAmount: 0, dueDate: "", contractNumber: "" }
      groups.set(line.supplierId, group)
    }
    group.lines.push(line)
    group.amount = roundMoney(group.amount + line.amount)
    if (group.method !== line.method) group.method = "original"
  }
  return [...groups.values()]
}

/** Allocate a supplier-level advance in cents without losing rounding remainders. */
export function expandPaymentGroups(groups: SupplierPaymentGroup[]): OrderPaymentLine[] {
  return groups.flatMap((group) => {
    if (!Number.isFinite(group.prepaidAmount) || group.prepaidAmount < 0 || group.prepaidAmount > group.amount || Math.abs(roundMoney(group.prepaidAmount) - group.prepaidAmount) > 0.000001) throw new Error("invalid-prepayment")
    let allocatedCents = 0
    let cumulativeAmount = 0
    const totalCents = Math.round(group.prepaidAmount * 100)
    return group.lines.map((line, index) => {
      cumulativeAmount = roundMoney(cumulativeAmount + line.amount)
      const cumulativeCents = index === group.lines.length - 1 ? totalCents : Math.round(totalCents * cumulativeAmount / group.amount)
      const prepaidAmount = (cumulativeCents - allocatedCents) / 100
      allocatedCents = cumulativeCents
      return { ...line, supplierInn: group.supplierInn.trim(), method: group.method === "original" ? line.method : group.method,
        prepaidAmount, prepaidPercent: roundMoney(prepaidAmount / line.amount * 100), dueDate: group.dueDate, contractNumber: group.contractNumber }
    })
  })
}
