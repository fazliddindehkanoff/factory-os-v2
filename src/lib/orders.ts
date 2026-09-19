export type OrderType = "material" | "service"
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
  procurementReviewComment?: string
  lastActorUserId: string
  createdAt: string
  workflowHistory?: WorkflowHistoryEntry[]
}

export type ProcurementSuborder = {
  id: string
  number: string
  suffix: number
  specialistUserId: string
  orderLineIds: string[]
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
  >,
  createdAt = order.createdAt,
) {
  const assignments = getProcurementLineAssignments(order)
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
    }))
    .sort((a, b) => a.suffix - b.suffix)
}

export function getProcurementSuborderForSpecialist(
  order: Parameters<typeof buildProcurementSuborders>[0],
  userId?: string,
) {
  if (!userId) return undefined
  return buildProcurementSuborders(order).find(
    (suborder) => suborder.specialistUserId === userId,
  )
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
    "currentStep" | "waitingForUserId" | "lines" | "procurementLineAssignments" | "procurementSpecialistUserId"
  >,
  userId?: string,
  warehouseResponsibleUserId?: string,
) {
  if (!userId) return false
  if (
    ["warehouse", "warehouse_receipt"].includes(order.currentStep) &&
    warehouseResponsibleUserId
  ) {
    return warehouseResponsibleUserId === userId
  }
  if (order.currentStep === "sourcing") {
    return isOrderAssignedToProcurementSpecialist(order, userId)
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
    "applicantId" | "createdByUserId" | "lastActorUserId" | "status"
  >,
  userId?: string,
  supervisorUserId?: string,
) {
  if (order.status !== "rejected") return true
  return Boolean(
    userId &&
      [order.createdByUserId, supervisorUserId ?? order.applicantId].includes(userId),
  )
}
