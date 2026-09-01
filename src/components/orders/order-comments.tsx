"use client"

import * as React from "react"
import {
  MessageCircleMoreIcon,
  ReplyIcon,
  SendHorizontalIcon,
  XIcon,
} from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Locale, Messages } from "@/lib/i18n"
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
  const { addOrderComment } = useOrders()
  const { data } = useSettings()
  const { currentUser } = useAuthorization()
  const comments = order.comments ?? []
  const [body, setBody] = React.useState("")
  const [replyToId, setReplyToId] = React.useState<string>()
  const [error, setError] = React.useState("")
  const composerRef = React.useRef<HTMLTextAreaElement>(null)
  const threadEndRef = React.useRef<HTMLDivElement>(null)
  const hasMounted = React.useRef(false)
  const replyTo = comments.find((comment) => comment.id === replyToId)

  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [comments.length])

  function userFor(comment: OrderComment) {
    return data.users.find((user) => user.id === comment.authorUserId)
  }

  function startReply(comment: OrderComment) {
    setReplyToId(comment.id)
    setError("")
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  function submitComment() {
    setError("")
    if (!body.trim()) return
    if (body.trim().length > ORDER_COMMENT_MAX_LENGTH) {
      setError(messages.commentTooLong)
      return
    }
    if (!addOrderComment(order.id, body, replyToId)) {
      setError(messages.commentSendFailed)
      return
    }
    setBody("")
    setReplyToId(undefined)
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
          const author = userFor(comment)
          const repliedComment = comment.replyToId
            ? comments.find((item) => item.id === comment.replyToId)
            : undefined
          const repliedAuthor = repliedComment ? userFor(repliedComment) : undefined
          const isOwn = comment.authorUserId === currentUser?.id
          const initials = initialsFor(author?.fullName ?? messages.unknownUser)

          return (
            <article
              id={`order-comment-${comment.id}`}
              key={comment.id}
              className={cn("flex items-end gap-2", isOwn && "flex-row-reverse")}
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
                    {author?.fullName ?? messages.unknownUser}
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
                        {repliedAuthor?.fullName ?? messages.unknownUser}
                      </span>
                      <span className={cn("line-clamp-2 text-xs", isOwn ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        {repliedComment.body}
                      </span>
                    </button>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.body}</p>
                  <p className={cn("mt-1 text-right text-[10px] tabular-nums", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {formatCommentTime(comment.createdAt, lang)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="mt-0.5 h-5 px-1.5 text-[11px] text-muted-foreground"
                  aria-label={`${messages.reply}: ${author?.fullName ?? messages.unknownUser}`}
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
          submitComment()
        }}
      >
        {replyTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-2">
            <ReplyIcon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-primary">
                {messages.replyingTo.replace("{name}", userFor(replyTo)?.fullName ?? messages.unknownUser)}
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
          <Textarea
            ref={composerRef}
            value={body}
            maxLength={ORDER_COMMENT_MAX_LENGTH}
            rows={2}
            placeholder={messages.writeComment}
            aria-label={messages.writeComment}
            aria-describedby="order-comment-limit"
            className="max-h-36 min-h-16 resize-y rounded-2xl bg-muted/30 px-3.5 py-2.5"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submitComment()
              }
            }}
          />
          <Button
            type="submit"
            size="icon-lg"
            className="rounded-full"
            disabled={!body.trim()}
            aria-label={messages.sendComment}
          >
            <SendHorizontalIcon />
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
