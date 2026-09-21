import assert from "node:assert/strict"
import test from "node:test"
import { paymentsForOrder, paymentActions, canSeePayment, transitionPayment, cancelFinanceOrder } from "../src/lib/finance-workflow.ts"
const now = "2026-09-20T12:00:00.000Z"
const actor = (role, userId = role) => ({ userId, roles: [role], canView: true, canApprove: true, canReject: true, canPay: true })
const line = (id, amount = 100, prepaidAmount = 30) => ({ quotationId: "quote", orderLineId: id, supplierId: "supplier", supplierName: "Supplier", supplierInn: "123", amount, prepaidAmount, method: "bank", dueDate: "2026-12-01", contractNumber: "A", quantity: 1, unitPrice: amount })
const order = { id: "child-1", number: "ORD-1/1", status: "in_progress", currentStep: "warehouse_receipt", waitingForUserId: "warehouse", lines: ["one", "two"].map((id) => ({ id, productId: `product-${id}`, fulfillmentStatus: "needs_procurement" })), procurementSpecialistUserId: "a", placement: { createdAt: now, createdByUserId: "a", lines: [line("one"), line("two", 200, 20)] } }
const head = actor("procurement_head"), director = actor("director"), financier = actor("finance"), a = actor("procurement_manager", "a"), b = actor("procurement_manager", "b")
test("placement groups by supplier and splits advance/balance exactly, stable IDs", () => {
  const payments = paymentsForOrder(order)
  assert.deepEqual(payments.map((payment) => [payment.kind, payment.amount]), [["advance", 50], ["balance", 250]])
  assert.equal(payments[0].lines.length, 2)
  assert.equal(payments[0].lines[0].productId, "product-one")
  assert.deepEqual(paymentsForOrder(order), payments)
  assert.equal(paymentsForOrder({ ...order, procurementSplit: true }).length, 0)
})
test("zero parts omitted and separate placement batches kept separate", () => {
  const payments = paymentsForOrder({ ...order, placement: { ...order.placement, lines: [line("one", 100, 100), { ...line("two", 50, 0), placedAt: "2026-09-21T12:00:00Z" }] } })
  assert.deepEqual(payments.map((payment) => [payment.kind, payment.amount]), [["advance", 100], ["balance", 50]])
})
test("specialists see only related payments even with finance.view; head sees all", () => {
  const payment = paymentsForOrder(order)[0]
  assert.equal(canSeePayment(payment, a), true)
  assert.equal(canSeePayment(payment, b), false)
  assert.equal(canSeePayment(payment, head), true)
  assert.equal(canSeePayment(payment, { ...b, roles: ["procurement"] }), false)
})
test("strict head -> director -> financier; repeated payments cannot execute", () => {
  let payment = paymentsForOrder(order)[0]
  assert.deepEqual(paymentActions(payment, financier), [])
  assert.throws(() => transitionPayment(payment, director, "approve", "", now), /forbidden/)
  payment = transitionPayment(payment, head, "approve", "", now)
  assert.equal(payment.stage, "director_review")
  payment = transitionPayment(payment, director, "approve", "", now)
  assert.deepEqual(paymentActions(payment, financier), ["paid"])
  for (const action of ["approve", "return", "cancel"]) assert.throws(() => transitionPayment(payment, financier, action, "test", now), /forbidden/)
  payment = transitionPayment(payment, financier, "paid", "Bank ref 123", now)
  assert.equal(payment.stage, "paid")
  assert.equal(payment.revision, 3)
  assert.throws(() => transitionPayment(payment, financier, "paid", "", now), /forbidden/)
})
test("return requires comment, only placing specialist corrects then both approvals repeat", () => {
  const payment = paymentsForOrder(order)[1]
  assert.throws(() => transitionPayment(payment, head, "return", " ", now), /comment-required/)
  const returned = transitionPayment(payment, head, "return", "Check date", now)
  assert.deepEqual(paymentActions(returned, a), ["resubmit"])
  assert.deepEqual(paymentActions(returned, b), [])
  const correction = { method: "cash", dueDate: "2026-12-22", contractNumber: "B", amount: 999, supplierInn: "forged" }
  const corrected = transitionPayment(returned, a, "resubmit", "Corrected date", now, correction)
  assert.equal(corrected.stage, "head_review")
  assert.equal(corrected.amount, payment.amount)
  assert.equal(corrected.supplierInn, payment.supplierInn)
  assert.equal(corrected.method, "cash")
  assert.equal(corrected.dueDate, "2026-12-22")
  assert.throws(() => transitionPayment(returned, a, "resubmit", "fixed", now, { ...correction, dueDate: "2026-02-30" }), /invalid-correction/)
})
test("approval/payment permissions still required, owner grants do not bypass role stages", () => {
  const payment = paymentsForOrder(order)[0]
  assert.deepEqual(paymentActions(payment, actor("owner")), [])
  assert.deepEqual(paymentActions(payment, { ...head, canApprove: false, canReject: false }), [])
  assert.deepEqual(paymentActions({ ...payment, stage: "payment" }, { ...financier, canPay: false }), [])
})
test("cancel closes the exact order and all its procurement lanes; preserves placement evidence", () => {
  const cancelled = cancelFinanceOrder(order, head.userId, now, "No longer needed")
  assert.equal(cancelled.id, order.id)
  assert.equal(cancelled.status, "rejected")
  assert.equal(cancelled.waitingForUserId, undefined)
  assert.equal(cancelled.currentStep, "complete")
  assert.equal(cancelled.placement, order.placement)
  assert.equal(Object.values(cancelled.procurementProgress).every((state) => state.step === "complete" && state.rejected), true)
  assert.equal(paymentsForOrder(cancelled).every((payment) => payment.stage === "cancelled"), true)
})
