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
import {
  buildApprovedOrder,
  getNextWorkflowStep,
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
    return await activeUser(order.procurementSpecialistUserId) ??
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
  _request: Request,
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

  const order = row.payload
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
  const nextStep = getNextWorkflowStep(order.currentStep)
  const nextAssigneeUserId = await resolveAssignee(nextStep, order)
  const updatedAt = new Date().toISOString()
  const updated = buildApprovedOrder(
    order,
    session.userId,
    nextAssigneeUserId,
    completesOperationalTask,
    updatedAt,
  )
  if (!updated) {
    return NextResponse.json({
      error: nextStep !== "complete" && !nextAssigneeUserId
        ? "next-assignee-missing"
        : "invalid-transition",
    }, { status: 409 })
  }

  const result = await db.update(appRecords)
    .set({
      payload: updated as unknown as Record<string, unknown>,
      updatedAt,
    })
    .where(and(
      eq(appRecords.namespace, "orders"),
      eq(appRecords.id, id),
      eq(appRecords.updatedAt, row.updatedAt),
    ))
  if (result.rowsAffected !== 1) {
    return NextResponse.json({ error: "order-changed" }, { status: 409 })
  }

  try {
    await db.insert(auditEvents).values({
      id: randomUUID(),
      actorUserId: session.userId,
      action: completesOperationalTask ? "order.step_completed" : "order.approved",
      entityType: "order",
      entityId: id,
      metadata: { fromStep: order.currentStep, toStep: updated.currentStep },
    })
  } catch {
    // The order transition is authoritative even if non-critical auditing is unavailable.
  }

  return NextResponse.json({ order: updated })
}
