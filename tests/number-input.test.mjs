import assert from "node:assert/strict"
import test from "node:test"
import { normalizeNumberDraft, numberDraftValue } from "../src/lib/number-input.ts"

test("typing after a zero replaces it instead of prefixing it", () => {
  assert.equal(normalizeNumberDraft("0123"), "123")
  assert.equal(normalizeNumberDraft("05"), "5")
  assert.equal(normalizeNumberDraft("00.5"), "0.5")
  assert.equal(normalizeNumberDraft("0.5"), "0.5")
  assert.equal(normalizeNumberDraft("0"), "0")
  assert.equal(normalizeNumberDraft("-012"), "-12")
  assert.equal(normalizeNumberDraft("100"), "100")
})

test("a cleared field is allowed and counts as zero", () => {
  assert.equal(normalizeNumberDraft(""), "")
  assert.equal(numberDraftValue(""), 0)
  assert.equal(numberDraftValue("12.5"), 12.5)
})
