import assert from "node:assert/strict"
import test from "node:test"

import {
  createProductsWorkbook,
  parseProductsWorkbook,
  ProductWorkbookValidationError,
} from "../src/lib/product-excel.ts"

const references = {
  categories: [
    { id: "category-material", titleUz: "Xomashyo", titleRu: "Сырьё", titleTr: "Hammadde" },
  ],
}

test("the product workbook round-trips its editable product fields", async () => {
  const product = {
    code: "MAT-001",
    categoryId: "category-material",
    titleUz: "Po‘lat",
    titleRu: "Сталь",
    titleTr: "Çelik",
  }

  const workbook = await createProductsWorkbook([product], references)
  const parsed = await parseProductsWorkbook(workbook, references)

  assert.deepEqual(parsed, [product])
})

test("the product importer reports the row for invalid references", async () => {
  const workbook = await createProductsWorkbook([{
    code: "MAT-404",
    categoryId: "missing-category",
    titleUz: "Noma’lum",
    titleRu: "",
    titleTr: "",
  }], references)

  await assert.rejects(
    parseProductsWorkbook(workbook, references),
    (error) => {
      assert.equal(error instanceof ProductWorkbookValidationError, true)
      assert.equal(error.issues.some((issue) => issue.row === 2 && issue.message.includes("Unknown Category ID")), true)
      return true
    },
  )
})

test("the product importer rejects titles longer than one hundred characters", async () => {
  const workbook = await createProductsWorkbook([{
    code: "MAT-100",
    categoryId: "category-material",
    titleUz: "a".repeat(101),
    titleRu: "",
    titleTr: "",
  }], references)

  await assert.rejects(
    parseProductsWorkbook(workbook, references),
    (error) => {
      assert.equal(error instanceof ProductWorkbookValidationError, true)
      assert.equal(
        error.issues.some((issue) => issue.row === 2 && issue.message.includes("100 characters")),
        true,
      )
      return true
    },
  )
})
