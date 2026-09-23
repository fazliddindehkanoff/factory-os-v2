import assert from "node:assert/strict"
import test from "node:test"

import { buildFlowMap, buildMyQueue, dailyTrend, lateOrders, placementMoney, specialistLoad } from "../src/lib/dashboard-insights.ts"

const now = Date.parse("2026-09-23T12:00:00")
const line = (id) => ({ id, productId: "p", quantity: 5, note: "", fulfillmentStatus: "needs_procurement" })
const base = (id, extra = {}) => ({ id, number: id, createdByUserId: "u", type: "material", applicantId: "u", departmentIds: [], branchIds: [], warehouseId: "w",
  purposeId: "p", expectedDate: "2026-10-01", urgency: "normal", lines: [line(`${id}-1`)], comment: "", attachmentNames: [], status: "in_progress",
  currentStep: "director", waitingForUserId: "director", lastActorUserId: "u", createdAt: "2026-09-20T12:00:00", workflowHistory: [], ...extra })

test("flow map counts orders per step, splits independent positions and finds the bottleneck", () => {
  const orders = [
    base("a", { workflowHistory: [{ step: "price_check", action: "approved", actorUserId: "head", createdAt: "2026-09-21T12:00:00" }] }),
    base("b", { currentStep: "director", createdAt: "2026-09-13T12:00:00" }),
    base("c", { currentStep: "sourcing", lines: [line("c-1"), line("c-2")], procurementProgress: {
      "c-1": { step: "sourcing", waitingForUserId: "s1" }, "c-2": { step: "director", waitingForUserId: "director" } } }),
    base("done", { currentStep: "complete", status: "approved" }),
  ]
  const { stages, bottleneck } = buildFlowMap(orders, now)
  const director = stages.find((stage) => stage.step === "director")
  assert.deepEqual(director.orderIds, ["a", "b", "c"])
  assert.equal(Math.round(director.maxDays), 10)
  assert.equal(Math.round(stages.find((stage) => stage.step === "director").avgDays * 10) / 10, 5)
  assert.deepEqual(stages.find((stage) => stage.step === "sourcing").holders, [{ userId: "s1", count: 1 }])
  assert.equal(bottleneck, "director")
})

test("my queue puts critical and late work first", () => {
  const orders = [
    base("old", { createdAt: "2026-09-10T12:00:00" }),
    base("critical", { urgency: "critical" }),
    base("late", { expectedDate: "2026-09-22" }),
    base("other", { waitingForUserId: "someone" }),
  ]
  assert.deepEqual(buildMyQueue(orders, "director", now).map((item) => item.order.id), ["critical", "late", "old"])
})

test("late orders ignore closed ones", () => {
  const orders = [base("late", { expectedDate: "2026-09-20" }), base("closed", { expectedDate: "2026-09-01", currentStep: "complete", status: "approved" })]
  assert.deepEqual(lateOrders(orders, now).map((item) => [item.order.id, item.daysLate]), [["late", 3]])
})

test("trend buckets created and closed orders by local day", () => {
  const orders = [base("x", { createdAt: "2026-09-23T09:00:00" }), base("y", { createdAt: "2026-09-01T09:00:00", currentStep: "complete", status: "approved",
    workflowHistory: [{ step: "warehouse_receipt", action: "completed", actorUserId: "w", createdAt: "2026-09-22T10:00:00" }] })]
  const trend = dailyTrend(orders, now)
  assert.equal(trend.length, 14)
  assert.deepEqual(trend.at(-1), { date: "2026-09-23", created: 1, closed: 0 })
  assert.deepEqual(trend.at(-2), { date: "2026-09-22", created: 0, closed: 1 })
})

test("specialist load counts open positions and recent submissions", () => {
  const orders = [base("c", { currentStep: "sourcing", lines: [line("c-1"), line("c-2")], procurementProgress: {
    "c-1": { step: "sourcing", waitingForUserId: "s1" }, "c-2": { step: "procurement_order", waitingForUserId: "s1" } },
    workflowHistory: [{ step: "sourcing", action: "completed", actorUserId: "s1", createdAt: "2026-09-20T10:00:00", orderLineIds: ["c-2"] }] })]
  assert.deepEqual(specialistLoad(orders, ["s1", "s2"], now), [
    { userId: "s1", sourcing: 1, placing: 1, submitted30d: 1 }, { userId: "s2", sourcing: 0, placing: 0, submitted30d: 0 }])
})

test("placement money sums this month and upcoming balances", () => {
  const placementLine = (dueDate, amount, prepaidAmount) => ({ quotationId: "q", orderLineId: "l", method: "bank", prepaidAmount, dueDate, contractNumber: "",
    supplierId: "s", supplierName: "Supplier", quantity: 1, unitPrice: amount, amount, prepaidPercent: 0, placedAt: "2026-09-05T10:00:00" })
  const orders = [base("p", { placement: { createdAt: "2026-09-05T10:00:00", createdByUserId: "s", lines: [placementLine("2026-09-30", 1000, 300), placementLine("2026-12-01", 500, 0)] } })]
  const money = placementMoney(orders, now)
  assert.equal(money.placedThisMonth, 1500)
  assert.equal(money.advancesThisMonth, 300)
  assert.deepEqual(money.upcoming, [{ orderId: "p", orderNumber: "p", supplierName: "Supplier", dueDate: "2026-09-30", amount: 700 }])
})

test("workflow progress averages independent positions", async () => {
  const { workflowProgress } = await import("../src/lib/dashboard-insights.ts")
  assert.equal(workflowProgress(base("d")), 6 / 9)
  assert.equal(workflowProgress(base("c", { currentStep: "complete", status: "approved" })), 1)
  assert.equal(workflowProgress(base("p", { currentStep: "sourcing", lines: [line("p-1"), line("p-2")], procurementProgress: {
    "p-1": { step: "sourcing", waitingForUserId: "s" }, "p-2": { step: "director", waitingForUserId: "d" } } })), 5 / 9)
})

test("dashboard blocks follow role permissions, not role IDs", async () => {
  const { dashboardAccess, procurementTeamIds } = await import("../src/lib/dashboard-insights.ts")
  const custom = [{ id: "role-custom", permissions: ["requests.view", "reports.status_summary", "finance.view"] }]
  assert.deepEqual(dashboardAccess(custom), { orders: true, summary: true, team: false, money: true, createOrder: false })
  assert.deepEqual(dashboardAccess([{ id: "role-x", permissions: [] }]), { orders: false, summary: false, team: false, money: false, createOrder: false })
  assert.equal(dashboardAccess([{ id: "owner", permissions: [], grantsAll: true }]).team, true)
  const roles = [
    { id: "buyer", permissions: ["procurement.quote"] },
    { id: "lead", permissions: ["procurement.quote", "procurement.select_supplier"] },
    { id: "owner", permissions: [], grantsAll: true },
  ]
  const users = [{ id: "a", roleIds: ["buyer"] }, { id: "b", roleIds: ["lead"] }, { id: "c", roleIds: ["owner"] }, { id: "d", roleIds: ["buyer", "lead"] }]
  assert.deepEqual(procurementTeamIds(users, roles), ["a"])
})
