import { randomUUID } from "node:crypto"
import { dirname, resolve } from "node:path"
import { and, eq } from "drizzle-orm"
import { databaseClient, db } from "../src/db/client"
import { appRecords, auditEvents, notifications, roles, userRoles, users } from "../src/db/schema"
import { buildProcurementSuborders, createProcurementChild, getProcurementSpecialistIds, type OrderRecord } from "../src/lib/orders"
import type { QuotationRecord } from "../src/lib/procurement"

// No seeds, deletes, or workflow resets. Run without --apply to inspect the plan.
async function main() {
  const apply = process.argv.includes("--apply")
  const now = new Date().toISOString()
  const candidates = (await db.select().from(appRecords).where(eq(appRecords.namespace, "orders")))
    .map((row) => row.payload as unknown as OrderRecord)
    .filter(needsMigration)
  if (!candidates.length) { console.log("No legacy procurement splits to migrate."); return }
  if (apply) {
    const url = process.env.DATABASE_URL ?? "file:data/factory-os.sqlite"
    if (!url.startsWith("file:")) throw new Error("A local SQLite backup is required for this migration")
    const backup = resolve(dirname(url.slice(5)), `before-procurement-split-${Date.now()}.sqlite`)
    await databaseClient.execute({ sql: "VACUUM INTO ?", args: [backup] })
    console.log(`Recovery backup: ${backup}`)
  }
  await db.transaction(async (tx) => {
    // Serialize against workflow writers while planning and migrating.
    if (apply) await tx.update(appRecords).set({ updatedAt: now })
      .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, candidates[0].id)))
    const rows = await tx.select().from(appRecords).where(eq(appRecords.namespace, "orders"))
    const quotes = await tx.select().from(appRecords).where(eq(appRecords.namespace, "quotations"))
    const heads = await tx.select({ id: users.id }).from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id)).innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(roles.code, "procurement_head"), eq(users.isActive, true)))
    for (const row of rows) {
      const parent = row.payload as unknown as OrderRecord
      if (!needsMigration(parent)) continue
      const headId = parent.procurementHeadUserId ?? parent.workflowHistory?.findLast(
        (entry) => entry.step === "procurement_accept" && heads.some((head) => head.id === entry.actorUserId),
      )?.actorUserId ?? heads[0]?.id
      if (!headId) throw new Error("Active procurement head is missing")
      const descriptors = buildProcurementSuborders(parent)
      const children = descriptors.map((item) => createProcurementChild(parent, item, headId))
      if (children.some((child) => rows.some((existing) => existing.id === child.id))) {
        throw new Error(`Child identity collision for ${parent.number}`)
      }
      const reassignedQuotes = quotes.filter((item) => item.payload.procurementCaseId === `procurement-${parent.id}`).map((row) => {
        const quote = row.payload as unknown as QuotationRecord
        // Current split offers belong to one specialist. Refuse ambiguous legacy
        // packages rather than inventing supplier prices or dropping positions.
        const child = children.find((item) => quote.lines.length && quote.lines.every((line) => item.lines.some((itemLine) => itemLine.id === line.orderLineId)))
        if (!child) throw new Error(`Quotation ${quote.id} crosses child boundaries; manual review required`)
        return { ...quote, procurementCaseId: `procurement-${child.id}`, procurementSuborderId: child.id, procurementSuborderNumber: child.number }
      })
      console.log(JSON.stringify({ parent: parent.number, children: children.map((child) => ({ number: child.number, step: child.currentStep, positions: child.lines.length })), quotes: reassignedQuotes.length, apply }))
      if (!apply) continue
      const container: OrderRecord = { ...parent, procurementSplit: true, procurementHeadUserId: headId,
        procurementSuborders: descriptors, procurementSpecialistUserId: undefined,
        currentStep: "procurement_accept", status: "in_progress", waitingForUserId: headId }
      await tx.update(appRecords).set({ payload: container as unknown as Record<string, unknown>, updatedAt: now })
        .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, parent.id)))
      for (const child of children) {
        await tx.insert(appRecords).values({ namespace: "orders", id: child.id, payload: child as unknown as Record<string, unknown>,
          createdByUserId: row.createdByUserId, createdAt: child.createdAt, updatedAt: now })
        if (child.currentStep === "price_check") {
          await tx.insert(notifications).values({ id: randomUUID(), userId: headId, type: "workflow", title: child.number,
            body: "Tijorat takliflari tekshiruvni kutmoqda.", resourceType: "order", resourceId: child.id })
        }
      }
      for (const quote of reassignedQuotes) {
        await tx.update(appRecords).set({ payload: quote as unknown as Record<string, unknown>, updatedAt: now })
          .where(and(eq(appRecords.namespace, "quotations"), eq(appRecords.id, quote.id)))
      }
      await tx.insert(auditEvents).values({ id: randomUUID(), action: "order.procurement_split_migrated", entityType: "order", entityId: parent.id,
        metadata: { childIds: children.map((child) => child.id), quotationIds: reassignedQuotes.map((quote) => quote.id) } })
    }
  })
}

function needsMigration(order: OrderRecord) {
  return !order.parentOrderId && !order.procurementSplit && order.status !== "rejected" &&
    ["procurement_accept", "sourcing", "price_check", "director", "procurement_order", "warehouse_receipt"].includes(order.currentStep) &&
    (getProcurementSpecialistIds(order).length > 1 || Boolean(order.procurementSuborders?.length) || Object.keys(order.procurementLineAssignments ?? {}).length > 0)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => databaseClient.close())
