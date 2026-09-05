import Link from "next/link"
import { ArrowLeftIcon, MessageCircleMoreIcon, ReplyIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { requireSession } from "@/lib/auth/session"
import { isLocale, messages } from "@/lib/i18n"
import { getMentionedOrderDiscussion } from "@/lib/telegram-orders"
import { cn } from "@/lib/utils"

export default async function Page({ params, searchParams }: PageProps<"/[lang]/orders/discussion/[id]">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const session = await requireSession(lang)
  const discussion = await getMentionedOrderDiscussion(session.userId, id)
  if (!discussion) notFound()
  const copy = messages[lang]
  const highlightedId = typeof query.comment === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(query.comment)
    ? query.comment
    : undefined
  const localeTag = lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"

  return (
    <AppShell lang={lang} messages={copy} currentLabel={copy.comments}>
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <Link href={`/${lang}/orders`} className={buttonVariants({ variant: "ghost", className: "mb-3" })}>
          <ArrowLeftIcon />{copy.orderList}
        </Link>
        <section className="overflow-hidden rounded-2xl border bg-muted/20 shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageCircleMoreIcon className="size-5" /></span>
              <div className="min-w-0"><p className="truncate font-mono text-xs font-semibold text-primary">{discussion.orderNumber}</p><h1 className="text-lg font-semibold">{copy.comments}</h1></div>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground">{discussion.comments.length}</span>
          </header>
          <div role="log" aria-label={copy.comments} className="space-y-3 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--border)_55%,transparent)_1px,transparent_0)] bg-size-[18px_18px] p-4 sm:p-6">
            {discussion.comments.map((comment) => {
              const replied = comment.replyToId ? discussion.comments.find((item) => item.id === comment.replyToId) : undefined
              const isOwn = comment.authorUserId === session.userId
              return (
                <article id={`order-comment-${comment.id}`} key={comment.id} className={cn("flex scroll-m-8 items-end gap-2 rounded-2xl", isOwn && "flex-row-reverse", highlightedId === comment.id && "bg-primary/10 shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_22%,transparent)]")}>
                  <Avatar size="sm" className="mb-1 ring-2 ring-background"><AvatarFallback>{initialsFor(comment.authorName)}</AvatarFallback></Avatar>
                  <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[72%]", isOwn ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-background")}>
                    <p className={cn("mb-1 text-xs font-semibold", isOwn ? "text-primary-foreground" : "text-primary")}>{comment.authorName}</p>
                    {replied ? <div className={cn("mb-2 rounded-lg border-l-2 px-2.5 py-1.5 text-xs", isOwn ? "border-primary-foreground/70 bg-white/10" : "border-primary bg-muted/70")}><span className="mb-0.5 flex items-center gap-1 font-semibold"><ReplyIcon className="size-3" />{replied.authorName}</span><span className="line-clamp-2 opacity-75">{replied.body}</span></div> : null}
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.body}</p>
                    <time className={cn("mt-1 block text-right text-[10px]", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>{new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}</time>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

function initialsFor(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase()
}
