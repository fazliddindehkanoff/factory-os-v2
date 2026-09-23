import { Clock3Icon } from "lucide-react"

import { dashboardCopy } from "@/components/dashboard/dashboard-copy"
import { waitTone } from "@/components/dashboard/dashboard-parts"
import { currentStageEnteredAt, daysBetween, orderLateDays, workflowProgress, type FlowStep } from "@/lib/dashboard-insights"
import type { Locale } from "@/lib/i18n"
import { stepLabel } from "@/lib/order-labels"
import { workflowSteps, type OrderRecord } from "@/lib/orders"
import { cn } from "@/lib/utils"

export function shortStepLabel(step: OrderRecord["currentStep"], lang: Locale) {
  return (workflowSteps as readonly string[]).includes(step) ? dashboardCopy[lang].steps[step as FlowStep] : stepLabel(step, lang)
}

export function formatAge(days: number, lang: Locale) {
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24))
    return lang === "ru" ? `${hours} ч` : lang === "tr" ? `${hours} sa` : `${hours} soat`
  }
  const value = Math.floor(days)
  return lang === "ru" ? `${value} дн.` : lang === "tr" ? `${value} gün` : `${value} kun`
}

/** Current step, time spent there and overall workflow progress. */
export function OrderProgress({ order, lang, now, className }: { order: OrderRecord; lang: Locale; now: number; className?: string }) {
  const progress = workflowProgress(order)
  const open = order.currentStep !== "complete" && !["rejected", "approved", "fulfilled", "draft"].includes(order.status)
  const age = daysBetween(currentStageEnteredAt(order), now)
  const barColor = order.status === "rejected" ? "bg-destructive" : !open ? "bg-emerald-500" : "bg-primary"
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">{open ? shortStepLabel(order.currentStep, lang) : shortStepLabel("complete", lang)}</span>
        {open ? (
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums", waitTone(age).chip)}>
            <Clock3Icon className="size-3" aria-hidden="true" />{formatAge(age, lang)}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.max(4, progress * 100)}%` }} />
      </div>
    </div>
  )
}

export function LateBadge({ order, lang, now }: { order: OrderRecord; lang: Locale; now: number }) {
  const days = orderLateDays(order, now)
  if (!days) return null
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-red-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-red-700">
      +{lang === "ru" ? `${days} дн.` : lang === "tr" ? `${days} gün` : `${days} kun`}
    </span>
  )
}
