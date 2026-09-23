import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRightIcon, BanknoteIcon, CheckCircle2Icon, ChevronRightIcon, FlameIcon, TrendingUpIcon, TriangleAlertIcon, UsersIcon, WorkflowIcon } from "lucide-react"

import { dashboardCopy } from "@/components/dashboard/dashboard-copy"
import { formatMoneyShort } from "@/lib/money-format"
import { formatAge, shortStepLabel } from "@/components/orders/order-progress"
import { formatShortDate } from "@/lib/date-format"
import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import type { TelegramDashboard } from "@/lib/telegram-orders"
import { cn } from "@/lib/utils"

const urgencyColor = { critical: "#e04434", urgent: "#f07b16", high: "#e8b20f", normal: "#9aa6b8" } as const
const statLabels = {
  uz: { active: "Faol", late: "Kechikayotgan", urgent: "Shoshilinch", all: "Hammasi", finance: "Moliya" },
  ru: { active: "Активные", late: "Просроченные", urgent: "Срочные", all: "Все", finance: "Финансы" },
  tr: { active: "Aktif", late: "Geciken", urgent: "Acil", all: "Tümü", finance: "Finans" },
}

function waitChip(days: number) {
  if (days < 2) return "bg-[#1f9d60]/12 text-[#1b8a54]"
  if (days <= 5) return "bg-[#e8930f]/14 text-[#b86e00]"
  return "bg-[#e04434]/12 text-[#d23b2c]"
}

export function TelegramHomeHero({ model, lang, copy, userName, hour }: {
  model: TelegramDashboard
  lang: Locale
  copy: TelegramCopy
  userName: string
  hour: number
}) {
  const text = statLabels[lang]
  const stats = [
    { label: text.active, value: model.counts.active, href: `/${lang}/telegram/orders?scope=active#orders`, tone: "text-white" },
    { label: text.late, value: model.counts.late, href: `/${lang}/telegram/orders?scope=late#orders`, tone: model.counts.late ? "text-[#ff8a7a]" : "text-white" },
    { label: text.urgent, value: model.counts.urgent, href: `/${lang}/telegram/orders?urgency=urgent-group#orders`, tone: model.counts.urgent ? "text-[#ffc56b]" : "text-white" },
  ]
  return (
    <section aria-label={copy.workOverview} className="relative overflow-hidden bg-[#1a2b4a] px-5 pb-5 pt-1 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[#2d7dd2]/35 blur-3xl" />
      <div className="relative">
        <p className="text-[13px] font-medium text-[#9db0d6]">{dashboardCopy[lang].greeting(hour)},</p>
        <h2 className="mt-0.5 truncate text-[24px] font-bold leading-tight tracking-[-0.02em]">{userName}</h2>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(model.roleNames.length ? model.roleNames : [copy.employee]).map((role) => (
            <span key={role} className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-[#dce5f4] ring-1 ring-inset ring-white/15">{role}</span>
          ))}
        </div>
        {model.access.orders ? (
          <nav aria-label={copy.workOverview} className="mt-4 grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl bg-white/[0.07] ring-1 ring-inset ring-white/12">
            {stats.map((stat) => (
              <Link key={stat.label} href={stat.href} className="touch-manipulation px-3 py-3 text-left transition-colors active:bg-white/10">
                <span className={cn("block font-mono text-[26px] font-semibold leading-none tabular-nums", stat.tone)}>{stat.value}</span>
                <span className="mt-1.5 block truncate text-[11px] font-semibold text-[#9db0d6]">{stat.label}</span>
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  )
}

export function TelegramHome({ model, lang }: { model: TelegramDashboard; lang: Locale }) {
  const copy = dashboardCopy[lang]
  const text = statLabels[lang]
  return (
    <div className="grid gap-4">
      <Card
        title={copy.queueTitle}
        badge={<span className={cn("rounded-full px-2 py-0.5 font-mono text-[11px] text-white", model.queue.length ? "bg-[#2d7dd2]" : "bg-[#1f9d60]")}>{model.queue.length}</span>}
        action={model.queue.length > 4 ? <HeaderLink href={`/${lang}/telegram/orders?scope=waiting#orders`}>{text.all}</HeaderLink> : null}
      >
        {model.queue.length ? (
          <ul className="divide-y divide-[var(--tg-divider)]">
            {model.queue.slice(0, 4).map((item) => (
              <li key={item.id}>
                <Link href={`/${lang}/telegram/orders/${encodeURIComponent(item.id)}?from=waiting`} className="flex min-h-14 touch-manipulation items-center gap-3 px-4 py-2.5 active:bg-[var(--tg-card-muted)]">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: urgencyColor[item.urgency] }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--tg-text)]">{item.summary}</span>
                    <span className="block truncate text-[11px] text-[var(--tg-text-secondary)]"><span className="font-mono">{item.number}</span> · {shortStepLabel(item.step, lang)}</span>
                  </span>
                  <span title={item.overdue ? copy.late : undefined} className={cn("shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium", item.overdue ? "bg-[#e04434]/12 font-bold text-[#d23b2c]" : waitChip(item.ageDays))}>
                    {item.overdue ? "! " : ""}{formatAge(item.ageDays, lang)}
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-[#a3adbc]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 px-4 pb-4 pt-1">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1f9d60]/12 text-[#1f9d60]"><CheckCircle2Icon className="size-5" aria-hidden="true" /></span>
            <span>
              <span className="block text-[13px] font-bold text-[var(--tg-text)]">{copy.queueEmptyTitle}</span>
              <span className="block text-xs text-[var(--tg-text-secondary)]">{copy.queueEmptyBody}</span>
            </span>
          </div>
        )}
      </Card>

      {model.flow ? (
        <Card title={copy.flowTitle} icon={WorkflowIcon} subtitle={copy.avgWaitLegend.replace(":", "")}>
          <ol className="px-4 pb-3">
            {model.flow.stages.map((stage, index) => {
              const bottleneck = stage.step === model.flow?.bottleneck
              const empty = stage.orders === 0
              return (
                <li key={stage.step} className={cn("relative flex items-center gap-3 rounded-xl py-2", bottleneck && "-mx-2 bg-[#e04434]/[0.07] px-2")}>
                  <span className={cn("relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                    empty ? "bg-[var(--tg-card-muted)] text-[var(--tg-text-muted)] ring-1 ring-inset ring-[var(--tg-border)]" : bottleneck ? "bg-[#e04434] text-white" : "bg-[#2d7dd2] text-white")}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", empty ? "text-[var(--tg-text-muted)]" : "text-[var(--tg-text)]")}>
                      <span className="truncate">{copy.steps[stage.step]}</span>
                      {bottleneck ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#e04434]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#d23b2c]"><FlameIcon className="size-3" aria-hidden="true" />{copy.bottleneck}</span> : null}
                    </span>
                    {!empty && stage.holders.length ? <span className="block truncate text-[11px] text-[var(--tg-text-secondary)]">{stage.holders.join(", ")}</span> : null}
                  </span>
                  {!empty ? <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium", waitChip(stage.avgDays))}>{formatAge(stage.avgDays, lang)}</span> : null}
                  <span className={cn("w-7 shrink-0 text-right font-mono text-[17px] font-semibold tabular-nums", empty ? "text-[var(--tg-text-muted)] opacity-50" : "text-[var(--tg-text)]")}>{stage.orders}</span>
                </li>
              )
            })}
          </ol>
        </Card>
      ) : null}

      {model.trend ? <TrendCard trend={model.trend} lang={lang} /> : null}

      {model.access.orders ? (
        <Card title={copy.lateTitle} icon={TriangleAlertIcon} iconTone={model.late.length ? "text-[#d23b2c] bg-[#e04434]/12" : undefined}
          action={model.counts.late > model.late.length ? <HeaderLink href={`/${lang}/telegram/orders?scope=late#orders`}>{text.all}</HeaderLink> : null}>
          {model.late.length ? (
            <ul className="divide-y divide-[var(--tg-divider)]">
              {model.late.map((item) => (
                <li key={item.id}>
                  <Link href={`/${lang}/telegram/orders/${encodeURIComponent(item.id)}`} className="flex min-h-12 touch-manipulation items-center gap-3 px-4 py-2.5 active:bg-[var(--tg-card-muted)]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: urgencyColor[item.urgency] }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--tg-text)]">{item.summary}</span>
                      <span className="block font-mono text-[11px] text-[var(--tg-text-secondary)]">{item.number}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-[#e04434]/12 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#d23b2c]">{copy.daysLate(item.daysLate)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 pb-4 text-xs text-[var(--tg-text-secondary)]">{copy.lateEmpty}</p>}
        </Card>
      ) : null}

      {model.team ? (
        <Card title={copy.teamTitle} icon={UsersIcon} subtitle={copy.teamDescription}>
          <ul className="space-y-3 px-4 pb-4">
            {model.team.map((item) => {
              const max = Math.max(1, ...model.team!.map((row) => row.sourcing + row.placing))
              return (
                <li key={item.userId}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate font-semibold text-[var(--tg-text)]">{item.name}</span>
                    <span className="shrink-0 text-[11px] text-[var(--tg-text-secondary)]">{copy.teamSubmitted}: <b className="font-mono text-[var(--tg-text)]">{item.submitted30d}</b></span>
                  </div>
                  <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-[var(--tg-card-muted)] ring-1 ring-inset ring-[var(--tg-divider)]" aria-hidden="true">
                    <span className="h-full bg-[#2d7dd2]" style={{ width: `${(item.sourcing / max) * 100}%` }} />
                    <span className="h-full bg-[#7fb6ec]" style={{ width: `${(item.placing / max) * 100}%` }} />
                  </div>
                  <p className="mt-1 flex gap-3 text-[11px] text-[var(--tg-text-secondary)]">
                    <span>{copy.teamSourcing}: <b className="font-mono text-[var(--tg-text)]">{item.sourcing}</b></span>
                    <span>{copy.teamPlacing}: <b className="font-mono text-[var(--tg-text)]">{item.placing}</b></span>
                  </p>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      {model.money ? (
        <Card title={copy.moneyTitle} icon={BanknoteIcon} subtitle={copy.moneyDescription}
          action={<HeaderLink href={`/${lang}/telegram/finance`}>{text.finance}</HeaderLink>}>
          <div className="grid grid-cols-2 gap-2.5 px-4">
            <MoneyTile label={copy.placedThisMonth} value={formatMoneyShort(model.money.placedThisMonth, lang)} />
            <MoneyTile label={copy.advances} value={formatMoneyShort(model.money.advancesThisMonth, lang)} />
          </div>
          <p className="px-4 pb-2 pt-3.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--tg-text-muted)]">{copy.upcomingBalances}</p>
          {model.money.upcoming.length ? (
            <ul className="divide-y divide-[var(--tg-divider)] border-t border-[var(--tg-divider)]">
              {model.money.upcoming.slice(0, 4).map((item) => (
                <li key={`${item.orderId}-${item.supplierName}-${item.dueDate}`}>
                  <Link href={`/${lang}/telegram/orders/${encodeURIComponent(item.orderId)}`} className="flex min-h-11 touch-manipulation items-center gap-3 px-4 py-2 text-[13px] active:bg-[var(--tg-card-muted)]">
                    <span className="w-12 shrink-0 font-mono text-[11px] text-[var(--tg-text-muted)]">{formatShortDate(new Date(`${item.dueDate}T12:00:00`), lang)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-[var(--tg-text)]">{item.supplierName}</span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-[var(--tg-text)]">{formatMoneyShort(item.amount, lang)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 pb-4 text-xs text-[var(--tg-text-secondary)]">{copy.noUpcoming}</p>}
        </Card>
      ) : null}
    </div>
  )
}

function Card({ title, subtitle, icon: Icon, iconTone, badge, action, children }: {
  title: string
  subtitle?: string
  icon?: typeof UsersIcon
  iconTone?: string
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="tg-card overflow-hidden rounded-[14px] border shadow-[0_1px_2px_rgba(16,30,60,0.06)]">
      <div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#2d7dd2]/12 text-[#2d7dd2]", iconTone)}><Icon className="size-4" aria-hidden="true" /></span> : null}
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[14px] font-bold text-[var(--tg-text)]">{title}{badge}</h2>
            {subtitle ? <p className="truncate text-[11px] text-[var(--tg-text-secondary)]">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-9 shrink-0 items-center gap-1 text-xs font-semibold text-[var(--tg-link)]">{children}<ArrowRightIcon className="size-3.5" aria-hidden="true" /></Link>
}

function MoneyTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--tg-card-muted)] px-3 py-2.5 ring-1 ring-inset ring-[var(--tg-divider)]">
      <p className="truncate text-[11px] text-[var(--tg-text-secondary)]">{label}</p>
      <p className="mt-1 font-mono text-[17px] font-semibold tabular-nums text-[var(--tg-text)]">{value}</p>
    </div>
  )
}

function TrendCard({ trend, lang }: { trend: NonNullable<TelegramDashboard["trend"]>; lang: Locale }) {
  const copy = dashboardCopy[lang]
  const max = Math.max(1, ...trend.flatMap((day) => [day.created, day.closed]))
  const created = trend.reduce((sum, day) => sum + day.created, 0)
  const closed = trend.reduce((sum, day) => sum + day.closed, 0)
  return (
    <Card title={copy.trendTitle} icon={TrendingUpIcon} subtitle={copy.trendHint}>
      <div className="px-4 pb-4">
        <div className="flex gap-3 text-[11px] text-[var(--tg-text-secondary)]">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#2d7dd2]" aria-hidden="true" />{copy.trendCreated} <b className="font-mono text-[var(--tg-text)]">{created}</b></span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#1f9d60]" aria-hidden="true" />{copy.trendClosed} <b className="font-mono text-[var(--tg-text)]">{closed}</b></span>
        </div>
        <div className="mt-3 flex h-16 items-end gap-1" role="img" aria-label={`${copy.trendCreated} ${created}, ${copy.trendClosed} ${closed}`}>
          {trend.map((day) => (
            <div key={day.date} className="flex h-full flex-1 items-end gap-px">
              <span className="w-1/2 rounded-t-sm bg-[#2d7dd2]/85" style={{ height: `${day.created ? Math.max(8, (day.created / max) * 100) : 3}%` }} />
              <span className="w-1/2 rounded-t-sm bg-[#1f9d60]/85" style={{ height: `${day.closed ? Math.max(8, (day.closed / max) * 100) : 3}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--tg-text-muted)]">
          <span>{formatShortDate(new Date(`${trend[0].date}T12:00:00`), lang)}</span>
          <span>{formatShortDate(new Date(`${trend.at(-1)!.date}T12:00:00`), lang)}</span>
        </div>
      </div>
    </Card>
  )
}
