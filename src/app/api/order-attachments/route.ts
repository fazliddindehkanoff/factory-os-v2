import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { appRecords } from "@/db/schema"
import { getSessionUser } from "@/lib/auth/session"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSettingsData } from "@/lib/settings-data"
import { canReadOrderWithSettings } from "@/lib/order-access"
import type { OrderRecord } from "@/lib/orders"
export const runtime = "nodejs"
export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  if (!await userHasPermission(session.userId, "requests.create")) return Response.json({ error: "forbidden" }, { status: 403 })
  if (!request.body || !request.headers.get("content-type")?.startsWith("multipart/form-data")) return Response.json({ error: "invalid-files" }, { status: 400 })
  const chunks: Uint8Array[] = []; let size = 0
  const reader = request.body.getReader()
  while (true) {
    const part = await reader.read(); if (part.done) break
    size += part.value.byteLength
    if (size > 20 * 1024 * 1024) { await reader.cancel(); return Response.json({ error: "files-too-large" }, { status: 413 }) }
    chunks.push(part.value)
  }
  const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData().catch(() => null)
  const files = form?.getAll("files")
  if (!files?.length || files.length > 20 || files.some((file) => typeof file === "string" || !file.size || file.size > 5 * 1024 * 1024)) return Response.json({ error: "invalid-files" }, { status: 400 })
  const records = await Promise.all((files as File[]).map(async (file) => ({ id: randomUUID(), name: file.name.replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 200), type: file.type, size: file.size, base64: Buffer.from(await file.arrayBuffer()).toString("base64") })))
  await db.transaction(async (tx) => { for (const record of records) await tx.insert(appRecords).values({ namespace: "order-attachments", id: record.id, payload: record, createdByUserId: session.userId }) })
  return Response.json({ attachments: records.map(({ id, name, type, size }) => ({ id, name, type, size })) }, { status: 201 })
}
export async function GET(request: Request) {
  const session = await getSessionUser()
  if (!session) return new Response(null, { status: 401 })
  const id = new URL(request.url).searchParams.get("id") ?? ""
  const [file] = await db.select().from(appRecords).where(and(eq(appRecords.namespace, "order-attachments"), eq(appRecords.id, id)))
  if (!file || typeof file.payload.base64 !== "string") return new Response(null, { status: 404 })
  const rows = await db.select().from(appRecords).where(eq(appRecords.namespace, "orders"))
  const related = rows.map((row) => row.payload as OrderRecord).filter((order) => order.attachments?.some((attachment) => attachment.id === id))
  const data = await getSettingsData()
  const allowed = related.length ? related.some((order) => canReadOrderWithSettings(order, session.userId, data)) : file.createdByUserId === session.userId
  if (!allowed) return new Response(null, { status: 403 })
  return new Response(Buffer.from(file.payload.base64, "base64"), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(String(file.payload.name))}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
}
