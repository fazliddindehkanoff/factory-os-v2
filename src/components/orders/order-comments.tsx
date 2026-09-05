"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  AtSignIcon,
  LoaderCircleIcon,
  MessageCircleMoreIcon,
  ReplyIcon,
  SendHorizontalIcon,
  XIcon,
} from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { useSettings } from "@/components/settings/settings-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Locale, Messages } from "@/lib/i18n"
import { containsUserMention } from "@/lib/mentions"
import {
  ORDER_COMMENT_MAX_LENGTH,
  type OrderComment,
  type OrderRecord,
} from "@/lib/orders"
import { cn } from "@/lib/utils"

export function OrderComments({
  order,
  lang,
  messages,
}: {
  order: OrderRecord
  lang: Locale
  messages: Messages
}) {
  const { data } = useSettings()
  const { currentUser } = useAuthorization()
  const [serverComments, setServerComments] = React.useState<OrderComment[]>([])
  const [body, setBody] = React.useState("")
  const [replyToId, setReplyToId] = React.useState<string>()
  const [error, setError] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [mentionIndex, setMentionIndex] = React.useState(0)
  const composerRef = React.useRef<HTMLTextAreaElement>(null)
  const threadEndRef = React.useRef<HTMLDivElement>(null)
  const hasMounted = React.useRef(false)
  const searchParams = useSearchParams()
  const highlightedId = searchParams.get("comment") ?? undefined
  const comments = React.useMemo(() => {
    const byId = new Map<string, OrderComment>()
    for (const comment of [...(order.comments ?? []), ...serverComments]) byId.set(comment.id, comment)
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [order.comments, serverComments])
  const replyTo = comments.find((comment) => comment.id === replyToId)
  const mentionMatch = body.match(/(?:^|\s)@([^\s@]*)$/u)
  const mentionQuery = mentionMatch?.[1]?.toLocaleLowerCase() ?? null
  const mentionUsers = mentionQuery === null ? [] : data.users
    .filter((user) => user.id !== currentUser?.id)
    .filter((user) => !mentionQuery || user.username.toLocaleLowerCase().includes(mentionQuery) || user.fullName.toLocaleLowerCase().includes(mentionQuery))
    .slice(0, 6)

  React.useEffect(() => {
    let cancelled = false
    async function loadComments() {
      try {
        const response = await fetch(`/api/order-comments?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" })
        if (!response.ok) return
        const payload = await response.json() as { comments?: OrderComment[] }
        if (!cancelled) setServerComments(payload.comments ?? [])
      } catch {
        // The local thread remains visible if the server is temporarily unavailable.
      }
    }
    void loadComments()
    const interval = window.setInterval(loadComments, 15_000)
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void loadComments() }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [order.id])

  React.useEffect(() => {
    const commentId = highlightedId
    if (!commentId || !comments.some((comment) => comment.id === commentId)) return
    requestAnimationFrame(() => {
      document.getElementById(`order-comment-${commentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [comments, highlightedId])

  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    if (new URLSearchParams(window.location.search).get("comment")) return
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [comments.length])

  function userFor(comment: OrderComment) {
    return data.users.find((user) => user.id === comment.authorUserId)
  }

  function authorNameFor(comment: OrderComment) {
    return userFor(comment)?.fullName ?? comment.authorName ?? messages.unknownUser
  }

  function startReply(comment: OrderComment) {
    setReplyToId(comment.id)
    setError("")
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  function insertMention(username: string) {
    const match = body.match(/(?:^|\s)@([^\s@]*)$/u)
    if (!match || match.index === undefined) return
    const atIndex = match.index + match[0].lastIndexOf("@")
    setBody(`${body.slice(0, atIndex)}@${username} `)
    setMentionIndex(0)
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  async function submitComment() {
    setError("")
    if (!body.trim() || sending) return
    if (body.trim().length > ORDER_COMMENT_MAX_LENGTH) {
      setError(messages.commentTooLong)
      return
    }
    const mentionedUserIds = data.users
      .filter((user) => user.id !== currentUser?.id && containsUserMention(body, user.username))
      .map((user) => user.id)
    setSending(true)
    try {
      const response = await fetch("/api/order-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.number,
          body,
          replyToId,
          mentionedUserIds,
        }),
      })
      if (!response.ok) throw new Error("comment failed")
      const payload = await response.json() as { comment: OrderComment }
      setServerComments((current) => [...current.filter((item) => item.id !== payload.comment.id), payload.comment])
      setBody("")
      setReplyToId(undefined)
    } catch {
      setError(messages.commentSendFailed)
    } finally {
      setSending(false)
    }
  }

  return (
    <section aria-labelledby="order-comments-title" className="overflow-hidden rounded-2xl border bg-muted/20 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircleMoreIcon className="size-4" />
          </span>
          <div>
            <h3 id="order-comments-title" className="text-sm font-semibold">{messages.comments}</h3>
            <p className="text-xs text-muted-foreground">{messages.commentsDescription}</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {comments.length}
        </span>
      </div>

      <div
        role="log"
        aria-label={messages.comments}
        aria-live="polite"
        className="max-h-[28rem] min-h-52 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--border)_55%,transparent)_1px,transparent_0)] bg-size-[18px_18px] p-4"
      >
        {comments.length ? comments.map((comment) => {
          const repliedComment = comment.replyToId
            ? comments.find((item) => item.id === comment.replyToId)
            : undefined
          const repliedAuthor = repliedComment ? userFor(repliedComment) : undefined
          const isOwn = comment.authorUserId === currentUser?.id
          const authorName = authorNameFor(comment)
          const initials = initialsFor(authorName)

          return (
            <article
              id={`order-comment-${comment.id}`}
              key={comment.id}
              className={cn(
                "flex scroll-m-6 items-end gap-2 rounded-2xl transition-[background-color,box-shadow] duration-500",
                isOwn && "flex-row-reverse",
                highlightedId === comment.id && "bg-primary/10 shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_22%,transparent)]",
              )}
            >
              <Avatar size="sm" className="mb-5 ring-2 ring-background">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className={cn("flex max-w-[85%] flex-col items-start sm:max-w-[72%]", isOwn && "items-end")}>
                <div
                  className={cn(
                    "min-w-32 rounded-2xl px-3.5 py-2.5 shadow-sm",
                    isOwn
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border bg-background text-foreground",
                  )}
                >
                  <p className={cn("mb-1 text-xs font-semibold", isOwn ? "text-primary-foreground" : "text-primary")}>
                    {authorName}
                  </p>
                  {repliedComment ? (
                    <button
                      type="button"
                      className={cn(
                        "mb-2 block w-full rounded-lg border-l-2 px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isOwn ? "border-primary-foreground/70 bg-white/10" : "border-primary bg-muted/70",
                      )}
                      onClick={() => document.getElementById(`order-comment-${repliedComment.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    >
                      <span className={cn("block truncate text-[11px] font-semibold", isOwn ? "text-primary-foreground" : "text-primary")}>
                        {repliedAuthor?.fullName ?? repliedComment.authorName ?? messages.unknownUser}
                      </span>
                      <span className={cn("line-clamp-2 text-xs", isOwn ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        {repliedComment.body}
                      </span>
                    </button>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{renderCommentBody(comment.body, data.users, isOwn)}</p>
                  <p className={cn("mt-1 text-right text-[10px] tabular-nums", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {formatCommentTime(comment.createdAt, lang)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="mt-0.5 h-5 px-1.5 text-[11px] text-muted-foreground"
                  aria-label={`${messages.reply}: ${authorName}`}
                  onClick={() => startReply(comment)}
                >
                  <ReplyIcon className="size-3" />
                  {messages.reply}
                </Button>
              </div>
            </article>
          )
        }) : (
          <div className="flex min-h-44 flex-col items-center justify-center px-4 text-center">
            <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border">
              <MessageCircleMoreIcon className="size-5" />
            </span>
            <p className="text-sm font-medium">{messages.noComments}</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">{messages.noCommentsDescription}</p>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <form
        className="border-t bg-background p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submitComment()
        }}
      >
        {replyTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-2">
            <ReplyIcon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-primary">
                {messages.replyingTo.replace("{name}", authorNameFor(replyTo))}
              </p>
              <p className="truncate text-xs text-muted-foreground">{replyTo.body}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={messages.cancelReply}
              onClick={() => setReplyToId(undefined)}
            >
              <XIcon />
            </Button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            {mentionUsers.length ? (
              <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 w-full max-w-sm overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg" role="listbox" aria-label={mentionCopy[lang].people}>
                <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <AtSignIcon className="size-3.5" />{mentionCopy[lang].people}
                </div>
                {mentionUsers.map((user, index) => (
                  <button
                    key={user.id}
                    type="button"
                    role="option"
                    aria-selected={mentionIndex === index}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left", mentionIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-accent")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertMention(user.username)}
                  >
                    <Avatar size="sm"><AvatarFallback>{initialsFor(user.fullName)}</AvatarFallback></Avatar>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{user.fullName}</span><span className="block truncate text-xs text-muted-foreground">@{user.username}</span></span>
                  </button>
                ))}
              </div>
            ) : null}
            <Textarea
              ref={composerRef}
              value={body}
              maxLength={ORDER_COMMENT_MAX_LENGTH}
              rows={2}
              placeholder={`${messages.writeComment} · ${mentionCopy[lang].hint}`}
              aria-label={messages.writeComment}
              aria-describedby="order-comment-limit"
              className="max-h-36 min-h-16 resize-y rounded-2xl bg-muted/30 px-3.5 py-2.5"
              onChange={(event) => { setBody(event.target.value); setMentionIndex(0) }}
              onKeyDown={(event) => {
                if (mentionUsers.length && event.key === "ArrowDown") {
                  event.preventDefault()
                  setMentionIndex((current) => (current + 1) % mentionUsers.length)
                  return
                }
                if (mentionUsers.length && event.key === "ArrowUp") {
                  event.preventDefault()
                  setMentionIndex((current) => (current - 1 + mentionUsers.length) % mentionUsers.length)
                  return
                }
                if (mentionUsers.length && (event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
                  event.preventDefault()
                  insertMention(mentionUsers[mentionIndex]?.username ?? mentionUsers[0].username)
                  return
                }
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void submitComment()
                }
              }}
            />
          </div>
          <Button
            type="submit"
            size="icon-lg"
            className="rounded-full"
            disabled={!body.trim() || sending}
            aria-label={messages.sendComment}
          >
            {sending ? <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" /> : <SendHorizontalIcon />}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
          <p id="order-comment-limit" className="text-[11px] text-muted-foreground">{messages.commentInputHint}</p>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {body.length}/{ORDER_COMMENT_MAX_LENGTH}
          </span>
        </div>
        {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
      </form>
    </section>
  )
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase()
}

function formatCommentTime(value: string, lang: Locale) {
  const locales: Record<Locale, string> = { uz: "uz-UZ", ru: "ru-RU", tr: "tr-TR" }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locales[lang], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const mentionCopy = {
  uz: { people: "Foydalanuvchini belgilang", hint: "@ orqali belgilang" },
  ru: { people: "Упомянуть пользователя", hint: "упомянуть через @" },
  tr: { people: "Kullanıcıdan bahset", hint: "@ ile bahset" },
} satisfies Record<Locale, { people: string; hint: string }>

function renderCommentBody(
  body: string,
  users: Array<{ id: string; username: string }>,
  isOwn: boolean,
) {
  const byUsername = new Map(users.map((user) => [user.username.toLocaleLowerCase(), user]))
  return body.split(/(@[^\s@]+)/gu).map((part, index) => {
    if (!part.startsWith("@")) return <React.Fragment key={index}>{part}</React.Fragment>
    const punctuation = part.match(/[.,!?;:]+$/u)?.[0] ?? ""
    const username = part.slice(1, punctuation ? -punctuation.length : undefined)
    if (!byUsername.has(username.toLocaleLowerCase())) return <React.Fragment key={index}>{part}</React.Fragment>
    return <React.Fragment key={index}><span className={cn("rounded px-0.5 font-semibold", isOwn ? "bg-white/15 text-primary-foreground" : "bg-primary/10 text-primary")}>@{username}</span>{punctuation}</React.Fragment>
  })
}
