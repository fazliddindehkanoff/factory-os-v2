import assert from "node:assert/strict"
import test from "node:test"

import { parseNewProductInput } from "../src/lib/product-input.ts"

test("new product input is trimmed and its code is normalized", () => {
  assert.deepEqual(parseNewProductInput({
    code: " mat-009 ",
    categoryId: " category-material ",
    unitTypeId: " unit-piece ",
    titleUz: " Bolt ",
    titleRu: " ",
    titleTr: " ",
  }), {
    ok: true,
    value: {
      code: "MAT-009",
      categoryId: "category-material",
      unitTypeId: "unit-piece",
      titleUz: "Bolt",
      titleRu: "",
      titleTr: "",
    },
  })
})

test("new product input requires references, a code, and one title", () => {
  assert.deepEqual(parseNewProductInput({
    code: "MAT-010",
    categoryId: "category-material",
    unitTypeId: "unit-piece",
    titleUz: "",
    titleRu: "",
    titleTr: "",
  }), { ok: false, error: "invalid-product" })
  assert.deepEqual(parseNewProductInput(null), { ok: false, error: "invalid-product" })
})
