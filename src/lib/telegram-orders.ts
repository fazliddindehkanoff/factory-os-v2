import "server-only"

import { and, desc, eq, or } from "drizzle-orm"

import { db } from "@/db/client"
import {
  departments,
  notifications,
  orderCommentMentions,
  orderComments,
  orderLines,
  orderPurposes,
  orders,
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
  return db.select({
    id: orders.id,
    number: orders.number,
    type: orders.type,
    status: orders.status,
    urgency: orders.urgency,
    requesterUserId: orders.requesterUserId,
    createdByUserId: orders.createdByUserId,
    applicant: users.fullName,
    department: localized.department,
    warehouse: localized.warehouse,
    purpose: localized.purpose,
    expectedDate: orders.expectedDate,
    createdAt: orders.createdAt,
    comment: orders.comment,
  })
    .from(orders)
    .innerJoin(users, eq(orders.requesterUserId, users.id))
    .innerJoin(departments, eq(orders.primaryDepartmentId, departments.id))
    .innerJoin(warehouses, eq(orders.warehouseId, warehouses.id))
    .innerJoin(orderPurposes, eq(orders.purposeId, orderPurposes.id))
    .where(access.canViewAll
      ? undefined
      : or(eq(orders.requesterUserId, userId), eq(orders.createdByUserId, userId)))
    .orderBy(desc(orders.createdAt))
}

export async function getTelegramOrders(userId: string, lang: Locale, waitingOnly = false) {
  const [rows, waitingIds, lineRows] = await Promise.all([
    getVisibleOrderRows(userId, lang),
    getWaitingOrderIds(userId),
    db.select({ orderId: orderLines.orderId }).from(orderLines),
  ])
  const counts = new Map<string, number>()
  for (const row of lineRows) counts.set(row.orderId, (counts.get(row.orderId) ?? 0) + 1)
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
      itemCount: counts.get(row.id) ?? 0,
      waitingForMe: waitingIds.has(row.id),
    } satisfies TelegramOrderSummary))
    .filter((order) => !waitingOnly || order.waitingForMe)
}

export async function getTelegramOrder(userId: string, orderId: string, lang: Locale) {
  const rows = await getVisibleOrderRows(userId, lang)
  const order = rows.find((row) => row.id === orderId)
  if (!order) return null
  const localized = localeField[lang]
  const [lines, waitingIds, comments] = await Promise.all([
    db.select({
      id: orderLines.id,
      product: localized.product,
      unit: localized.unit,
      quantity: orderLines.quantity,
      note: orderLines.note,
    })
      .from(orderLines)
      .innerJoin(products, eq(orderLines.productId, products.id))
      .leftJoin(unitTypes, eq(orderLines.unitTypeId, unitTypes.id))
      .where(eq(orderLines.orderId, orderId))
      .orderBy(orderLines.sortOrder),
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
    waitingForMe: waitingIds.has(order.id),
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
