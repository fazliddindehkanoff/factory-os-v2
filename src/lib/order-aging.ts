import type { OrderRecord } from "./orders"

/** Age measures elapsed days since creation, not lateness against a promised date. */
export function orderAging(orders: OrderRecord[], now: number) {
  const active = orders.filter((order) => order.currentStep !== "complete" && !["rejected", "draft"].includes(order.status))
  const buckets = [0, 0, 0, 0]
  for (const order of active) {
    const created = Date.parse(order.createdAt)
    if (!Number.isFinite(created)) continue
    const days = Math.max(0, Math.floor((now - created) / 86400000))
    buckets[days <= 3 ? 0 : days <= 7 ? 1 : days <= 14 ? 2 : 3]++
  }
  return { buckets, oldest: [...active].filter((order) => Number.isFinite(Date.parse(order.createdAt))).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 3) }
}
