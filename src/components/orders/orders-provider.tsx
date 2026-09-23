"use client"

import * as React from "react"
import { canReadOrderWithSettings } from "@/lib/order-access"

import { useSettings } from "@/components/settings/settings-provider"
import {
  approveOrderRecord,
  createAppRecord,
  loadAppRecords,
  runOrderWorkflowAction,
} from "@/lib/client-app-records"
import {
  canCreateRequestForApplicant,
  getOrderActionView,
  getProcurementLinesAtStep,
  getProcurementSpecialistIds,
  isOrderAssignedToProcurementSpecialist,
  normalizeOrderCommentBody,
  resolveOrderApplicantId,
  shouldSkipSupervisorApproval,
  type OrderRecord,
  type WorkflowNotification,
  type WorkflowNotificationEvent,
  type WorkflowStep,
} from "@/lib/orders"
import { hasPermission, type PermissionCode } from "@/lib/rbac"

const initialOrders: OrderRecord[] = []
type OrdersContextValue = {
  orders: OrderRecord[]
  notifications: WorkflowNotification[]
  storageReady: boolean
  syncError: boolean
  lastUpdated: string | null
  addOrder: (order: Omit<OrderRecord, "id" | "number" | "createdAt" | "status" | "createdByUserId" | "currentStep" | "waitingForUserId" | "lastActorUserId">) => Promise<OrderRecord>
  resubmitOrder: (orderId: string, order: Omit<OrderRecord, "id" | "number" | "createdAt" | "status" | "createdByUserId" | "currentStep" | "waitingForUserId" | "lastActorUserId">) => Promise<OrderRecord | undefined>
  approveOrder: (orderId: string, paymentForm?: FormData) => Promise<boolean>
  rejectOrder: (orderId: string) => Promise<boolean>
  submitWarehouseReport: (orderId: string, quantities: Record<string, number>) => Promise<boolean>
  assignProcurementSpecialist: (
    orderId: string,
    specialistUserId: string,
    orderLineIds: string[],
  ) => Promise<boolean>
  submitProcurementOffers: (orderId: string) => Promise<OrderRecord | undefined>
  reviewProcurementOffers: (orderId: string, approved: boolean, comment?: string, quotationIds?: string[]) => Promise<boolean>
  addOrderComment: (orderId: string, body: string, replyToId?: string) => boolean
  markNotificationsRead: (ids?: string[]) => Promise<boolean>
  deleteOrders: (ids: string[]) => Promise<void>
}

const OrdersContext = React.createContext<OrdersContextValue | null>(null)

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { currentUserId, data } = useSettings()
  const [orders, updateOrders] = React.useState(initialOrders)
  const orderRevision = React.useRef(0)
  const setOrders = React.useCallback((value: React.SetStateAction<OrderRecord[]>) => {
    orderRevision.current += 1
    updateOrders(value)
  }, [])
  const [notifications, setNotifications] = React.useState<WorkflowNotification[]>([])
  const [syncError, setSyncError] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null)
  const [storageReady, setStorageReady] = React.useState(false)
  const currentUser = data.users.find((user) => user.id === currentUserId)
  const currentRoles = data.roles.filter((role) => currentUser?.roleIds.includes(role.id))
  const can = (permission: PermissionCode) => hasPermission(currentRoles, permission)

  function canViewOrder(order: OrderRecord) {
    return canReadOrderWithSettings(order, currentUserId, data)
  }

  const visibleOrders = orders.filter(canViewOrder)
  const visibleNotifications = notifications.filter((notification) => notification.userId === currentUserId)

  React.useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    let loading = false
    let loadedOnce = false
    async function refresh() {
      // Background tabs still need the first load; only periodic refreshes pause while hidden.
      if (loading || (loadedOnce && document.visibilityState === "hidden")) return
      loading = true
      const revision = orderRevision.current
      try {
        const serverOrders = await loadAppRecords<OrderRecord>("orders")
        if (!cancelled && revision === orderRevision.current) {
          setSyncError(false)
          setLastUpdated(new Date().toISOString())
          updateOrders(serverOrders.sort((left, right) => right.createdAt.localeCompare(left.createdAt)))
        }
      } finally { loading = false; loadedOnce = true; if (!cancelled) setStorageReady(true) }
    }
    const refreshSafely = () => { void refresh().catch(() => { if (!cancelled) setSyncError(true) }) }
    refreshSafely()
    const interval = window.setInterval(refreshSafely, 30_000)
    window.addEventListener("focus", refreshSafely)
    window.addEventListener("factory-os:orders-changed", refreshSafely)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshSafely)
      window.removeEventListener("factory-os:orders-changed", refreshSafely)
    }
  }, [currentUserId])

  React.useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    async function refreshNotifications() {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store", signal: AbortSignal.timeout(15000) })
        if (!response.ok) return
        const payload = await response.json() as { notifications?: WorkflowNotification[] }
        if (cancelled) return
        setNotifications((current) => {
          const merged = new Map((payload.notifications ?? []).map((item) => [item.id, item]))
          for (const item of current) {
            const remote = merged.get(item.id)
            merged.set(item.id, remote ? { ...item, ...remote, event: remote.event ?? item.event, read: remote.read || item.read } : item)
          }
          return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
        })
      } catch {
        // Local notifications remain usable while the server is unavailable.
      }
    }
    void refreshNotifications()
    const interval = window.setInterval(refreshNotifications, 30_000)
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void refreshNotifications() }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [currentUserId])

  function assigneeFor(
    step: WorkflowStep,
    order: Pick<
      OrderRecord,
      "applicantId" | "departmentIds" | "warehouseId" | "lines" |
      "procurementSpecialistUserId" | "procurementLineAssignments"
    >,
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
    if (["sourcing", "procurement_order"].includes(step)) {
      const specialistUserId = getProcurementSpecialistIds(order)[0]
      if (specialistUserId) return specialistUserId
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

  async function addOrder(order: Omit<OrderRecord, "id" | "number" | "createdAt" | "status" | "createdByUserId" | "currentStep" | "waitingForUserId" | "lastActorUserId">) {
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
    const sequence = Math.max(0, ...orders.map((item) => Number(item.number.split("/")[0].split("-").at(-1)) || 0)) + 1
    const createdAt = new Date().toISOString()
    const base = {
      ...order,
      applicantId: applicant.id,
      id: `order-${crypto.randomUUID()}`,
      number: `ORD-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`,
      createdByUserId: currentUserId,
      createdAt,
      lastActorUserId: currentUserId,
      procurementSpecialistUserId: undefined,
      procurementLineAssignments: undefined,
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
    const persisted = await createAppRecord("orders", record)
    setOrders((current) => [persisted, ...current.filter((item) => item.id !== persisted.id)])
    notify(persisted.waitingForUserId, persisted, { kind: "action_required" })
    return persisted
  }

  async function resubmitOrder(orderId: string, changes: Omit<OrderRecord, "id" | "number" | "createdAt" | "status" | "createdByUserId" | "currentStep" | "waitingForUserId" | "lastActorUserId">) {
    const existing = orders.find((order) => order.id === orderId)
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes, revision: existing?.revision ?? 0 }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? "resubmit-failed")
    const updated = result.order as OrderRecord
    setOrders((current) => current.map((order) => order.id === orderId ? updated : order))
    return updated
  }

  async function approveOrder(orderId: string, paymentForm?: FormData) {
    const storedOrder = orders.find((item) => item.id === orderId)
    const order: OrderRecord | undefined = storedOrder ? paymentForm && getProcurementLinesAtStep(storedOrder, "procurement_order", currentUserId).length
      ? { ...storedOrder, currentStep: "procurement_order", waitingForUserId: currentUserId }
      : getOrderActionView(storedOrder, currentUserId) : undefined
    const completesOperationalTask =
      (order?.currentStep === "procurement_order" && can("procurement.quote")) ||
      (order?.currentStep === "warehouse_receipt" && can("warehouse.receive"))
    if (
      !order ||
      (!can("approvals.approve") && !completesOperationalTask) ||
      order.waitingForUserId !== currentUserId ||
      order.currentStep === "complete" ||
      ["warehouse", "procurement_accept", "sourcing", "price_check"].includes(order.currentStep)
    ) return false
    let updated: OrderRecord
    try {
      updated = await approveOrderRecord<OrderRecord>(orderId, paymentForm)
    } catch (error) {
      if (paymentForm) throw error
      return false
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const actorName = data.users.find((user) => user.id === currentUserId)?.fullName ?? currentUserId
    notify(order.lastActorUserId, updated, { kind: "approved_by", actorName })
    if (order.createdByUserId !== order.lastActorUserId) notify(order.createdByUserId, updated, { kind: "step_approved" })
    notifyNextActors(storedOrder!, updated)
    return true
  }

  async function rejectOrder(orderId: string) {
    const storedOrder = orders.find((item) => item.id === orderId)
    const order = storedOrder ? getOrderActionView(storedOrder, currentUserId) : undefined
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
    ) return false
    if (order.procurementProgress) {
      try {
        const updated = await runOrderWorkflowAction<OrderRecord>(orderId, "reject-procurement-positions")
        setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
        notify(updated.createdByUserId, updated, { kind: "rejected" })
        return true
      } catch { return false }
    }
    let updated: OrderRecord
    try { updated = await runOrderWorkflowAction<OrderRecord>(orderId, "reject") } catch { return false }
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
    return true
  }

  async function submitWarehouseReport(orderId: string, quantities: Record<string, number>) {
    const order = orders.find((item) => item.id === orderId)
    if (!order || !can("warehouse.check_stock") || order.currentStep !== "warehouse" || assigneeFor("warehouse", order) !== currentUserId) return false
    let updated: OrderRecord
    try {
      updated = await runOrderWorkflowAction<OrderRecord>(orderId, "warehouse-report", { quantities })
    } catch {
      return false
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const fulfilledCount = updated.lines.filter((line) => line.fulfillmentStatus === "fulfilled_from_stock").length
    const fullyFulfilled = updated.currentStep === "complete"
    notify(order.lastActorUserId, updated, fullyFulfilled
      ? { kind: "warehouse_fulfilled" }
      : { kind: "warehouse_partial", fulfilledCount, totalCount: updated.lines.length })
    if (order.createdByUserId !== order.lastActorUserId) notify(order.createdByUserId, updated, { kind: "warehouse_report_ready" })
    notify(updated.waitingForUserId, updated, { kind: "action_required" })
    return true
  }

  async function assignProcurementSpecialist(
    orderId: string,
    specialistUserId: string,
    orderLineIds: string[],
  ) {
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
      !["procurement_accept", "sourcing"].includes(order.currentStep) ||
      (order.currentStep === "procurement_accept" && order.waitingForUserId !== currentUserId)
    ) return false
    let updated: OrderRecord
    let children: OrderRecord[] = []
    try {
      updated = await runOrderWorkflowAction<OrderRecord>(orderId, "assign-procurement-specialist", {
        specialistUserId: specialist.id,
        orderLineIds,
      }, (related) => { children = related })
    } catch {
      return false
    }
    setOrders((current) => {
      const merged = new Map(current.map((item) => [item.id, item]))
      for (const item of [updated, ...children]) merged.set(item.id, item)
      return [...merged.values()]
    })
    const actorName = data.users.find((user) => user.id === currentUserId)?.fullName ?? currentUserId
    notify(specialist.id, children.find((item) => item.procurementSpecialistUserId === specialist.id) ?? updated, { kind: "procurement_assigned", actorName })
    return true
  }

  async function submitProcurementOffers(orderId: string) {
    const order = orders.find((item) => item.id === orderId)
    if (
      !order ||
      !can("procurement.quote") ||
      !getProcurementLinesAtStep(order, "sourcing", currentUserId).length ||
      !isOrderAssignedToProcurementSpecialist(order, currentUserId)
    ) return undefined
    let updated: OrderRecord
    try {
      updated = await runOrderWorkflowAction<OrderRecord>(orderId, "submit-procurement-offers")
    } catch {
      return undefined
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const actorName = data.users.find((user) => user.id === currentUserId)?.fullName ?? currentUserId
    notifyNextActors(order, updated, { kind: "procurement_offers_submitted", actorName })
    return updated
  }

  async function reviewProcurementOffers(orderId: string, approved: boolean, comment = "", quotationIds: string[] = []) {
    const order = orders.find((item) => item.id === orderId)
    if (
      !order ||
      !can(approved ? "approvals.approve" : "approvals.reject") ||
      !can("procurement.select_supplier") ||
      !getProcurementLinesAtStep(order, "price_check", currentUserId).length ||
      (!approved && !comment.trim())
    ) return false
    let updated: OrderRecord
    try {
      updated = await runOrderWorkflowAction<OrderRecord>(orderId, "review-procurement-offers", {
        approved,
        comment,
        quotationIds,
      })
    } catch {
      return false
    }
    setOrders((current) => current.map((item) => item.id === orderId ? updated : item))
    const event: WorkflowNotificationEvent = approved
      ? { kind: "procurement_offer_approved" }
      : { kind: "procurement_offer_rejected", comment: comment.trim() }
    for (const specialistUserId of getProcurementSpecialistIds(order)) {
      notify(specialistUserId, updated, event)
    }
    if (approved) notifyNextActors(order, updated)
    return true
  }

  function notifyNextActors(previous: OrderRecord, updated: OrderRecord, event: WorkflowNotificationEvent = { kind: "action_required" }) {
    if (!updated.procurementProgress) { notify(updated.waitingForUserId, updated, event); return }
    const recipients = new Set<string>()
    for (const [lineId, state] of Object.entries(updated.procurementProgress)) {
      const old = previous.procurementProgress?.[lineId]
      if (state.step !== "complete" && state.waitingForUserId &&
        (state.step !== (old?.step ?? previous.currentStep) || state.waitingForUserId !== (old?.waitingForUserId ?? previous.waitingForUserId))) recipients.add(state.waitingForUserId)
    }
    for (const userId of recipients) notify(userId, updated, event)
  }

  async function markNotificationsRead(ids?: string[]) {
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids ? { ids } : { all: true }) })
      if (!response.ok) return false
      setNotifications((current) => current.map((item) => item.userId === currentUserId && (!ids || ids.includes(item.id)) ? { ...item, read: true } : item))
      window.dispatchEvent(new Event("factory-os:notifications-changed"))
      return true
    } catch { return false }
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

  async function deleteOrders(ids: string[]) {
    const response = await fetch("/api/orders/archive", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: ids.map((id) => ({ id, revision: orders.find((order) => order.id === id)?.revision ?? 0 })) }),
    })
    if (!response.ok) throw new Error("archive-failed")
    setOrders((current) => current.filter((order) => !ids.includes(order.id)))
  }

  return (
    <OrdersContext.Provider value={{ orders: visibleOrders, notifications: visibleNotifications, storageReady, syncError, lastUpdated, addOrder, resubmitOrder, approveOrder, rejectOrder, submitWarehouseReport, assignProcurementSpecialist, submitProcurementOffers, reviewProcurementOffers, addOrderComment, markNotificationsRead, deleteOrders }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = React.useContext(OrdersContext)
  if (!context) throw new Error("useOrders must be used within OrdersProvider")
  return context
}
