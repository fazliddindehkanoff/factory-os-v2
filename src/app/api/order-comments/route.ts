import { randomUUID } from "node:crypto"
import { and, asc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db/client"
import {
  notifications,
  orderCommentMentions,
  orderComments,
  users,
} from "@/db/schema"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import { containsUserMention } from "@/lib/mentions"
import { normalizeOrderCommentBody } from "@/lib/orders"
import { sendTelegramNotificationForUser } from "@/lib/telegram-bot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_MENTIONS = 20

async function canUseOrderChat(userId: string) {
  const permissions = await Promise.all([
    userHasPermission(userId, "requests.view"),
    userHasPermission(userId, "requests.view_own"),
  ])
  return permissions.some(Boolean)
}

function validShortId(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 128
}

export async function GET(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!(await canUseOrderChat(session.userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const orderId = new URL(request.url).searchParams.get("orderId")
  if (!validShortId(orderId)) {
    return NextResponse.json({ error: "invalid-order" }, { status: 400 })
  }

  const rows = await db.select().from(orderComments)
    .where(eq(orderComments.orderId, orderId!))
    .orderBy(asc(orderComments.createdAt))
  const mentionRows = rows.length
    ? await db.select().from(orderCommentMentions)
      .where(inArray(orderCommentMentions.commentId, rows.map((row) => row.id)))
    : []
  const mentionsByComment = new Map<string, string[]>()
  for (const mention of mentionRows) {
    const ids = mentionsByComment.get(mention.commentId) ?? []
    ids.push(mention.userId)
    mentionsByComment.set(mention.commentId, ids)
  }

  return NextResponse.json({
    comments: rows.map((row) => ({
      ...row,
      authorUserId: row.authorUserId ?? "",
      replyToId: row.replyToId ?? undefined,
      mentionedUserIds: mentionsByComment.get(row.id) ?? [],
    })),
  })
}

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!(await canUseOrderChat(session.userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-comment" }, { status: 400 })
  }
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "invalid-comment" }, { status: 400 })
  }
  const input = raw as Record<string, unknown>
  const orderId = input.orderId
  const orderNumber = typeof input.orderNumber === "string" ? input.orderNumber.trim() : ""
  const body = typeof input.body === "string" ? normalizeOrderCommentBody(input.body) : null
  const replyToId = input.replyToId === undefined ? undefined : input.replyToId
  const requestedMentionIds = Array.isArray(input.mentionedUserIds)
    ? [...new Set(input.mentionedUserIds.filter(validShortId) as string[])].slice(0, MAX_MENTIONS)
    : []
  if (!validShortId(orderId) || !orderNumber || orderNumber.length > 64 || !body || (replyToId !== undefined && !validShortId(replyToId))) {
    return NextResponse.json({ error: "invalid-comment" }, { status: 400 })
  }

  const [author] = await db.select({
    id: users.id,
    fullName: users.fullName,
    username: users.username,
  }).from(users).where(and(eq(users.id, session.userId), eq(users.isActive, true))).limit(1)
  if (!author) return NextResponse.json({ error: "user-not-found" }, { status: 404 })

  const requestedUsers = requestedMentionIds.length
    ? await db.select({ id: users.id, username: users.username })
      .from(users)
      .where(and(inArray(users.id, requestedMentionIds), eq(users.isActive, true)))
    : []
  const mentionedUsers = requestedUsers.filter((user) => {
    if (user.id === author.id) return false
    return containsUserMention(body, user.username)
  })

  const comment = {
    id: randomUUID(),
    orderId: orderId as string,
    orderNumber,
    authorUserId: author.id,
    authorName: author.fullName,
    authorUsername: author.username,
    body,
    replyToId: replyToId as string | undefined,
    createdAt: new Date().toISOString(),
  }
  await db.insert(orderComments).values(comment)
  if (mentionedUsers.length) {
    await db.insert(orderCommentMentions).values(
      mentionedUsers.map((user) => ({ commentId: comment.id, userId: user.id })),
    )
    const preview = body.length > 180 ? `${body.slice(0, 179).trimEnd()}…` : body
    await db.insert(notifications).values(mentionedUsers.map((user) => ({
      id: randomUUID(),
      userId: user.id,
      type: "order_mention",
      title: orderNumber,
      body: `${author.fullName} sizni izohda belgiladi: ${preview}`,
      resourceType: "order",
      resourceId: orderId as string,
      commentId: comment.id,
    })))

    if (process.env.TELEGRAM_BOT_TOKEN) {
      await Promise.allSettled(mentionedUsers.map((user) =>
        sendTelegramNotificationForUser(
          user.id,
          orderNumber,
          `${author.fullName} sizni izohda belgiladi:\n${preview}`,
          orderId as string,
          comment.id,
        ),
      ))
    }
  }

  return NextResponse.json({
    comment: {
      ...comment,
      mentionedUserIds: mentionedUsers.map((user) => user.id),
    },
  }, { status: 201 })
}
