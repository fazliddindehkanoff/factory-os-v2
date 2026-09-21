import type { OrderPlacement } from "./order-payment"

export type OrderType = "material" | "service"

// This is navigation visibility, not a replacement for order access checks.
export function canViewParentOrderLink(roleCodes: readonly string[]) {
  return roleCodes.includes("procurement_manager")
}
export type OrderStatus = "supervisor_review" | "warehouse_check" | "in_progress" | "fulfilled" | "approved" | "rejected" | "draft"
export type UrgencyLevel = "normal" | "high" | "urgent" | "critical"
export const workflowSteps = [
  "department_supervisor",
  "warehouse",
  "chief_engineer",
  "procurement_accept",
  "sourcing",
  "price_check",
  "director",
  "procurement_order",
  "warehouse_receipt",
] as const
export type LegacyWorkflowStep = "procurement_supervisor" | "warehouse_supervisor"
export type WorkflowStep = (typeof workflowSteps)[number] | LegacyWorkflowStep | "complete"
export type FulfillmentStatus = "pending" | "fulfilled_from_stock" | "needs_procurement"

export function getNextWorkflowStep(
  step: Exclude<WorkflowStep, "complete">,
): WorkflowStep {
  if (step === "procurement_supervisor") return "warehouse_receipt"
  if (step === "warehouse_supervisor") return "complete"
  const index = workflowSteps.indexOf(step)
  return workflowSteps[index + 1] ?? "complete"
}

const nonApprovalWorkflowSteps = new Set<WorkflowStep>([
  "warehouse",
  "procurement_accept",
  "sourcing",
  "price_check",
])

export function truncateLabel(value: string, maxLength = 40) {
  if (value.length <= maxLength) return value
  if (maxLength <= 1) return "…".slice(0, maxLength)
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

export type WorkflowHistoryEntry = {
  orderLineIds?: string[]
  step: Exclude<WorkflowStep, "complete">
  action: "approved" | "completed" | "rejected" | "returned" | "skipped"
  actorUserId?: string
  createdAt: string
}

export type WorkflowNotificationEvent =
  | { kind: "action_required" }
  | { kind: "approved_by"; actorName: string }
  | { kind: "step_approved" }
  | { kind: "rejected" }
  | { kind: "warehouse_fulfilled" }
  | { kind: "warehouse_partial"; fulfilledCount: number; totalCount: number }
  | { kind: "warehouse_report_ready" }
  | { kind: "procurement_assigned"; actorName: string }
  | { kind: "procurement_offers_submitted"; actorName: string }
  | { kind: "procurement_offer_approved" }
  | { kind: "procurement_offer_rejected"; comment: string }

export type OrderLineRecord = {
  id: string
  productId: string
  unitTypeId?: string
  quantity: number
  note: string
  availableQuantity?: number
  fulfillmentStatus?: FulfillmentStatus
}

export type OrderAttachment = {
  id: string
  name: string
  type: string
  size: number
}

export const ORDER_COMMENT_MAX_LENGTH = 2_000

export type OrderComment = {
  id: string
  authorUserId: string
  authorName?: string
  authorUsername?: string
  body: string
  replyToId?: string
  mentionedUserIds?: string[]
  createdAt: string
}

export function normalizeOrderCommentBody(value: string) {
  const body = value.trim()
  return body && body.length <= ORDER_COMMENT_MAX_LENGTH ? body : null
}

export type WorkflowNotification = {
  id: string
  userId: string
  orderId: string
  orderNumber: string
  commentId?: string
  event?: WorkflowNotificationEvent
  message?: string
  createdAt: string
  read: boolean
}

export function formatWorkflowNotification(
  notification: Pick<WorkflowNotification, "event" | "message">,
  locale: "uz" | "ru" | "tr",
) {
  const event = notification.event ?? inferLegacyNotificationEvent(notification.message)
  if (!event) return notification.message ?? ""

  const copy = {
    uz: {
      action_required: "Buyurtma sizning amalingizni kutmoqda.",
      approved_by: (actorName: string) => `${actorName} buyurtmani tasdiqladi.`,
      step_approved: "Buyurtma joriy bosqichda tasdiqlandi.",
      rejected: "Buyurtma rad etildi.",
      warehouse_fulfilled: "Buyurtma ombor zaxirasidan to‘liq ta’minlandi va yopildi.",
      warehouse_partial: (fulfilled: number, total: number) =>
        `${total} pozitsiyadan ${fulfilled} tasi ombordan ta’minlandi; qolganlari keyingi bosqichga o‘tdi.`,
      warehouse_report_ready: "Ombor hisoboti tayyor.",
      procurement_assigned: (actorName: string) => `${actorName} sizga xarid pozitsiyalarini biriktirdi.`,
      procurement_offers_submitted: (actorName: string) => `${actorName} tijorat takliflarini tekshiruvga yubordi.`,
      procurement_offer_approved: "Ta’minot rahbari tijorat taklifini tasdiqladi.",
      procurement_offer_rejected: (comment: string) => `Tijorat taklifi qayta ishlash uchun qaytarildi: ${comment}`,
    },
    ru: {
      action_required: "Заявка ожидает вашего действия.",
      approved_by: (actorName: string) => `${actorName} одобрил(а) заявку.`,
      step_approved: "Заявка одобрена на текущем этапе.",
      rejected: "Заявка отклонена.",
      warehouse_fulfilled: "Заявка полностью исполнена со склада и закрыта.",
      warehouse_partial: (fulfilled: number, total: number) =>
        `${fulfilled} из ${total} позиций выданы со склада; остальные перешли на следующий этап.`,
      warehouse_report_ready: "Отчёт склада готов.",
      procurement_assigned: (actorName: string) => `${actorName} назначил(а) вам позиции для закупки.`,
      procurement_offers_submitted: (actorName: string) => `${actorName} отправил(а) коммерческие предложения на проверку.`,
      procurement_offer_approved: "Руководитель снабжения одобрил коммерческое предложение.",
      procurement_offer_rejected: (comment: string) => `Коммерческое предложение возвращено на доработку: ${comment}`,
    },
    tr: {
      action_required: "Talep işleminizi bekliyor.",
      approved_by: (actorName: string) => `${actorName} talebi onayladı.`,
      step_approved: "Talep mevcut aşamada onaylandı.",
      rejected: "Talep reddedildi.",
      warehouse_fulfilled: "Talep depo stokundan tamamen karşılandı ve kapatıldı.",
      warehouse_partial: (fulfilled: number, total: number) =>
        `${total} kalemin ${fulfilled} tanesi depodan karşılandı; kalanlar sonraki aşamaya geçti.`,
      warehouse_report_ready: "Depo raporu hazır.",
      procurement_assigned: (actorName: string) => `${actorName} satın alma kalemlerini size atadı.`,
      procurement_offers_submitted: (actorName: string) => `${actorName} teklifleri incelemeye gönderdi.`,
      procurement_offer_approved: "Satın alma yöneticisi ticari teklifi onayladı.",
      procurement_offer_rejected: (comment: string) => `Ticari teklif yeniden çalışma için iade edildi: ${comment}`,
    },
  }[locale]

  if (event.kind === "approved_by") return copy.approved_by(event.actorName)
  if (event.kind === "warehouse_partial") {
    return copy.warehouse_partial(event.fulfilledCount, event.totalCount)
  }
  if (event.kind === "procurement_assigned" || event.kind === "procurement_offers_submitted") {
    return copy[event.kind](event.actorName)
  }
  if (event.kind === "procurement_offer_rejected") {
    return copy.procurement_offer_rejected(event.comment)
  }
  return copy[event.kind]
}

function inferLegacyNotificationEvent(message?: string): WorkflowNotificationEvent | undefined {
  if (!message) return undefined
  if (message.includes("is waiting for your action") || message.includes("is now waiting for your action")) {
    return { kind: "action_required" }
  }
  if (message.includes("was approved at the current step")) return { kind: "step_approved" }
  if (message.includes("was rejected")) return { kind: "rejected" }
  if (message.includes("was fully fulfilled from warehouse stock")) return { kind: "warehouse_fulfilled" }
  if (message.includes("warehouse report is ready")) return { kind: "warehouse_report_ready" }
  const partial = message.match(/: (\d+)\/(\d+) lines fulfilled from stock/)
  if (partial) {
    return { kind: "warehouse_partial", fulfilledCount: Number(partial[1]), totalCount: Number(partial[2]) }
  }
  const approvedBy = message.match(/^(.+) approved ORD-/)
  if (approvedBy) return { kind: "approved_by", actorName: approvedBy[1] }
  return undefined
}

export type OrderRecord = {
  id: string
  number: string
  createdByUserId: string
  type: OrderType
  applicantId: string
  departmentIds: string[]
  branchIds: string[]
  warehouseId: string
  purposeId: string
  expectedDate: string
  urgency: UrgencyLevel
  lines: OrderLineRecord[]
  comment: string
  attachmentNames: string[]
  attachments?: OrderAttachment[]
  comments?: OrderComment[]
  status: OrderStatus
  currentStep: WorkflowStep
  waitingForUserId?: string
  procurementSpecialistUserId?: string
  procurementLineAssignments?: Record<string, string>
  procurementSuborders?: ProcurementSuborder[]
  /** Allocation container only; its children have independent workflows. */
  procurementSplit?: boolean
  parentOrderId?: string
  parentOrderNumber?: string
  procurementHeadUserId?: string
  procurementReviewComment?: string
  placement?: OrderPlacement
  financeCancellation?: { actorUserId: string; createdAt: string; comment: string }
  /** Independent procurement workflow for positions within this same order. */
  procurementProgress?: Record<string, ProcurementLineProgress>
  lastActorUserId: string
  createdAt: string
  workflowHistory?: WorkflowHistoryEntry[]
}

export type ProcurementLineProgress = {
  step: "sourcing" | "price_check" | "director" | "procurement_order" | "warehouse_receipt" | "complete"
  waitingForUserId?: string
  reviewComment?: string
  rejected?: boolean
}

export function getProcurementLinesAtStep(
  order: Pick<OrderRecord, "lines" | "currentStep" | "waitingForUserId" | "procurementProgress" | "procurementLineAssignments" | "procurementSpecialistUserId" | "procurementSuborders">,
  step: ProcurementLineProgress["step"],
  userId?: string,
) {
  return order.lines.filter((line) => {
    if (line.fulfillmentStatus !== "needs_procurement") return false
    const state = order.procurementProgress?.[line.id]
    if (!state && step === "sourcing" && userId) return order.currentStep === "sourcing" &&
      (order.procurementLineAssignments?.[line.id] ?? order.procurementSpecialistUserId ?? order.waitingForUserId) === userId &&
      order.procurementSuborders?.find((item) => item.specialistUserId === userId)?.status !== "submitted"
    return (state?.step ?? order.currentStep) === step &&
      (!userId || (state ? state.waitingForUserId : order.waitingForUserId) === userId)
  })
}

/** Choose the user's most advanced actionable lane, without hiding other lines. */
export function getOrderActionView(order: OrderRecord, userId?: string): OrderRecord {
  if (!order.procurementProgress || !userId) return order
  const states = Object.values(order.procurementProgress).filter((state) => state.step !== "complete" && state.waitingForUserId === userId)
    .sort((a, b) => workflowSteps.indexOf(b.step as (typeof workflowSteps)[number]) - workflowSteps.indexOf(a.step as (typeof workflowSteps)[number]))
  if (!states.length) return order
  return { ...order, currentStep: states[0].step, waitingForUserId: userId,
    procurementReviewComment: states.find((state) => state.reviewComment)?.reviewComment }
}

export function advanceProcurementLines(
  order: OrderRecord, lineIds: string[], fromStep: ProcurementLineProgress["step"],
  toStep: ProcurementLineProgress["step"], actorUserId: string, nextUserId: string | undefined,
  now: string, action: WorkflowHistoryEntry["action"] = "completed", reviewComment?: string,
): OrderRecord {
  const eligible = new Set(getProcurementLinesAtStep(order, fromStep, actorUserId).map((line) => line.id))
  if (!lineIds.length || new Set(lineIds).size !== lineIds.length || lineIds.some((id) => !eligible.has(id)) ||
    (toStep !== "complete" && !nextUserId) || order.procurementSplit) throw new Error("invalid-position-transition")
  const progress = Object.fromEntries(getRequiredProcurementLines(order).map((line) => [line.id,
    order.procurementProgress?.[line.id] ?? { step: order.currentStep as ProcurementLineProgress["step"], waitingForUserId: order.currentStep === "sourcing" ? getProcurementLineAssignments(order)[line.id] ?? order.waitingForUserId : order.waitingForUserId },
  ]))
  for (const id of lineIds) progress[id] = { step: toStep, waitingForUserId: nextUserId, reviewComment, rejected: action === "rejected" }
  const active = Object.values(progress).filter((state) => state.step !== "complete")
    .sort((a, b) => workflowSteps.indexOf(a.step as (typeof workflowSteps)[number]) - workflowSteps.indexOf(b.step as (typeof workflowSteps)[number]))
  return { ...order, procurementProgress: progress, procurementSuborders: undefined,
    currentStep: active[0]?.step ?? "complete", waitingForUserId: active[0]?.waitingForUserId,
    status: active.length ? "in_progress" : Object.values(progress).every((state) => state.rejected) ? "rejected" : "approved",
    lastActorUserId: actorUserId, procurementReviewComment: undefined,
    workflowHistory: [...(order.workflowHistory ?? []), { step: fromStep as WorkflowHistoryEntry["step"], action, actorUserId, createdAt: now, orderLineIds: lineIds }],
  }
}

export type ProcurementSuborder = {
  id: string
  number: string
  suffix: number
  specialistUserId: string
  orderLineIds: string[]
  status: "sourcing" | "submitted"
  submittedAt?: string
  createdAt: string
}

export function getRequiredProcurementLines(
  order: Pick<OrderRecord, "lines">,
) {
  return order.lines.filter((line) => line.fulfillmentStatus === "needs_procurement")
}

export function getProcurementLineAssignments(
  order: Pick<OrderRecord, "lines" | "procurementLineAssignments" | "procurementSpecialistUserId">,
) {
  const requiredLineIds = new Set(getRequiredProcurementLines(order).map((line) => line.id))
  const explicitAssignments = Object.entries(order.procurementLineAssignments ?? {})
    .filter(([lineId, userId]) => requiredLineIds.has(lineId) && Boolean(userId))

  if (explicitAssignments.length > 0) {
    return Object.fromEntries(explicitAssignments)
  }
  if (!order.procurementSpecialistUserId) return {}
  return Object.fromEntries(
    [...requiredLineIds].map((lineId) => [lineId, order.procurementSpecialistUserId as string]),
  )
}

export function getProcurementSpecialistIds(
  order: Pick<OrderRecord, "lines" | "procurementLineAssignments" | "procurementSpecialistUserId">,
) {
  return [...new Set(Object.values(getProcurementLineAssignments(order)))]
}

/**
 * Keeps one stable procurement sub-order per specialist. New positions assigned
 * to an existing specialist are appended to their original /n sub-order.
 */
export function buildProcurementSuborders(
  order: Pick<
    OrderRecord,
    | "id"
    | "number"
    | "createdAt"
    | "lines"
    | "procurementLineAssignments"
    | "procurementSpecialistUserId"
    | "procurementSuborders"
    | "parentOrderId"
    | "procurementSplit"
    | "currentStep"
  >,
  createdAt = order.createdAt,
) {
  const assignments = getProcurementLineAssignments(order)
  if (order.parentOrderId && order.procurementSpecialistUserId) {
    return [{
      id: order.id,
      number: order.number,
      suffix: Number(order.number.split("/").at(-1)),
      specialistUserId: order.procurementSpecialistUserId,
      orderLineIds: getRequiredProcurementLines(order).map((line) => line.id),
      status: order.currentStep === "sourcing" ? "sourcing" as const : "submitted" as const,
      createdAt: order.createdAt,
    }] satisfies ProcurementSuborder[]
  }
  const existing = Array.isArray(order.procurementSuborders)
    ? order.procurementSuborders
    : []
  const bySpecialist = new Map<string, ProcurementSuborder>()
  const usedSuffixes = new Set<number>()

  for (const suborder of [...existing].sort((a, b) => a.suffix - b.suffix)) {
    if (
      !suborder ||
      !suborder.specialistUserId ||
      !Number.isInteger(suborder.suffix) ||
      suborder.suffix < 1 ||
      bySpecialist.has(suborder.specialistUserId) ||
      usedSuffixes.has(suborder.suffix)
    ) continue
    bySpecialist.set(suborder.specialistUserId, suborder)
    usedSuffixes.add(suborder.suffix)
  }

  const specialistIds = [...new Set(Object.values(assignments))]
  let nextSuffix = Math.max(0, ...usedSuffixes) + 1
  for (const specialistUserId of specialistIds) {
    if (bySpecialist.has(specialistUserId)) continue
    while (usedSuffixes.has(nextSuffix)) nextSuffix += 1
    const suffix = nextSuffix
    usedSuffixes.add(suffix)
    bySpecialist.set(specialistUserId, {
      id: `${order.id}-procurement-${suffix}`,
      number: `${order.number}/${suffix}`,
      suffix,
      specialistUserId,
      orderLineIds: [],
      status: "sourcing",
      createdAt,
    })
    nextSuffix += 1
  }

  const lineIdsBySpecialist = new Map<string, string[]>()
  for (const line of getRequiredProcurementLines(order)) {
    const specialistUserId = assignments[line.id]
    if (!specialistUserId) continue
    lineIdsBySpecialist.set(specialistUserId, [
      ...(lineIdsBySpecialist.get(specialistUserId) ?? []),
      line.id,
    ])
  }

  return [...bySpecialist.values()]
    .filter((suborder) => specialistIds.includes(suborder.specialistUserId))
    .map((suborder) => ({
      ...suborder,
      number: `${order.number}/${suborder.suffix}`,
      orderLineIds: lineIdsBySpecialist.get(suborder.specialistUserId) ?? [],
      status: suborder.status === "submitted" ? "submitted" as const : "sourcing" as const,
      submittedAt: suborder.status === "submitted" ? suborder.submittedAt : undefined,
    }))
    .sort((a, b) => a.suffix - b.suffix)
}

export function getProcurementSuborderForSpecialist(
  order: Parameters<typeof buildProcurementSuborders>[0],
  userId?: string,
) {
  if (!userId) return undefined
  if (order.procurementSplit) return undefined
  return buildProcurementSuborders(order).find(
    (suborder) => suborder.specialistUserId === userId,
  )
}

/** Root containers remain available for history, but are not counted twice. */
export function isOperationalOrder(order: OrderRecord) {
  return !order.procurementSplit || getUnassignedProcurementLines(order).length > 0
}

export function createProcurementChild(
  parent: OrderRecord,
  suborder: ProcurementSuborder,
  headUserId: string,
): OrderRecord {
  const sourcing = ["procurement_accept", "sourcing"].includes(parent.currentStep)
  const submitted = sourcing && suborder.status === "submitted"
  const currentStep = sourcing ? submitted ? "price_check" : "sourcing" : parent.currentStep
  const history = [...(parent.workflowHistory ?? [])]
  if (!history.some((entry) => entry.step === "procurement_accept" && entry.action === "completed")) {
    history.push({ step: "procurement_accept", action: "completed", actorUserId: headUserId, createdAt: suborder.createdAt })
  }
  if (submitted && !history.some((entry) => entry.step === "sourcing" && entry.action === "completed")) {
    history.push({ step: "sourcing", action: "completed", actorUserId: suborder.specialistUserId, createdAt: suborder.submittedAt ?? suborder.createdAt })
  }
  return {
    ...parent,
    id: suborder.id,
    number: suborder.number,
    parentOrderId: parent.id,
    parentOrderNumber: parent.number,
    procurementHeadUserId: headUserId,
    procurementSplit: undefined,
    procurementSuborders: undefined,
    procurementSpecialistUserId: suborder.specialistUserId,
    procurementLineAssignments: Object.fromEntries(suborder.orderLineIds.map((id) => [id, suborder.specialistUserId])),
    lines: parent.lines.filter((line) => suborder.orderLineIds.includes(line.id)),
    comments: [],
    currentStep,
    status: sourcing ? "in_progress" : parent.status,
    waitingForUserId: ["sourcing", "procurement_order"].includes(currentStep)
      ? suborder.specialistUserId
      : submitted ? headUserId : parent.waitingForUserId,
    createdAt: suborder.createdAt,
    workflowHistory: history,
  }
}

/** Pure assignment plan; the API commits parent and child in one transaction. */
export function planProcurementAssignment(
  parent: OrderRecord,
  children: OrderRecord[],
  specialistUserId: string,
  orderLineIds: string[],
  headUserId: string,
  now: string,
) {
  if (parent.parentOrderId || !["procurement_accept", "sourcing"].includes(parent.currentStep)) {
    throw new Error("procurement-assignment-forbidden")
  }
  const unassigned = new Set(getUnassignedProcurementLines(parent).map((line) => line.id))
  if (!orderLineIds.length || orderLineIds.some((id) => !unassigned.has(id))) {
    throw new Error("procurement-lines-already-assigned")
  }
  const existingChild = children.find((child) => child.procurementSpecialistUserId === specialistUserId)
  if (existingChild && (existingChild.currentStep !== "sourcing" || existingChild.status === "rejected")) {
    throw new Error("procurement-child-already-submitted")
  }
  const assignments = { ...getProcurementLineAssignments(parent), ...Object.fromEntries(orderLineIds.map((id) => [id, specialistUserId])) }
  const updated: OrderRecord = {
    ...parent,
    procurementSplit: true,
    procurementHeadUserId: headUserId,
    procurementSpecialistUserId: undefined,
    procurementLineAssignments: assignments,
    currentStep: "procurement_accept",
    status: "in_progress",
    waitingForUserId: headUserId,
    lastActorUserId: headUserId,
  }
  updated.procurementSuborders = buildProcurementSuborders(updated, now)
  const descriptor = updated.procurementSuborders.find((item) => item.specialistUserId === specialistUserId)!
  const child = existingChild ? {
    ...existingChild,
    lines: parent.lines.filter((line) => descriptor.orderLineIds.includes(line.id)),
    procurementLineAssignments: Object.fromEntries(descriptor.orderLineIds.map((id) => [id, specialistUserId])),
    procurementProgress: existingChild.procurementProgress ? {
      ...existingChild.procurementProgress,
      ...Object.fromEntries(orderLineIds.map((id) => [id, { step: "sourcing" as const, waitingForUserId: specialistUserId }])),
    } : undefined,
  } : createProcurementChild(updated, descriptor, headUserId)
  return { parent: updated, child }
}

export function getUnassignedProcurementLines(
  order: Pick<OrderRecord, "lines" | "procurementLineAssignments" | "procurementSpecialistUserId">,
) {
  const assignments = getProcurementLineAssignments(order)
  return getRequiredProcurementLines(order).filter((line) => !assignments[line.id])
}

export function getAssignedProcurementLineIds(
  order: Pick<OrderRecord, "lines" | "procurementLineAssignments" | "procurementSpecialistUserId">,
  userId?: string,
) {
  if (!userId) return []
  return Object.entries(getProcurementLineAssignments(order))
    .filter(([, assignedUserId]) => assignedUserId === userId)
    .map(([lineId]) => lineId)
}

export function isOrderAssignedToProcurementSpecialist(
  order: Pick<OrderRecord, "lines" | "procurementLineAssignments" | "procurementSpecialistUserId">,
  userId?: string,
) {
  return getAssignedProcurementLineIds(order, userId).length > 0
}

export function areAllProcurementLinesAssigned(
  order: Pick<OrderRecord, "lines" | "procurementLineAssignments" | "procurementSpecialistUserId">,
) {
  const requiredLines = getRequiredProcurementLines(order)
  const assignments = getProcurementLineAssignments(order)
  return requiredLines.length > 0 && requiredLines.every((line) => Boolean(assignments[line.id]))
}

export function buildApprovedOrder(
  order: OrderRecord,
  actorUserId: string,
  nextAssigneeUserId: string | undefined,
  completesOperationalTask: boolean,
  createdAt = new Date().toISOString(),
) {
  if (
    order.procurementSplit ||
    order.waitingForUserId !== actorUserId ||
    order.currentStep === "complete" ||
    nonApprovalWorkflowSteps.has(order.currentStep)
  ) return null

  const currentStep = order.currentStep
  const nextStep = getNextWorkflowStep(currentStep)
  if (nextStep !== "complete" && !nextAssigneeUserId) return null

  return {
    ...order,
    currentStep: nextStep,
    waitingForUserId: nextStep === "complete" ? undefined : nextAssigneeUserId,
    lastActorUserId: actorUserId,
    status: nextStep === "complete"
      ? "approved" as const
      : nextStep === "warehouse"
        ? "warehouse_check" as const
        : "in_progress" as const,
    workflowHistory: [
      ...(order.workflowHistory ?? []),
      {
        step: currentStep,
        action: completesOperationalTask ? "completed" as const : "approved" as const,
        actorUserId,
        createdAt,
      },
    ],
  } satisfies OrderRecord
}

export function shouldSkipSupervisorApproval(createdByUserId: string, supervisorUserId?: string) {
  return Boolean(supervisorUserId && createdByUserId === supervisorUserId)
}

export function canCreateRequestForApplicant(
  creatorRoleIds: readonly string[],
  applicantRoleIds: readonly string[],
) {
  return (
    !creatorRoleIds.includes("role-requester") ||
    applicantRoleIds.includes("role-dept_head")
  )
}

export function resolveOrderApplicantId(
  creator: { id: string; roleIds: readonly string[] },
  requestedApplicantId?: string,
) {
  return creator.roleIds.includes("role-requester")
    ? requestedApplicantId ?? ""
    : creator.id
}

export function isOrderWaitingForUser(
  order: Pick<
    OrderRecord,
    "currentStep" | "waitingForUserId" | "lines" | "procurementLineAssignments" | "procurementSpecialistUserId" | "procurementSuborders" | "procurementSplit" | "procurementProgress"
  >,
  userId?: string,
  warehouseResponsibleUserId?: string,
) {
  if (!userId) return false
  if (order.procurementProgress) return Object.values(order.procurementProgress).some(
    (state) => state.step !== "complete" && state.waitingForUserId === userId,
  )
  if (order.procurementSplit) {
    return order.waitingForUserId === userId && getUnassignedProcurementLines(order).length > 0
  }
  if (
    ["warehouse", "warehouse_receipt"].includes(order.currentStep) &&
    warehouseResponsibleUserId
  ) {
    return warehouseResponsibleUserId === userId
  }
  if (order.currentStep === "sourcing") {
    return isOrderAssignedToProcurementSpecialist(order, userId) &&
      order.procurementSuborders?.find(
        (suborder) => suborder.specialistUserId === userId,
      )?.status !== "submitted"
  }
  return order.waitingForUserId === userId
}

export function isOrderSuccessfullyClosed(
  order: Pick<OrderRecord, "currentStep" | "status">,
) {
  return (
    order.currentStep === "complete" &&
    (order.status === "approved" || order.status === "fulfilled")
  )
}

export function canUserViewRejectedOrder(
  order: Pick<
    OrderRecord,
    "applicantId" | "createdByUserId" | "lastActorUserId" | "status" | "financeCancellation"
  >,
  userId?: string,
  supervisorUserId?: string,
) {
  if (order.status !== "rejected") return true
  // Financial cancellations remain visible under the caller's normal order-access scope.
  if (order.financeCancellation) return Boolean(userId)
  return Boolean(
    userId &&
      [order.createdByUserId, supervisorUserId ?? order.applicantId].includes(userId),
  )
}
