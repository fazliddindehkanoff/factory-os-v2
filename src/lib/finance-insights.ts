import type { PaymentRequest } from "./finance-workflow"

export type FinanceLifecycle = "unpaid" | "in_progress" | "closed" | "cancelled"
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export function financeInsights(payments: PaymentRequest[], today: string) {
  const groups = new Map<string, PaymentRequest[]>()
  for (const payment of payments) groups.set(payment.orderId, [...(groups.get(payment.orderId) ?? []), payment])
  const orders = new Map<string, FinanceLifecycle>()
  for (const [id, items] of groups) {
    // Cancellation may retain historical paid advances; those are not refunds.
    const state = items.some((item) => item.stage === "cancelled") ? "cancelled"
      : items.every((item) => item.stage === "paid") ? "closed"
      : items.some((item) => item.stage === "paid") ? "in_progress" : "unpaid"
    orders.set(id, state)
  }
  const outstanding = payments.filter((item) => !["paid", "cancelled"].includes(item.stage))
  const overdue = outstanding.filter((item) => item.dueDate && item.dueDate < today)
  const sum = (items: PaymentRequest[]) => money(items.reduce((total, item) => total + item.amount, 0))
  return { orders, outstanding: sum(outstanding), overdue: sum(overdue), overdueIds: new Set(overdue.map((item) => item.id)), paid: sum(payments.filter((item) => item.stage === "paid")) }
}
