import assert from "node:assert/strict"
import test from "node:test"

import { generateProductCode, parseNewProductInput } from "../src/lib/product-input.ts"

test("new product input is trimmed without requiring a code or unit", () => {
  assert.deepEqual(parseNewProductInput({
    categoryId: " category-material ",
    titleUz: " Bolt ",
    titleRu: " ",
    titleTr: " ",
  }), {
    ok: true,
    value: {
      categoryId: "category-material",
      titleUz: "Bolt",
      titleRu: "",
      titleTr: "",
    },
  })
})

test("new product input requires a category and one title", () => {
  assert.deepEqual(parseNewProductInput({
    categoryId: "category-material",
    titleUz: "",
    titleRu: "",
    titleTr: "",
  }), { ok: false, error: "invalid-product" })
  assert.deepEqual(parseNewProductInput(null), { ok: false, error: "invalid-product" })
})

test("product titles cannot exceed one hundred characters", () => {
  assert.equal(parseNewProductInput({
    categoryId: "category-material",
    titleUz: "a".repeat(100),
    titleRu: "",
    titleTr: "",
  }).ok, true)
  assert.deepEqual(parseNewProductInput({
    categoryId: "category-material",
    titleUz: "a".repeat(101),
    titleRu: "",
    titleTr: "",
  }), { ok: false, error: "invalid-product" })
})

test("product codes are generated deterministically from the product id", () => {
  assert.equal(
    generateProductCode("50cdb174-56a2-44d5-922e-d277171f4ec8"),
    "PRD-50CDB17456A2",
  )
})
