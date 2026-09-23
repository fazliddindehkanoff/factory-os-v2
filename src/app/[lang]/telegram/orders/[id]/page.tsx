import { stepLabel } from "@/lib/order-labels"
import { TelegramOrderActions } from "@/components/telegram/telegram-order-actions"
import { OrderComments } from "@/components/orders/order-comments"
import { uxCopy } from "@/lib/ux-copy"
import { messages } from "@/lib/i18n"
import Link from "next/link"
import { ArrowLeftIcon, BoxIcon, CalendarXIcon, CheckIcon, Clock3Icon, HashIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { TelegramStatusPill, telegramAge, telegramLateDays, telegramStepName } from "@/components/telegram/telegram-order-card"
import { workflowSteps } from "@/lib/orders"
import { cn } from "@/lib/utils"
import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireTelegramSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"
import { getMentionedOrderDiscussion, getTelegramOrder } from "@/lib/telegram-orders"

export default async function Page({ params, searchParams }: PageProps<"/[lang]/telegram/orders/[id]">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const session = await requireTelegramSession(lang, `/${lang}/telegram/orders/${encodeURIComponent(id)}${typeof query.comment === "string" ? `?comment=${encodeURIComponent(query.comment)}` : ""}`)
  const copy = telegramCopy[lang]
  const order = await getTelegramOrder(session.userId, id, lang)
  const localeTag = lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"
  const rawReturnQuery = typeof query.return === "string" ? query.return : ""
  const returnParams = new URLSearchParams(rawReturnQuery)
  const safeReturnParams = new URLSearchParams()
  for (const key of ["scope", "q", "type", "status", "urgency", "department", "warehouse"]) {
    const value = returnParams.get(key)
    if (value && value.length <= 160) safeReturnParams.set(key, value)
  }
  const backQuery = safeReturnParams.toString()

  if (!order) {
    const discussion = await getMentionedOrderDiscussion(session.userId, id)
    if (!discussion) notFound()
    return (
      <TelegramShell lang={lang} copy={copy} userId={session.userId} title={discussion.orderNumber} subtitle={telegramDiscussionCopy[lang]}>
        <Link href={`/${lang}/telegram/notifications`} className="mb-3 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl px-2 text-[13px] font-semibold text-[var(--tg-link,#2365a9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:bg-[#e7f1fb]"><ArrowLeftIcon className="size-4" />{copy.notifications}</Link>
        <OrderComments order={{ id, number: discussion.orderNumber }} lang={lang} messages={messages[lang]} />
      </TelegramShell>
    )
  }

  const formatDate = (value: string) => new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value))


  const lateDays = telegramLateDays(order)
  const open = order.currentStep !== "complete" && !["rejected", "cancelled", "approved", "fulfilled"].includes(order.status)
  const currentIndex = workflowSteps.indexOf(order.currentStep as (typeof workflowSteps)[number])
  const completedSteps = currentIndex >= 0 ? currentIndex : Math.round(order.progress * workflowSteps.length)
  const facts = [
    [uxCopy[lang].currentStep, stepLabel(order.currentStep, lang)],
    [uxCopy[lang].responsible, order.waitingFor || "—"],
    [copy.applicant, order.applicant],
    [copy.department, order.department],
    [copy.warehouse, order.warehouse],
    [copy.purpose, order.purpose],
    [copy.expectedDate, formatDate(`${order.expectedDate}T00:00:00`)],
    [copy.createdAt, formatDate(order.createdAt)],
    [copy.type, order.type === "material" ? copy.material : copy.service],
    [copy.urgency, copy.urgencyLabels[order.urgency]],
  ]

  return (
    <TelegramShell lang={lang} copy={copy} userId={session.userId} title={order.number} subtitle={copy.status[order.status]}>
      <Link href={typeof query.back === "string" && query.back.startsWith(`/${lang}/telegram/finance`) && !query.back.includes("\\") ? query.back : `/${lang}/telegram/orders${backQuery ? `?${backQuery}` : ""}#orders`} className="mb-3 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl px-2 text-[13px] font-semibold text-[var(--tg-link,#2365a9)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:bg-[#e7f1fb]">
        <ArrowLeftIcon className="size-4" />{copy.backToOrders}
      </Link>

      {order.parentOrderId || order.childOrders.length ? <nav className="tg-card mb-4 space-y-2 rounded-xl border p-3" aria-label={copy.orderInformation}>
        <p className="text-xs font-semibold">{lang === "ru" ? "Связанные заказы" : lang === "tr" ? "İlgili siparişler" : "Bog‘liq buyurtmalar"}</p>
        {order.parentOrderId ? <Link className="flex min-h-11 items-center text-sm text-primary underline" href={`/${lang}/telegram/orders/${encodeURIComponent(order.parentOrderId)}`}>{order.parentOrderNumber}</Link> : null}
        {order.childOrders.map((child) => <Link key={child.id} className="flex min-h-11 items-center text-sm text-primary underline" href={`/${lang}/telegram/orders/${encodeURIComponent(child.id)}`}>{child.number}</Link>)}
      </nav> : null}

      <section className="tg-card overflow-hidden rounded-[14px] border shadow-[0_1px_2px_rgba(16,30,60,0.06),0_8px_22px_-14px_rgba(16,30,60,0.18)]">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold tracking-wide text-[var(--tg-link,#2365a9)]">{order.number}</p>
              <h2 className="mt-1 text-lg font-bold leading-6 text-[var(--tg-text)]">{order.productSummary || order.purpose}</h2>
              <p className="mt-0.5 text-xs text-[var(--tg-text-secondary)]">{order.purpose}</p>
            </div>
            <TelegramStatusPill order={order} copy={copy} />
          </div>
          {lateDays ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#e04434]/12 px-2 py-1 text-[11px] font-bold text-[#d23b2c]">
              <CalendarXIcon className="size-3.5" aria-hidden="true" />
              {lang === "ru" ? `Просрочено +${lateDays} дн.` : lang === "tr" ? `Gecikme +${lateDays} gün` : `Kechikmoqda +${lateDays} kun`}
            </p>
          ) : null}
        </div>

        <div className="border-t border-[var(--tg-divider)] bg-[var(--tg-card-muted)] px-4 py-3.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-bold text-[var(--tg-text)]">{open ? telegramStepName(order.currentStep, lang) : copy.status[order.status]}</span>
            <span className="shrink-0 font-mono font-medium tabular-nums text-[var(--tg-text-muted)]">
              {open ? <><Clock3Icon className="mr-1 inline size-3 -translate-y-px" aria-hidden="true" />{telegramAge(order.stageEnteredAt, lang)} · </> : null}{Math.round(order.progress * 100)}%
            </span>
          </div>
          <ol className="mt-3 flex items-center" aria-label={uxCopy[lang].currentStep}>
            {workflowSteps.map((step, index) => {
              const done = !open || index < completedSteps
              const current = open && step === order.currentStep
              return (
                <li key={step} className="flex flex-1 items-center last:flex-none" title={telegramStepName(step, lang)}>
                  <span className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    done ? "bg-[#1f9d60] text-white" : current ? "bg-[#2d7dd2] text-white ring-4 ring-[#2d7dd2]/20" : "bg-[var(--tg-card)] text-[var(--tg-text-muted)] ring-1 ring-inset ring-[var(--tg-border)]",
                  )}>{done ? <CheckIcon className="size-3" aria-hidden="true" /> : index + 1}</span>
                  {index < workflowSteps.length - 1 ? <span className={cn("h-0.5 flex-1", done ? "bg-[#1f9d60]/70" : "bg-[var(--tg-border)]")} /> : null}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[var(--tg-divider)] p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tg-text-muted)]">{copy.urgency}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--tg-text)]">{copy.urgencyLabels[order.urgency]}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tg-text-muted)]">{copy.positions}</p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-[var(--tg-text)]">{order.lines.length}</p>
          </div>
        </div>
      </section>

      <TelegramOrderActions id={id} lang={lang} />
      <section className="mt-5">
        <h2 className="mb-2.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--tg-text-secondary)]">{copy.orderInformation}</h2>
        <dl className="tg-card divide-y divide-[var(--tg-divider)] rounded-[14px] border px-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
          {facts.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-3 text-[13px]">
              <dt className="text-[var(--tg-text-muted)]">{label}</dt>
              <dd className="break-words text-right font-semibold leading-5 text-[var(--tg-text-secondary)]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {order.comment ? (
        <section className="mt-5">
          <h2 className="mb-2.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--tg-text-secondary)]">{copy.comment}</h2>
          <div className="tg-card rounded-[14px] border p-4 text-[13px] leading-6 text-[var(--tg-text-secondary)] shadow-[0_1px_2px_rgba(16,30,60,0.05)]">{order.comment}</div>
        </section>
      ) : null}

      <OrderComments order={{ id, number: order.number }} lang={lang} messages={messages[lang]} />

      <section className="mt-4">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--tg-text-secondary)]">{copy.positions}</h2>
          <span className="font-mono text-[11px] font-semibold text-[var(--tg-text-muted)]">{order.lines.length}</span>
        </div>
        <div className="grid gap-2.5">
          {order.lines.map((line, index) => (
            <article key={line.id} className="tg-card rounded-[14px] border p-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#e7f1fb] text-[var(--tg-link,#2365a9)]"><BoxIcon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-5 text-[var(--tg-text)]">{index + 1}. {line.product}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--tg-text-muted)]"><HashIcon className="size-3.5" />{copy.quantity}: <span className="font-mono font-semibold tabular-nums text-[var(--tg-text-secondary)]">{line.quantity} {line.unit}</span></div>
                  {line.note ? <p className="mt-2 border-t border-[var(--tg-divider)] pt-2 text-xs leading-5 text-[var(--tg-text-secondary)]">{line.note}</p> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </TelegramShell>
  )
}

const telegramDiscussionCopy = {
  uz: "Muhokama",
  ru: "Обсуждение",
  tr: "Tartışma",
} as const
