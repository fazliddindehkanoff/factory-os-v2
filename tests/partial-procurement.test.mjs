import assert from "node:assert/strict"
import test from "node:test"
import { advanceProcurementLines, getOrderActionView, getProcurementLinesAtStep, isOrderWaitingForUser } from "../src/lib/orders.ts"
import { approvedPaymentLines, validateOrderPayments } from "../src/lib/order-payment.ts"

const now = "2026-09-20T12:00:00Z"
const root = () => ({ id: "partial", currentStep: "sourcing", waitingForUserId: "specialist", status: "in_progress", procurementSpecialistUserId: "specialist",
  lines: [1,2,3,4,5].map((n) => ({ id: `line-${n}`, quantity: 10, availableQuantity: 2, fulfillmentStatus: "needs_procurement" })) })

test("positions in the same order can wait for different actors independently", () => {
  const order = advanceProcurementLines(root(), ["line-1", "line-2"], "sourcing", "price_check", "specialist", "head", now)
  assert.equal(order.id, "partial")
  assert.equal(order.lines.length, 5)
  assert.equal(isOrderWaitingForUser(order, "specialist"), true)
  assert.equal(isOrderWaitingForUser(order, "head"), true)
  assert.equal(isOrderWaitingForUser(order, "director"), false)
  assert.equal(getProcurementLinesAtStep(order, "sourcing", "specialist").length, 3)
  assert.equal(getOrderActionView(order, "head").currentStep, "price_check")
  assert.throws(() => advanceProcurementLines(order, ["line-1"], "sourcing", "price_check", "specialist", "head", now), /invalid-position-transition/)
})
test("review, approval, partial placement and receipt do not complete the untouched positions", () => {
  let order = advanceProcurementLines(root(), ["line-1", "line-2"], "sourcing", "price_check", "specialist", "head", now)
  order = advanceProcurementLines(order, ["line-1", "line-2"], "price_check", "director", "head", "director", now, "approved")
  order = advanceProcurementLines(order, ["line-1", "line-2"], "director", "procurement_order", "director", "specialist", now, "approved")
  assert.equal(getOrderActionView(order, "specialist").currentStep, "procurement_order")
  order = advanceProcurementLines(order, ["line-1"], "procurement_order", "warehouse_receipt", "specialist", "warehouse", now)
  assert.equal(isOrderWaitingForUser(order, "specialist"), true)
  assert.equal(isOrderWaitingForUser(order, "warehouse"), true)
  order = advanceProcurementLines(order, ["line-1"], "warehouse_receipt", "complete", "warehouse", undefined, now)
  assert.equal(order.status, "in_progress")
  assert.equal(order.procurementProgress["line-2"].step, "procurement_order")
  assert.equal(order.procurementProgress["line-5"].step, "sourcing")
})
test("returning only the reviewed positions preserves other approved and completed work", () => {
  let order = advanceProcurementLines(root(), ["line-1"], "sourcing", "price_check", "specialist", "head", now)
  order = advanceProcurementLines(order, ["line-2"], "sourcing", "price_check", "specialist", "head", now)
  order = advanceProcurementLines(order, ["line-1"], "price_check", "director", "head", "director", now)
  order = advanceProcurementLines(order, ["line-2"], "price_check", "sourcing", "head", "specialist", now, "returned", "Revise price")
  assert.equal(order.procurementProgress["line-1"].step, "director")
  assert.equal(order.procurementProgress["line-2"].reviewComment, "Revise price")
  assert.equal(isOrderWaitingForUser(order, "specialist"), true)
})
test("selected positions inherit offer methods; unapproved and already placed positions are excluded", () => {
  const order = { ...root(), currentStep: "procurement_order" }
  const quote = { id: "q", procurementCaseId: "procurement-partial", selected: true, selectedLineIds: ["line-1", "line-2"], supplierId: "s", supplierName: "Supplier",
    lines: ["line-1", "line-2", "line-3"].map((orderLineId) => ({ orderLineId, quantity: 8, unitPrice: 100, paymentMethod: "cash" })) }
  const rows = approvedPaymentLines(order, [quote])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].method, "cash")
  const selected = validateOrderPayments(order, [quote], [{ ...rows[0], method: "bank", prepaidAmount: 800 }])
  assert.equal(selected.length, 1)
  assert.equal(selected[0].method, "bank")
  order.placement = { lines: selected }
  assert.deepEqual(approvedPaymentLines(order, [quote]).map((line) => line.orderLineId), ["line-2"])
})
