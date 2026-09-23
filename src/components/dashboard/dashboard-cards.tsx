"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRightIcon, BanknoteIcon, CalendarClockIcon, CircleCheckBigIcon, TriangleAlertIcon, UsersIcon } from "lucide-react"

import type { dailyTrend, lateOrders, placementMoney, QueueItem, SpecialistLoad } from "@/lib/dashboard-insights"
import type { Locale } from "@/lib/i18n"
import { formatShortDate } from "@/lib/date-format"
import { formatMoneyShort } from "@/lib/money-format"
import { cn } from "@/lib/utils"
import { dashboardCopy } from "./dashboard-copy"
import { avatarTone, initials, orderSummary, UrgencyDot, waitTone, type DashboardData } from "./dashboard-parts"


export function MyQueue({ items, data, lang, stepLabel }: {
  items: QueueItem[]
  data: DashboardData
  lang: Locale
  stepLabel: (step: QueueItem["step"]) => string
}) {
  const copy = dashboardCopy[lang]
  const visible = items.slice(0, 5)
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border bg-card shadow-xs" aria-labelledby="my-queue-title">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 id="my-queue-title" className="font-semibold tracking-tight">{copy.queueTitle}</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-sm font-semibold tabular-nums", items.length ? "bg-primary text-primary-foreground" : "bg-emerald-50 text-emerald-700")}>{items.length}</span>
        </div>
      </div>
      {visible.length ? (
        <ul className="divide-y">
          {visible.map(({ order, step, ageDays, overdue }) => (
            <li key={order.id}>
              <Link
                href={`/${lang}/orders?order=${encodeURIComponent(order.id)}`}
                className="group flex min-h-[4.25rem] items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <UrgencyDot urgency={order.urgency} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-sm font-semibold">{order.number}</span>
                    {overdue ? <span className="shrink-0 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">{copy.late}</span> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">{orderSummary(order, data, lang)} · {stepLabel(step)}</span>
                </span>
                <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums sm:inline", waitTone(ageDays).chip)}>{copy.waitingDays(ageDays)}</span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  {copy.open}<ArrowRightIcon className="size-3.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="relative flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CircleCheckBigIcon className="size-8" aria-hidden="true" />
            <span aria-hidden="true" className="absolute -right-1 -top-1 size-3 rounded-full bg-emerald-400" />
          </span>
          <p className="mt-4 font-semibold">{copy.queueEmptyTitle}</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">{copy.queueEmptyBody}</p>
        </div>
      )}
      {items.length > visible.length ? (
        <Link href={`/${lang}/orders?view=waiting`} className="mt-auto flex min-h-11 items-center justify-center gap-1.5 border-t text-sm font-medium text-primary hover:bg-primary/5">
          {copy.queueMore(items.length - visible.length)}<ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  )
}

export function PulseTiles({ active, late, urgent, trend, lang }: {
  active: number
  late: number
  urgent: number
  /** Omitted when the user lacks the status-summary permission. */
  trend?: ReturnType<typeof dailyTrend>
  lang: Locale
}) {
  const copy = dashboardCopy[lang]
  const days = trend ?? []
  const max = Math.max(1, ...days.flatMap((day) => [day.created, day.closed]))
  const created = days.reduce((sum, day) => sum + day.created, 0)
  const closed = days.reduce((sum, day) => sum + day.closed, 0)
  const tiles = [
    { label: copy.activeOrders, value: active, tone: "text-foreground", href: `/${lang}/orders` },
    { label: copy.lateOrders, value: late, tone: late ? "text-red-600" : "text-foreground", href: "#late-orders" },
    { label: copy.urgentOrders, value: urgent, tone: urgent ? "text-orange-600" : "text-foreground", href: `/${lang}/orders` },
  ]
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="rounded-2xl border bg-card px-4 py-3.5 shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <p className="truncate text-xs text-muted-foreground">{tile.label}</p>
            <p className={cn("mt-1.5 font-mono text-3xl font-semibold tabular-nums tracking-tight", tile.tone)}>{tile.value}</p>
          </Link>
        ))}
      </div>
      {trend ? <section className="rounded-2xl border bg-card px-4 py-4 shadow-xs" aria-labelledby="trend-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="trend-title" className="text-sm font-semibold">{copy.trendTitle}</h2>
            <p className="text-xs text-muted-foreground">{copy.trendHint}</p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" aria-hidden="true" />{copy.trendCreated} <b className="font-mono tabular-nums">{created}</b></span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-emerald-500" aria-hidden="true" />{copy.trendClosed} <b className="font-mono tabular-nums">{closed}</b></span>
          </div>
        </div>
        <div className="mt-4 flex h-24 items-end gap-1" role="img" aria-label={`${copy.trendCreated} ${created}, ${copy.trendClosed} ${closed}`}>
          {trend.map((day, index) => (
            <div key={day.date} className="group relative flex h-full flex-1 items-end justify-center gap-px" title={`${formatShortDate(new Date(`${day.date}T12:00:00`), lang)} · ${copy.trendCreated} ${day.created} · ${copy.trendClosed} ${day.closed}`}>
              <span className={cn("w-1/2 rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary", index === trend.length - 1 && "bg-primary")} style={{ height: `${day.created ? Math.max(6, (day.created / max) * 100) : 2}%` }} />
              <span className="w-1/2 rounded-t-sm bg-emerald-500/80 transition-colors group-hover:bg-emerald-500" style={{ height: `${day.closed ? Math.max(6, (day.closed / max) * 100) : 2}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{trend[0] ? formatShortDate(new Date(`${trend[0].date}T12:00:00`), lang) : null}</span>
          <span>{trend.at(-1) ? formatShortDate(new Date(`${trend.at(-1)!.date}T12:00:00`), lang) : null}</span>
        </div>
      </section> : null}
    </div>
  )
}

export function LateOrdersCard({ items, data, lang }: { items: ReturnType<typeof lateOrders>; data: DashboardData; lang: Locale }) {
  const copy = dashboardCopy[lang]
  return (
    <section id="late-orders" className="scroll-mt-20 rounded-2xl border bg-card shadow-xs" aria-labelledby="late-orders-title">
      <CardHeader icon={TriangleAlertIcon} iconTone={items.length ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"} title={copy.lateTitle} description={copy.lateDescription} id="late-orders-title" />
      {items.length ? (
        <ul className="divide-y">
          {items.slice(0, 6).map(({ order, daysLate }) => (
            <li key={order.id}>
              <Link href={`/${lang}/orders?order=${encodeURIComponent(order.id)}`} className="flex min-h-14 items-center gap-3 px-5 py-2.5 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                <UrgencyDot urgency={order.urgency} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm font-semibold">{order.number}</span>
                  <span className="block truncate text-xs text-muted-foreground">{orderSummary(order, data, lang)}</span>
                </span>
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-red-700">{copy.daysLate(daysLate)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyLine text={copy.lateEmpty} />}
    </section>
  )
}

export function TeamLoadCard({ items, data, lang }: { items: SpecialistLoad[]; data: DashboardData; lang: Locale }) {
  const copy = dashboardCopy[lang]
  const max = Math.max(1, ...items.map((item) => item.sourcing + item.placing))
  return (
    <section className="rounded-2xl border bg-card shadow-xs" aria-labelledby="team-load-title">
      <CardHeader icon={UsersIcon} iconTone="bg-violet-50 text-violet-600" title={copy.teamTitle} description={copy.teamDescription} id="team-load-title" />
      {items.length ? (
        <ul className="space-y-4 px-5 py-4">
          {items.map((item) => {
            const name = data.users.find((user) => user.id === item.userId)?.fullName ?? item.userId
            return (
              <li key={item.userId} className="flex items-center gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", avatarTone(item.userId))}>{initials(name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{copy.teamSubmitted}: <b className="font-mono tabular-nums text-foreground">{item.submitted30d}</b></span>
                  </span>
                  <span className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="h-full bg-primary" style={{ width: `${(item.sourcing / max) * 100}%` }} />
                    <span className="h-full bg-sky-300" style={{ width: `${(item.placing / max) * 100}%` }} />
                  </span>
                  <span className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                    <span>{copy.teamSourcing}: <b className="font-mono tabular-nums text-foreground">{item.sourcing}</b></span>
                    <span>{copy.teamPlacing}: <b className="font-mono tabular-nums text-foreground">{item.placing}</b></span>
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      ) : <EmptyLine text={copy.teamEmpty} />}
    </section>
  )
}

export function MoneyCard({ money, lang }: { money: ReturnType<typeof placementMoney>; lang: Locale }) {
  const copy = dashboardCopy[lang]
  const format = (value: number) => formatMoneyShort(value, lang)
  const upcomingTotal = money.upcoming.reduce((sum, item) => sum + item.amount, 0)
  return (
    <section className="rounded-2xl border bg-card shadow-xs" aria-labelledby="money-title">
      <CardHeader icon={BanknoteIcon} iconTone="bg-emerald-50 text-emerald-600" title={copy.moneyTitle} description={copy.moneyDescription} id="money-title"
        action={<Link href={`/${lang}/finance`} className="shrink-0 text-xs font-medium text-primary hover:underline">{copy.openFinance}</Link>} />
      <div className="grid grid-cols-2 gap-3 px-5 pt-4">
        <div className="rounded-xl bg-muted/60 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">{copy.placedThisMonth}</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{format(money.placedThisMonth)} <span className="text-xs font-normal text-muted-foreground">UZS</span></p>
        </div>
        <div className="rounded-xl bg-muted/60 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">{copy.advances}</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{format(money.advancesThisMonth)} <span className="text-xs font-normal text-muted-foreground">UZS</span></p>
        </div>
      </div>
      <div className="px-5 pb-4 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium"><CalendarClockIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />{copy.upcomingBalances}</span>
          <span className="font-mono font-semibold tabular-nums">{format(upcomingTotal)}</span>
        </div>
        {money.upcoming.length ? (
          <ul className="divide-y rounded-xl border">
            {money.upcoming.slice(0, 4).map((item) => (
              <li key={`${item.orderId}-${item.supplierName}-${item.dueDate}`}>
                <Link href={`/${lang}/orders?order=${encodeURIComponent(item.orderId)}`} className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60">
                  <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{formatShortDate(new Date(`${item.dueDate}T12:00:00`), lang)}</span>
                  <span className="min-w-0 flex-1 truncate">{item.supplierName} <span className="text-xs text-muted-foreground">· {item.orderNumber}</span></span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">{format(item.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{copy.noUpcoming}</p>}
      </div>
    </section>
  )
}

function CardHeader({ icon: Icon, iconTone, title, description, id, action }: {
  icon: typeof UsersIcon; iconTone: string; title: string; description: string; id: string; action?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 border-b px-5 py-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", iconTone)}><Icon className="size-4.5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{text}</p>
}

