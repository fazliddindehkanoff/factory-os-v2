import assert from "node:assert/strict"
import test from "node:test"
import { planProcurementAssignment, advanceProcurementLines, createProcurementChild, buildProcurementSuborders, buildApprovedOrder, getProcurementSuborderForSpecialist, isOperationalOrder, isOrderWaitingForUser } from "../src/lib/orders.ts"

const now = "2026-09-19T12:00:00.000Z"
const root = () => ({ id: "root", number: "ORD-2026-0020", currentStep: "procurement_accept", waitingForUserId: "head", status: "in_progress", createdAt: now,
  lines: [1,2,3,4,5].map((n) => ({ id: `line-${n}`, quantity: 10, availableQuantity: 2, fulfillmentStatus: "needs_procurement" })), workflowHistory: [], comments: [{ id: "original-comment" }] })

test("A, B, A allocation creates two independent orders, retaining identity and offers", () => {
  const a = planProcurementAssignment(root(), [], "a", ["line-1"], "head", now)
  const b = planProcurementAssignment(a.parent, [a.child], "b", ["line-2", "line-3"], "head", now)
  const a2 = planProcurementAssignment(b.parent, [a.child, b.child], "a", ["line-4", "line-5"], "head", now)
  assert.equal(a2.child.id, a.child.id)
  assert.equal(a2.child.number, "ORD-2026-0020/1")
  assert.equal(b.child.number, "ORD-2026-0020/2")
  assert.equal(a2.child.lines.length, 3)
  assert.equal(b.child.lines.length, 2)
  assert.equal(a2.child.lines[0].availableQuantity, 2)
  assert.equal(a2.child.waitingForUserId, "a")
  assert.equal(b.child.waitingForUserId, "b")
  assert.equal(a2.parent.procurementSuborders.length, 2)
  assert.equal(isOperationalOrder(a.parent), true)
  assert.equal(isOperationalOrder(a2.parent), false)
  assert.equal(isOrderWaitingForUser(a2.parent, "head"), false)
  assert.equal(getProcurementSuborderForSpecialist(a2.child, "a").number, "ORD-2026-0020/1")
  assert.equal(a2.parent.comments.length, 1)
  assert.deepEqual(a2.child.comments, [])
})

test("assigned positions and submitted child orders cannot be silently changed", () => {
  const a = planProcurementAssignment(root(), [], "a", ["line-1"], "head", now)
  assert.throws(() => planProcurementAssignment(a.parent, [a.child], "b", ["line-1"], "head", now), /already-assigned/)
  assert.throws(() => planProcurementAssignment(a.parent, [{ ...a.child, currentStep: "price_check" }], "a", ["line-2"], "head", now), /already-submitted/)
  assert.throws(() => planProcurementAssignment(a.child, [], "b", ["line-1"], "head", now), /forbidden/)
  assert.equal(buildApprovedOrder(a.parent, "head", "a", false), null)
})

test("legacy submitted child migrates to head review without waiting for another specialist", () => {
  const parent = { ...root(), currentStep: "sourcing", procurementLineAssignments: { "line-1": "a", "line-2": "b" } }
  const descriptors = buildProcurementSuborders(parent)
  const a = createProcurementChild(parent, { ...descriptors[0], status: "submitted", submittedAt: now }, "head")
  const b = createProcurementChild(parent, descriptors[1], "head")
  assert.equal(a.currentStep, "price_check")
  assert.equal(a.waitingForUserId, "head")
  assert.equal(b.currentStep, "sourcing")
  assert.equal(b.waitingForUserId, "b")
  assert.equal(a.workflowHistory.at(-1).step, "sourcing")
  assert.equal(b.workflowHistory.at(-1).step, "procurement_accept")
})

test("downstream approvals affect only the child and return to its own specialist", () => {
  const a = planProcurementAssignment(root(), [], "a", ["line-1"], "head", now).child
  const directorOrder = { ...a, currentStep: "director", waitingForUserId: "director" }
  const purchasing = buildApprovedOrder(directorOrder, "director", "a", false, now)
  assert.equal(purchasing.currentStep, "procurement_order")
  assert.equal(purchasing.waitingForUserId, "a")
  const receipt = buildApprovedOrder(purchasing, "a", "warehouse", true, now)
  const complete = buildApprovedOrder(receipt, "warehouse", undefined, true, now)
  assert.equal(complete.currentStep, "complete")
  assert.equal(complete.parentOrderId, "root")
  assert.equal(complete.number, "ORD-2026-0020/1")
})

test("appending to a partially sourcing child preserves progress and initializes new positions", () => {
  const a = planProcurementAssignment(root(), [], "a", ["line-1", "line-2"], "head", now)
  const progressed = advanceProcurementLines(a.child, ["line-1"], "sourcing", "price_check", "a", "head", now)
  const updated = planProcurementAssignment(a.parent, [progressed], "a", ["line-3"], "head", now)
  assert.equal(updated.child.id, a.child.id)
  assert.equal(updated.child.procurementProgress["line-1"].step, "price_check")
  assert.deepEqual(updated.child.procurementProgress["line-3"], { step: "sourcing", waitingForUserId: "a" })
  assert.equal(isOrderWaitingForUser(updated.child, "head"), true)
  assert.equal(isOrderWaitingForUser(updated.child, "a"), true)
})
