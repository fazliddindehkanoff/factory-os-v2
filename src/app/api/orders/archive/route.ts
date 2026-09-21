import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { appRecords, auditEvents } from "@/db/schema"
import { getSessionUser } from "@/lib/auth/session"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSettingsData } from "@/lib/settings-data"
import { canReadOrderWithSettings } from "@/lib/order-access"
import type { OrderRecord } from "@/lib/orders"
export const runtime = "nodejs"
export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  if (!await userHasPermission(session.userId, "requests.edit")) return Response.json({ error: "forbidden" }, { status: 403 })
  const body = await request.json().catch(() => null)
  const items = body?.items as Array<{ id: string; revision: number }> | undefined
  if (!Array.isArray(items) || !items.length || items.length > 100 || items.some((item) => !item || typeof item.id !== "string" || !Number.isInteger(item.revision)) || new Set(items.map((item) => item.id)).size !== items.length) return Response.json({ error: "invalid-orders" }, { status: 400 })
  const settings = await getSettingsData()
  try {
    await db.transaction(async (tx) => {
      for (const item of items) {
        const [row] = await tx.select().from(appRecords).where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, item.id)))
        const order = row?.payload as OrderRecord | undefined
        if (!order || !canReadOrderWithSettings(order, session.userId, settings) || (order.revision ?? 0) !== item.revision) throw new Error("order-changed")
        if (order.placement?.lines.length || order.procurementSplit || order.parentOrderId) throw new Error("linked-order")
        // Soft archive preserves workflow/payment evidence and can be reversed by an administrator.
        const now = new Date().toISOString()
        const result = await tx.update(appRecords).set({ payload: { ...row.payload, archivedAt: now, revision: item.revision + 1 }, updatedAt: now }).where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, item.id), eq(appRecords.updatedAt, row.updatedAt)))
        if (result.rowsAffected !== 1) throw new Error("order-changed")
        await tx.insert(auditEvents).values({ id: randomUUID(), actorUserId: session.userId, action: "order.archived", entityType: "order", entityId: item.id })
      }
    })
  } catch { return Response.json({ error: "order-changed" }, { status: 409 }) }
  return Response.json({ ok: true })
}
