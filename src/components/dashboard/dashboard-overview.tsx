"use client"

import Link from "next/link"
import { PlusIcon, TriangleAlertIcon } from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { buttonVariants } from "@/components/ui/button"
import { buildFlowMap, buildMyQueue, dailyTrend, dashboardAccess, lateOrders, placementMoney, procurementTeamIds, specialistLoad, type FlowStep } from "@/lib/dashboard-insights"
import type { Locale, Messages } from "@/lib/i18n"
import { formatLongDate } from "@/lib/date-format"
import { stepLabel } from "@/lib/order-labels"
import { isOperationalOrder, workflowSteps, type WorkflowStep } from "@/lib/orders"
import { getLocalizedTitle } from "@/lib/settings"
import { uxCopy } from "@/lib/ux-copy"
import { cn } from "@/lib/utils"
import { dashboardCopy } from "./dashboard-copy"
import { LateOrdersCard, MoneyCard, MyQueue, PulseTiles, TeamLoadCard } from "./dashboard-cards"
import { FlowMap } from "./flow-map"


export function DashboardOverview({ lang, messages }: { lang: Locale; messages: Messages }) {
  const { orders: allOrders, storageReady, syncError, lastUpdated } = useOrders()
  const { data } = useSettings()
  const { can, canViewOrders, currentUser, roles } = useAuthorization()
  const copy = dashboardCopy[lang]

  if (!storageReady) return <DashboardSkeleton label={uxCopy[lang].loading} />

  const now = lastUpdated ? Date.parse(lastUpdated) : Date.parse(new Date().toISOString())
  const orders = canViewOrders ? allOrders.filter(isOperationalOrder) : []
  const warehouseResponsible = (warehouseId: string) => data.warehouses.find((warehouse) => warehouse.id === warehouseId)?.responsibleUserId
  const queue = buildMyQueue(allOrders.filter(isOperationalOrder), currentUser?.id, now, warehouseResponsible)
  const { stages, bottleneck } = buildFlowMap(orders, now, warehouseResponsible)
  const late = lateOrders(orders, now)
  const activeCount = new Set(stages.flatMap((stage) => stage.orderIds)).size
  const urgentCount = orders.filter((order) => stages.some((stage) => stage.orderIds.includes(order.id)) && ["urgent", "critical"].includes(order.urgency)).length
  const access = dashboardAccess(roles)
  const showOperationalSummary = access.summary
  const showTeam = access.team
  const showMoney = access.money
  const specialists = procurementTeamIds(data.users, data.roles)
  const roleNames = roles.map((role) => getLocalizedTitle(role, lang))
  const firstName = currentUser?.fullName.split(/\s+/)[0] ?? ""
  const labelFor = (step: WorkflowStep) => (workflowSteps as readonly string[]).includes(step) ? copy.steps[step as FlowStep] : stepLabel(step, lang)
  const bottomCards = [
    <LateOrdersCard key="late" items={late} data={data} lang={lang} />,
    showTeam ? <TeamLoadCard key="team" items={specialistLoad(orders, specialists, now)} data={data} lang={lang} /> : null,
    showMoney ? <MoneyCard key="money" money={placementMoney(orders, now)} lang={lang} /> : null,
  ].filter(Boolean)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 pb-10 md:px-6">
      <header className="relative overflow-hidden rounded-2xl border bg-card px-5 py-5 shadow-xs md:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(0_102_255/0.08)_1px,transparent_0)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_60%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground first-letter:uppercase">
              {formatLongDate(new Date(now), lang)}
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight md:text-3xl">
              {copy.greeting(new Date(now).getHours())}{firstName ? `, ${firstName}` : ""}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
              {roleNames.map((role) => <span key={role} className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{role}</span>)}
              {syncError ? (
                <span className="inline-flex items-center gap-1.5 text-destructive">
                  <TriangleAlertIcon className="size-3.5" aria-hidden="true" />{uxCopy[lang].stale}
                </span>
              ) : null}
            </div>
          </div>
          {can("requests.create") ? (
            <Link href={`/${lang}/orders/new`} className={cn(buttonVariants({ size: "lg" }), "shrink-0 shadow-sm shadow-primary/20")}>
              <PlusIcon />{messages.newOrder}
            </Link>
          ) : null}
        </div>
      </header>

      <div className={cn("grid gap-5", canViewOrders && "lg:grid-cols-5")}>
        <div className={cn("min-w-0", canViewOrders && "lg:col-span-3")}>
          <MyQueue items={queue} data={data} lang={lang} stepLabel={labelFor} />
        </div>
        {canViewOrders ? (
          <div className="min-w-0 lg:col-span-2">
            <PulseTiles active={activeCount} late={late.length} urgent={urgentCount} trend={showOperationalSummary ? dailyTrend(orders, now) : undefined} lang={lang} />
          </div>
        ) : null}
      </div>

      {showOperationalSummary && canViewOrders ? (
        <FlowMap stages={stages} bottleneck={bottleneck} orders={orders} data={data} lang={lang} now={now} />
      ) : null}

      {canViewOrders ? (
        <div className={cn("grid items-start gap-5", bottomCards.length === 2 && "lg:grid-cols-2", bottomCards.length === 3 && "lg:grid-cols-2 xl:grid-cols-3")}>
          {bottomCards}
        </div>
      ) : null}
    </div>
  )
}

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 pb-10 md:px-6" role="status" aria-label={label}>
      <div className="h-32 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="h-80 animate-pulse rounded-2xl bg-muted lg:col-span-3 motion-reduce:animate-none" />
        <div className="h-80 animate-pulse rounded-2xl bg-muted lg:col-span-2 motion-reduce:animate-none" />
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
    </div>
  )
}
