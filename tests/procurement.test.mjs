import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateQuotationTotal,
  getLocalDateInputValue,
  isExpectedDeliveryDateAllowed,
  normalizeSupplierPhone,
  supplierPhoneMatches,
} from "../src/lib/procurement.ts"
import { formatWorkflowNotification } from "../src/lib/orders.ts"

test("quotation totals are calculated from quantity and unit price per position", () => {
  assert.equal(
    calculateQuotationTotal([
      { quantity: 5, unitPrice: 12_500 },
      { quantity: 2, unitPrice: 80_000 },
    ]),
    222_500,
  )
})

test("expected delivery dates cannot be earlier than today", () => {
  assert.equal(isExpectedDeliveryDateAllowed("2026-08-23", "2026-08-24"), false)
  assert.equal(isExpectedDeliveryDateAllowed("2026-08-24", "2026-08-24"), true)
  assert.equal(isExpectedDeliveryDateAllowed("2026-08-25", "2026-08-24"), true)
  assert.equal(isExpectedDeliveryDateAllowed("2026-02-31", "2026-01-01"), false)
  assert.equal(getLocalDateInputValue(new Date(2026, 7, 24)), "2026-08-24")
})

test("procurement revision notifications include the head comment", () => {
  const notification = {
    event: { kind: "procurement_offer_rejected", comment: "Ikkinchi pozitsiya narxini tekshiring." },
  }
  assert.equal(
    formatWorkflowNotification(notification, "uz"),
    "Tijorat taklifi qayta ishlash uchun qaytarildi: Ikkinchi pozitsiya narxini tekshiring.",
  )
})

test("supplier phone matching ignores formatting differences", () => {
  assert.equal(normalizeSupplierPhone("+998 90 123-45-67"), "998901234567")
  assert.equal(normalizeSupplierPhone("00998 (90) 123 45 67"), "998901234567")
})

test("supplier phone lookup uses full international numbers and suffixes for local numbers", () => {
  const stored = "+998 90 123 45 67"
  assert.equal(supplierPhoneMatches("+998901234567", stored), true)
  assert.equal(supplierPhoneMatches("+7901234567", stored), false)
  assert.equal(supplierPhoneMatches("90 123 45 67", stored), true)
  assert.equal(supplierPhoneMatches("123 45 67", stored), true)
  assert.equal(supplierPhoneMatches("12345", stored), false)
})
