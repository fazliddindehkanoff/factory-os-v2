"use client"

import * as React from "react"

import { useSettings } from "@/components/settings/settings-provider"
import {
  canCreateRequestForApplicant,
  canUserViewRejectedOrder,
  getNextWorkflowStep,
  normalizeOrderCommentBody,
  resolveOrderApplicantId,
  shouldSkipSupervisorApproval,
  type OrderRecord,
  type WorkflowHistoryEntry,
  type WorkflowNotification,
  type WorkflowNotificationEvent,
  type WorkflowStep,
} from "@/lib/orders"
import { hasPermission, type PermissionCode } from "@/lib/rbac"

const initialOrders: OrderRecord[] = []
const retiredDemoOrderIds = new Set([
  "order-2026-0010",
  "order-2026-0011",
  "order-2026-0012",
])

const ORDERS_STORAGE_KEY = "factory-os-demo-orders"
const NOTIFICATIONS_STORAGE_KEY = "factory-os-demo-notifications"

type OrdersContextValue = {
  orders: OrderRecord[]
  notifications: WorkflowNotification[]
  storageReady: boolean
  addOrder: (order: Omit<OrderRecord, "id" | "number" | "createdAt" | "status" | "createdByUserId" | "currentStep" | "waitingForUserId" | "lastActorUserId">) => OrderRecord
  resubmitOrder: (orderId: string, order: Omit<OrderRecord, "id" | "number" | "createdAt" | "status" | "createdByUserId" | "currentStep" | "waitingForUserId" | "lastActorUserId">) => OrderRecord | undefined
  approveOrder: (orderId: string) => void
  rejectOrder: (orderId: string) => void
  submitWarehouseReport: (orderId: string, quantities: Record<string, number>) => void
  assignProcurementSpecialist: (orderId: string, specialistUserId: string) => boolean
  submitProcurementOffers: (orderId: string) => boolean
  reviewProcurementOffers: (orderId: string, approved: boolean, comment?: string) => boolean
  addOrderComment: (orderId: string, body: string, replyToId?: string) => boolean
  markNotificationsRead: () => void
  deleteOrders: (ids: string[]) => void
}

const OrdersContext = React.createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { currentUserId, data } = useSettings()
  const initialSettingsData = React.useRef(data)
  const [orders, setOrders] = React.useState(initialOrders)
  const [notifications, setNotifications] = React.useState<WorkflowNotification[]>([])
  const [storageReady, setStorageReady] = React.useState(false)
  const currentUser = data.users.find((user) => user.id === currentUserId)
  const currentRoles = data.roles.filter((role) => currentUser?.roleIds.includes(role.id))
  const can = (permission: PermissionCode) => hasPermission(currentRoles, permission)

  function canViewOrder(order: OrderRecord) {
    if (!currentUser || (!can("requests.view") && !can("requests.view_own"))) return false
    if (!can("requests.view") && order.createdByUserId !== currentUser.id) return false
    if (
      currentUser.roleIds.includes("role-dept_head") &&
      !order.departmentIds.some((id) => currentUser.departmentIds.includes(id))
    ) return false
    if (
      currentUser.roleIds.includes("role-procurement_manager") &&
      order.procurementSpecialistUserId !== currentUser.id
    ) return false
    const applicant = data.users.find((user) => user.id === order.applicantId)
    const supervisorUserId = applicant?.roleIds.includes("role-dept_head")
      ? applicant.id
      : data.users.find(
          (user) =>
            user.roleIds.includes("role-dept_head") &&
            user.departmentIds.some((id) => order.departmentIds.includes(id)),
        )?.id
    return canUserViewRejectedOrder(order, currentUser.id, supervisorUserId)
  }

  const visibleOrders = orders.filter(canViewOrder)
  const visibleNotifications = notifications.filter((notification) => notification.userId === currentUserId)

  React.useEffect(() => {
    try {
      const savedOrders = window.localStorage.getItem(ORDERS_STORAGE_KEY)
      const savedNotifications = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
      if (savedOrders) {
        const saved = (JSON.parse(savedOrders) as OrderRecord[])
          .filter((order) => !retiredDemoOrderIds.has(order.id))
        const settings = initialSettingsData.current
        setOrders(saved.map((order) => {
          const supervisorId = settings.users.find(
            (user) =>
              user.roleIds.includes("role-dept_head") &&
              user.departmentIds.some((id) => order.departmentIds.includes(id)),
          )?.id
          const incorrectlySkipped =
            order.currentStep === "warehouse" &&
            order.status === "warehouse_check" &&
            order.applicantId === supervisorId &&
            order.createdByUserId !== supervisorId &&
            order.lastActorUserId === order.createdByUserId
          const normalized = incorrectlySkipped
            ? {
                ...order,
                status: "supervisor_review" as const,
                currentStep: "department_supervisor" as const,
                waitingForUserId: supervisorId,
              }
            : order
          const withHistory = {
            ...normalized,
            comments: normalized.comments ?? [],
            workflowHistory: normalized.workflowHistory ?? [],
          }
          const warehouseResponsibleUserId = settings.warehouses.find(
            (warehouse) => warehouse.id === withHistory.warehouseId,
          )?.responsibleUserId
          if (withHistory.currentStep === "procurement_supervisor") {
            return {
              ...withHistory,
              currentStep: "warehouse_receipt" as const,
              status: "in_progress" as const,
              waitingForUserId: warehouseResponsibleUserId,
            }
          }
          if (withHistory.currentStep === "warehouse_supervisor") {
            return {
              ...withHistory,
              currentStep: "complete" as const,
              status: "approved" as const,
              waitingForUserId: undefined,
            }
          }
          if (withHistory.currentStep !== "warehouse" || withHistory.status !== "warehouse_check") {
            return withHistory
          }
          return withHistory.waitingForUserId === warehouseResponsibleUserId
            ? withHistory
            : { ...withHistory, waitingForUserId: warehouseResponsibleUserId }
        }))
      }
      if (savedNotifications) {
        setNotifications((JSON.parse(savedNotifications) as WorkflowNotification[])
          .filter((notification) => !retiredDemoOrderIds.has(notification.orderId)))
      }
    } finally {
      setStorageReady(true)
    }
  }, [])

  React.useEffect(() => {
    if (!storageReady) return
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders))
    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications))
  }, [notifications, orders, storageReady])

  function assigneeFor(
    step: WorkflowStep,
    order: Pick<OrderRecord, "applicantId" | "departmentIds" | "warehouseId" | "procurementSpecialistUserId">,
  ) {
    if (step === "department_supervisor") {
      const selectedSupervisor = data.users.find(
        (user) =>
          user.id === order.applicantId &&
          user.roleIds.includes("role-dept_head") &&
          order.departmentIds.every((id) => user.departmentIds.includes(id)),
      )
      return selectedSupervisor?.id ?? data.users.find(
        (user) =>
          user.roleIds.includes("role-dept_head") &&
          user.departmentIds.some((id) => order.departmentIds.includes(id)),
      )?.id
    }
    if (["warehouse", "warehouse_receipt"].includes(step)) {
      return data.warehouses.find((warehouse) => warehouse.id === order.warehouseId)?.responsibleUserId
    }
    if (["sourcing", "procurement_order"].includes(step) && order.procurementSpecialistUserId) {
      return order.procurementSpecialistUserId
    }
    const roleByStep: Partial<Record<WorkflowStep, string>> = {
      chief_engineer: "role-deputy_director",
      procurement_accept: "role-procurement_head",
      sourcing: "role-procurement_manager",
      price_check: "role-procurement_head",
      director: "role-director",
      procurement_order: "role-procurement_manager",
    }
    const roleId = roleByStep[step]
    const assignee = data.users.find((user) => roleId && user.roleIds.includes(roleId))
    if (assignee) return assignee.id
    return undefined
  }

  function notify(userId: string | undefined, order: OrderRecord, event: WorkflowNotificationEvent) {
    if (!userId) return
    const notification = {
      id: crypto.randomUUID(), userId, orderId: order.id, orderNumber: order.number,
      event, createdAt: new Date().toISOString(), read: false,
    }
    setNotifications((current) => [notification, ...current])
    void fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification),
    })
  }

  function appendWorkflowHistory(
    order: Pick<OrderRecord, "workflowHistory">,
    step: Exclude<WorkflowStep, "complete">,
    action: WorkflowHistoryEntry["action"],
    createdAt = new Date().toISOString(),
  ) {
    return [
      ...(order.workflowHistory ?? []),
      { step, action, actorUserId: currentUserId, createdAt },
    ] satisfies WorkflowHistoryEntry[]
  }

  function hasValidRequestAssignments(
    applicantDepartmentIds: readonly string[],
    order: Pick<OrderRecord, "departmentIds" | "branchIds" | "warehouseId">,
  ) {
    if (!order.departmentIds.length || !order.branchIds.length || !order.warehouseId) return false
    if (!order.departmentIds.every((id) => applicantDepartmentIds.includes(id))) return false
    const departments = data.departments.filter((department) =>
      order.departmentIds.includes(department.id),
    )
    if (departments.length !== new Set(order.departmentIds).size) return false
    const allowedBranchIds = new Set(departments.flatMap((department) => department.branchIds))
    const allowedWarehouseIds = new Set(departments.flatMap((department) => department.warehouseIds))
    const warehouse = data.warehouses.find((item) => item.id === order.warehouseId)
    return (
      order.branchIds.every((id) => allowedBranchIds.has(id)) &&
      allowedWarehouseIds.has(order.warehouseId) &&
      Boolean(warehouse?.branchIds.some((id) => order.branchIds.includes(id)))
    )
  }

  function addOrder(order: Omit<OrderRecord, "id" | "number" | "createdAt" | "status" | "createdByUserId" | "currentStep" | "waitingForUserId" | "lastActorUserId">) {
    const creator = data.users.find((user) => user.id === currentUserId)
    const applicantId = creator
      ? resolveOrderApplicantId(creator, order.applicantId)
      : ""
    const applicant = data.users.find((user) => user.id === applicantId)
    if (
      !can("requests.create") ||
      !creator ||
      !applicant ||
      !canCreateRequestForApplicant(creator.roleIds, applicant.roleIds) ||
      !hasValidRequestAssignments(applicant.departmentIds, order)
    ) {
      throw new Error("The selected applicant is not allowed for this user.")
    }
    const sequence = Math.max(0, ...orders.map((item) => Number(item.number.split("-").at(-1)))) + 1
    const createdAt = new Date().toISOString()
    const base = {
      ...order,
      applicantId: applicant.id,
      id: `order-${crypto.randomUUID()}`,
      number: `ORD-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`,
      createdByUserId: currentUserId,
      createdAt,
      lastActorUserId: currentUserId,
    }
    const supervisorId = assigneeFor("department_supervisor", base)
    // An assistant can create on behalf of a supervisor, but approval is skipped
    // only when that supervisor is the user who actually created the request.
    const skipSupervisor = creator.roleIds.includes("role-dept_head") ||
      shouldSkipSupervisorApproval(currentUserId, supervisorId)
    const currentStep: WorkflowStep = skipSupervisor ? "warehouse" : "department_supervisor"
    const record: OrderRecord = {
      ...base,
      status: skipSupervisor ? "warehouse_check" : "supervisor_review",
      currentStep,
      waitingForUserId: assigneeFor(currentStep, base),
      lines: order.lines.map((line) => ({ ...line, fulfillmentStatus: "pending" })),
      workflowHistory: skipSupervisor
        ? [{
            step: "department_supervisor",
            action: "skipped",
            actorUserId: currentUserId,
            createdAt,
          }]
        : [],
    }
    setOrders((current) => [record, ...current])
    notify(record.waitingForUserId, record, { kind: "action_required" })
    return record
  }

  function resubmitOrder(
    orderId: string,
    changes: Omit<OrderRecord, "id" | "number" | "createdAt" | "status" | "createdByUserId" | "currentStep" | "waitingForUserId" | "lastActorUserId">,
  ) {
    const existing = orders.find((order) => order.id === orderId)
    if (!can("requests.create") || !existing || existing.status !== "rejected" || existing.createdByUserId !== currentUserId) {
      return undefined
    }
    const creator = data.users.find((user) => user.id === currentUserId)
    const requestedApplicantId = creator
      ? resolveOrderApplicantId(creator, changes.applicantId)
      : ""
    const requestedApplicant = data.users.find((user) => user.id === requestedApplicantId)
    const departmentSupervisor = data.users.find(
      (user) =>
        user.roleIds.includes("role-dept_head") &&
        user.departmentIds.some((id) => changes.departmentIds.includes(id)),
    )
    const applicant = creator?.roleIds.includes("role-requester") &&
          !requestedApplicant?.roleIds.includes("role-dept_head")
        ? departmentSupervisor
        : requestedApplicant
    if (
      !creator ||
      !applicant ||
      !canCreateRequestForApplicant(creator.roleIds, applicant.roleIds) ||
      !hasValidRequestAssignments(applicant.departmentIds, changes)
    ) {
      return undefined
    }
    const normalizedChanges = { ...changes, applicantId: applicant.id }
    const supervisorId = assigneeFor("department_supervisor", normalizedChanges)
    const skipSupervisor = creator.roleIds.includes("role-dept_head") ||
      shouldSkipSupervisorApproval(currentUserId, supervisorId)
    const currentStep: WorkflowStep = skipSupervisor ? "warehouse" : "department_supervisor"
    const resubmittedAt = new Date().toISOString()
    const updated: OrderRecord = {
      ...existing,
      ...normalizedChanges,
      status: skipSupervisor ? "warehouse_check" : "supervisor_review",
      currentStep,
      waitingForUserId: assigneeFor(currentStep, normalizedChanges),
      lastActorUserId: currentUserId,
      lines: normalizedChanges.lines.map((line) => ({
        ...line,
        availableQuantity: undefined,
        fulfillmentStatus: "pending",
      })),
      workflowHistory: skipSupervisor
        ? appendWorkflowHistory(
            existing,
            "department_supervisor",
            "skipped",
            resubmittedAt,
          )
        : existing.workflowHistory ?? [],
    }
    setOrders((current) => current.map((order) => order.id === orderId ? updated : order))
    notify(updated.waitingForUserId, updated, { kind: "action_required" })
    return updated
  }

  function approveOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    const completesOperationalTask =
      (order?.currentStep === "procurement_order" && can("procurement.quote")) ||
      (order?.currentStep === "warehouse_receipt" && can("warehouse.receive"))
    if (
      !order ||
      (!can("approvals.approve") && !completesOperationalTask) ||
      order.waitingForUserId !== currentUserId ||
      order.currentStep === "complete" ||
      ["warehouse", "procurement_accept", "sourcing", "price_check"].includes(order.currentStep)
    ) return
    const step = getNextWorkflowStep(order.currentStep)
    const waitingForUserId = step === "complete" ? undefined : assigneeFor(step, order)
    if (step !== "complete" && !waitingForUserId) return
    const updated: OrderRecord = {
      ...order, currentStep: step, waitingForUserId, lastActorUserId: currentUserId,
      status: step === "complete" ? "approved" : step === "warehouse" ? "warehouse_check" : "in_progress",
      workflowHistory: appendWorkflowHistory(
        order,
        order.currentStep as Exclude<WorkflowStep, "complete">,
        completesOperationalTask ? "completed" : "approved",
      ),
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const actorName = data.users.find((user) => user.id === currentUserId)?.fullName ?? currentUserId
    notify(order.lastActorUserId, updated, { kind: "approved_by", actorName })
    if (order.createdByUserId !== order.lastActorUserId) notify(order.createdByUserId, updated, { kind: "step_approved" })
    notify(waitingForUserId, updated, { kind: "action_required" })
  }

  function rejectOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    if (
      !order ||
      !can("approvals.reject") ||
      order.waitingForUserId !== currentUserId ||
      [
        "procurement_accept",
        "sourcing",
        "price_check",
        "procurement_order",
        "warehouse_receipt",
      ].includes(order.currentStep)
    ) return
    const updated = {
      ...order,
      status: "rejected" as const,
      currentStep: "complete" as const,
      waitingForUserId: undefined,
      lastActorUserId: currentUserId,
      workflowHistory: appendWorkflowHistory(
        order,
        order.currentStep as Exclude<WorkflowStep, "complete">,
        "rejected",
      ),
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const supervisorUserId = assigneeFor("department_supervisor", order)
    setNotifications((current) => current.filter(
      (notification) =>
        notification.orderId !== orderId ||
        notification.userId === order.createdByUserId ||
        notification.userId === supervisorUserId,
    ))
    notify(order.createdByUserId, updated, { kind: "rejected" })
    if (order.lastActorUserId !== order.createdByUserId) notify(order.lastActorUserId, updated, { kind: "rejected" })
  }

  function submitWarehouseReport(orderId: string, quantities: Record<string, number>) {
    const order = orders.find((item) => item.id === orderId)
    if (!order || !can("warehouse.check_stock") || order.currentStep !== "warehouse" || assigneeFor("warehouse", order) !== currentUserId) return
    const lines = order.lines.map((line) => {
      const availableQuantity = Math.max(0, Math.min(line.quantity, Number(quantities[line.id]) || 0))
      return { ...line, availableQuantity, fulfillmentStatus: availableQuantity >= line.quantity ? "fulfilled_from_stock" as const : "needs_procurement" as const }
    })
    const fullyFulfilled = lines.every((line) => line.fulfillmentStatus === "fulfilled_from_stock")
    const next = fullyFulfilled ? "complete" as const : "chief_engineer" as const
    const waitingForUserId = fullyFulfilled ? undefined : assigneeFor(next, order)
    const updated: OrderRecord = {
      ...order, lines, currentStep: next, waitingForUserId, lastActorUserId: currentUserId,
      status: fullyFulfilled ? "fulfilled" : "in_progress",
      workflowHistory: appendWorkflowHistory(order, "warehouse", "completed"),
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const fulfilledCount = lines.filter((line) => line.fulfillmentStatus === "fulfilled_from_stock").length
    notify(order.lastActorUserId, updated, fullyFulfilled
      ? { kind: "warehouse_fulfilled" }
      : { kind: "warehouse_partial", fulfilledCount, totalCount: lines.length })
    if (order.createdByUserId !== order.lastActorUserId) notify(order.createdByUserId, updated, { kind: "warehouse_report_ready" })
    notify(waitingForUserId, updated, { kind: "action_required" })
  }

  function assignProcurementSpecialist(orderId: string, specialistUserId: string) {
    const order = orders.find((item) => item.id === orderId)
    const procurementHead = data.users.find((user) => user.id === currentUserId)
    const specialist = data.users.find(
      (user) =>
        user.id === specialistUserId &&
        user.roleIds.includes("role-procurement_manager") &&
        user.departmentIds.some((id) => procurementHead?.departmentIds.includes(id)),
    )
    if (
      !order ||
      !can("procurement.select_supplier") ||
      !procurementHead?.roleIds.includes("role-procurement_head") ||
      !specialist ||
      !["procurement_accept", "sourcing", "price_check"].includes(order.currentStep) ||
      (order.currentStep === "procurement_accept" && order.waitingForUserId !== currentUserId)
    ) return false
    const beginsSourcing = order.currentStep === "procurement_accept"
    const updated: OrderRecord = {
      ...order,
      procurementSpecialistUserId: specialist.id,
      currentStep: beginsSourcing ? "sourcing" : order.currentStep,
      waitingForUserId: order.currentStep === "price_check" ? order.waitingForUserId : specialist.id,
      lastActorUserId: currentUserId,
      status: "in_progress",
      workflowHistory: beginsSourcing
        ? appendWorkflowHistory(order, "procurement_accept", "completed")
        : order.workflowHistory,
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const actorName = data.users.find((user) => user.id === currentUserId)?.fullName ?? currentUserId
    notify(specialist.id, updated, { kind: "procurement_assigned", actorName })
    return true
  }

  function submitProcurementOffers(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    if (
      !order ||
      !can("procurement.quote") ||
      order.currentStep !== "sourcing" ||
      order.procurementSpecialistUserId !== currentUserId ||
      order.waitingForUserId !== currentUserId
    ) return false
    const waitingForUserId = assigneeFor("price_check", order)
    const updated: OrderRecord = {
      ...order,
      currentStep: "price_check",
      waitingForUserId,
      lastActorUserId: currentUserId,
      status: "in_progress",
      workflowHistory: appendWorkflowHistory(order, "sourcing", "completed"),
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const actorName = data.users.find((user) => user.id === currentUserId)?.fullName ?? currentUserId
    notify(waitingForUserId, updated, { kind: "procurement_offers_submitted", actorName })
    return true
  }

  function reviewProcurementOffers(orderId: string, approved: boolean, comment = "") {
    const order = orders.find((item) => item.id === orderId)
    if (
      !order ||
      !can(approved ? "approvals.approve" : "approvals.reject") ||
      !can("procurement.select_supplier") ||
      order.currentStep !== "price_check" ||
      order.waitingForUserId !== currentUserId ||
      (!approved && !comment.trim())
    ) return false
    const nextStep: WorkflowStep = approved ? "director" : "sourcing"
    const waitingForUserId = approved
      ? assigneeFor("director", order)
      : order.procurementSpecialistUserId
    if (!waitingForUserId) return false
    const updated: OrderRecord = {
      ...order,
      currentStep: nextStep,
      waitingForUserId,
      lastActorUserId: currentUserId,
      status: "in_progress",
      workflowHistory: appendWorkflowHistory(
        order,
        "price_check",
        approved ? "approved" : "returned",
      ),
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    notify(
      order.procurementSpecialistUserId,
      updated,
      approved
        ? { kind: "procurement_offer_approved" }
        : { kind: "procurement_offer_rejected", comment: comment.trim() },
    )
    if (approved) notify(waitingForUserId, updated, { kind: "action_required" })
    return true
  }

  function markNotificationsRead() {
    setNotifications((current) => current.map((item) => item.userId === currentUserId ? { ...item, read: true } : item))
  }

  function addOrderComment(orderId: string, body: string, replyToId?: string) {
    const order = orders.find((item) => item.id === orderId)
    const normalizedBody = normalizeOrderCommentBody(body)
    if (!currentUserId || !order || !canViewOrder(order) || !normalizedBody) return false
    if (replyToId && !(order.comments ?? []).some((comment) => comment.id === replyToId)) {
      return false
    }

    const comment = {
      id: crypto.randomUUID(),
      authorUserId: currentUserId,
      body: normalizedBody,
      replyToId,
      createdAt: new Date().toISOString(),
    }
    setOrders((current) => current.map((item) => item.id === orderId
      ? { ...item, comments: [...(item.comments ?? []), comment] }
      : item))
    return true
  }

  function deleteOrders(ids: string[]) {
    if (!can("requests.edit")) return
    setOrders((current) => current.filter((order) => !ids.includes(order.id) || !canViewOrder(order)))
  }

  return (
    <OrdersContext.Provider value={{ orders: visibleOrders, notifications: visibleNotifications, storageReady, addOrder, resubmitOrder, approveOrder, rejectOrder, submitWarehouseReport, assignProcurementSpecialist, submitProcurementOffers, reviewProcurementOffers, addOrderComment, markNotificationsRead, deleteOrders }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = React.useContext(OrdersContext)
  if (!context) throw new Error("useOrders must be used within OrdersProvider")
  return context
}
