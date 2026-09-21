import { after } from "next/server"
import { sendTelegramNotificationForUser } from "@/lib/telegram-bot"
import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { appRecords, auditEvents, notifications } from "@/db/schema"
import { getSessionUser } from "@/lib/auth/session"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSettingsData } from "@/lib/settings-data"
import { canReadOrderWithSettings } from "@/lib/order-access"
import { canCreateRequestForApplicant, resolveOrderApplicantId, formatWorkflowNotification, type OrderRecord } from "@/lib/orders"
import { parseOrderChanges } from "@/lib/order-input"

export const runtime = "nodejs"
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await context.params
  const body = await request.json().catch(() => null)
  const [row] = await db.select().from(appRecords).where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, id)))
  const data = await getSettingsData()
  const order = row?.payload as OrderRecord | undefined
  if (!order || !canReadOrderWithSettings(order, session.userId, data)) return Response.json({ error: "not-found" }, { status: 404 })
  if (order.createdByUserId !== session.userId || order.status !== "rejected" || order.financeCancellation || order.parentOrderId || order.procurementSplit || !await userHasPermission(session.userId, "requests.create")) return Response.json({ error: "forbidden" }, { status: 403 })
  if (body?.revision !== (order.revision ?? 0)) return Response.json({ error: "order-changed" }, { status: 409 })
  const changes = parseOrderChanges(body?.changes, data)
  const creator = data.users.find((user) => user.id === session.userId)!
  const applicantId = changes && resolveOrderApplicantId(creator, changes.applicantId)
  const applicant = data.users.find((user) => user.id === applicantId)
  if (!changes || !applicant || applicantId !== changes.applicantId || !canCreateRequestForApplicant(creator.roleIds, applicant.roleIds) || !changes.departmentIds.every((id) => applicant.departmentIds.includes(id))) return Response.json({ error: "invalid-order" }, { status: 400 })
  const head = applicant.roleIds.includes("role-dept_head") ? applicant : data.users.find((user) => user.roleIds.includes("role-dept_head") && user.departmentIds.some((id) => changes.departmentIds.includes(id)))
  const skip = creator.roleIds.includes("role-dept_head") || head?.id === creator.id
  const assignee = skip ? data.warehouses.find((item) => item.id === changes.warehouseId)?.responsibleUserId : head?.id
  if (!assignee) return Response.json({ error: "next-assignee-missing" }, { status: 409 })
  // New uploads must belong to the author; existing attachments may be retained.
  for (const attachment of changes.attachments ?? []) {
    if (order.attachments?.some((item) => item.id === attachment.id)) continue
    const [file] = await db.select().from(appRecords).where(and(eq(appRecords.namespace, "order-attachments"), eq(appRecords.id, attachment.id)))
    if (!file || file.createdByUserId !== session.userId) return Response.json({ error: "invalid-attachment" }, { status: 400 })
  }
  const now = new Date().toISOString()
  const updated: OrderRecord = { ...order, ...changes, revision: (order.revision ?? 0) + 1, status: skip ? "warehouse_check" : "supervisor_review", currentStep: skip ? "warehouse" : "department_supervisor", waitingForUserId: assignee, lastActorUserId: session.userId, procurementSpecialistUserId: undefined, procurementLineAssignments: undefined, procurementSuborders: undefined, procurementProgress: undefined, procurementReviewComment: undefined, lines: changes.lines.map((line) => ({ ...line, fulfillmentStatus: "pending" })), workflowHistory: [...(order.workflowHistory ?? []), { step: "department_supervisor", action: "returned", actorUserId: session.userId, createdAt: now }] }
  try {
    await db.transaction(async (tx) => {
      const result = await tx.update(appRecords).set({ payload: updated as unknown as Record<string, unknown>, updatedAt: now }).where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, id), eq(appRecords.updatedAt, row.updatedAt)))
      if (result.rowsAffected !== 1) throw new Error("order-changed")
      await tx.insert(auditEvents).values({ id: randomUUID(), actorUserId: session.userId, action: "order.resubmitted", entityType: "order", entityId: id })
      await tx.insert(notifications).values({ id: randomUUID(), userId: assignee, type: "action_required", title: order.number, body: formatWorkflowNotification({ event: { kind: "action_required" } }, "uz"), resourceType: "order", resourceId: id })
    })
  } catch { return Response.json({ error: "order-changed" }, { status: 409 }) }
  if (process.env.TELEGRAM_BOT_TOKEN) after(async () => {
    try { await sendTelegramNotificationForUser(assignee, order.number, formatWorkflowNotification({ event: { kind: "action_required" } }, "uz"), id) } catch {}
  })
  return Response.json({ order: updated })
}
