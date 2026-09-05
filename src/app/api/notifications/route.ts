import { randomUUID } from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { notifications, users } from "@/db/schema"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import {
  formatWorkflowNotification,
  type WorkflowNotificationEvent,
} from "@/lib/orders"
import type { PermissionCode } from "@/lib/rbac"
import { sendTelegramNotificationForUser } from "@/lib/telegram-bot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const rows = await db.select({
    id: notifications.id,
    orderId: notifications.resourceId,
    orderNumber: notifications.title,
    message: notifications.body,
    commentId: notifications.commentId,
    createdAt: notifications.createdAt,
    readAt: notifications.readAt,
  }).from(notifications)
    .where(eq(notifications.userId, session.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(100)
  return NextResponse.json({
    notifications: rows.map((row) => ({
      ...row,
      orderId: row.orderId ?? "",
      userId: session.userId,
      commentId: row.commentId ?? undefined,
      read: Boolean(row.readAt),
    })),
  })
}

export async function PATCH() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  await db.update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(eq(notifications.userId, session.userId))
  return NextResponse.json({ ok: true })
}

function parseEvent(value: unknown): WorkflowNotificationEvent | null {
  if (!value || typeof value !== "object" || !("kind" in value)) return null
  const event = value as Record<string, unknown>
  switch (event.kind) {
    case "action_required":
    case "step_approved":
    case "rejected":
    case "warehouse_fulfilled":
    case "warehouse_report_ready":
    case "procurement_offer_approved":
      return { kind: event.kind }
    case "approved_by":
    case "procurement_assigned":
    case "procurement_offers_submitted":
      return typeof event.actorName === "string" && event.actorName.length <= 160
        ? { kind: event.kind, actorName: event.actorName }
        : null
    case "warehouse_partial":
      return Number.isFinite(event.fulfilledCount) && Number.isFinite(event.totalCount)
        ? { kind: event.kind, fulfilledCount: Number(event.fulfilledCount), totalCount: Number(event.totalCount) }
        : null
    case "procurement_offer_rejected":
      return typeof event.comment === "string" && event.comment.length <= 2_000
        ? { kind: event.kind, comment: event.comment }
        : null
    default:
      return null
  }
}

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const notificationPermissions: PermissionCode[] = [
    "requests.create",
    "approvals.approve",
    "approvals.reject",
    "warehouse.check_stock",
    "warehouse.receive",
    "procurement.select_supplier",
    "procurement.quote",
  ]
  const canEmit = (await Promise.all(
    notificationPermissions.map((permission) => userHasPermission(session.userId, permission)),
  )).some(Boolean)
  if (!canEmit) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-notification" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid-notification" }, { status: 400 })
  }
  const input = body as Record<string, unknown>
  const id = typeof input.id === "string" && input.id.length <= 128 ? input.id : randomUUID()
  const userId = typeof input.userId === "string" && input.userId.length <= 128 ? input.userId : ""
  const orderId = typeof input.orderId === "string" && input.orderId.length <= 128 ? input.orderId : ""
  const orderNumber = typeof input.orderNumber === "string" && input.orderNumber.length <= 64 ? input.orderNumber : ""
  const event = parseEvent(input.event)
  if (!userId || !orderId || !orderNumber || !event) {
    return NextResponse.json({ error: "invalid-notification" }, { status: 400 })
  }
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!target) return NextResponse.json({ error: "user-not-found" }, { status: 404 })

  const bodyText = formatWorkflowNotification({ event }, "uz")
  const inserted = await db.insert(notifications).values({
    id,
    userId,
    type: event.kind,
    title: orderNumber,
    body: bodyText,
    resourceType: "order",
    resourceId: orderId,
  }).onConflictDoNothing()

  if (inserted.rowsAffected > 0 && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      await sendTelegramNotificationForUser(userId, orderNumber, bodyText, orderId)
    } catch {
      // Keep the saved in-app notification if Telegram is temporarily unavailable.
    }
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
