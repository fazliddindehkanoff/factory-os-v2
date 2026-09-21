import type { OrderRecord } from "./orders"
import type { OrderPaymentLine } from "./order-payment"

export type PaymentStage = "head_review" | "director_review" | "payment" | "returned" | "paid" | "cancelled"
export type PaymentAction = "approve" | "return" | "cancel" | "paid" | "resubmit"
export type FinanceActor = { userId: string; roles: string[]; canView: boolean; canApprove: boolean; canReject: boolean; canPay: boolean }
export type PaymentRequest = {
  id: string; orderId: string; orderNumber: string; supplierId: string; supplierName: string; supplierInn: string
  kind: "advance" | "balance"; amount: number; method: "bank" | "cash"; dueDate: string; contractNumber: string
  lines: (OrderPaymentLine & { productId?: string })[]; specialistUserId: string; relatedUserIds: string[]; createdAt: string
  stage: PaymentStage; revision: number; comment: string
  history: { action: PaymentAction; actorUserId: string; at: string; comment: string; from: PaymentStage; to: PaymentStage }[]
}
export const specialistRoles = ["procurement", "procurement_manager"]
export const financeRoles = ["finance", "finance_head", "finance_manager"]
export function hasFinanceAccess(roles: string[], canView: boolean) {
  return canView || roles.some((role) => [...specialistRoles, "procurement_head", "director"].includes(role))
}
export function canSeePayment(payment: PaymentRequest, actor: FinanceActor) {
  if (!hasFinanceAccess(actor.roles, actor.canView)) return false
  // A specialist's general finance.view grant must not reveal colleagues' payments.
  const unrestricted = actor.roles.some((role) => ["procurement_head", "director", ...financeRoles, "accountant", "owner", "admin"].includes(role))
  if (!unrestricted && actor.roles.some((role) => specialistRoles.includes(role))) return payment.relatedUserIds.includes(actor.userId)
  return true
}
export function paymentActions(payment: PaymentRequest, actor: FinanceActor): PaymentAction[] {
  if (!canSeePayment(payment, actor)) return []
  if (payment.stage === "returned" && payment.specialistUserId === actor.userId && actor.roles.some((role) => specialistRoles.includes(role))) return ["resubmit"]
  if (payment.stage === "payment" && actor.canPay && actor.roles.some((role) => financeRoles.includes(role))) return ["paid"]
  if ((payment.stage === "head_review" && actor.roles.includes("procurement_head")) ||
      (payment.stage === "director_review" && actor.roles.includes("director"))) {
    return [...(actor.canApprove ? ["approve" as const] : []), ...(actor.canReject ? ["return" as const, "cancel" as const] : [])]
  }
  return []
}
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

/** Deterministic IDs also surface placements made before the finance feature, without a write on GET. */
export function paymentsForOrder(order: OrderRecord): PaymentRequest[] {
  if (!order.placement || order.procurementSplit) return []
  const groups = new Map<string, OrderPaymentLine[]>()
  for (const line of order.placement.lines) {
    if (!Number.isFinite(line.amount) || line.amount <= 0 || !Number.isFinite(line.prepaidAmount) || line.prepaidAmount < 0 || line.prepaidAmount > line.amount) continue
    const key = JSON.stringify([order.id, line.supplierId, line.placedAt ?? order.placement.createdAt,
      line.placedByUserId ?? order.placement.createdByUserId, line.method, line.dueDate, line.contractNumber])
    groups.set(key, [...(groups.get(key) ?? []), line])
  }
  return [...groups.entries()].flatMap(([key, lines]) => {
    const first = lines[0]
    const specialistUserId = first.placedByUserId ?? order.placement!.createdByUserId
    return (["advance", "balance"] as const).flatMap((kind) => {
      const amount = money(lines.reduce((sum, line) => sum + (kind === "advance" ? line.prepaidAmount : money(line.amount - line.prepaidAmount)), 0))
      if (amount <= 0) return []
      return [{ id: `payment:${key}:${kind}`, orderId: order.id, orderNumber: order.number,
        supplierId: first.supplierId, supplierName: first.supplierName, supplierInn: first.supplierInn ?? "",
        kind, amount, method: first.method, dueDate: kind === "advance" ? "" : first.dueDate, contractNumber: first.contractNumber,
        lines: lines.filter((line) => kind === "advance" ? line.prepaidAmount > 0 : line.amount > line.prepaidAmount)
          .map((line) => ({ ...line, productId: order.lines.find((source) => source.id === line.orderLineId)?.productId })),
        specialistUserId, relatedUserIds: [...new Set([specialistUserId, order.procurementSpecialistUserId,
          ...lines.map((line) => order.procurementLineAssignments?.[line.orderLineId])].filter((id): id is string => Boolean(id)))],
        createdAt: first.placedAt ?? order.placement!.createdAt, stage: order.status === "rejected" ? "cancelled" as const : "head_review" as const,
        revision: 0, comment: "", history: [] }]
    })
  })
}

export type PaymentCorrection = { method: "bank" | "cash"; dueDate: string; contractNumber: string }
export function transitionPayment(payment: PaymentRequest, actor: FinanceActor, action: PaymentAction, comment: string, now: string, correction?: PaymentCorrection): PaymentRequest {
  if (!paymentActions(payment, actor).includes(action)) throw new Error("forbidden-action")
  if (typeof comment !== "string" || comment.length > 2000 || (["return", "cancel", "resubmit"].includes(action) && !comment.trim())) throw new Error("comment-required")
  let changes: Partial<PaymentRequest> = {}
  if (action === "resubmit") {
    if (!correction || !["bank", "cash"].includes(correction.method) || typeof correction.contractNumber !== "string" || correction.contractNumber.length > 150 ||
      typeof correction.dueDate !== "string" || (!correction.dueDate && payment.kind === "balance") || (correction.dueDate &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(correction.dueDate) || !Number.isFinite(Date.parse(correction.dueDate)) || new Date(correction.dueDate).toISOString().slice(0, 10) !== correction.dueDate))) throw new Error("invalid-correction")
    changes = { method: correction.method, dueDate: correction.dueDate, contractNumber: correction.contractNumber.trim() }
  }
  const stage: PaymentStage = action === "approve" ? payment.stage === "head_review" ? "director_review" : "payment"
    : action === "return" ? "returned" : action === "cancel" ? "cancelled" : action === "resubmit" ? "head_review" : "paid"
  return { ...payment, ...changes, stage, revision: payment.revision + 1, comment: comment.trim(),
    history: [...payment.history, { action, actorUserId: actor.userId, at: now, comment: comment.trim(), from: payment.stage, to: stage }] }
}

export function cancelFinanceOrder(order: OrderRecord, actorUserId: string, now: string, comment: string): OrderRecord {
  return { ...order, status: "rejected", currentStep: "complete", waitingForUserId: undefined, lastActorUserId: actorUserId,
    financeCancellation: { actorUserId, createdAt: now, comment },
    procurementProgress: Object.fromEntries(order.lines.filter((line) => line.fulfillmentStatus === "needs_procurement").map((line) => [line.id, { step: "complete", rejected: true }])),
    workflowHistory: [...(order.workflowHistory ?? []), { step: "procurement_order", action: "rejected", actorUserId, createdAt: now }] }
}
