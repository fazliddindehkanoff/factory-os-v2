import { NextResponse } from "next/server"

import { databaseClient } from "@/db/client"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import { PRODUCT_TITLE_MAX_LENGTH } from "@/lib/product-input"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const tableBySection = {
  positions: "positions",
  "product-categories": "product_categories",
  "order-purposes": "order_purposes",
  branches: "branches",
  "unit-types": "unit_types",
  products: "products",
  warehouses: "warehouses",
  departments: "departments",
} as const

type LocalizedSection = keyof typeof tableBySection
type TranslationRecord = {
  id: string
  titleUz: string
  titleRu: string
  titleTr: string
}

function isLocalizedSection(value: unknown): value is LocalizedSection {
  return typeof value === "string" && value in tableBySection
}

function parseRecords(value: unknown, section: LocalizedSection): TranslationRecord[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) return null
  const maxTitleLength = section === "products" ? PRODUCT_TITLE_MAX_LENGTH : 500
  const records: TranslationRecord[] = []
  const ids = new Set<string>()

  for (const item of value) {
    if (!item || typeof item !== "object") return null
    const source = item as Record<string, unknown>
    const record = {
      id: typeof source.id === "string" ? source.id.trim() : "",
      titleUz: typeof source.titleUz === "string" ? source.titleUz.trim() : "",
      titleRu: typeof source.titleRu === "string" ? source.titleRu.trim() : "",
      titleTr: typeof source.titleTr === "string" ? source.titleTr.trim() : "",
    }
    if (
      !record.id || ids.has(record.id) ||
      !record.titleUz || !record.titleRu || !record.titleTr ||
      [record.titleUz, record.titleRu, record.titleTr].some((title) => title.length > maxTitleLength)
    ) return null
    ids.add(record.id)
    records.push(record)
  }

  return records
}

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!await userHasPermission(session.userId, "settings.manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-translations" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid-translations" }, { status: 400 })
  }
  const input = body as Record<string, unknown>
  if (!isLocalizedSection(input.section)) {
    return NextResponse.json({ error: "invalid-section" }, { status: 400 })
  }
  const records = parseRecords(input.records, input.section)
  if (!records) {
    return NextResponse.json({ error: "invalid-translations" }, { status: 400 })
  }

  const table = tableBySection[input.section]
  const placeholders = records.map(() => "?").join(", ")
  const existing = await databaseClient.execute({
    sql: `SELECT id FROM ${table} WHERE id IN (${placeholders})`,
    args: records.map((record) => record.id),
  })
  if (existing.rows.length !== records.length) {
    return NextResponse.json({ error: "record-not-found" }, { status: 404 })
  }

  await databaseClient.batch(records.map((record) => ({
    sql: `
      UPDATE ${table}
      SET title_uz = ?, title_ru = ?, title_tr = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    args: [record.titleUz, record.titleRu, record.titleTr, record.id],
  })), "write")

  return NextResponse.json({ updated: records.length })
}
