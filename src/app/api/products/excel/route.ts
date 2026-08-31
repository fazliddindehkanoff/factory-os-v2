import { randomUUID } from "node:crypto"
import { asc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { productCategories, products } from "@/db/schema"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import {
  createProductsWorkbook,
  parseProductsWorkbook,
  ProductWorkbookValidationError,
} from "@/lib/product-excel"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_FILE_SIZE = 5 * 1024 * 1024

async function authorize() {
  const session = await getSessionUser()
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!await userHasPermission(session.userId, "settings.manage")) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session }
}

async function getReferences() {
  const categories = await db.select({
    id: productCategories.id,
    titleUz: productCategories.titleUz,
    titleRu: productCategories.titleRu,
    titleTr: productCategories.titleTr,
  }).from(productCategories).orderBy(asc(productCategories.titleUz))
  return { categories }
}

async function getActiveProducts() {
  return db.select({
    id: products.id,
    code: products.code,
    categoryId: products.categoryId,
    titleUz: products.titleUz,
    titleRu: products.titleRu,
    titleTr: products.titleTr,
  }).from(products).where(eq(products.isActive, true)).orderBy(asc(products.code))
}

export async function GET() {
  const authorization = await authorize()
  if ("response" in authorization) return authorization.response

  const [catalog, references] = await Promise.all([getActiveProducts(), getReferences()])
  const workbook = await createProductsWorkbook(catalog, references)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(workbook, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="factory-os-products-${date}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  })
}

export async function POST(request: Request) {
  const authorization = await authorize()
  if ("response" in authorization) return authorization.response

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File) || !file.name.toLocaleLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "An .xlsx file is required." }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "The workbook must be 5 MB or smaller." }, { status: 413 })
  }

  const references = await getReferences()
  let importedProducts
  try {
    importedProducts = await parseProductsWorkbook(Buffer.from(await file.arrayBuffer()), references)
  } catch (error) {
    if (error instanceof ProductWorkbookValidationError) {
      return NextResponse.json({
        error: error.message,
        issues: error.issues.slice(0, 50),
        issueCount: error.issues.length,
      }, { status: 400 })
    }
    return NextResponse.json({ error: "The workbook could not be read." }, { status: 400 })
  }

  const codes = importedProducts.map((product) => product.code)
  const existing = codes.length > 0
    ? await db.select({ code: products.code }).from(products).where(inArray(products.code, codes))
    : []
  const existingCodes = new Set(existing.map((product) => product.code))
  const updatedAt = new Date().toISOString()

  await db.transaction(async (transaction) => {
    for (const product of importedProducts) {
      await transaction.insert(products).values({
        id: randomUUID(),
        ...product,
        isActive: true,
        updatedAt,
      }).onConflictDoUpdate({
        target: products.code,
        set: {
          categoryId: product.categoryId,
          unitTypeId: null,
          titleUz: product.titleUz,
          titleRu: product.titleRu,
          titleTr: product.titleTr,
          isActive: true,
          updatedAt,
        },
      })
    }
  })

  return NextResponse.json({
    created: importedProducts.length - existingCodes.size,
    updated: existingCodes.size,
    products: await getActiveProducts(),
  })
}
