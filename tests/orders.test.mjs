import assert from "node:assert/strict"
import test from "node:test"

import {
  canCreateRequestForApplicant,
  canUserViewRejectedOrder,
  formatWorkflowNotification,
  getNextWorkflowStep,
  isOrderSuccessfullyClosed,
  isOrderWaitingForUser,
  resolveOrderApplicantId,
  shouldSkipSupervisorApproval,
  workflowSteps,
} from "../src/lib/orders.ts"

test("assistant-created requests still require the selected supervisor approval", () => {
  assert.equal(shouldSkipSupervisorApproval("user-assistant", "user-supervisor"), false)
})

test("assistants can create requests only for department supervisors", () => {
  assert.equal(
    canCreateRequestForApplicant(["role-requester"], ["role-dept_head"]),
    true,
  )
  assert.equal(
    canCreateRequestForApplicant(["role-requester"], ["role-requester"]),
    false,
  )
  assert.equal(
    canCreateRequestForApplicant(["role-dept_head"], ["role-dept_head"]),
    true,
  )
})

test("only assistants may choose a different applicant", () => {
  assert.equal(
    resolveOrderApplicantId(
      { id: "user-assistant", roleIds: ["role-requester"] },
      "user-supervisor",
    ),
    "user-supervisor",
  )
  assert.equal(
    resolveOrderApplicantId(
      { id: "user-director", roleIds: ["role-director"] },
      "user-supervisor",
    ),
    "user-director",
  )
})

test("a supervisor creating their own request skips only their own approval", () => {
  assert.equal(shouldSkipSupervisorApproval("user-supervisor", "user-supervisor"), true)
  assert.equal(shouldSkipSupervisorApproval("user-supervisor", undefined), false)
})

test("waiting-for-me is an exact user assignment", () => {
  const order = { currentStep: "department_supervisor", waitingForUserId: "user-production-supervisor" }
  assert.equal(isOrderWaitingForUser(order, "user-production-supervisor"), true)
  assert.equal(isOrderWaitingForUser(order, "user-other-supervisor"), false)
  assert.equal(isOrderWaitingForUser(order, undefined), false)
})

test("warehouse-stage requests follow the configured warehouse responsible user", () => {
  const staleOrder = { currentStep: "warehouse", waitingForUserId: "user-admin" }
  assert.equal(isOrderWaitingForUser(staleOrder, "user-warehouse", "user-warehouse"), true)
  assert.equal(isOrderWaitingForUser(staleOrder, "user-admin", "user-warehouse"), false)
})

test("procured orders pass through operational work and both final supervisors", () => {
  assert.deepEqual(workflowSteps.slice(-4), [
    "procurement_order",
    "procurement_supervisor",
    "warehouse_receipt",
    "warehouse_supervisor",
  ])
  assert.equal(getNextWorkflowStep("director"), "procurement_order")
  assert.equal(getNextWorkflowStep("procurement_order"), "procurement_supervisor")
  assert.equal(getNextWorkflowStep("procurement_supervisor"), "warehouse_receipt")
  assert.equal(getNextWorkflowStep("warehouse_receipt"), "warehouse_supervisor")
  assert.equal(getNextWorkflowStep("warehouse_supervisor"), "complete")
})

test("warehouse receipt follows the configured warehouse responsible user", () => {
  const order = { currentStep: "warehouse_receipt", waitingForUserId: "user-admin" }
  assert.equal(isOrderWaitingForUser(order, "user-warehouse", "user-warehouse"), true)
  assert.equal(isOrderWaitingForUser(order, "user-admin", "user-warehouse"), false)
})

test("workflow notifications render in the active locale", () => {
  const notification = { event: { kind: "action_required" } }
  assert.equal(formatWorkflowNotification(notification, "uz"), "Buyurtma sizning amalingizni kutmoqda.")
  assert.equal(formatWorkflowNotification(notification, "ru"), "Заявка ожидает вашего действия.")
  assert.equal(formatWorkflowNotification(notification, "tr"), "Talep işleminizi bekliyor.")
})

test("legacy English notifications are localized without losing saved history", () => {
  const legacy = { message: "ORD-2026-0012 is now waiting for your action." }
  assert.equal(formatWorkflowNotification(legacy, "ru"), "Заявка ожидает вашего действия.")
})

test("successful closure includes approved and warehouse-fulfilled terminal orders", () => {
  assert.equal(isOrderSuccessfullyClosed({ currentStep: "complete", status: "approved" }), true)
  assert.equal(isOrderSuccessfullyClosed({ currentStep: "complete", status: "fulfilled" }), true)
  assert.equal(isOrderSuccessfullyClosed({ currentStep: "warehouse", status: "warehouse_check" }), false)
  assert.equal(isOrderSuccessfullyClosed({ currentStep: "complete", status: "rejected" }), false)
})

test("rejected requests are visible only to the creator and involved supervisor", () => {
  const rejected = {
    status: "rejected",
    createdByUserId: "user-assistant",
    applicantId: "user-supervisor",
    lastActorUserId: "user-supervisor",
  }
  assert.equal(canUserViewRejectedOrder(rejected, "user-assistant", "user-supervisor"), true)
  assert.equal(canUserViewRejectedOrder(rejected, "user-supervisor", "user-supervisor"), true)
  assert.equal(canUserViewRejectedOrder(rejected, "user-director", "user-supervisor"), false)
  assert.equal(
    canUserViewRejectedOrder({ ...rejected, status: "warehouse_check" }, "user-director", "user-supervisor"),
    true,
  )
})
