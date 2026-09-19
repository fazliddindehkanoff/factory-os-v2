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
  getProcurementSuborderForSpecialist,
  isOrderAssignedToProcurementSpecialist,
  type OrderRecord,
} from "@/lib/orders"

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
  if (auth.namespace === "quotations") {
    const procurementCaseId = typeof payload.procurementCaseId === "string"
      ? payload.procurementCaseId
      : ""
    const quotationLines = Array.isArray(payload.lines) ? payload.lines : []
    const orderId = procurementCaseId.startsWith("procurement-")
      ? procurementCaseId.slice("procurement-".length)
      : ""
    const [orderRow] = orderId
      ? await db.select({ payload: appRecords.payload })
          .from(appRecords)
          .where(and(eq(appRecords.namespace, "orders"), eq(appRecords.id, orderId)))
          .limit(1)
      : []
    const order = orderRow?.payload as OrderRecord | undefined
    const assignedLineIds = new Set(order
      ? getAssignedProcurementLineIds(order, auth.session.userId)
      : [])
    const submittedLineIds = quotationLines.map((line) => (
      line && typeof line === "object" && typeof line.orderLineId === "string"
        ? line.orderLineId
        : ""
    ))
    if (
      !order ||
      order.currentStep !== "sourcing" ||
      !quotationLines.length ||
      new Set(submittedLineIds).size !== submittedLineIds.length ||
      submittedLineIds.some((lineId) => !lineId || !assignedLineIds.has(lineId))
    ) {
      return NextResponse.json({ error: "quotation-lines-forbidden" }, { status: 403 })
    }
    const procurementSuborder = getProcurementSuborderForSpecialist(
      order,
      auth.session.userId,
    )
    payload = {
      ...payload,
      createdByUserId: auth.session.userId,
      procurementSuborderId: procurementSuborder?.id,
      procurementSuborderNumber: procurementSuborder?.number,
    }
  }

  try {
    await db.insert(appRecords).values({
      namespace: auth.namespace,
      id: parsed.id,
      payload,
      createdByUserId: auth.session.userId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.toLocaleLowerCase() : ""
    if (message.includes("unique constraint failed")) {
      return NextResponse.json({ error: "record-exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "create-failed" }, { status: 500 })
  }

  return NextResponse.json({ record: { ...payload, id: parsed.id } }, { status: 201 })
}
