import {
  getOrderActionView,
  getProcurementLineAssignments,
  isOrderWaitingForUser,
  workflowSteps,
  type OrderRecord,
  type UrgencyLevel,
  type WorkflowStep,
} from "./orders"
import { hasPermission, type PermissionCode, type PermissionGrant } from "./rbac"

const DAY = 86_400_000
export type FlowStep = (typeof workflowSteps)[number]

export function daysBetween(from: string, now: number) {
  const time = Date.parse(from)
  return Number.isFinite(time) ? Math.max(0, (now - time) / DAY) : 0
}

export function localDateKey(time: number) {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function isActive(order: OrderRecord) {
  return order.currentStep !== "complete" && !["rejected", "draft", "fulfilled", "approved"].includes(order.status)
}

/** Every step an active order occupies; positions progress independently after sourcing starts. */
export function orderStepLines(order: OrderRecord) {
  const steps = new Map<FlowStep, string[]>()
  if (!isActive(order)) return steps
  const progress = order.procurementProgress
  if (progress) {
    for (const [lineId, state] of Object.entries(progress)) {
      if (state.step === "complete") continue
      steps.set(state.step, [...(steps.get(state.step) ?? []), lineId])
    }
    return steps
  }
  if ((workflowSteps as readonly WorkflowStep[]).includes(order.currentStep)) {
    steps.set(order.currentStep as FlowStep, order.lines.map((line) => line.id))
  }
  return steps
}

/** When the order (or the given positions) last moved; falls back to creation. */
export function enteredStepAt(order: OrderRecord, lineIds: string[]) {
  const ids = new Set(lineIds)
  const entry = [...(order.workflowHistory ?? [])].reverse().find((item) =>
    item.action !== "rejected" && (!item.orderLineIds || item.orderLineIds.some((id) => ids.has(id))))
  return entry?.createdAt ?? order.createdAt
}

function holdersAt(order: OrderRecord, step: FlowStep, lineIds: string[], warehouseResponsibleUserId?: string) {
  if (["warehouse", "warehouse_receipt"].includes(step) && warehouseResponsibleUserId) return [warehouseResponsibleUserId]
  const progress = order.procurementProgress
  if (progress) return [...new Set(lineIds.map((id) => progress[id]?.waitingForUserId).filter((id): id is string => Boolean(id)))]
  if (step === "sourcing") {
    const assignments = getProcurementLineAssignments(order)
    return [...new Set(lineIds.map((id) => assignments[id]).filter(Boolean))]
  }
  return order.waitingForUserId ? [order.waitingForUserId] : []
}

export type FlowStage = {
  step: FlowStep
  orderIds: string[]
  positions: number
  holders: { userId: string; count: number }[]
  avgDays: number
  maxDays: number
  /** Sum of waiting days — how much work is piling up here. */
  pressure: number
}

export function buildFlowMap(
  orders: OrderRecord[],
  now: number,
  warehouseResponsible: (warehouseId: string) => string | undefined = () => undefined,
) {
  const stages = new Map<FlowStep, FlowStage & { ages: number[]; holderCounts: Map<string, number> }>(
    workflowSteps.map((step) => [step, { step, orderIds: [], positions: 0, holders: [], avgDays: 0, maxDays: 0, pressure: 0, ages: [], holderCounts: new Map() }]),
  )
  for (const order of orders) {
    for (const [step, lineIds] of orderStepLines(order)) {
      const stage = stages.get(step)!
      const age = daysBetween(enteredStepAt(order, lineIds), now)
      stage.orderIds.push(order.id)
      stage.positions += lineIds.length
      stage.ages.push(age)
      for (const userId of holdersAt(order, step, lineIds, warehouseResponsible(order.warehouseId))) {
        stage.holderCounts.set(userId, (stage.holderCounts.get(userId) ?? 0) + 1)
      }
    }
  }
  const result: FlowStage[] = [...stages.values()].map(({ ages, holderCounts, ...stage }) => ({
    ...stage,
    avgDays: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0,
    maxDays: ages.length ? Math.max(...ages) : 0,
    pressure: ages.reduce((sum, age) => sum + age, 0),
    holders: [...holderCounts].map(([userId, count]) => ({ userId, count })).sort((a, b) => b.count - a.count),
  }))
  const top = result.reduce<FlowStage | undefined>((best, stage) => !best || stage.pressure > best.pressure ? stage : best, undefined)
  // A single fresh order is not a bottleneck; require at least a day of accumulated waiting.
  const bottleneck = top && top.pressure >= 1 ? top.step : undefined
  return { stages: result, bottleneck }
}

const urgencyRank: Record<UrgencyLevel, number> = { critical: 3, urgent: 2, high: 1, normal: 0 }

export type QueueItem = { order: OrderRecord; step: WorkflowStep; ageDays: number; overdue: boolean }

export function buildMyQueue(
  orders: OrderRecord[],
  userId: string | undefined,
  now: number,
  warehouseResponsible: (warehouseId: string) => string | undefined = () => undefined,
): QueueItem[] {
  if (!userId) return []
  const today = localDateKey(now)
  return orders
    .filter((order) => isOrderWaitingForUser(order, userId, warehouseResponsible(order.warehouseId)))
    .map((stored) => {
      const order = getOrderActionView(stored, userId)
      const lines = orderStepLines(stored).get(order.currentStep as FlowStep) ?? order.lines.map((line) => line.id)
      return { order, step: order.currentStep, ageDays: daysBetween(enteredStepAt(stored, lines), now), overdue: Boolean(order.expectedDate && order.expectedDate < today) }
    })
    .sort((a, b) => urgencyRank[b.order.urgency] - urgencyRank[a.order.urgency] ||
      Number(b.overdue) - Number(a.overdue) || b.ageDays - a.ageDays)
}

export function lateOrders(orders: OrderRecord[], now: number) {
  const today = localDateKey(now)
  return orders.filter((order) => isActive(order) && order.expectedDate && order.expectedDate < today)
    .map((order) => ({ order, daysLate: Math.round(daysBetween(`${order.expectedDate}T23:59:59`, now)) || 1 }))
    .sort((a, b) => b.daysLate - a.daysLate)
}

/** When an order reached its final state, from its last workflow entry. */
function closedAt(order: OrderRecord) {
  if (isActive(order) || order.status === "draft") return undefined
  return order.workflowHistory?.at(-1)?.createdAt
}

export function dailyTrend(orders: OrderRecord[], now: number, days = 14) {
  const keys = Array.from({ length: days }, (_, index) => localDateKey(now - (days - 1 - index) * DAY))
  const created = new Map(keys.map((key) => [key, 0]))
  const closed = new Map(keys.map((key) => [key, 0]))
  for (const order of orders) {
    const createdKey = localDateKey(Date.parse(order.createdAt))
    if (created.has(createdKey)) created.set(createdKey, created.get(createdKey)! + 1)
    const done = closedAt(order)
    const closedKey = done ? localDateKey(Date.parse(done)) : ""
    if (closed.has(closedKey)) closed.set(closedKey, closed.get(closedKey)! + 1)
  }
  return keys.map((key) => ({ date: key, created: created.get(key)!, closed: closed.get(key)! }))
}

export type SpecialistLoad = { userId: string; sourcing: number; placing: number; submitted30d: number }

export function specialistLoad(orders: OrderRecord[], specialistIds: string[], now: number): SpecialistLoad[] {
  const since = now - 30 * DAY
  const load = new Map(specialistIds.map((userId) => [userId, { userId, sourcing: 0, placing: 0, submitted30d: 0 }]))
  for (const order of orders) {
    for (const [step, lineIds] of orderStepLines(order)) {
      if (step !== "sourcing" && step !== "procurement_order") continue
      for (const userId of holdersAt(order, step, lineIds)) {
        const item = load.get(userId)
        if (!item) continue
        const count = order.procurementProgress ? lineIds.filter((id) => order.procurementProgress?.[id]?.waitingForUserId === userId).length : lineIds.length
        if (step === "sourcing") item.sourcing += count
        else item.placing += count
      }
    }
    for (const entry of order.workflowHistory ?? []) {
      const item = entry.actorUserId ? load.get(entry.actorUserId) : undefined
      if (item && entry.step === "sourcing" && entry.action === "completed" && Date.parse(entry.createdAt) >= since) {
        item.submitted30d += entry.orderLineIds?.length ?? order.lines.length
      }
    }
  }
  return [...load.values()].sort((a, b) => b.sourcing + b.placing - (a.sourcing + a.placing))
}

/** Agreed supplier terms from placement snapshots; this is not payment execution status. */
export function placementMoney(orders: OrderRecord[], now: number, horizonDays = 14) {
  const month = localDateKey(now).slice(0, 7)
  const today = localDateKey(now)
  const horizon = localDateKey(now + horizonDays * DAY)
  let placedThisMonth = 0
  let advancesThisMonth = 0
  const upcoming: { orderId: string; orderNumber: string; supplierName: string; dueDate: string; amount: number }[] = []
  for (const order of orders) {
    for (const line of order.placement?.lines ?? []) {
      if ((line.placedAt ?? order.placement?.createdAt ?? "").slice(0, 7) === month) {
        placedThisMonth += line.amount
        advancesThisMonth += line.prepaidAmount
      }
      const balance = line.amount - line.prepaidAmount
      if (balance > 0 && line.dueDate >= today && line.dueDate <= horizon && order.status !== "rejected") {
        const existing = upcoming.find((item) => item.orderId === order.id && item.supplierName === line.supplierName && item.dueDate === line.dueDate)
        if (existing) existing.amount += balance
        else upcoming.push({ orderId: order.id, orderNumber: order.number, supplierName: line.supplierName, dueDate: line.dueDate, amount: balance })
      }
    }
  }
  return { placedThisMonth, advancesThisMonth, upcoming: upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)) }
}

/** Share of the 9-step workflow already behind the order; positions are averaged. */
export function workflowProgress(order: OrderRecord) {
  const done = (step: WorkflowStep) => step === "complete" ? workflowSteps.length : Math.max(0, workflowSteps.indexOf(step as FlowStep))
  if (order.currentStep === "complete" || ["approved", "fulfilled"].includes(order.status)) return 1
  const states = Object.values(order.procurementProgress ?? {})
  const completed = states.length ? states.reduce((sum, state) => sum + done(state.step), 0) / states.length : done(order.currentStep)
  return Math.min(1, completed / workflowSteps.length)
}

/** When the order reached the step it is waiting on now. */
export function currentStageEnteredAt(order: OrderRecord) {
  const lines = orderStepLines(order).get(order.currentStep as FlowStep) ?? order.lines.map((line) => line.id)
  return enteredStepAt(order, lines)
}

/** Whole days past the expected date for an open order; 0 when on time or closed. */
export function orderLateDays(order: OrderRecord, now: number) {
  if (!isActive(order) || !order.expectedDate) return 0
  const today = localDateKey(now)
  if (order.expectedDate >= today) return 0
  return Math.max(1, Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${order.expectedDate}T00:00:00`)) / DAY))
}

/**
 * Which dashboard blocks a user sees. Derived from the user's role permissions
 * (editable in Settings → Roles), never from hard-coded role IDs.
 */
export function dashboardAccess(roles: readonly PermissionGrant[]) {
  const can = (permission: PermissionCode) => hasPermission(roles, permission)
  return {
    orders: can("requests.view") || can("requests.view_own"),
    summary: can("reports.status_summary"),
    team: can("procurement.select_supplier") || can("approvals.override"),
    money: can("finance.view") || can("procurement.select_supplier"),
    createOrder: can("requests.create"),
  }
}

export type DashboardAccess = ReturnType<typeof dashboardAccess>

/** Users who source offers but do not select suppliers — the procurement team. */
export function procurementTeamIds(
  users: readonly { id: string; roleIds: readonly string[] }[],
  roles: readonly (PermissionGrant & { id: string })[],
) {
  return users.filter((user) => {
    const grants = roles.filter((role) => user.roleIds.includes(role.id) && !role.grantsAll)
    return hasPermission(grants, "procurement.quote") && !hasPermission(grants, "procurement.select_supplier")
  }).map((user) => user.id)
}
