export const procurementStages = [
  "needs_quote",
  "comparing",
  "supplier_selected",
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

export type QuotationRecord = {
  id: string
  procurementCaseId: string
  supplierId: string
  amount: number
  ndsIncluded: boolean
  paymentTerms: string
  leadTimeDays: number
  selected: boolean
  createdAt: string
}

export type ProcurementCase = {
  id: string
  orderId: string
  assigneeId: string
  stage: ProcurementStage
  updatedAt: string
}
