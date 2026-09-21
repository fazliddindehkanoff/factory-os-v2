import assert from "node:assert/strict"
import test from "node:test"
import { groupPaymentLines, expandPaymentGroups } from "../src/lib/order-payment-groups.ts"
import { validateOrderPayments } from "../src/lib/order-payment.ts"

const rows = [
  { quotationId: "q1", orderLineId: "l1", supplierId: "s1", supplierName: "Same name", quantity: 1, unitPrice: 1.01, amount: 1.01, method: "cash" },
  { quotationId: "q2", orderLineId: "l2", supplierId: "s1", supplierName: "Same name", quantity: 1, unitPrice: 2.02, amount: 2.02, method: "bank" },
  { quotationId: "q3", orderLineId: "l3", supplierId: "s2", supplierName: "Same name", quantity: 1, unitPrice: 3, amount: 3, method: "cash" },
]

test("group by supplier ID across quote packages, not by supplier name", () => {
  const groups = groupPaymentLines(rows)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].lines.length, 2)
  assert.equal(groups[0].amount, 3.03)
  assert.equal(groups[0].method, "original")
  assert.equal(groups[1].method, "cash")
})

test("one supplier's terms fan out only to its selected products and preserve original methods", () => {
  const groups = groupPaymentLines(rows)
  Object.assign(groups[0], { prepaidAmount: 1, supplierInn: " 123456789 ", dueDate: "2026-12-31", contractNumber: "Shared" })
  const expanded = expandPaymentGroups(groups.slice(0, 1))
  assert.equal(expanded.length, 2)
  assert.deepEqual(expanded.map(row => row.method), ["cash", "bank"])
  assert.deepEqual(expanded.map(row => row.prepaidAmount), [0.33, 0.67])
  assert.ok(expanded.every(row => row.supplierInn === "123456789" && row.contractNumber === "Shared"))
  groups[0].method = "bank"
  assert.ok(expandPaymentGroups(groups.slice(0, 1)).every(row => row.method === "bank"))
})

test("supplier advance stays exact at cents including full advance", () => {
  for (const prepaidAmount of [0, 0.01, 0.02, 1, 3.02, 3.03]) {
    const [group] = groupPaymentLines(rows)
    group.prepaidAmount = prepaidAmount
    const expanded = expandPaymentGroups([group])
    assert.equal(Math.round(expanded.reduce((sum, line) => sum + line.prepaidAmount, 0) * 100), Math.round(prepaidAmount * 100))
    assert.ok(expanded.every(line => line.prepaidAmount >= 0 && line.prepaidAmount <= line.amount))
  }
  for (const prepaidAmount of [-1, 4, NaN, Infinity, 1.001]) {
    const [group] = groupPaymentLines(rows)
    group.prepaidAmount = prepaidAmount
    assert.throws(() => expandPaymentGroups([group]), /invalid-prepayment/)
  }
})

test("grouped payload retains existing API coverage and source-price checks", () => {
  const order = { id: "o", currentStep: "procurement_order", lines: rows.map(row => ({ id: row.orderLineId, quantity: 1, fulfillmentStatus: "needs_procurement" })) }
  const quotes = rows.map(row => ({ id: row.quotationId, procurementCaseId: "procurement-o", supplierId: row.supplierId, supplierName: row.supplierName, selected: true, lines: [row] }))
  const [group] = groupPaymentLines(rows)
  group.prepaidAmount = 3.03
  const validated = validateOrderPayments(order, quotes, expandPaymentGroups([group]))
  assert.equal(validated.length, 2)
  assert.equal(validated.reduce((sum, row) => sum + Math.round(row.prepaidAmount * 100), 0), 303)
})
