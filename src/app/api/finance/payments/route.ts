import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/db/client"
import { appRecords, auditEvents } from "@/db/schema"
import { getSessionUser } from "@/lib/auth/session"
import { cancelFinanceOrder, canSeePayment, hasFinanceAccess, transitionPayment, type PaymentAction, type PaymentCorrection } from "@/lib/finance-workflow"
import { financeNamespace, getFinanceActor, loadFinance } from "@/lib/server-finance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const actor = await getFinanceActor(session.userId)
  if (!hasFinanceAccess(actor.roles, actor.canView)) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const { payments } = await loadFinance()
  return NextResponse.json({ payments: [...payments.values()].filter((payment) => canSeePayment(payment, actor)), actor }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const actor = await getFinanceActor(session.userId)
  if (!hasFinanceAccess(actor.roles, actor.canView)) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  let body: { action: PaymentAction; items: { id: string; revision: number }[]; comment: string; correction?: PaymentCorrection }
  try { body = await request.json() } catch { return NextResponse.json({ error: "invalid-request" }, { status: 400 }) }
  if (!body || !["approve", "return", "cancel", "paid", "resubmit"].includes(body.action) || !Array.isArray(body.items) || !body.items.length || body.items.length > 200 ||
    body.items.some((item) => !item || typeof item.id !== "string" || item.id.length > 3000 || !Number.isInteger(item.revision) || item.revision < 0) ||
    new Set(body.items.map((item) => item.id)).size !== body.items.length || (body.action === "resubmit" && body.items.length !== 1)) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }
  try {
    await db.transaction(async (tx) => {
      const { orders, stored, payments } = await loadFinance(tx)
      const now = new Date().toISOString()
      const updates = new Map<string, ReturnType<typeof transitionPayment>>()
      for (const item of body.items) {
        const payment = payments.get(item.id)
        if (!payment || !canSeePayment(payment, actor)) throw new Error("forbidden-action")
        if (payment.revision !== item.revision) throw new Error("payment-changed")
        const sourceOrder = orders.find((row) => row.id === payment.orderId)
        if (!sourceOrder || sourceOrder.order.status === "rejected") throw new Error("order-cancelled")
        updates.set(payment.id, transitionPayment(payment, actor, body.action, body.comment ?? "", now, body.correction))
      }
      if (body.action === "cancel") {
        for (const orderId of new Set([...updates.values()].map((payment) => payment.orderId))) {
          const row = orders.find((row) => row.id === orderId)!
          const order = cancelFinanceOrder(row.order, actor.userId, now, body.comment.trim())
          const changed = await tx.update(appRecords).set({ payload: order as unknown as Record<string, unknown>, updatedAt: now })
            .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, orderId), eq(appRecords.updatedAt, row.updatedAt)))
          if (changed.rowsAffected !== 1) throw new Error("payment-changed")
          // Cancel all outstanding sibling payments for this exact child order, never its parent or other children.
          // Historical paid requests stay paid: cancellation is not a refund.
          for (const payment of payments.values()) if (payment.orderId === orderId && !["paid", "cancelled"].includes(payment.stage) && !updates.has(payment.id)) {
            updates.set(payment.id, { ...payment, stage: "cancelled", revision: payment.revision + 1, comment: body.comment.trim(),
              history: [...payment.history, { action: "cancel", from: payment.stage, to: "cancelled", actorUserId: actor.userId, at: now, comment: body.comment.trim() }] })
          }
          await tx.insert(auditEvents).values({ id: randomUUID(), actorUserId: actor.userId, action: "order.finance_cancelled", entityType: "order", entityId: orderId, metadata: { comment: body.comment.trim() } })
        }
      }
      for (const payment of updates.values()) {
        const row = stored.get(payment.id)
        const payload = payment as unknown as Record<string, unknown>
        if (row) {
          const changed = await tx.update(appRecords).set({ payload, updatedAt: now })
            .where(and(eq(appRecords.namespace, financeNamespace), eq(appRecords.id, payment.id), eq(appRecords.updatedAt, row.updatedAt)))
          if (changed.rowsAffected !== 1) throw new Error("payment-changed")
        } else await tx.insert(appRecords).values({ namespace: financeNamespace, id: payment.id, payload, createdByUserId: actor.userId, updatedAt: now })
        await tx.insert(auditEvents).values({ id: randomUUID(), actorUserId: actor.userId, action: `finance.${payment.history.at(-1)!.action}`, entityType: "finance-payment", entityId: payment.id,
          metadata: { orderId: payment.orderId, amount: payment.amount, revision: payment.revision, from: payment.history.at(-1)!.from, to: payment.stage, comment: payment.comment } })
      }
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : "save-failed"
    const status = reason === "forbidden-action" ? 403 : ["payment-changed", "order-cancelled"].includes(reason) ? 409 : ["comment-required", "invalid-correction"].includes(reason) ? 400 : 500
    return NextResponse.json({ error: status === 500 ? "save-failed" : reason }, { status })
  }
  return NextResponse.json({ ok: true })
}
