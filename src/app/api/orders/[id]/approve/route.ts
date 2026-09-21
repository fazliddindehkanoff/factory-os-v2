import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import {
  appRecords,
  auditEvents,
  roles,
  userRoles,
  users,
  warehouses,
} from "@/db/schema"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import { validateOrderPayments } from "@/lib/order-payment"
import { readOrderPaymentForm } from "@/lib/order-payment-form"
import { paymentsForOrder } from "@/lib/finance-workflow"
import type { QuotationRecord } from "@/lib/procurement"
import {
  buildApprovedOrder,
  advanceProcurementLines,
  getOrderActionView,
  getProcurementLinesAtStep,
  getAssignedProcurementLineIds,
  getNextWorkflowStep,
  getProcurementSpecialistIds,
  workflowSteps,
  type OrderRecord,
  type WorkflowStep,
} from "@/lib/orders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const validWorkflowSteps = new Set<WorkflowStep>([
  ...workflowSteps,
  "procurement_supervisor",
  "warehouse_supervisor",
  "complete",
])

function isOrderRecord(value: unknown): value is OrderRecord {
  if (!value || typeof value !== "object") return false
  const order = value as Partial<OrderRecord>
  return (
    typeof order.id === "string" &&
    typeof order.number === "string" &&
    typeof order.currentStep === "string" &&
    validWorkflowSteps.has(order.currentStep as WorkflowStep) &&
    typeof order.waitingForUserId === "string" &&
    typeof order.warehouseId === "string" &&
    Array.isArray(order.workflowHistory ?? [])
  )
}

async function firstActiveUserWithRole(roleCode: string) {
  const [assignee] = await db.select({ id: users.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(roles.code, roleCode), eq(users.isActive, true)))
    .limit(1)
  return assignee?.id
}

async function activeUser(userId: string | undefined) {
  if (!userId) return undefined
  const [assignee] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1)
  return assignee?.id
}

async function resolveAssignee(step: WorkflowStep, order: OrderRecord) {
  if (step === "complete") return undefined
  if (["warehouse", "warehouse_receipt"].includes(step)) {
    const [warehouse] = await db.select({ userId: warehouses.responsibleUserId })
      .from(warehouses)
      .where(eq(warehouses.id, order.warehouseId))
      .limit(1)
    return activeUser(warehouse?.userId ?? undefined)
  }
  if (["sourcing", "procurement_order"].includes(step)) {
    return await activeUser(getProcurementSpecialistIds(order)[0]) ??
      firstActiveUserWithRole("procurement_manager")
  }
  const roleByStep: Partial<Record<WorkflowStep, string>> = {
    chief_engineer: "deputy_director",
    procurement_accept: "procurement_head",
    price_check: "procurement_head",
    director: "director",
  }
  const roleCode = roleByStep[step]
  return roleCode ? firstActiveUserWithRole(roleCode) : undefined
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/orders/[id]/approve">,
) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await context.params
  if (!id || id.length > 200) {
    return NextResponse.json({ error: "invalid-order" }, { status: 400 })
  }

  const [row] = await db.select({ payload: appRecords.payload, updatedAt: appRecords.updatedAt })
    .from(appRecords)
    .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, id)))
    .limit(1)
  if (!row || !isOrderRecord(row.payload)) {
    return NextResponse.json({ error: "order-not-found" }, { status: 404 })
  }

  const storedOrder = row.payload
  if (storedOrder.archivedAt) return NextResponse.json({ error: "order-not-found" }, { status: 404 })
  const wantsPlacement = request.headers.get("content-type")?.startsWith("multipart/form-data")
  if (wantsPlacement && !getProcurementLinesAtStep(storedOrder, "procurement_order", session.userId).length) {
    return NextResponse.json({ error: "not-current-assignee" }, { status: 403 })
  }
  const order: OrderRecord = wantsPlacement ? { ...storedOrder, currentStep: "procurement_order", waitingForUserId: session.userId } : getOrderActionView(storedOrder, session.userId)
  if (order.waitingForUserId !== session.userId) {
    return NextResponse.json({ error: "not-current-assignee" }, { status: 403 })
  }

  const completesOperationalTask =
    (order.currentStep === "procurement_order" && await userHasPermission(session.userId, "procurement.quote")) ||
    (order.currentStep === "warehouse_receipt" && await userHasPermission(session.userId, "warehouse.receive"))
  if (!completesOperationalTask && !await userHasPermission(session.userId, "approvals.approve")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  if (order.currentStep === "complete") {
    return NextResponse.json({ error: "order-complete" }, { status: 409 })
  }
  let paymentForm: Awaited<ReturnType<typeof readOrderPaymentForm>> | undefined
  if (order.currentStep === "procurement_order") {
    if (!await userHasPermission(session.userId, "procurement.quote") || !getAssignedProcurementLineIds(order, session.userId).length) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
    try { paymentForm = await readOrderPaymentForm(request) } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "invalid-payment" }, { status: 400 })
    }
  }
  const nextStep = getNextWorkflowStep(order.currentStep)
  const nextAssigneeUserId = await resolveAssignee(nextStep, order)
  const updatedAt = new Date().toISOString()
  const approvedOrder = buildApprovedOrder(
    order,
    session.userId,
    nextAssigneeUserId,
    completesOperationalTask,
    updatedAt,
  )
  if (!approvedOrder) {
    return NextResponse.json({
      error: nextStep !== "complete" && !nextAssigneeUserId
        ? "next-assignee-missing"
        : "invalid-transition",
    }, { status: 409 })
  }
  let updated: OrderRecord = approvedOrder

  if (storedOrder.procurementProgress && !paymentForm && ["director", "warehouse_receipt"].includes(order.currentStep)) {
    const step = order.currentStep as "director" | "warehouse_receipt"
    const lineIds = getProcurementLinesAtStep(storedOrder, step, session.userId).map((line) => line.id)
    updated = advanceProcurementLines(storedOrder, lineIds, step, step === "director" ? "procurement_order" : "complete", session.userId, nextAssigneeUserId, updatedAt, completesOperationalTask ? "completed" : "approved")
  }

  try {
    await db.transaction(async (tx) => {
      if (paymentForm) {
        const quotationRows = await tx.select({ payload: appRecords.payload }).from(appRecords)
          .where(eq(appRecords.namespace, "quotations"))
        const lines = validateOrderPayments(order, quotationRows.map((item) => item.payload as unknown as QuotationRecord), paymentForm.input)
        const allowed = new Set(getProcurementLinesAtStep(storedOrder, "procurement_order", session.userId).map((line) => line.id))
        const assigned = new Set(getAssignedProcurementLineIds(storedOrder, session.userId))
        if (lines.some((line) => !allowed.has(line.orderLineId) || !assigned.has(line.orderLineId))) throw new Error("invalid-payment-position")
        for (const supplierId of new Set(lines.map((line) => line.supplierId))) {
          const [supplier] = await tx.select().from(appRecords).where(and(eq(appRecords.namespace, "suppliers"), eq(appRecords.id, supplierId)))
          if (!supplier) throw new Error("supplier-not-found")
          const supplierLines = lines.filter((line) => line.supplierId === supplierId)
          const savedInn = typeof supplier.payload.inn === "string" ? supplier.payload.inn.trim() : ""
          const suppliedInns = supplierLines.map((line) => typeof line.supplierInn === "string" ? line.supplierInn.trim() : "")
          const inn = savedInn || suppliedInns[0]
          if (!inn || inn.length > 64 || /[\u0000-\u001f]/.test(inn) || suppliedInns.some((value) => value && value !== inn)) throw new Error(savedInn ? "supplier-inn-locked" : "supplier-inn-required")
          if (!savedInn) await tx.update(appRecords).set({ payload: { ...supplier.payload, inn }, updatedAt })
            .where(and(eq(appRecords.namespace, "suppliers"), eq(appRecords.id, supplierId)))
          for (const line of supplierLines) { line.supplierInn = inn; line.placedAt = updatedAt; line.placedByUserId = session.userId }
        }
        for (const file of paymentForm.files) {
          const fileId = randomUUID()
          const targets = file.supplierWide ? lines.filter((line) => line.supplierId === lines[file.index].supplierId) : [lines[file.index]]
          if (targets.some((line) => line.contract)) throw new Error("invalid-contract-file")
          for (const line of targets) line.contract = { id: fileId, name: file.name, type: file.type, size: file.size }
          // Private namespace, excluded from generic record APIs. File and transition commit together.
          await tx.insert(appRecords).values({ namespace: "order-contracts", id: fileId,
            createdByUserId: session.userId, payload: { orderId: id, name: file.name, base64: file.base64 } })
        }
        updated = advanceProcurementLines(storedOrder, [...new Set(lines.map((line) => line.orderLineId))], "procurement_order", "warehouse_receipt", session.userId, nextAssigneeUserId, updatedAt)
        updated.placement = { createdAt: storedOrder.placement?.createdAt ?? updatedAt, createdByUserId: storedOrder.placement?.createdByUserId ?? session.userId, lines: [...(storedOrder.placement?.lines ?? []), ...lines] }
        const newPayments = paymentsForOrder({ ...updated, placement: { createdAt: updatedAt, createdByUserId: session.userId, lines } })
        for (const payment of newPayments) await tx.insert(appRecords).values({ namespace: "finance-payments", id: payment.id,
          payload: payment as unknown as Record<string, unknown>, createdByUserId: session.userId, updatedAt })
      }
      updated.revision = (storedOrder.revision ?? 0) + 1
      const result = await tx.update(appRecords)
    .set({
      payload: updated as unknown as Record<string, unknown>,
      updatedAt,
    })
    .where(and(
      eq(appRecords.namespace, "orders"),
      eq(appRecords.id, id),
      eq(appRecords.updatedAt, row.updatedAt),
    ))
      if (result.rowsAffected !== 1) throw new Error("order-changed")
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : "save-failed"
    const validationErrors = ["invalid-contract-file", "supplier-not-found", "supplier-inn-locked", "supplier-inn-required", "approved-offers-incomplete", "payment-lines-required", "invalid-payment", "invalid-payment-position", "invalid-payment-method", "invalid-prepayment", "invalid-payment-date", "payment-date-required", "invalid-contract-number"]
    return NextResponse.json({ error: reason === "order-changed" || validationErrors.includes(reason) ? reason : "save-failed" }, { status: reason === "order-changed" ? 409 : validationErrors.includes(reason) ? 400 : 500 })
  }

  try {
    await db.insert(auditEvents).values({
      id: randomUUID(),
      actorUserId: session.userId,
      action: paymentForm ? "order.placed" : completesOperationalTask ? "order.step_completed" : "order.approved",
      entityType: "order",
      entityId: id,
      metadata: { fromStep: order.currentStep, toStep: nextStep, aggregateStep: updated.currentStep, orderLineIds: updated.workflowHistory?.at(-1)?.orderLineIds },
    })
  } catch {
    // The order transition is authoritative even if non-critical auditing is unavailable.
  }

  return NextResponse.json({ order: updated })
}
