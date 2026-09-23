"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRightIcon, FlameIcon } from "lucide-react"

import type { FlowStage, FlowStep } from "@/lib/dashboard-insights"
import { daysBetween, enteredStepAt, orderStepLines } from "@/lib/dashboard-insights"
import type { Locale } from "@/lib/i18n"
import type { OrderRecord } from "@/lib/orders"
import { cn } from "@/lib/utils"
import { dashboardCopy } from "./dashboard-copy"
import { AvatarStack, orderSummary, UrgencyDot, waitTone, type DashboardData } from "./dashboard-parts"

export function FlowMap({ stages, bottleneck, orders, data, lang, now }: {
  stages: FlowStage[]
  bottleneck?: FlowStep
  orders: OrderRecord[]
  data: DashboardData
  lang: Locale
  now: number
}) {
  const copy = dashboardCopy[lang]
  // undefined: follow the bottleneck; null: the user closed the details.
  const [picked, setPicked] = React.useState<FlowStep | null | undefined>(undefined)
  const selected = picked === undefined ? bottleneck : picked ?? undefined
  const maxCount = Math.max(1, ...stages.map((stage) => stage.orderIds.length))
  const total = new Set(stages.flatMap((stage) => stage.orderIds)).size
  const selectedStage = stages.find((stage) => stage.step === selected)
  const selectedOrders = selectedStage
    ? selectedStage.orderIds.map((id) => orders.find((order) => order.id === id)).filter((order): order is OrderRecord => Boolean(order))
      .map((order) => {
        const lineIds = orderStepLines(order).get(selectedStage.step) ?? []
        return { order, lineIds, age: daysBetween(enteredStepAt(order, lineIds), now) }
      })
      .sort((a, b) => b.age - a.age)
    : []

  return (
    <section className="rounded-2xl border bg-card shadow-xs" aria-labelledby="flow-map-title">
      <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="flow-map-title" className="font-semibold tracking-tight">{copy.flowTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.flowDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{copy.avgWaitLegend}</span>
          <Legend className="bg-emerald-500" label="< 2" lang={lang} />
          <Legend className="bg-amber-500" label="2–5" lang={lang} />
          <Legend className="bg-red-500" label="> 5" lang={lang} />
        </div>
      </div>

      {total === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">{copy.flowEmpty}</p>
      ) : (
        <>
          <div className="relative overflow-x-auto px-5 pb-5 pt-6 [scrollbar-width:thin]">
            <ol className="relative grid min-w-[62rem] grid-cols-9 gap-2">
              <span aria-hidden="true" className="absolute left-[5.5%] right-[5.5%] top-3 h-0.5 rounded-full bg-gradient-to-r from-primary/15 via-primary/35 to-primary/15" />
              {stages.map((stage, index) => {
                const count = stage.orderIds.length
                const isBottleneck = stage.step === bottleneck
                const isSelected = stage.step === selected
                const tone = waitTone(stage.avgDays)
                return (
                  <li key={stage.step} className="relative">
                    <button
                      type="button"
                      onClick={() => setPicked(isSelected ? null : stage.step)}
                      aria-pressed={isSelected}
                      className={cn(
                        "group flex h-full w-full cursor-pointer flex-col items-center rounded-xl px-1.5 pb-3 text-center outline-none transition-[background-color,box-shadow] duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                        isSelected ? "bg-primary/[0.06] ring-1 ring-primary/30" : "hover:bg-muted/70",
                      )}
                    >
                      <span
                        className={cn(
                          "relative z-10 flex size-6 items-center justify-center rounded-full border-2 bg-background font-mono text-[11px] font-semibold tabular-nums",
                          count ? isBottleneck ? "border-red-500 text-red-600" : "border-primary text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        {index + 1}
                        {isBottleneck ? <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border-2 border-red-500/60 motion-reduce:hidden" /> : null}
                      </span>
                      <span className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-4 text-foreground">{copy.steps[stage.step]}</span>
                      <span className={cn("mt-2 font-mono text-3xl font-semibold leading-none tabular-nums tracking-tight", count ? "text-foreground" : "text-muted-foreground/40")}>{count}</span>
                      <span className="mt-1 text-[11px] text-muted-foreground">{stage.positions} {copy.positions}</span>
                      <span aria-hidden="true" className="mt-3 flex h-12 w-full items-end justify-center">
                        <span
                          className={cn("w-7 rounded-t-md transition-[height] duration-500 motion-reduce:transition-none", count ? tone.bar : "bg-muted")}
                          style={{ height: `${count ? Math.max(12, (count / maxCount) * 100) : 6}%` }}
                        />
                      </span>
                      <span className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums", count ? tone.chip : "text-muted-foreground/60")}>
                        {count ? formatDays(stage.avgDays, lang) : "—"}
                      </span>
                      <span className="mt-2 min-h-6"><AvatarStack userIds={stage.holders.map((holder) => holder.userId)} data={data} /></span>
                      {isBottleneck ? (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          <FlameIcon className="size-3" aria-hidden="true" />{copy.bottleneck}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          {selectedStage ? (
            <div className="border-t bg-muted/30 px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{copy.stageOrders}: <span className="text-primary">{copy.steps[selectedStage.step]}</span></h3>
                <span className="font-mono text-xs text-muted-foreground">{selectedOrders.length}</span>
              </div>
              {selectedOrders.length ? (
                <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {selectedOrders.slice(0, 9).map(({ order, lineIds, age }) => {
                    const holderIds = selectedStage.step === "sourcing" || order.procurementProgress
                      ? lineIds.map((id) => order.procurementProgress?.[id]?.waitingForUserId ?? order.procurementLineAssignments?.[id]).filter((id): id is string => Boolean(id))
                      : order.waitingForUserId ? [order.waitingForUserId] : []
                    const holder = data.users.find((user) => user.id === holderIds[0])
                    return (
                      <li key={order.id}>
                        <Link href={`/${lang}/orders?order=${encodeURIComponent(order.id)}`} className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                          <UrgencyDot urgency={order.urgency} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-xs font-semibold">{order.number}</span>
                            <span className="block truncate text-xs text-muted-foreground">{orderSummary(order, data, lang)}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{copy.holder}: {holder?.fullName ?? copy.unassigned}</span>
                          </span>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums", waitTone(age).chip)}>{formatDays(age, lang)}</span>
                          <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : <p className="text-sm text-muted-foreground">{copy.stageEmpty}</p>}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function Legend({ className, label, lang }: { className: string; label: string; lang: Locale }) {
  const unit = lang === "ru" ? "дн." : lang === "tr" ? "gün" : "kun"
  return <span className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", className)} aria-hidden="true" />{label} {unit}</span>
}

export function formatDays(value: number, lang: Locale) {
  if (value < 1) {
    const hours = Math.max(1, Math.round(value * 24))
    return lang === "ru" ? `${hours} ч` : lang === "tr" ? `${hours} sa` : `${hours} soat`
  }
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value)
  return lang === "ru" ? `${rounded} дн.` : lang === "tr" ? `${rounded} gün` : `${rounded} kun`
}
