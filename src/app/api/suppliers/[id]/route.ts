import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { appRecords, auditEvents } from "@/db/schema"
import { getSessionUser } from "@/lib/auth/session"
import { userHasPermission } from "@/lib/auth/authorization"
export const runtime = "nodejs"
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  if (!await userHasPermission(session.userId, "suppliers.manage")) return Response.json({ error: "forbidden" }, { status: 403 })
  const { id } = await context.params
  const input = await request.json().catch(() => null)
  const keys = ["name", "inn", "phone", "email", "contactPerson", "category"] as const
  if (!input || keys.some((key) => typeof input[key] !== "string" || input[key].length > 300) || !input.name.trim() || !["active", "archived"].includes(input.status)) return Response.json({ error: "invalid-supplier" }, { status: 400 })
  const [row] = await db.select().from(appRecords).where(and(eq(appRecords.namespace, "suppliers"), eq(appRecords.id, id)))
  if (!row) return Response.json({ error: "not-found" }, { status: 404 })
  if ((input.revision ?? 0) !== (row.payload.revision ?? 0)) return Response.json({ error: "supplier-changed" }, { status: 409 })
  const record = { ...row.payload, ...Object.fromEntries(keys.map((key) => [key, input[key].trim()])), status: input.status, id, revision: Number(row.payload.revision ?? 0) + 1 }
  try { await db.transaction(async (tx) => {
    const changed = await tx.update(appRecords).set({ payload: record, updatedAt: new Date().toISOString() }).where(and(eq(appRecords.namespace, "suppliers"), eq(appRecords.id, id), eq(appRecords.updatedAt, row.updatedAt)))
    if (changed.rowsAffected !== 1) throw new Error("supplier-changed")
    await tx.insert(auditEvents).values({ id: randomUUID(), actorUserId: session.userId, action: "supplier.updated", entityType: "supplier", entityId: id })
  }) } catch { return Response.json({ error: "supplier-changed" }, { status: 409 }) }
  return Response.json({ record })
}
