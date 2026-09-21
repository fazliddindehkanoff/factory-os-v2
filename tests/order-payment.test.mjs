import assert from "node:assert/strict"
import test from "node:test"
import { approvedPaymentLines, validateOrderPayments } from "../src/lib/order-payment.ts"

const order = { id: "child", currentStep: "procurement_order", lines: [{ id: "one", quantity: 10, availableQuantity: 2, fulfillmentStatus: "needs_procurement" }] }
const quote = (id, quantity) => ({ id, selected: true, procurementCaseId: "procurement-child", supplierId: id, supplierName: id, lines: [{ orderLineId: "one", quantity, unitPrice: 100 }] })
const quotes = [quote("supplier-a", 3), quote("supplier-b", 5)]
const inputs = () => approvedPaymentLines(order, quotes).map((line) => ({ ...line, prepaidAmount: 100, dueDate: "2026-12-20", contractNumber: "  C-001  " }))

test("each accepted supplier-position retains independent terms and authoritative price", () => {
  const input = inputs()
  input[0].amount = 999999
  input[0].supplierId = "forged"
  const result = validateOrderPayments(order, quotes, input)
  assert.equal(result.length, 2)
  assert.equal(result[0].amount, 300)
  assert.equal(result[0].supplierId, "supplier-a")
  assert.equal(result[0].prepaidPercent, 33.33)
  assert.equal(result[0].contractNumber, "C-001")
})
test("reject missing, duplicate and foreign positions", () => {
  assert.throws(() => validateOrderPayments(order, quotes, inputs().slice(1)), /payment-lines-required/)
  assert.throws(() => validateOrderPayments(order, quotes, [inputs()[0], inputs()[0]]), /invalid-payment-position/)
  const input = inputs(); input[0].orderLineId = "sibling-position"
  assert.throws(() => validateOrderPayments(order, quotes, input), /invalid-payment-position/)
})
test("ignore unselected and sibling offers, reject under/over coverage", () => {
  assert.equal(approvedPaymentLines(order, [...quotes, { ...quote("sibling", 8), procurementCaseId: "procurement-other" }, { ...quote("unselected", 8), selected: false }]).length, 2)
  assert.throws(() => validateOrderPayments(order, [quote("a", 7)], inputs()), /approved-offers-incomplete/)
  assert.throws(() => validateOrderPayments(order, [quote("a", 9)], inputs()), /approved-offers-incomplete/)
})
test("prepayment must be finite, nonnegative, at most total, and have two decimal places", () => {
  for (const amount of [-1, 301, Infinity, NaN, 1.001, "100"]) {
    const input = inputs(); input[0].prepaidAmount = amount
    assert.throws(() => validateOrderPayments(order, quotes, input), /invalid-prepayment/)
  }
})
test("balance needs real calendar due date; full prepayment permits empty due date", () => {
  for (const date of ["", "2026-02-30", "not-a-date"]) {
    const input = inputs(); input[0].dueDate = date
    assert.throws(() => validateOrderPayments(order, quotes, input), /payment-date/)
  }
  const input = inputs(); input[0].prepaidAmount = 300; input[0].dueDate = ""
  assert.equal(validateOrderPayments(order, quotes, input)[0].prepaidPercent, 100)
})
test("validate payment method and contract number", () => {
  const input = inputs(); input[0].method = "crypto"
  assert.throws(() => validateOrderPayments(order, quotes, input), /invalid-payment-method/)
  input[0].method = "cash"; input[0].contractNumber = "X".repeat(151)
  assert.throws(() => validateOrderPayments(order, quotes, input), /invalid-contract-number/)
})
