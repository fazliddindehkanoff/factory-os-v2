import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { productCategories, products } from "@/db/schema"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import { generateProductCode, parseNewProductInput } from "@/lib/product-input"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!await userHasPermission(session.userId, "requests.create")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-product" }, { status: 400 })
  }

  const parsed = parseNewProductInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const input = parsed.value
  const category = await db.select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.id, input.categoryId))
    .limit(1)

  if (!category.length) {
    return NextResponse.json({ error: "invalid-product" }, { status: 400 })
  }

  const id = randomUUID()
  const product = { id, code: generateProductCode(id), ...input }
  try {
    await db.insert(products).values({ ...product, isActive: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.toLocaleLowerCase().includes("unique constraint failed: products.code")) {
      return NextResponse.json({ error: "product-code-exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "product-create-failed" }, { status: 500 })
  }

  return NextResponse.json({ product }, { status: 201 })
}
