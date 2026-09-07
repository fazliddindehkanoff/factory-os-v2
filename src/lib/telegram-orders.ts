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
  workflowInstances,
  workflowStepInstances,
} from "@/db/schema"
import type { Locale } from "@/lib/i18n"
import type { OrderRecord, OrderStatus } from "@/lib/orders"
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
  status: "draft" | "in_review" | "revision_requested" | "approved" | "rejected" | "cancelled"
  urgency: "normal" | "high" | "urgent" | "critical"
  applicant: string
  department: string
  warehouse: string
  purpose: string
  expectedDate: string
  createdAt: string
  itemCount: number
  waitingForMe: boolean
}

export type TelegramOrderDetail = TelegramOrderSummary & {
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
  number: string
  type: OrderRecord["type"]
  status: TelegramOrderStatus
  urgency: OrderRecord["urgency"]
  applicant: string
  department: string
  warehouse: string
  purpose: string
  expectedDate: string
  createdAt: string
  comment: string
  lines: OrderRecord["lines"]
  waitingForUserId?: string
}

function toTelegramOrderStatus(status: OrderStatus): TelegramOrderStatus {
  if (status === "draft") return "draft"
  if (status === "approved" || status === "fulfilled") return "approved"
  if (status === "rejected") return "rejected"
  return "in_review"
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
    code: rolePermissions.permissionCode,
  })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .where(eq(userRoles.userId, userId))
  const permissions = new Set(grants.map((grant) => grant.code).filter(Boolean) as PermissionCode[])
  return {
    canViewAll: grants.some((grant) => grant.grantsAll) || permissions.has("requests.view"),
    canViewOwn: grants.some((grant) => grant.grantsAll) || permissions.has("requests.view_own"),
  }
}

async function getWaitingOrderIds(userId: string) {
  const rows = await db.select({ orderId: workflowInstances.orderId })
    .from(workflowStepInstances)
    .innerJoin(workflowInstances, eq(workflowStepInstances.workflowInstanceId, workflowInstances.id))
    .where(and(
      eq(workflowStepInstances.assignedUserId, userId),
      eq(workflowStepInstances.status, "active"),
    ))
  return new Set(rows.map((row) => row.orderId))
}

async function getVisibleOrderRows(userId: string, lang: Locale) {
  const access = await getOrderAccess(userId)
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
    .filter(({ order, ownerId }) => access.canViewAll || order.applicantId === userId || order.createdByUserId === userId || ownerId === userId)

  const [userRows, departmentRows, warehouseRows, purposeRows] = await Promise.all([
    db.select({ id: users.id, title: users.fullName }).from(users),
    db.select({ id: departments.id, title: localized.department }).from(departments),
    db.select({ id: warehouses.id, title: localized.warehouse }).from(warehouses),
    db.select({ id: orderPurposes.id, title: localized.purpose }).from(orderPurposes),
  ])
  const userNames = new Map(userRows.map((row) => [row.id, row.title]))
  const departmentNames = new Map(departmentRows.map((row) => [row.id, row.title]))
  const warehouseNames = new Map(warehouseRows.map((row) => [row.id, row.title]))
  const purposeNames = new Map(purposeRows.map((row) => [row.id, row.title]))

  return storedOrders.map(({ order }) => ({
    id: order.id,
    number: order.number,
    type: order.type,
    status: toTelegramOrderStatus(order.status),
    urgency: order.urgency,
    applicant: userNames.get(order.applicantId) ?? order.applicantId,
    department: order.departmentIds.map((id) => departmentNames.get(id)).filter(Boolean).join(", ") || "—",
    warehouse: warehouseNames.get(order.warehouseId) ?? "—",
    purpose: purposeNames.get(order.purposeId) ?? "—",
    expectedDate: order.expectedDate,
    createdAt: order.createdAt,
    comment: order.comment,
    lines: order.lines,
    waitingForUserId: order.waitingForUserId,
  } satisfies VisibleOrderRow))
}

export async function getTelegramOrders(userId: string, lang: Locale, waitingOnly = false) {
  const [rows, waitingIds] = await Promise.all([
    getVisibleOrderRows(userId, lang),
    getWaitingOrderIds(userId),
  ])
  return rows
    .map((row) => ({
      id: row.id,
      number: row.number,
      type: row.type,
      status: row.status,
      urgency: row.urgency,
      applicant: row.applicant,
      department: row.department,
      warehouse: row.warehouse,
      purpose: row.purpose,
      expectedDate: row.expectedDate,
      createdAt: row.createdAt,
      itemCount: row.lines.length,
      waitingForMe: row.waitingForUserId === userId || waitingIds.has(row.id),
    } satisfies TelegramOrderSummary))
    .filter((order) => !waitingOnly || order.waitingForMe)
}

export async function getTelegramOrder(userId: string, orderId: string, lang: Locale) {
  const rows = await getVisibleOrderRows(userId, lang)
  const order = rows.find((row) => row.id === orderId)
  if (!order) return null
  const localized = localeField[lang]
  const productIds = [...new Set(order.lines.map((line) => line.productId))]
  const unitTypeIds = [...new Set(order.lines.map((line) => line.unitTypeId).filter(Boolean) as string[])]
  const [productRows, unitRows, waitingIds, comments] = await Promise.all([
    productIds.length
      ? db.select({ id: products.id, title: localized.product }).from(products).where(inArray(products.id, productIds))
      : Promise.resolve([]),
    unitTypeIds.length
      ? db.select({ id: unitTypes.id, title: localized.unit }).from(unitTypes).where(inArray(unitTypes.id, unitTypeIds))
      : Promise.resolve([]),
    getWaitingOrderIds(userId),
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
    type: order.type,
    status: order.status,
    urgency: order.urgency,
    applicant: order.applicant,
    department: order.department,
    warehouse: order.warehouse,
    purpose: order.purpose,
    expectedDate: order.expectedDate,
    createdAt: order.createdAt,
    itemCount: lines.length,
    waitingForMe: order.waitingForUserId === userId || waitingIds.has(order.id),
    comment: order.comment,
    lines: lines.map((line) => ({ ...line, unit: line.unit ?? "" })),
    comments: comments.map((comment) => ({
      ...comment,
      replyToId: comment.replyToId ?? undefined,
    })),
  } satisfies TelegramOrderDetail
}

export async function getTelegramNotifications(userId: string) {
  return db.select({
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
