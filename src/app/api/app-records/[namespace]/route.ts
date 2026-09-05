import { and, desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { appRecords } from "@/db/schema"
import { userHasAnyPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import {
  appRecordPolicies,
  isAppRecordNamespace,
  parseAppRecord,
} from "@/lib/app-records"

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

  return NextResponse.json({ records: rows.map((row) => ({ ...row.payload, id: row.id })) })
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

  try {
    await db.insert(appRecords).values({
      namespace: auth.namespace,
      id: parsed.id,
      payload: parsed.payload,
      createdByUserId: auth.session.userId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.toLocaleLowerCase() : ""
    if (message.includes("unique constraint failed")) {
      return NextResponse.json({ error: "record-exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "create-failed" }, { status: 500 })
  }

  return NextResponse.json({ record: { ...parsed.payload, id: parsed.id } }, { status: 201 })
}
