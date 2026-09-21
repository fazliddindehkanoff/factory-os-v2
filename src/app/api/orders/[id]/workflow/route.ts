import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import {
  appRecords,
  auditEvents,
  roles,
  userDepartments,
  userRoles,
  users,
  warehouses,
} from "@/db/schema"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import {
  advanceProcurementLines,
  getProcurementLinesAtStep,
  getProcurementSpecialistIds,
  getRequiredProcurementLines,
  getUnassignedProcurementLines,
  isOrderAssignedToProcurementSpecialist,
  planProcurementAssignment,
  type OrderRecord,
  type WorkflowHistoryEntry,
} from "@/lib/orders"
import { quotationLinesCoverRequirements, type QuotationRecord } from "@/lib/procurement"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type StoredOrder = { payload: Record<string, unknown>; updatedAt: string }

function parseOrder(value: unknown): OrderRecord | null {
  if (!value || typeof value !== "object") return null
  const order = value as Partial<OrderRecord>
  if (
    typeof order.id !== "string" ||
    typeof order.number !== "string" ||
    typeof order.currentStep !== "string" ||

    typeof order.warehouseId !== "string" ||
    !Array.isArray(order.lines) ||
    !Array.isArray(order.workflowHistory ?? [])
  ) return null
  return order as OrderRecord
}

function appendHistory(
  order: OrderRecord,
  step: WorkflowHistoryEntry["step"],
  action: WorkflowHistoryEntry["action"],
  actorUserId: string,
  createdAt: string,
) {
  return [...(order.workflowHistory ?? []), { step, action, actorUserId, createdAt }]
}

async function loadOrder(id: string) {
  const [row] = await db.select({ payload: appRecords.payload, updatedAt: appRecords.updatedAt })
    .from(appRecords)
    .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, id)))
    .limit(1)
  const order = parseOrder(row?.payload)
  return row && order ? { row: row as StoredOrder, order } : null
}

async function activeUser(userId: string | undefined) {
  if (!userId) return undefined
  const [row] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1)
  return row?.id
}

async function firstUserWithRole(roleCode: string) {
  const [row] = await db.select({ id: users.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(roles.code, roleCode), eq(users.isActive, true)))
    .limit(1)
  return row?.id
}

async function warehouseResponsible(warehouseId: string) {
  const [row] = await db.select({ userId: warehouses.responsibleUserId })
    .from(warehouses)
    .where(eq(warehouses.id, warehouseId))
    .limit(1)
  return activeUser(row?.userId ?? undefined)
}

async function hasRole(userId: string, roleCode: string) {
  const [row] = await db.select({ id: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.code, roleCode)))
    .limit(1)
  return Boolean(row)
}

async function shareDepartment(leftUserId: string, rightUserId: string) {
  const rows = await db.select({ userId: userDepartments.userId, departmentId: userDepartments.departmentId })
    .from(userDepartments)
    .where(eq(userDepartments.userId, leftUserId))
  const leftDepartments = new Set(rows.map((row) => row.departmentId))
  if (!leftDepartments.size) return false
  const rightRows = await db.select({ departmentId: userDepartments.departmentId })
    .from(userDepartments)
    .where(eq(userDepartments.userId, rightUserId))
  return rightRows.some((row) => leftDepartments.has(row.departmentId))
}

async function persistOrder(
  id: string,
  stored: StoredOrder,
  updated: OrderRecord,
  actorUserId: string,
  action: string,
  metadata: Record<string, unknown>,
  quotationUpdates: { id: string; payload: Record<string, unknown> }[] = [],
) {
  const updatedAt = new Date().toISOString()
  return db.transaction(async (tx) => {
    const result = await tx.update(appRecords)
      .set({ payload: { ...updated, revision: (Number(stored.payload.revision) || 0) + 1 } as unknown as Record<string, unknown>, updatedAt })
      .where(and(
        eq(appRecords.namespace, "orders"),
        eq(appRecords.id, id),
        eq(appRecords.updatedAt, stored.updatedAt),
      ))
    if (result.rowsAffected !== 1) return false
    for (const quotation of quotationUpdates) {
      await tx.update(appRecords).set({ payload: quotation.payload, updatedAt })
        .where(and(eq(appRecords.namespace, "quotations"), eq(appRecords.id, quotation.id)))
    }
    await tx.insert(auditEvents).values({
      id: randomUUID(), actorUserId, action, entityType: "order", entityId: id, metadata,
    })
    return true
  })
}

function numberMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const result: Record<string, number> = {}
  for (const [key, amount] of Object.entries(value)) {
    if (!key || key.length > 200 || typeof amount !== "number" || !Number.isFinite(amount)) return null
    result[key] = amount
  }
  return result
}

function parseQuotation(value: unknown): QuotationRecord | null {
  if (!value || typeof value !== "object") return null
  const quotation = value as Partial<QuotationRecord>
  if (
    typeof quotation.id !== "string" ||
    typeof quotation.procurementCaseId !== "string" ||
    !Array.isArray(quotation.lines)
  ) return null
  return quotation as QuotationRecord
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/orders/[id]/workflow">,
) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await context.params
  if (!id || id.length > 200) return NextResponse.json({ error: "invalid-order" }, { status: 400 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const action = typeof body?.action === "string" ? body.action : ""
  const stored = await loadOrder(id)
  if (!stored) return NextResponse.json({ error: "order-not-found" }, { status: 404 })
  const { order, row } = stored
  const now = new Date().toISOString()
  if (order.procurementSplit && action !== "assign-procurement-specialist") {
    return NextResponse.json({ error: "use-child-order" }, { status: 409 })
  }

  let updated: OrderRecord | null = null
  let auditAction = ""
  let metadata: Record<string, unknown> = { fromStep: order.currentStep }
  let quotationUpdates: { id: string; payload: Record<string, unknown> }[] = []

  if (order.archivedAt) return NextResponse.json({ error: "order-not-found" }, { status: 404 })
  if (action === "reject") {
    if (order.currentStep === "complete" || order.waitingForUserId !== session.userId || !["department_supervisor", "warehouse", "chief_engineer", "director"].includes(order.currentStep) || !await userHasPermission(session.userId, "approvals.reject")) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    updated = { ...order, status: "rejected", currentStep: "complete", waitingForUserId: undefined, lastActorUserId: session.userId, workflowHistory: appendHistory(order, order.currentStep, "rejected", session.userId, now) }
    auditAction = "order.rejected"
  } else if (action === "warehouse-report") {
    const quantities = numberMap(body?.quantities)
    const responsibleUserId = await warehouseResponsible(order.warehouseId)
    if (
      !quantities ||
      order.currentStep !== "warehouse" ||
      order.waitingForUserId !== session.userId ||
      responsibleUserId !== session.userId ||
      !await userHasPermission(session.userId, "warehouse.check_stock")
    ) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    const lines = order.lines.map((line) => {
      const availableQuantity = Math.max(0, Math.min(line.quantity, quantities[line.id] ?? 0))
      return {
        ...line,
        availableQuantity,
        fulfillmentStatus: availableQuantity >= line.quantity
          ? "fulfilled_from_stock" as const
          : "needs_procurement" as const,
      }
    })
    const fullyFulfilled = lines.every((line) => line.fulfillmentStatus === "fulfilled_from_stock")
    const nextAssignee = fullyFulfilled ? undefined : await firstUserWithRole("deputy_director")
    if (!fullyFulfilled && !nextAssignee) {
      return NextResponse.json({ error: "next-assignee-missing" }, { status: 409 })
    }
    updated = {
      ...order,
      lines,
      currentStep: fullyFulfilled ? "complete" : "chief_engineer",
      waitingForUserId: nextAssignee,
      lastActorUserId: session.userId,
      status: fullyFulfilled ? "fulfilled" : "in_progress",
      workflowHistory: appendHistory(order, "warehouse", "completed", session.userId, now),
    }
    auditAction = "order.warehouse_reported"
    metadata = { ...metadata, toStep: updated.currentStep, fullyFulfilled }
  } else if (action === "assign-procurement-specialist") {
    const specialistUserId = typeof body?.specialistUserId === "string" ? body.specialistUserId : ""
    const orderLineIds = Array.isArray(body?.orderLineIds)
      ? [...new Set(body.orderLineIds.filter(
          (value): value is string => typeof value === "string" && value.length > 0 && value.length <= 200,
        ))]
      : []
    const requiredLineIds = new Set(getRequiredProcurementLines(order).map((line) => line.id))
    const unassignedLineIds = new Set(getUnassignedProcurementLines(order).map((line) => line.id))
    const validSpecialist =
      await activeUser(specialistUserId) &&
      await hasRole(specialistUserId, "procurement_manager") &&
      await shareDepartment(session.userId, specialistUserId)
    if (
      !specialistUserId ||
      order.parentOrderId ||
      !orderLineIds.length ||
      orderLineIds.some((lineId) => !requiredLineIds.has(lineId)) ||
      !validSpecialist ||
      !["procurement_accept", "sourcing"].includes(order.currentStep) ||
      (order.currentStep === "procurement_accept" && order.waitingForUserId !== session.userId) ||
      !await hasRole(session.userId, "procurement_head") ||
      !await userHasPermission(session.userId, "procurement.select_supplier")
    ) return NextResponse.json({ error: "forbidden" }, { status: 403 })

    if (orderLineIds.some((lineId) => !unassignedLineIds.has(lineId))) {
      return NextResponse.json({ error: "procurement-lines-already-assigned" }, { status: 409 })
    }

    try {
      const result = await db.transaction(async (tx) => {
        // Acquire the SQLite write lock before reading children. The revision
        // check prevents concurrent heads from allocating the same position.
        const locked = await tx.update(appRecords).set({ updatedAt: now }).where(and(
          eq(appRecords.namespace, "orders"), eq(appRecords.id, id), eq(appRecords.updatedAt, row.updatedAt),
        ))
        if (locked.rowsAffected !== 1) throw new Error("order-changed")
        const rows = await tx.select().from(appRecords).where(eq(appRecords.namespace, "orders"))
        const children = rows.map((item) => item.payload as unknown as OrderRecord)
          .filter((item) => item.parentOrderId === id)
        const plan = planProcurementAssignment(order, children, specialistUserId, orderLineIds, session.userId, now)
        plan.parent.revision = (order.revision ?? 0) + 1
        plan.child.revision = (children.find((child) => child.id === plan.child.id)?.revision ?? 0) + 1
        await tx.update(appRecords).set({ payload: plan.parent as unknown as Record<string, unknown> })
          .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, id)))
        const childPayload = plan.child as unknown as Record<string, unknown>
        if (children.some((child) => child.id === plan.child.id)) {
          await tx.update(appRecords).set({ payload: childPayload, updatedAt: now })
            .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, plan.child.id)))
        } else {
          await tx.insert(appRecords).values({ namespace: "orders", id: plan.child.id, payload: childPayload,
            createdByUserId: order.createdByUserId, createdAt: now, updatedAt: now })
        }
        await tx.insert(auditEvents).values({ id: randomUUID(), actorUserId: session.userId,
          action: "order.procurement_split_assigned", entityType: "order", entityId: id,
          metadata: { specialistUserId, orderLineIds, childOrderId: plan.child.id, childOrderNumber: plan.child.number } })
        return { order: plan.parent, relatedOrders: [plan.child] }
      })
      return NextResponse.json(result)
    } catch (error) {
      const code = error instanceof Error ? error.message : "assignment-failed"
      const expected = ["order-changed", "procurement-lines-already-assigned", "procurement-child-already-submitted", "procurement-assignment-forbidden"]
      return NextResponse.json({ error: expected.includes(code) ? code : "assignment-failed" }, { status: 409 })
    }
  } else if (action === "submit-procurement-offers") {
    if (
      !getProcurementLinesAtStep(order, "sourcing", session.userId).length ||
      !isOrderAssignedToProcurementSpecialist(order, session.userId) ||
      !await userHasPermission(session.userId, "procurement.quote")
    ) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    const quotationRows = await db.select({ payload: appRecords.payload }).from(appRecords)
      .where(eq(appRecords.namespace, "quotations"))
    const caseId = `procurement-${order.id}`
    const sourcingLines = getProcurementLinesAtStep(order, "sourcing", session.userId)
    const currentLineIds = new Set(sourcingLines.map((line) => line.id))
    const quotationLines = quotationRows
      .map((item) => parseQuotation(item.payload))
      .filter((item): item is QuotationRecord => item !== null && item.procurementCaseId === caseId)
      .flatMap((item) => item.lines)
      .filter((line) => currentLineIds.has(line.orderLineId))
    const readyLines = sourcingLines.filter((line) => quotationLinesCoverRequirements(
      [line], quotationLines.filter((quoteLine) => quoteLine.orderLineId === line.id),
    ))
    if (!readyLines.length) {
      return NextResponse.json({ error: "quotation-coverage-required" }, { status: 409 })
    }
    // A child is a real order: it never waits for its siblings to submit.
    const nextAssignee = await activeUser(order.procurementHeadUserId) ?? await firstUserWithRole("procurement_head")
    if (!nextAssignee) return NextResponse.json({ error: "next-assignee-missing" }, { status: 409 })
    updated = advanceProcurementLines(order, readyLines.map((line) => line.id), "sourcing", "price_check", session.userId, nextAssignee, now)
    auditAction = "order.procurement_offers_submitted"
    metadata = {
      ...metadata,
      toStep: updated.currentStep,
      orderLineIds: readyLines.map((line) => line.id),
    }
  } else if (action === "review-procurement-offers") {
    const approved = body?.approved === true
    const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 2_000) : ""
    const quotationIds = Array.isArray(body?.quotationIds)
      ? [...new Set(body.quotationIds.filter((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 200))]
      : typeof body?.quotationId === "string" && body.quotationId
        ? [body.quotationId]
        : []
    const permission = approved ? "approvals.approve" : "approvals.reject"
    if (
      !getProcurementLinesAtStep(order, "price_check", session.userId).length ||
      !await hasRole(session.userId, "procurement_head") ||
      !await userHasPermission(session.userId, "procurement.select_supplier") ||
      !await userHasPermission(session.userId, permission) ||
      (!approved && !comment)
    ) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    const nextAssignee = approved
      ? await firstUserWithRole("director")
      : await activeUser(getProcurementSpecialistIds(order)[0])
    if (!nextAssignee) return NextResponse.json({ error: "next-assignee-missing" }, { status: 409 })
    const quotationRows = await db.select({ id: appRecords.id, payload: appRecords.payload })
      .from(appRecords)
      .where(eq(appRecords.namespace, "quotations"))
    const caseId = `procurement-${order.id}`
    const caseQuotations = quotationRows
      .map((item) => ({ ...item, quotation: parseQuotation(item.payload) }))
      .filter((item): item is { id: string; payload: Record<string, unknown>; quotation: QuotationRecord } => (
        item.quotation !== null && item.quotation.procurementCaseId === caseId
      ))
    const selectedQuotationIds = new Set(quotationIds)
    const requiredLines = getProcurementLinesAtStep(order, "price_check", session.userId)
    const reviewIds = new Set(requiredLines.map((line) => line.id))
    const selectedQuotations = caseQuotations.filter((item) => selectedQuotationIds.has(item.id) && item.quotation.lines.some((line) => reviewIds.has(line.orderLineId)))
    if (approved && (
      !quotationIds.length ||
      selectedQuotations.length !== quotationIds.length ||
      !quotationLinesCoverRequirements(requiredLines, selectedQuotations.flatMap((item) => item.quotation.lines).filter((line) => reviewIds.has(line.orderLineId)), "exact")
    )) {
      return NextResponse.json({ error: "quotation-selection-invalid" }, { status: 409 })
    }
    if (approved) {
      quotationUpdates = caseQuotations.map((quotation) => {
        const previous = quotation.quotation.selectedLineIds ?? (quotation.quotation.selected ? quotation.quotation.lines.map((line) => line.orderLineId) : [])
        const selectedLineIds = [...previous.filter((id) => !reviewIds.has(id)),
          ...quotation.quotation.lines.filter((line) => reviewIds.has(line.orderLineId) && selectedQuotationIds.has(quotation.id)).map((line) => line.orderLineId)]
        return { id: quotation.id, payload: { ...quotation.payload, selected: selectedLineIds.length > 0, selectedLineIds } }
      })
    }
    updated = advanceProcurementLines(order, requiredLines.map((line) => line.id), "price_check", approved ? "director" : "sourcing", session.userId, nextAssignee, now, approved ? "approved" : "returned", approved ? undefined : comment)
    auditAction = approved ? "order.procurement_offer_approved" : "order.procurement_offer_returned"
    metadata = { ...metadata, toStep: updated.currentStep, quotationIds: approved ? quotationIds : undefined }
  } else if (action === "reject-procurement-positions") {
    const lines = getProcurementLinesAtStep(order, "director", session.userId)
    if (!order.procurementProgress || !lines.length || !await userHasPermission(session.userId, "approvals.reject")) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    updated = advanceProcurementLines(order, lines.map((line) => line.id), "director", "complete", session.userId, undefined, now, "rejected")
    auditAction = "order.positions_rejected"
    metadata = { ...metadata, orderLineIds: lines.map((line) => line.id) }
  } else {
    return NextResponse.json({ error: "invalid-action" }, { status: 400 })
  }

  if (!updated || !await persistOrder(id, row, updated, session.userId, auditAction, metadata, quotationUpdates)) {
    return NextResponse.json({ error: "order-changed" }, { status: 409 })
  }
  return NextResponse.json({ order: { ...updated, revision: (order.revision ?? 0) + 1 } })
}
