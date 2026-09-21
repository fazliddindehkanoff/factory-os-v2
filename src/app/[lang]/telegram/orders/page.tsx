import Link from "next/link"
import { uxCopy } from "@/lib/ux-copy"
import { ClipboardListIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { TelegramOrderCard } from "@/components/telegram/telegram-order-card"
import {
  TelegramOrdersFilters,
} from "@/components/telegram/telegram-orders-filters"
import { TelegramOrdersHero } from "@/components/telegram/telegram-orders-hero"
import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireTelegramSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { matchesTelegramOrderFilters, type TelegramOrderFilterValues } from "@/lib/telegram-order-filters"
import { telegramCopy } from "@/lib/telegram-copy"
import { getTelegramOrders, getTelegramUserProfile } from "@/lib/telegram-orders"

const validTypes = new Set(["material", "service"])
const validStatuses = new Set(["draft", "supervisor_review", "warehouse_check", "in_progress", "fulfilled", "revision_requested", "approved", "rejected", "cancelled"])
const validUrgencies = new Set(["normal", "high", "urgent", "critical", "urgent-group"])

function queryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : ""
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/telegram/orders">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireTelegramSession(lang, `/${lang}/telegram/orders`)
  const query = await searchParams
  const waitingOnly = queryValue(query.scope) === "waiting"
  const [allOrders, profile, copy] = await Promise.all([
    getTelegramOrders(session.userId, lang),
    getTelegramUserProfile(session.userId, lang),
    Promise.resolve(telegramCopy[lang]),
  ])
  const waitingCount = allOrders.filter((order) => order.waitingForMe).length
  const urgentCount = allOrders.filter((order) => order.urgency === "urgent" || order.urgency === "critical").length
  const localeTag = lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"
  const departments = [...new Map(allOrders.flatMap((order) => order.departmentOptions.map((option) => [option.value, option] as const))).values()]
  const warehouses = [...new Map(allOrders.map((order) => [order.warehouseId, { value: order.warehouseId, label: order.warehouse }])).values()]
  const rawType = queryValue(query.type)
  const rawStatus = queryValue(query.status)
  const rawUrgency = queryValue(query.urgency)
  const rawDepartment = queryValue(query.department)
  const rawWarehouse = queryValue(query.warehouse)
  const filters: TelegramOrderFilterValues = {
    q: queryValue(query.q).slice(0, 120),
    type: validTypes.has(rawType) ? rawType : "",
    status: validStatuses.has(rawStatus) ? rawStatus : "",
    urgency: validUrgencies.has(rawUrgency) ? rawUrgency : "",
    department: departments.some((item) => item.value === rawDepartment) ? rawDepartment : "",
    warehouse: warehouses.some((item) => item.value === rawWarehouse) ? rawWarehouse : "",
  }
  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const orders = allOrders.filter((order) => matchesTelegramOrderFilters(order, filters, waitingOnly, localeTag))
  const returnParams = new URLSearchParams()
  if (waitingOnly) returnParams.set("scope", "waiting")
  for (const [key, value] of Object.entries(filters)) {
    if (value) returnParams.set(key, value)
  }
  const returnQuery = returnParams.toString()
  const activeShortcut = waitingOnly
    ? "waiting"
    : filters.urgency === "urgent-group" && activeFilterCount === 1
      ? "urgent"
      : activeFilterCount === 0
        ? "all"
        : null
  const groups = orders.reduce<Array<{ key: string; label: string; orders: typeof orders }>>((result, order) => {
    const date = new Date(order.createdAt)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const current = result.at(-1)
    if (current?.key === key) current.orders.push(order)
    else result.push({
      key,
      label: new Intl.DateTimeFormat(localeTag, { weekday: "long", day: "2-digit", month: "short" }).format(date),
      orders: [order],
    })
    return result
  }, [])

  return (
    <TelegramShell
      lang={lang}
      copy={copy}
      userId={session.userId}
      title={waitingOnly ? copy.waiting : copy.orders}
      hero={(
        <TelegramOrdersHero
          copy={copy}
          lang={lang}
          userName={profile?.fullName ?? session.fullName}
          roleNames={profile?.roles ?? []}
          totalCount={allOrders.length}
          waitingCount={waitingCount}
          urgentCount={urgentCount}
          activeShortcut={activeShortcut}
        />
      )}
    >
      <div id="orders" className="mb-3 flex scroll-mt-28 items-center justify-between gap-3 px-0.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--tg-text-secondary)]">{copy.ordersSection}</h2>
        <span className="font-mono text-[11px] font-semibold text-[var(--tg-text-muted)]">{orders.length}</span>
      </div>
      <TelegramOrdersFilters
        lang={lang}
        copy={copy}
        values={filters}
        waitingOnly={waitingOnly}
        departments={departments}
        warehouses={warehouses}
      />
      {orders.length ? (
        <div className="grid gap-3">
          {groups.map((group) => (
            <section key={group.key} className="grid gap-2.5">
              <div className="flex items-center gap-2 py-0.5" aria-label={group.label}>
                <span className="h-px flex-1 bg-[var(--tg-divider)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--tg-text-muted)]">{group.label}</span>
                <span className="h-px flex-1 bg-[var(--tg-divider)]" />
              </div>
              {group.orders.map((order) => <TelegramOrderCard key={order.id} order={order} lang={lang} copy={copy} returnQuery={returnQuery} />)}
            </section>
          ))}
        </div>
      ) : (
        <div className="tg-card flex min-h-72 flex-col items-center justify-center rounded-[14px] border border-dashed px-8 text-center">
          <span className="flex size-[76px] items-center justify-center rounded-[22px] bg-[#edf1f6] text-[#8b97aa]">
            <ClipboardListIcon className="size-8" />
          </span>
          <h2 className="mt-4 text-base font-bold text-[var(--tg-text)]">{waitingOnly && !activeFilterCount ? copy.noWaiting : copy.noOrders}</h2>
          <p className="mt-1 max-w-64 text-[13px] leading-5 text-[var(--tg-text-secondary)]">{activeFilterCount ? uxCopy[lang].noResults : waitingOnly ? copy.noWaitingBody : copy.noOrdersBody}</p>
          <Link className="mt-4 inline-flex min-h-11 items-center text-primary underline" href={activeFilterCount ? `/${lang}/telegram/orders${waitingOnly ? "?scope=waiting" : ""}` : `/${lang}/orders`}>{activeFilterCount ? uxCopy[lang].clear : uxCopy[lang].openWeb}</Link>
        </div>
      )}
    </TelegramShell>
  )
}
