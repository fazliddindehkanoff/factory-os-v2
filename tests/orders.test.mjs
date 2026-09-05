import assert from "node:assert/strict"
import test from "node:test"

import {
  canCreateRequestForApplicant,
  canUserViewRejectedOrder,
  formatWorkflowNotification,
  getNextWorkflowStep,
  isOrderSuccessfullyClosed,
  isOrderWaitingForUser,
  normalizeOrderCommentBody,
  resolveOrderApplicantId,
  shouldSkipSupervisorApproval,
  workflowSteps,
  truncateLabel,
} from "../src/lib/orders.ts"
import { containsUserMention } from "../src/lib/mentions.ts"

test("mentions match a complete username without matching prefixes", () => {
  assert.equal(containsUserMention("Please check this, @sarvar.", "sarvar"), true)
  assert.equal(containsUserMention("Please check this, @sarvarjon.", "sarvar"), false)
  assert.equal(containsUserMention("@SARVAR please check", "sarvar"), true)
})

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

test("procured orders move directly from ordering to warehouse receipt", () => {
  assert.deepEqual(workflowSteps.slice(-2), [
    "procurement_order",
    "warehouse_receipt",
  ])
  assert.equal(getNextWorkflowStep("director"), "procurement_order")
  assert.equal(getNextWorkflowStep("procurement_order"), "warehouse_receipt")
  assert.equal(getNextWorkflowStep("warehouse_receipt"), "complete")
})

test("selected product labels are capped at forty characters", () => {
  const label = "PRD-20260901-ABCDEFGH · A deliberately long product title"
  const truncated = truncateLabel(label, 40)
  assert.equal(truncated.length <= 40, true)
  assert.equal(truncated.endsWith("…"), true)
  assert.equal(truncateLabel("Short product", 40), "Short product")
})

test("order comments are trimmed and limited to two thousand characters", () => {
  assert.equal(normalizeOrderCommentBody("  Ready for review.  "), "Ready for review.")
  assert.equal(normalizeOrderCommentBody("   "), null)
  assert.equal(normalizeOrderCommentBody("a".repeat(2_001)), null)
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
