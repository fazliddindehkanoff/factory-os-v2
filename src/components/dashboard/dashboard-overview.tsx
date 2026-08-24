"use client"

import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleCheckBigIcon,
  ClipboardListIcon,
  Clock3Icon,
  PlusIcon,
  Settings2Icon,
  TriangleAlertIcon,
  WarehouseIcon,
} from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Locale, Messages } from "@/lib/i18n"
import { canUserViewRejectedOrder, isOrderSuccessfullyClosed, isOrderWaitingForUser, type OrderStatus, type UrgencyLevel } from "@/lib/orders"
import { getLocalizedTitle } from "@/lib/settings"
import { cn } from "@/lib/utils"

export function DashboardOverview({ lang, messages }: { lang: Locale; messages: Messages }) {
  const { orders } = useOrders()
  const { data } = useSettings()
  const { can, canViewOrders, canViewSettingsSection, currentUser } = useAuthorization()
  const ownOnly = !can("requests.view") && can("requests.view_own")
  const departmentScoped = currentUser?.roleIds.includes("role-dept_head") ?? false
  const procurementSpecialistScoped = currentUser?.roleIds.includes("role-procurement_manager") ?? false
  const visibleAfterRejection = (order: (typeof orders)[number]) => {
    const supervisorUserId = data.users.find(
      (user) =>
        user.roleIds.includes("role-dept_head") &&
        user.departmentIds.some((id) => order.departmentIds.includes(id)),
    )?.id
    return canUserViewRejectedOrder(order, currentUser?.id, supervisorUserId)
  }
  const permittedOrders = canViewOrders
    ? orders.filter((order) =>
        (!ownOnly || order.createdByUserId === currentUser?.id) &&
        (!departmentScoped || order.departmentIds.some((id) => currentUser?.departmentIds.includes(id))) &&
        (!procurementSpecialistScoped || order.procurementSpecialistUserId === currentUser?.id) &&
        visibleAfterRejection(order),
      )
    : []
  const showOperationalSummary = can("reports.status_summary")
  const visibleOrders = showOperationalSummary
    ? permittedOrders
    : permittedOrders.filter((order) => order.createdByUserId === currentUser?.id)
  const awaitingCount = visibleOrders.filter((order) => order.status === "warehouse_check").length
  const urgentCount = visibleOrders.filter((order) => order.urgency === "urgent" || order.urgency === "critical").length
  const approvedCount = visibleOrders.filter((order) => order.status === "approved").length
  const successfullyClosedCount = visibleOrders.filter(isOrderSuccessfullyClosed).length
  const waitingForMeCount = orders.filter((order) => {
    const warehouseResponsibleUserId = data.warehouses.find(
      (warehouse) => warehouse.id === order.warehouseId,
    )?.responsibleUserId
    return isOrderWaitingForUser(order, currentUser?.id, warehouseResponsibleUserId)
  }).length
  const recentOrders = [...visibleOrders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const metrics = [
    { label: waitingLabel(lang), value: waitingForMeCount, icon: Clock3Icon, href: `/${lang}/orders?view=waiting` },
    ...(!procurementSpecialistScoped
      ? [{ label: messages.totalOrders, value: visibleOrders.length, icon: ClipboardListIcon }]
      : []),
    { label: messages.awaitingWarehouse, value: awaitingCount, icon: WarehouseIcon },
    { label: messages.urgentOrders, value: urgentCount, icon: TriangleAlertIcon },
    { label: messages.approvedOrders, value: approvedCount, icon: CheckCircle2Icon },
    { label: successfullyClosedLabel(lang), value: successfullyClosedCount, icon: CircleCheckBigIcon },
  ]

  const pipeline: Array<{ status: OrderStatus; count: number; color: string }> = [
    { status: "warehouse_check", count: awaitingCount, color: "bg-amber-500" },
    { status: "approved", count: approvedCount, color: "bg-primary" },
    { status: "rejected", count: visibleOrders.filter((order) => order.status === "rejected").length, color: "bg-destructive" },
    { status: "draft", count: visibleOrders.filter((order) => order.status === "draft").length, color: "bg-muted-foreground" },
  ]

  const warehouseWorkload = data.warehouses.map((warehouse) => ({
    id: warehouse.id,
    title: getLocalizedTitle(warehouse, lang),
    count: visibleOrders.filter((order) => order.warehouseId === warehouse.id).length,
  }))
  const maxWarehouseCount = Math.max(1, ...warehouseWorkload.map((warehouse) => warehouse.count))

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-8 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{messages.dashboard}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{messages.dashboardOverview}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{messages.dashboardDescription}</p>
        </div>
        {can("requests.create") ? <Link href={`/${lang}/orders/new`} className={cn(buttonVariants(), "sm:self-auto")}>
          <PlusIcon />
          {messages.newOrder}
        </Link> : null}
      </div>

      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", procurementSpecialistScoped ? "xl:grid-cols-5" : "xl:grid-cols-6")}>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} total={visibleOrders.length} allLabel={messages.ofAllOrders} />
        ))}
      </div>

      {showOperationalSummary ? <div className="grid gap-4 xl:grid-cols-7">
        <section className="rounded-xl border bg-card p-5 shadow-xs xl:col-span-4">
          <SectionHeader title={messages.orderPipeline} description={messages.orderPipelineDescription} />
          <div className="mt-6 space-y-5">
            {pipeline.map((item) => {
              const percentage = visibleOrders.length ? Math.round((item.count / visibleOrders.length) * 100) : 0
              return (
                <div key={item.status}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{statusLabel(item.status, messages)}</span>
                    <span className="tabular-nums text-muted-foreground">{item.count} · {percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", item.color)}
                      style={{ width: `${item.count ? Math.max(percentage, 4) : 0}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-xs xl:col-span-3">
          <SectionHeader title={messages.warehouseWorkload} description={messages.warehouseWorkloadDescription} />
          <div className="mt-6 space-y-5">
            {warehouseWorkload.map((warehouse) => (
              <div key={warehouse.id}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{warehouse.title}</span>
                  <Badge variant="secondary" className="tabular-nums">{warehouse.count}</Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${warehouse.count ? Math.max((warehouse.count / maxWarehouseCount) * 100, 4) : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {warehouseWorkload.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{messages.noWarehouseOrders}</p>
            ) : null}
          </div>
        </section>
      </div> : null}

      <div className="grid gap-4 xl:grid-cols-7">
        <section className="min-w-0 rounded-xl border bg-card p-5 shadow-xs xl:col-span-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeader title={messages.recentOrders} description={messages.recentOrdersDescription} />
            {canViewOrders ? <Link href={`/${lang}/orders`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
              {messages.viewAllOrders}
              <ArrowRightIcon />
            </Link> : null}
          </div>
          <div className="mt-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.orderNumber}</TableHead>
                  <TableHead>{messages.applicant}</TableHead>
                  <TableHead>{messages.warehouse}</TableHead>
                  <TableHead>{messages.urgency}</TableHead>
                  <TableHead>{messages.orderStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => {
                  const applicant = data.users.find((user) => user.id === order.applicantId)
                  const warehouse = data.warehouses.find((item) => item.id === order.warehouseId)
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.number}</TableCell>
                      <TableCell>{applicant?.fullName ?? "—"}</TableCell>
                      <TableCell>{warehouse ? getLocalizedTitle(warehouse, lang) : "—"}</TableCell>
                      <TableCell><UrgencyBadge urgency={order.urgency} messages={messages} /></TableCell>
                      <TableCell><StatusBadge status={order.status} messages={messages} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        <aside className="rounded-xl border bg-card p-5 shadow-xs xl:col-span-2">
          <SectionHeader title={messages.quickActions} description={messages.updatedNow} />
          <div className="mt-5 space-y-2">
            {can("requests.create") ? <QuickAction href={`/${lang}/orders/new`} icon={PlusIcon} label={messages.createNewOrder} /> : null}
            {canViewOrders ? <QuickAction href={`/${lang}/orders`} icon={ClipboardListIcon} label={messages.viewAllOrders} /> : null}
            {(["positions", "roles", "users"] as const).some((section) => canViewSettingsSection(section)) ? <QuickAction href={`/${lang}/settings`} icon={Settings2Icon} label={messages.manageSettings} /> : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function MetricCard({ metric, total, allLabel }: {
  metric: { label: string; value: number; icon: typeof ClipboardListIcon; href?: string }
  total: number
  allLabel: string
}) {
  const content = <>
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-sm text-muted-foreground">{metric.label}</p><p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{metric.value}</p></div>
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><metric.icon className="size-5" aria-hidden="true" /></span>
    </div>
    <p className="mt-4 text-xs text-muted-foreground">{total ? Math.round((metric.value / total) * 100) : 0}% {allLabel}</p>
  </>
  const classes = "rounded-xl border bg-card p-5 shadow-xs transition-colors"
  return metric.href
    ? <Link href={metric.href} className={`${classes} cursor-pointer hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}>{content}</Link>
    : <section className={classes}>{content}</section>
}

function waitingLabel(lang: Locale) {
  return lang === "ru" ? "Ожидает меня" : lang === "tr" ? "Beni bekliyor" : "Meni kutmoqda"
}

function successfullyClosedLabel(lang: Locale) {
  return lang === "ru"
    ? "Успешно закрыты"
    : lang === "tr"
      ? "Başarıyla kapatıldı"
      : "Muvaffaqiyatli yopilgan"
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof PlusIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

function statusLabel(status: OrderStatus, messages: Messages) {
  if (status === "warehouse_check") return messages.statusWarehouseCheck
  if (status === "approved") return messages.statusApproved
  if (status === "rejected") return messages.statusRejected
  return messages.statusDraft
}

function StatusBadge({ status, messages }: { status: OrderStatus; messages: Messages }) {
  const variant = status === "rejected" ? "destructive" : status === "approved" ? "default" : status === "draft" ? "outline" : "secondary"
  return <Badge variant={variant}>{statusLabel(status, messages)}</Badge>
}

function UrgencyBadge({ urgency, messages }: { urgency: UrgencyLevel; messages: Messages }) {
  const label = urgency === "critical" ? messages.urgencyCritical : urgency === "urgent" ? messages.urgencyUrgent : urgency === "high" ? messages.urgencyHigh : messages.urgencyNormal
  return <Badge variant={urgency === "critical" || urgency === "urgent" ? "destructive" : urgency === "high" ? "default" : "secondary"}>{label}</Badge>
}
