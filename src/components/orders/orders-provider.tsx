"use client"

import * as React from "react"

import type { OrderRecord } from "@/lib/orders"

const initialOrders: OrderRecord[] = [
  {
    id: "order-2026-0012",
    number: "ORD-2026-0012",
    type: "material",
    applicantId: "user-admin",
    departmentIds: ["department-production"],
    branchIds: ["branch-tashkent"],
    warehouseId: "warehouse-main",
    purposeId: "purpose-production",
    expectedDate: "2026-08-22",
    urgency: "urgent",
    lines: [
      { id: "line-0012-1", productId: "product-steel", quantity: 500, note: "" },
      { id: "line-0012-2", productId: "product-copper-cable", quantity: 120, note: "" },
    ],
    comment: "Ishlab chiqarish liniyasi uchun.",
    attachmentNames: [],
    status: "warehouse_check",
    createdAt: "2026-08-20T09:30:00.000Z",
  },
  {
    id: "order-2026-0011",
    number: "ORD-2026-0011",
    type: "service",
    applicantId: "user-applicant",
    departmentIds: ["department-procurement"],
    branchIds: ["branch-samarkand"],
    warehouseId: "warehouse-samarkand",
    purposeId: "purpose-maintenance",
    expectedDate: "2026-08-29",
    urgency: "normal",
    lines: [{ id: "line-0011-1", productId: "product-copper-cable", quantity: 40, note: "Montaj bilan" }],
    comment: "",
    attachmentNames: ["technical-request.pdf"],
    status: "approved",
    createdAt: "2026-08-19T11:15:00.000Z",
  },
  {
    id: "order-2026-0010",
    number: "ORD-2026-0010",
    type: "material",
    applicantId: "user-applicant",
    departmentIds: ["department-production", "department-procurement"],
    branchIds: ["branch-tashkent", "branch-samarkand"],
    warehouseId: "warehouse-main",
    purposeId: "purpose-production",
    expectedDate: "2026-08-21",
    urgency: "critical",
    lines: [{ id: "line-0010-1", productId: "product-steel", quantity: 250, note: "Shoshilinch" }],
    comment: "",
    attachmentNames: [],
    status: "rejected",
    createdAt: "2026-08-18T08:00:00.000Z",
  },
]

type OrdersContextValue = {
  orders: OrderRecord[]
  addOrder: (order: Omit<OrderRecord, "id" | "number" | "createdAt" | "status">) => OrderRecord
  deleteOrders: (ids: string[]) => void
}

const OrdersContext = React.createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = React.useState(initialOrders)

  function addOrder(order: Omit<OrderRecord, "id" | "number" | "createdAt" | "status">) {
    const sequence = Math.max(0, ...orders.map((item) => Number(item.number.split("-").at(-1)))) + 1
    const record: OrderRecord = {
      ...order,
      id: `order-${crypto.randomUUID()}`,
      number: `ORD-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      status: "warehouse_check",
    }
    setOrders((current) => [record, ...current])
    return record
  }

  function deleteOrders(ids: string[]) {
    setOrders((current) => current.filter((order) => !ids.includes(order.id)))
  }

  return (
    <OrdersContext.Provider value={{ orders, addOrder, deleteOrders }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = React.useContext(OrdersContext)
  if (!context) throw new Error("useOrders must be used within OrdersProvider")
  return context
}
