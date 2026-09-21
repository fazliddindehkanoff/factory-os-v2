import { and, desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { appRecords, roles, userRoles } from "@/db/schema"
import { userHasAnyPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import {
  appRecordPolicies,
  isAppRecordNamespace,
  parseAppRecord,
} from "@/lib/app-records"
import {
  getAssignedProcurementLineIds,
  getProcurementLinesAtStep,
  getProcurementSuborderForSpecialist,
  isOrderAssignedToProcurementSpecialist,
  type OrderRecord,
} from "@/lib/orders"
import { getRequiredProcurementQuantity, isExpectedDeliveryDateAllowed } from "@/lib/procurement"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function authorize(namespace: string, operation: "read" | "write") {
  const session = await getSessionUser()
  if (!session) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  if (!isAppRecordNamespace(namespace)) {
    return { error: NextResponse.json({ error: "invalid-namespace" }, { status: 400 }) }
  }
  if (!await userHasAnyPermission(session.userId, appRecordPolicies[namespace][operation])) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  }
  return { session, namespace }
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/app-records/[namespace]">,
) {
  const { namespace } = await context.params
  const auth = await authorize(namespace, "read")
  if ("error" in auth) return auth.error

  const conditions = [eq(appRecords.namespace, auth.namespace)]
  if (
    auth.namespace === "orders" &&
    !await userHasAnyPermission(auth.session.userId, ["requests.view"])
  ) {
    conditions.push(eq(appRecords.createdByUserId, auth.session.userId))
  }
  const rows = await db.select({ id: appRecords.id, payload: appRecords.payload })
    .from(appRecords)
    .where(and(...conditions))
    .orderBy(desc(appRecords.createdAt))

  let records: Record<string, unknown>[] = rows.map((row) => ({ ...row.payload, id: row.id }))
  if (auth.namespace === "orders") {
    const assignedRoles = await db.select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, auth.session.userId))
    const roleCodes = new Set(assignedRoles.map((role) => role.code))
    if (roleCodes.has("procurement_manager") && !roleCodes.has("procurement_head")) {
      records = records.filter((record) => (
        Array.isArray(record.lines) &&
        isOrderAssignedToProcurementSpecialist(record as unknown as OrderRecord, auth.session.userId)
      ))
    }
  }

  return NextResponse.json({ records })
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/app-records/[namespace]">,
) {
  const { namespace } = await context.params
  const auth = await authorize(namespace, "write")
  if ("error" in auth) return auth.error

  const parsed = parseAppRecord(await request.json().catch(() => null))
  if (!parsed) return NextResponse.json({ error: "invalid-record" }, { status: 400 })

  let payload = parsed.payload
  // Financial snapshots and transitions are only created by the verified placement/workflow APIs.
  if (auth.namespace === "finance-transactions" || (auth.namespace === "orders" && (payload.placement || payload.financeCancellation))) {
    return NextResponse.json({ error: "use-finance-workflow" }, { status: 403 })
  }
  let quotationOrderVersion: { id: string; updatedAt: string } | undefined
  if (auth.namespace === "quotations") {
    const procurementCaseId = typeof payload.procurementCaseId === "string"
      ? payload.procurementCaseId
      : ""
    const quotationLines = Array.isArray(payload.lines) ? payload.lines : []
    const orderId = procurementCaseId.startsWith("procurement-")
      ? procurementCaseId.slice("procurement-".length)
      : ""
    const [orderRow] = orderId
      ? await db.select({ payload: appRecords.payload, updatedAt: appRecords.updatedAt })
          .from(appRecords)
          .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, orderId)))
          .limit(1)
      : []
    const order = orderRow?.payload as OrderRecord | undefined
    const assignedLineIds = new Set(order
      ? getAssignedProcurementLineIds(order, auth.session.userId)
      : [])
    const procurementSuborder = order
      ? getProcurementSuborderForSpecialist(order, auth.session.userId)
      : undefined
    const submittedLineIds = quotationLines.map((line) => (
      line && typeof line === "object" && typeof line.orderLineId === "string"
        ? line.orderLineId
        : ""
    ))
    const sourcingLines = order ? getProcurementLinesAtStep(order, "sourcing", auth.session.userId) : []
    const sourcingIds = new Set(sourcingLines.map((line) => line.id))
    if (
      !order ||
      order.procurementSplit ||
      !quotationLines.length ||
      new Set(submittedLineIds).size !== submittedLineIds.length ||
      submittedLineIds.some((lineId) => !lineId || !assignedLineIds.has(lineId) || !sourcingIds.has(lineId))
    ) {
      return NextResponse.json({ error: "quotation-lines-forbidden" }, { status: 403 })
    }
    if (quotationLines.some((line) => {
      const required = sourcingLines.find((item) => item.id === line.orderLineId)
      return !required || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > getRequiredProcurementQuantity(required) ||
        !Number.isFinite(line.unitPrice) || line.unitPrice <= 0 || typeof line.expectedDeliveryDate !== "string" || !isExpectedDeliveryDateAllowed(line.expectedDeliveryDate) ||
        (line.paymentMethod !== undefined && line.paymentMethod !== "bank" && line.paymentMethod !== "cash")
    })) return NextResponse.json({ error: "invalid-quotation-lines" }, { status: 400 })
    quotationOrderVersion = { id: orderId, updatedAt: orderRow!.updatedAt }
    payload = {
      ...payload,
      selected: false,
      selectedLineIds: [],
      lines: quotationLines.map((line) => ({ ...line, paymentMethod: line.paymentMethod ?? "bank" })),
      createdByUserId: auth.session.userId,
      procurementSuborderId: procurementSuborder?.id,
      procurementSuborderNumber: procurementSuborder?.number,
    }
  }

  try {
    await db.transaction(async (tx) => {
      if (quotationOrderVersion) {
        const locked = await tx.update(appRecords).set({ updatedAt: new Date().toISOString() })
          .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, quotationOrderVersion.id), eq(appRecords.updatedAt, quotationOrderVersion.updatedAt)))
        if (locked.rowsAffected !== 1) throw new Error("order-changed")
      }
      await tx.insert(appRecords).values({
      namespace: auth.namespace,
      id: parsed.id,
      payload,
      createdByUserId: auth.session.userId,
    })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.toLocaleLowerCase() : ""
    if (message.includes("unique constraint failed")) {
      return NextResponse.json({ error: "record-exists" }, { status: 409 })
    }
    if (message === "order-changed") return NextResponse.json({ error: "order-changed" }, { status: 409 })
    return NextResponse.json({ error: "create-failed" }, { status: 500 })
  }

  return NextResponse.json({ record: { ...payload, id: parsed.id } }, { status: 201 })
}
