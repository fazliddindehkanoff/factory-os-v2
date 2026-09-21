import "server-only"
import { eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import { appRecords, roles, userRoles } from "@/db/schema"
import { userHasPermission } from "@/lib/auth/authorization"
import { paymentsForOrder, type FinanceActor, type PaymentRequest } from "@/lib/finance-workflow"
import type { OrderRecord } from "@/lib/orders"

export const financeNamespace = "finance-payments"
export async function getFinanceActor(userId: string): Promise<FinanceActor> {
  const [roleRows, canView, canApprove, canReject, canPay] = await Promise.all([
    db.select({ code: roles.code }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId)),
    userHasPermission(userId, "finance.view"), userHasPermission(userId, "approvals.approve"),
    userHasPermission(userId, "approvals.reject"), userHasPermission(userId, "finance.mark_paid"),
  ])
  return { userId, roles: roleRows.map((role) => role.code), canView, canApprove, canReject, canPay }
}
type FinanceDb = Pick<typeof db, "select">
export async function loadFinance(executor: FinanceDb = db) {
  const rows = await executor.select().from(appRecords).where(inArray(appRecords.namespace, ["orders", financeNamespace]))
  const orders = rows.filter((row) => row.namespace === "orders").map((row) => ({ ...row, order: row.payload as unknown as OrderRecord }))
  const stored = new Map(rows.filter((row) => row.namespace === financeNamespace).map((row) => [row.id, row]))
  const payments = new Map<string, PaymentRequest>()
  for (const { order } of orders) for (const payment of paymentsForOrder(order)) payments.set(payment.id, payment)
  // Stored immutable financial snapshots survive any later changes to order display data.
  for (const row of stored.values()) payments.set(row.id, row.payload as unknown as PaymentRequest)
  return { orders, stored, payments }
}
