import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import type { TelegramOrderSummary } from "@/lib/telegram-orders"

const localeTag = { uz: "uz-UZ", ru: "ru-RU", tr: "tr-TR" } as const

export const telegramStatusVisual = {
  draft: { color: "#7b8798", background: "#edf1f6", progress: 8 },
  in_review: { color: "#d9820b", background: "#fcf0dd", progress: 56 },
  revision_requested: { color: "#d9820b", background: "#fcf0dd", progress: 28 },
  approved: { color: "#1fa363", background: "#e5f6ec", progress: 100 },
  rejected: { color: "#e04434", background: "#fbe8e5", progress: 100 },
  cancelled: { color: "#7b8798", background: "#edf1f6", progress: 100 },
} satisfies Record<TelegramOrderSummary["status"], { color: string; background: string; progress: number }>

export function TelegramStatusPill({ order, copy }: { order: Pick<TelegramOrderSummary, "status">; copy: TelegramCopy }) {
  const visual = telegramStatusVisual[order.status]
  return (
    <span
      className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold"
      style={{ color: visual.color, background: visual.background }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: visual.color }} />
      <span className="truncate">{copy.status[order.status]}</span>
    </span>
  )
}

function shortDate(value: string, lang: Locale) {
  return new Intl.DateTimeFormat(localeTag[lang], { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

export function TelegramOrderCard({ order, lang, copy, returnQuery = "" }: { order: TelegramOrderSummary; lang: Locale; copy: TelegramCopy; returnQuery?: string }) {
  const visual = telegramStatusVisual[order.status]

  return (
    <Link
      href={`/${lang}/telegram/orders/${encodeURIComponent(order.id)}${returnQuery ? `?return=${encodeURIComponent(returnQuery)}` : ""}`}
      className="tg-card group block min-h-44 touch-manipulation rounded-[14px] border p-[15px] text-left shadow-[0_1px_2px_rgba(16,30,60,0.06)] transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:opacity-80"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: visual.color }} />
          <span className="truncate font-mono text-[12px] font-semibold text-[var(--tg-text)]">{order.number}</span>
          {order.waitingForMe ? <span className="shrink-0 rounded-md bg-[#fcf0dd] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#ad6500]">{copy.actionRequired}</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TelegramStatusPill order={order} copy={copy} />
          <ChevronRightIcon className="size-4 text-[#a3adbc] transition-transform duration-200 group-active:translate-x-0.5" />
        </div>
      </div>

      <h2 className="mt-2 line-clamp-2 text-[15px] font-bold leading-5 text-[var(--tg-text)]">{order.purpose}</h2>

      <dl className="mt-3 grid gap-1.5 border-t border-[#edf0f4] pt-3">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <dt className="shrink-0 text-[var(--tg-text-muted)]">{copy.applicant}</dt>
          <dd className="truncate text-right font-semibold text-[var(--tg-text-secondary)]">{order.applicant}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <dt className="shrink-0 text-[var(--tg-text-muted)]">{copy.department}</dt>
          <dd className="truncate text-right font-semibold text-[var(--tg-text-secondary)]">{order.department}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <dt className="shrink-0 text-[var(--tg-text-muted)]">{copy.createdAt}</dt>
          <dd className="font-mono font-medium tabular-nums text-[var(--tg-text-secondary)]">{shortDate(order.createdAt, lang)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <dt className="shrink-0 text-[var(--tg-text-muted)]">{copy.expectedDate}</dt>
          <dd className="font-mono font-medium tabular-nums text-[var(--tg-text-secondary)]">{shortDate(`${order.expectedDate}T00:00:00`, lang)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between text-[10px] font-semibold">
        <span style={{ color: visual.color }}>{copy.status[order.status]}</span>
        <span className="font-mono text-[var(--tg-text-muted)]">{order.itemCount} {copy.items}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#e7ecf3]" aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${visual.progress}%`, background: visual.color }} />
      </div>
    </Link>
  )
}
