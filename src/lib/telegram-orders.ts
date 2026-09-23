import { formatWorkflowNotification } from "@/lib/orders"
import { buildFlowMap, buildMyQueue, currentStageEnteredAt, dailyTrend, dashboardAccess, lateOrders, placementMoney, procurementTeamIds, specialistLoad, workflowProgress } from "@/lib/dashboard-insights"
import { canReadOrderWithSettings } from "@/lib/order-access"
import { getSettingsData } from "@/lib/settings-data"
import "server-only"

import { and, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/db/client"
import {
  appRecords,
  departments,
  notifications,
  orderCommentMentions,
  orderComments,
  orderPurposes,
  products,
  rolePermissions,
  roles,
  unitTypes,
  userRoles,
  users,
  warehouses,
} from "@/db/schema"
import type { Locale } from "@/lib/i18n"
import {
  canViewParentOrderLink,
  getAssignedProcurementLineIds,
  getProcurementSuborderForSpecialist,
  isOrderAssignedToProcurementSpecialist,
  isOrderWaitingForUser,
  isOperationalOrder,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/orders"
import type { PermissionCode } from "@/lib/rbac"

const localeField = {
  uz: { department: departments.titleUz, warehouse: warehouses.titleUz, purpose: orderPurposes.titleUz, product: products.titleUz, unit: unitTypes.titleUz, role: roles.titleUz },
  ru: { department: departments.titleRu, warehouse: warehouses.titleRu, purpose: orderPurposes.titleRu, product: products.titleRu, unit: unitTypes.titleRu, role: roles.titleRu },
  tr: { department: departments.titleTr, warehouse: warehouses.titleTr, purpose: orderPurposes.titleTr, product: products.titleTr, unit: unitTypes.titleTr, role: roles.titleTr },
} as const

export type TelegramUserProfile = {
  fullName: string
  username: string
  phoneNumber: string
  telegramConnected: boolean
  roles: string[]
}

export type TelegramOrderSummary = {
  id: string
  number: string
  type: "material" | "service"
  status: OrderStatus | "revision_requested" | "cancelled"
  departmentOptions: Array<{ value: string; label: string }>
  departmentIds: string[]
  warehouseId: string
  currentStep: OrderRecord["currentStep"]
  waitingFor: string
  urgency: "normal" | "high" | "urgent" | "critical"
  applicant: string
  department: string
  warehouse: string
  purpose: string
  expectedDate: string
  createdAt: string
  itemCount: number
  waitingForMe: boolean
  /** 0–1 share of the workflow already completed. */
  progress: number
  stageEnteredAt: string
  productSummary: string
}

export type TelegramOrderDetail = TelegramOrderSummary & {
  parentOrderId?: string
  parentOrderNumber?: string
  childOrders: Array<{ id: string; number: string }>
  comment: string
  lines: Array<{ id: string; product: string; unit: string; quantity: number; note: string }>
  comments: Array<{
    id: string
    authorName: string
    authorUsername: string
    body: string
    replyToId?: string
    createdAt: string
  }>
}

type TelegramOrderStatus = TelegramOrderSummary["status"]

type VisibleOrderRow = {
  id: string
  parentOrderId?: string
  parentOrderNumber?: string
  number: string
  type: OrderRecord["type"]
  status: TelegramOrderStatus
  departmentOptions: Array<{ value: string; label: string }>
  departmentIds: string[]
  warehouseId: string
  currentStep: OrderRecord["currentStep"]
  waitingFor: string
  urgency: OrderRecord["urgency"]
  applicant: string
  department: string
  warehouse: string
  purpose: string
  expectedDate: string
  createdAt: string
  comment: string
  lines: OrderRecord["lines"]
  waitingForMe: boolean
  progress: number
  stageEnteredAt: string
  productSummary: string
}


function parseStoredOrder(payload: Record<string, unknown>): OrderRecord | null {
  const order = payload as Partial<OrderRecord>
  if (
    typeof order.id !== "string" ||
    typeof order.number !== "string" ||
    (order.type !== "material" && order.type !== "service") ||
    typeof order.createdByUserId !== "string" ||
    typeof order.applicantId !== "string" ||
    !Array.isArray(order.departmentIds) ||
    typeof order.warehouseId !== "string" ||
    typeof order.purposeId !== "string" ||
    typeof order.expectedDate !== "string" ||
    !["normal", "high", "urgent", "critical"].includes(order.urgency ?? "") ||
    !Array.isArray(order.lines) ||
    typeof order.createdAt !== "string" ||
    !["supervisor_review", "warehouse_check", "in_progress", "fulfilled", "approved", "rejected", "draft"].includes(order.status ?? "")
  ) return null
  return order as OrderRecord
}

export async function getTelegramUserProfile(userId: string, lang: Locale) {
  const localized = localeField[lang]
  const [userRows, roleRows] = await Promise.all([
    db.select({
      fullName: users.fullName,
      username: users.username,
      phoneNumber: users.phoneNumber,
      telegramChatId: users.telegramChatId,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db.select({ title: localized.role })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId)),
  ])
  const user = userRows[0]
  if (!user) return null
  return {
    fullName: user.fullName,
    username: user.username,
    phoneNumber: user.phoneNumber ?? "",
    telegramConnected: Boolean(user.telegramChatId),
    roles: roleRows.map((role) => role.title),
  } satisfies TelegramUserProfile
}

async function getOrderAccess(userId: string) {
  const grants = await db.select({
    grantsAll: roles.grantsAll,
    roleCode: roles.code,
    code: rolePermissions.permissionCode,
  })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .where(eq(userRoles.userId, userId))
  const permissions = new Set(grants.map((grant) => grant.code).filter(Boolean) as PermissionCode[])
  const roleCodes = new Set(grants.map((grant) => grant.roleCode))
  return {
    canViewAll: grants.some((grant) => grant.grantsAll) || permissions.has("requests.view"),
    canViewOwn: grants.some((grant) => grant.grantsAll) || permissions.has("requests.view_own"),
    procurementSpecialist: roleCodes.has("procurement_manager") && !roleCodes.has("procurement_head"),
    canViewParentLink: canViewParentOrderLink([...roleCodes]),
  }
}

async function getVisibleOrderRows(userId: string, lang: Locale, includeContainers = false) {
  const access = await getOrderAccess(userId)
  const settings = await getSettingsData()
  if (!access.canViewAll && !access.canViewOwn) return []
  const localized = localeField[lang]
  const storedRows = await db.select({
    payload: appRecords.payload,
    createdByUserId: appRecords.createdByUserId,
  })
    .from(appRecords)
    .where(eq(appRecords.namespace, "orders"))
    .orderBy(desc(appRecords.createdAt))
  const storedOrders = storedRows
    .map((row) => ({ order: parseStoredOrder(row.payload), ownerId: row.createdByUserId }))
    .filter((row): row is { order: OrderRecord; ownerId: string | null } => Boolean(row.order))
    .filter(({ order }) => includeContainers || isOperationalOrder(order))
    .filter(({ order }) => canReadOrderWithSettings(order, userId, settings))

  const [userRows, departmentRows, warehouseRows, purposeRows, productRows] = await Promise.all([
    db.select({ id: users.id, title: users.fullName }).from(users),
    db.select({ id: departments.id, title: localized.department }).from(departments),
    db.select({ id: warehouses.id, title: localized.warehouse }).from(warehouses),
    db.select({ id: orderPurposes.id, title: localized.purpose }).from(orderPurposes),
    db.select({ id: products.id, title: localized.product }).from(products),
  ])
  const productNames = new Map(productRows.map((row) => [row.id, row.title]))
  const userNames = new Map(userRows.map((row) => [row.id, row.title]))
  const departmentNames = new Map(departmentRows.map((row) => [row.id, row.title]))
  const warehouseNames = new Map(warehouseRows.map((row) => [row.id, row.title]))
  const purposeNames = new Map(purposeRows.map((row) => [row.id, row.title]))

  return storedOrders.map(({ order }) => {
    const assignedLineIds = new Set(getAssignedProcurementLineIds(order, userId))
    const visibleLines = access.procurementSpecialist
      ? order.lines.filter((line) => assignedLineIds.has(line.id))
      : order.lines
    const procurementSuborder = access.procurementSpecialist
      ? getProcurementSuborderForSpecialist(order, userId)
      : undefined
    return {
    id: order.id,
    parentOrderId: order.parentOrderId,
    parentOrderNumber: order.parentOrderNumber,
    number: procurementSuborder?.number ?? order.number,
    type: order.type,
    status: order.financeCancellation ? "cancelled" : order.currentStep === "sourcing" && order.procurementReviewComment ? "revision_requested" : order.status,
    departmentOptions: order.departmentIds.map((id) => ({ value: id, label: departmentNames.get(id) ?? id })),
    departmentIds: order.departmentIds,
    warehouseId: order.warehouseId,
    currentStep: order.currentStep,
    waitingFor: [...new Set([order.waitingForUserId, ...Object.values(order.procurementProgress ?? {}).map((item) => item.waitingForUserId)].filter(Boolean))].map((id) => userNames.get(id!) ?? "—").join(", "),
    urgency: order.urgency,
    applicant: userNames.get(order.applicantId) ?? order.applicantId,
    department: order.departmentIds.map((id) => departmentNames.get(id)).filter(Boolean).join(", ") || "—",
    warehouse: warehouseNames.get(order.warehouseId) ?? "—",
    purpose: purposeNames.get(order.purposeId) ?? "—",
    expectedDate: order.expectedDate,
    createdAt: order.createdAt,
    comment: order.comment,
    lines: visibleLines,
    waitingForMe: isOrderWaitingForUser(order, userId, settings.warehouses.find((item) => item.id === order.warehouseId)?.responsibleUserId),
    progress: workflowProgress(order),
    stageEnteredAt: currentStageEnteredAt(order),
    productSummary: visibleLines.length
      ? `${productNames.get(visibleLines[0].productId) ?? visibleLines[0].productId}${visibleLines.length > 1 ? ` +${visibleLines.length - 1}` : ""}`
      : "",
  } satisfies VisibleOrderRow
  })
}

export async function getTelegramOrders(userId: string, lang: Locale, waitingOnly = false) {
  const rows = await getVisibleOrderRows(userId, lang)
  return rows
    .map((row) => ({
      id: row.id,
      number: row.number,
      type: row.type,
      status: row.status,
      departmentOptions: row.departmentOptions, departmentIds: row.departmentIds, warehouseId: row.warehouseId, currentStep: row.currentStep, waitingFor: row.waitingFor,
      urgency: row.urgency,
      applicant: row.applicant,
      department: row.department,
      warehouse: row.warehouse,
      purpose: row.purpose,
      expectedDate: row.expectedDate,
      createdAt: row.createdAt,
      itemCount: row.lines.length,
      waitingForMe: row.waitingForMe,
      progress: row.progress,
      stageEnteredAt: row.stageEnteredAt,
      productSummary: row.productSummary,
    } satisfies TelegramOrderSummary))
    .filter((order) => !waitingOnly || order.waitingForMe)
}

export async function getTelegramOrder(userId: string, orderId: string, lang: Locale) {
  const rows = await getVisibleOrderRows(userId, lang, true)
  const order = rows.find((row) => row.id === orderId)
  if (!order) return null
  const access = await getOrderAccess(userId)
  const localized = localeField[lang]
  const productIds = [...new Set(order.lines.map((line) => line.productId))]
  const unitTypeIds = [...new Set(order.lines.map((line) => line.unitTypeId).filter(Boolean) as string[])]
  const [productRows, unitRows, comments] = await Promise.all([
    productIds.length
      ? db.select({ id: products.id, title: localized.product }).from(products).where(inArray(products.id, productIds))
      : Promise.resolve([]),
    unitTypeIds.length
      ? db.select({ id: unitTypes.id, title: localized.unit }).from(unitTypes).where(inArray(unitTypes.id, unitTypeIds))
      : Promise.resolve([]),
    db.select({
      id: orderComments.id,
      authorName: orderComments.authorName,
      authorUsername: orderComments.authorUsername,
      body: orderComments.body,
      replyToId: orderComments.replyToId,
      createdAt: orderComments.createdAt,
    }).from(orderComments)
      .where(eq(orderComments.orderId, orderId))
      .orderBy(orderComments.createdAt),
  ])
  const productNames = new Map(productRows.map((row) => [row.id, row.title]))
  const unitNames = new Map(unitRows.map((row) => [row.id, row.title]))
  const lines = order.lines.map((line) => ({
    id: line.id,
    product: productNames.get(line.productId) ?? line.productId,
    unit: line.unitTypeId ? unitNames.get(line.unitTypeId) ?? "" : "",
    quantity: line.quantity,
    note: line.note,
  }))
  return {
    id: order.id,
    number: order.number,
    parentOrderId: access.canViewParentLink ? order.parentOrderId : undefined,
    parentOrderNumber: access.canViewParentLink ? order.parentOrderNumber : undefined,
    childOrders: rows.filter((child) => child.parentOrderId === order.id).map((child) => ({ id: child.id, number: child.number })),
    type: order.type,
    status: order.status,
    departmentOptions: order.departmentOptions, departmentIds: order.departmentIds, warehouseId: order.warehouseId, currentStep: order.currentStep, waitingFor: order.waitingFor,
    urgency: order.urgency,
    applicant: order.applicant,
    department: order.department,
    warehouse: order.warehouse,
    purpose: order.purpose,
    expectedDate: order.expectedDate,
    createdAt: order.createdAt,
    itemCount: lines.length,
    waitingForMe: order.waitingForMe,
    progress: order.progress,
    stageEnteredAt: order.stageEnteredAt,
    productSummary: order.productSummary,
    comment: order.comment,
    lines: lines.map((line) => ({ ...line, unit: line.unit ?? "" })),
    comments: comments.map((comment) => ({
      ...comment,
      replyToId: comment.replyToId ?? undefined,
    })),
  } satisfies TelegramOrderDetail
}

export async function getTelegramNotifications(userId: string, lang: Locale = "uz") {
  const rows = await db.select({
    id: notifications.id,
    title: notifications.title,
    body: notifications.body,
    orderId: notifications.resourceId,
    commentId: notifications.commentId,
    readAt: notifications.readAt,
    createdAt: notifications.createdAt,
  })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(100)
  return rows.map((row) => ({ ...row, body: formatWorkflowNotification({ message: row.body }, lang) }))
}

export async function getMentionedOrderDiscussion(userId: string, orderId: string) {
  const [mention] = await db.select({ commentId: orderCommentMentions.commentId })
    .from(orderCommentMentions)
    .innerJoin(orderComments, eq(orderCommentMentions.commentId, orderComments.id))
    .where(and(
      eq(orderCommentMentions.userId, userId),
      eq(orderComments.orderId, orderId),
    ))
    .limit(1)
  if (!mention) return null

  const comments = await db.select({
    id: orderComments.id,
    orderNumber: orderComments.orderNumber,
    authorUserId: orderComments.authorUserId,
    authorName: orderComments.authorName,
    authorUsername: orderComments.authorUsername,
    body: orderComments.body,
    replyToId: orderComments.replyToId,
    createdAt: orderComments.createdAt,
  }).from(orderComments)
    .where(eq(orderComments.orderId, orderId))
    .orderBy(orderComments.createdAt)
  if (!comments.length) return null
  return {
    orderId,
    orderNumber: comments[0].orderNumber,
    comments: comments.map((comment) => ({ ...comment, replyToId: comment.replyToId ?? undefined })),
  }
}

/**
 * Telegram home model: the same insights as the web dashboard, gated by the
 * user's role permissions from the database.
 */
export async function getTelegramDashboard(userId: string, lang: Locale) {
  const settings = await getSettingsData()
  const user = settings.users.find((item) => item.id === userId)
  const roles = settings.roles.filter((role) => user?.roleIds.includes(role.id))
  const access = dashboardAccess(roles)
  const now = Date.now()
  const rows = access.orders
    ? await db.select({ payload: appRecords.payload }).from(appRecords).where(eq(appRecords.namespace, "orders"))
    : []
  const orders = rows.map((row) => parseStoredOrder(row.payload))
    .filter((order): order is OrderRecord => Boolean(order))
    .filter(isOperationalOrder)
    .filter((order) => canReadOrderWithSettings(order, userId, settings))
  const warehouseResponsible = (warehouseId: string) => settings.warehouses.find((item) => item.id === warehouseId)?.responsibleUserId
  const userName = (id: string) => settings.users.find((item) => item.id === id)?.fullName ?? id
  const title = (item: { titleUz: string; titleRu: string; titleTr: string }) => lang === "ru" ? item.titleRu : lang === "tr" ? item.titleTr : item.titleUz
  const summary = (order: OrderRecord) => {
    const visible = access.team || !isOrderAssignedToProcurementSpecialist(order, userId)
      ? order.lines
      : order.lines.filter((line) => getAssignedProcurementLineIds(order, userId).includes(line.id))
    const product = settings.products.find((item) => item.id === visible[0]?.productId)
    const purpose = settings["order-purposes"].find((item) => item.id === order.purposeId)
    const name = product ? title(product) : purpose ? title(purpose) : order.number
    return visible.length > 1 ? `${name} +${visible.length - 1}` : name
  }
  const flow = buildFlowMap(orders, now, warehouseResponsible)
  const activeIds = new Set(flow.stages.flatMap((stage) => stage.orderIds))
  const late = lateOrders(orders, now)
  return {
    access,
    roleNames: roles.map(title),
    counts: {
      active: activeIds.size,
      late: late.length,
      urgent: orders.filter((order) => activeIds.has(order.id) && ["urgent", "critical"].includes(order.urgency)).length,
    },
    queue: buildMyQueue(orders, userId, now, warehouseResponsible).map((item) => ({
      id: item.order.id, number: getProcurementSuborderForSpecialist(item.order, userId)?.number ?? item.order.number,
      summary: summary(item.order), step: item.step, ageDays: item.ageDays, overdue: item.overdue, urgency: item.order.urgency,
    })),
    flow: access.summary ? {
      bottleneck: flow.bottleneck,
      stages: flow.stages.map((stage) => ({
        step: stage.step, orders: stage.orderIds.length, positions: stage.positions, avgDays: stage.avgDays,
        holders: stage.holders.map((holder) => userName(holder.userId)),
      })),
    } : null,
    trend: access.summary ? dailyTrend(orders, now) : null,
    late: late.slice(0, 5).map(({ order, daysLate }) => ({ id: order.id, number: order.number, summary: summary(order), daysLate, urgency: order.urgency })),
    team: access.team ? specialistLoad(orders, procurementTeamIds(settings.users, settings.roles), now).map((item) => ({ ...item, name: userName(item.userId) })) : null,
    money: access.money ? placementMoney(orders, now) : null,
  }
}

export type TelegramDashboard = Awaited<ReturnType<typeof getTelegramDashboard>>
