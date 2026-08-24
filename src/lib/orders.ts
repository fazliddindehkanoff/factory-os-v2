export type OrderType = "material" | "service"
export type OrderStatus = "warehouse_check" | "approved" | "rejected" | "draft"
export type UrgencyLevel = "normal" | "high" | "urgent" | "critical"

export type OrderLineRecord = {
  id: string
  productId: string
  quantity: number
  note: string
}

export type OrderRecord = {
  id: string
  number: string
  type: OrderType
  applicantId: string
  departmentIds: string[]
  branchIds: string[]
  warehouseId: string
  purposeId: string
  expectedDate: string
  urgency: UrgencyLevel
  lines: OrderLineRecord[]
  comment: string
  attachmentNames: string[]
  status: OrderStatus
  createdAt: string
}
