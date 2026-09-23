import Link from "next/link"
import { CalendarXIcon, ChevronRightIcon, Clock3Icon } from "lucide-react"

import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import type { TelegramOrderSummary } from "@/lib/telegram-orders"
import { dashboardCopy } from "@/components/dashboard/dashboard-copy"
import type { FlowStep } from "@/lib/dashboard-insights"
import { stepLabel } from "@/lib/order-labels"
import { workflowSteps } from "@/lib/orders"
import { cn } from "@/lib/utils"

const localeTag = { uz: "uz-UZ", ru: "ru-RU", tr: "tr-TR" } as const

export const telegramStatusVisual = {
  draft: { color: "#526176", background: "#edf1f6" },
  supervisor_review: { color: "#925705", background: "#fcf0dd" },
  warehouse_check: { color: "#925705", background: "#fcf0dd" },
  in_progress: { color: "#2165a6", background: "#e7f1fb" },
  fulfilled: { color: "#137547", background: "#e5f6ec" },
  revision_requested: { color: "#925705", background: "#fcf0dd" },
  approved: { color: "#137547", background: "#e5f6ec" },
  rejected: { color: "#ae2d23", background: "#fbe8e5" },
  cancelled: { color: "#526176", background: "#edf1f6" },
} satisfies Record<TelegramOrderSummary["status"], { color: string; background: string }>

export function TelegramStatusPill({ order, copy }: { order: Pick<TelegramOrderSummary, "status">; copy: TelegramCopy }) {
  const visual = telegramStatusVisual[order.status]
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold"
      style={{ color: visual.color, background: visual.background }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: visual.color }} />
      <span>{copy.status[order.status]}</span>
    </span>
  )
}

function shortDate(value: string, lang: Locale) {
  return new Intl.DateTimeFormat(localeTag[lang], { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

const DAY = 86_400_000

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/** Compact "3 kun" / "5 soat" age since a timestamp. */
export function telegramAge(from: string, lang: Locale) {
  const days = Math.max(0, (Date.now() - Date.parse(from)) / DAY)
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24))
    return lang === "ru" ? `${hours} ч` : lang === "tr" ? `${hours} sa` : `${hours} soat`
  }
  const value = Math.floor(days)
  return lang === "ru" ? `${value} дн.` : lang === "tr" ? `${value} gün` : `${value} kun`
}

export function telegramLateDays(order: Pick<TelegramOrderSummary, "expectedDate" | "currentStep" | "status">) {
  const closed = order.currentStep === "complete" || ["approved", "fulfilled", "rejected", "cancelled"].includes(order.status)
  const today = localToday()
  if (closed || !order.expectedDate || order.expectedDate >= today) return 0
  return Math.max(1, Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${order.expectedDate}T00:00:00`)) / DAY))
}

export function telegramStepName(step: TelegramOrderSummary["currentStep"], lang: Locale) {
  return (workflowSteps as readonly string[]).includes(step) ? dashboardCopy[lang].steps[step as FlowStep] : stepLabel(step, lang)
}

export function TelegramOrderCard({ order, lang, copy, returnQuery = "" }: { order: TelegramOrderSummary; lang: Locale; copy: TelegramCopy; returnQuery?: string }) {
  const visual = telegramStatusVisual[order.status]
  const lateDays = telegramLateDays(order)
  const open = order.currentStep !== "complete" && !["rejected", "cancelled"].includes(order.status)
  const percent = Math.round(order.progress * 100)
  const late = lang === "ru" ? `Просрочено +${lateDays} дн.` : lang === "tr" ? `Gecikme +${lateDays} gün` : `Kechikmoqda +${lateDays} kun`

  return (
    <Link
      href={`/${lang}/telegram/orders/${encodeURIComponent(order.id)}${returnQuery ? `?return=${encodeURIComponent(returnQuery)}` : ""}`}
      className={cn(
        "tg-card group relative block touch-manipulation overflow-hidden rounded-[14px] border p-[15px] text-left shadow-[0_1px_2px_rgba(16,30,60,0.06)] transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:opacity-80",
        order.waitingForMe && "border-[#d9820b]/45",
      )}
    >
      {order.waitingForMe ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#e8930f]" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: urgencyColor[order.urgency] }} aria-hidden="true" />
          <span className="truncate font-mono text-[12px] font-semibold text-[var(--tg-text)]">{order.number}</span>
          {order.waitingForMe ? <span className="shrink-0 rounded-md bg-[#e8930f]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#c77700]">{copy.actionRequired}</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TelegramStatusPill order={order} copy={copy} />
          <ChevronRightIcon className="size-4 text-[#a3adbc] transition-transform duration-200 group-active:translate-x-0.5" />
        </div>
      </div>

      <h2 className="mt-2 line-clamp-2 text-[15px] font-bold leading-5 text-[var(--tg-text)]">{order.productSummary || order.purpose}</h2>
      <p className="mt-0.5 truncate text-xs text-[var(--tg-text-secondary)]">{order.purpose} · {order.applicant}</p>

      {lateDays ? (
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#e04434]/12 px-2 py-1 text-[11px] font-bold text-[#d23b2c]">
          <CalendarXIcon className="size-3.5" aria-hidden="true" />{late}
        </p>
      ) : null}

      <div className="mt-3 border-t border-[var(--tg-divider)] pt-3">
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="min-w-0 truncate font-semibold text-[var(--tg-text)]">{open ? telegramStepName(order.currentStep, lang) : copy.status[order.status]}</span>
          <span className="shrink-0 font-mono font-medium tabular-nums text-[var(--tg-text-muted)]">
            {open ? <><Clock3Icon className="mr-1 inline size-3 -translate-y-px" aria-hidden="true" />{telegramAge(order.stageEnteredAt, lang)} · </> : null}{percent}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--tg-card-muted)] ring-1 ring-inset ring-[var(--tg-divider)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={telegramStepName(order.currentStep, lang)}>
          <div className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(4, percent)}%`, background: visual.color }} />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--tg-text-muted)]">
          <span className="font-mono tabular-nums">{copy.expectedDate}: {shortDate(`${order.expectedDate}T00:00:00`, lang)}</span>
          <span className="font-mono">{order.itemCount} {copy.items}</span>
        </div>
      </div>
    </Link>
  )
}

const urgencyColor: Record<TelegramOrderSummary["urgency"], string> = {
  critical: "#e04434",
  urgent: "#f07b16",
  high: "#e8b20f",
  normal: "#9aa6b8",
}
