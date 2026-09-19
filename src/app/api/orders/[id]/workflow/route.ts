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
  areAllProcurementLinesAssigned,
  buildProcurementSuborders,
  getProcurementLineAssignments,
  getProcurementSuborderForSpecialist,
  getProcurementSpecialistIds,
  getRequiredProcurementLines,
  getUnassignedProcurementLines,
  isOrderAssignedToProcurementSpecialist,
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
    typeof order.waitingForUserId !== "string" ||
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
) {
  const updatedAt = new Date().toISOString()
  const result = await db.update(appRecords)
    .set({ payload: updated as unknown as Record<string, unknown>, updatedAt })
    .where(and(
      eq(appRecords.namespace, "orders"),
      eq(appRecords.id, id),
      eq(appRecords.updatedAt, stored.updatedAt),
    ))
  if (result.rowsAffected !== 1) return false
  try {
    await db.insert(auditEvents).values({
      id: randomUUID(), actorUserId, action, entityType: "order", entityId: id, metadata,
    })
  } catch {
    // The workflow transition remains authoritative if optional auditing is unavailable.
  }
  return true
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

  let updated: OrderRecord | null = null
  let auditAction = ""
  let metadata: Record<string, unknown> = { fromStep: order.currentStep }

  if (action === "warehouse-report") {
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

    const assignments = {
      ...getProcurementLineAssignments(order),
      ...Object.fromEntries(orderLineIds.map((lineId) => [lineId, specialistUserId])),
    }
    const specialistIds = [...new Set(Object.values(assignments))]
    const allAssigned = areAllProcurementLinesAssigned({
      ...order,
      procurementSpecialistUserId: undefined,
      procurementLineAssignments: assignments,
    })
    const wasAwaitingAssignment = order.currentStep === "procurement_accept"
    const procurementSuborders = buildProcurementSuborders({
      ...order,
      procurementSpecialistUserId: undefined,
      procurementLineAssignments: assignments,
    }, now)
    const assignedSuborder = procurementSuborders.find(
      (suborder) => suborder.specialistUserId === specialistUserId,
    )
    updated = {
      ...order,
      procurementSpecialistUserId: allAssigned && specialistIds.length === 1
        ? specialistIds[0]
        : undefined,
      procurementLineAssignments: assignments,
      procurementSuborders,
      procurementReviewComment: undefined,
      currentStep: allAssigned ? "sourcing" : "procurement_accept",
      waitingForUserId: allAssigned ? specialistIds[0] : session.userId,
      lastActorUserId: session.userId,
      status: "in_progress",
      workflowHistory: wasAwaitingAssignment && allAssigned
        ? appendHistory(order, "procurement_accept", "completed", session.userId, now)
        : order.workflowHistory,
    }
    auditAction = "order.procurement_assigned"
    metadata = {
      ...metadata,
      toStep: updated.currentStep,
      specialistUserId,
      orderLineIds,
      procurementSuborderId: assignedSuborder?.id,
      procurementSuborderNumber: assignedSuborder?.number,
      allAssigned,
    }
  } else if (action === "submit-procurement-offers") {
    if (
      order.currentStep !== "sourcing" ||
      !isOrderAssignedToProcurementSpecialist(order, session.userId) ||
      !await userHasPermission(session.userId, "procurement.quote")
    ) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    const quotationRows = await db.select({ payload: appRecords.payload }).from(appRecords)
      .where(eq(appRecords.namespace, "quotations"))
    const caseId = `procurement-${order.id}`
    const procurementSuborders = buildProcurementSuborders(order)
    const currentSuborder = getProcurementSuborderForSpecialist(order, session.userId)
    if (!currentSuborder || currentSuborder.status === "submitted") {
      return NextResponse.json({ error: "procurement-suborder-not-actionable" }, { status: 409 })
    }
    const currentLineIds = new Set(currentSuborder.orderLineIds)
    const quotationLines = quotationRows
      .map((item) => parseQuotation(item.payload))
      .filter((item): item is QuotationRecord => item !== null && item.procurementCaseId === caseId)
      .flatMap((item) => item.lines)
      .filter((line) => currentLineIds.has(line.orderLineId))
    const requiredLines = order.lines.filter((line) => currentLineIds.has(line.id))
    if (!quotationLinesCoverRequirements(requiredLines, quotationLines)) {
      return NextResponse.json({ error: "quotation-coverage-required" }, { status: 409 })
    }
    const updatedSuborders = procurementSuborders.map((suborder) => (
      suborder.id === currentSuborder.id
        ? { ...suborder, status: "submitted" as const, submittedAt: now }
        : suborder
    ))
    const allSubmitted = updatedSuborders.every((suborder) => suborder.status === "submitted")
    const nextAssignee = allSubmitted
      ? await firstUserWithRole("procurement_head")
      : updatedSuborders.find((suborder) => suborder.status !== "submitted")?.specialistUserId
    if (!nextAssignee) return NextResponse.json({ error: "next-assignee-missing" }, { status: 409 })
    updated = {
      ...order,
      procurementSuborders: updatedSuborders,
      currentStep: allSubmitted ? "price_check" : "sourcing",
      waitingForUserId: nextAssignee,
      lastActorUserId: session.userId,
      status: "in_progress",
      workflowHistory: allSubmitted
        ? appendHistory(order, "sourcing", "completed", session.userId, now)
        : order.workflowHistory,
    }
    auditAction = "order.procurement_offers_submitted"
    metadata = {
      ...metadata,
      toStep: updated.currentStep,
      procurementSuborderId: currentSuborder.id,
      procurementSuborderNumber: currentSuborder.number,
      allSubmitted,
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
      order.currentStep !== "price_check" ||
      order.waitingForUserId !== session.userId ||
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
    const selectedQuotations = caseQuotations.filter((item) => selectedQuotationIds.has(item.id))
    const requiredLines = order.lines.filter((line) => line.fulfillmentStatus === "needs_procurement")
    if (approved && (
      !quotationIds.length ||
      selectedQuotations.length !== quotationIds.length ||
      !quotationLinesCoverRequirements(requiredLines, selectedQuotations.flatMap((item) => item.quotation.lines), "exact")
    )) {
      return NextResponse.json({ error: "quotation-selection-invalid" }, { status: 409 })
    }
    if (approved) {
      for (const quotation of caseQuotations) {
        await db.update(appRecords).set({
          payload: { ...quotation.payload, selected: selectedQuotationIds.has(quotation.id) },
          updatedAt: now,
        }).where(and(eq(appRecords.namespace, "quotations"), eq(appRecords.id, quotation.id)))
      }
    }
    updated = {
      ...order,
      procurementReviewComment: approved ? undefined : comment,
      procurementSuborders: approved
        ? buildProcurementSuborders(order)
        : buildProcurementSuborders(order).map((suborder) => ({
            ...suborder,
            status: "sourcing" as const,
            submittedAt: undefined,
          })),
      currentStep: approved ? "director" : "sourcing",
      waitingForUserId: nextAssignee,
      lastActorUserId: session.userId,
      status: "in_progress",
      workflowHistory: appendHistory(order, "price_check", approved ? "approved" : "returned", session.userId, now),
    }
    auditAction = approved ? "order.procurement_offer_approved" : "order.procurement_offer_returned"
    metadata = { ...metadata, toStep: updated.currentStep, quotationIds: approved ? quotationIds : undefined }
  } else {
    return NextResponse.json({ error: "invalid-action" }, { status: 400 })
  }

  if (!updated || !await persistOrder(id, row, updated, session.userId, auditAction, metadata)) {
    return NextResponse.json({ error: "order-changed" }, { status: 409 })
  }
  return NextResponse.json({ order: updated })
}
