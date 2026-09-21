import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { appRecords, roles, userRoles } from "@/db/schema"
import { getSessionUser } from "@/lib/auth/session"
import { userHasPermission } from "@/lib/auth/authorization"
import { isOrderAssignedToProcurementSpecialist, type OrderRecord } from "@/lib/orders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await getSessionUser()
  if (!session) return new Response(null, { status: 401 })
  const { id, fileId } = await context.params
  const [row] = await db.select().from(appRecords).where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, id)))
  if (!row) return new Response(null, { status: 404 })
  const order = row.payload as unknown as OrderRecord
  const canRead = await userHasPermission(session.userId, "requests.view") ||
    (row.createdByUserId === session.userId && await userHasPermission(session.userId, "requests.view_own"))
  const assignedRoles = await db.select({ code: roles.code }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, session.userId))
  const codes = assignedRoles.map((role) => role.code)
  if (!canRead || (codes.includes("procurement_manager") && !codes.includes("procurement_head") && !isOrderAssignedToProcurementSpecialist(order, session.userId))) return new Response(null, { status: 403 })
  const attachment = order.placement?.lines.find((line) => line.contract?.id === fileId)?.contract
  if (!attachment) return new Response(null, { status: 404 })
  const [file] = await db.select().from(appRecords).where(and(eq(appRecords.namespace, "order-contracts"), eq(appRecords.id, fileId)))
  if (file?.payload.orderId !== id || typeof file.payload.base64 !== "string") return new Response(null, { status: 404 })
  return new Response(Buffer.from(file.payload.base64, "base64"), { headers: {
    "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="contract"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } })
}
