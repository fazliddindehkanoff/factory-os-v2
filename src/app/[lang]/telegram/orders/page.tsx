import { AlertTriangleIcon, ClipboardListIcon, Clock3Icon, FileTextIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { TelegramOrderCard } from "@/components/telegram/telegram-order-card"
import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"
import { getTelegramOrders } from "@/lib/telegram-orders"

export default async function Page({ params, searchParams }: PageProps<"/[lang]/telegram/orders">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireSession(lang)
  const query = await searchParams
  const waitingOnly = query.scope === "waiting"
  const [allOrders, copy] = await Promise.all([
    getTelegramOrders(session.userId, lang),
    Promise.resolve(telegramCopy[lang]),
  ])
  const orders = waitingOnly ? allOrders.filter((order) => order.waitingForMe) : allOrders
  const waitingCount = allOrders.filter((order) => order.waitingForMe).length
  const urgentCount = allOrders.filter((order) => order.urgency === "urgent" || order.urgency === "critical").length
  const localeTag = lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"
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
      userName={session.fullName}
      title={waitingOnly ? copy.waitingOrders : copy.allOrders}
      subtitle={waitingOnly ? copy.waitingSubtitle : copy.ordersSubtitle}
    >
      <section aria-label={copy.totalOrders} className="grid grid-cols-3 gap-2.5">
        <SummaryCard icon={FileTextIcon} label={copy.totalOrders} value={allOrders.length} tone="blue" />
        <SummaryCard icon={Clock3Icon} label={copy.actionRequired} value={waitingCount} tone="amber" />
        <SummaryCard icon={AlertTriangleIcon} label={copy.urgentOrders} value={urgentCount} tone="red" />
      </section>

      <div className="mb-3 mt-6 flex items-center justify-between gap-3 px-0.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#697386]">{copy.ordersSection}</h2>
        <span className="font-mono text-[11px] font-semibold text-[#9aa3b2]">{orders.length}</span>
      </div>
      {orders.length ? (
        <div className="grid gap-3">
          {groups.map((group) => (
            <section key={group.key} className="grid gap-2.5">
              <div className="flex items-center gap-2 py-0.5" aria-label={group.label}>
                <span className="h-px flex-1 bg-[#e0e5ec]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#9aa3b2]">{group.label}</span>
                <span className="h-px flex-1 bg-[#e0e5ec]" />
              </div>
              {group.orders.map((order) => <TelegramOrderCard key={order.id} order={order} lang={lang} copy={copy} returnToWaiting={waitingOnly} />)}
            </section>
          ))}
        </div>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-[14px] border border-dashed border-[#dfe5ee] bg-white px-8 text-center">
          <span className="flex size-[76px] items-center justify-center rounded-[22px] bg-[#edf1f6] text-[#8b97aa]">
            <ClipboardListIcon className="size-8" />
          </span>
          <h2 className="mt-4 text-base font-bold text-[#1a1a2e]">{waitingOnly ? copy.noWaiting : copy.noOrders}</h2>
          <p className="mt-1 max-w-64 text-[13px] leading-5 text-[#6b7280]">{waitingOnly ? copy.noWaitingBody : copy.noOrdersBody}</p>
        </div>
      )}
    </TelegramShell>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof FileTextIcon
  label: string
  value: number
  tone: "blue" | "amber" | "red"
}) {
  const colors = {
    blue: { foreground: "#2d7dd2", background: "#e7f1fb" },
    amber: { foreground: "#d9820b", background: "#fcf0dd" },
    red: { foreground: "#e04434", background: "#fbe8e5" },
  }[tone]

  return (
    <div className="min-w-0 rounded-[14px] border border-[#e2e7ef] bg-white p-3 shadow-[0_1px_2px_rgba(16,30,60,0.05),0_8px_22px_-14px_rgba(16,30,60,0.2)]">
      <span className="flex size-8 items-center justify-center rounded-[10px]" style={{ color: colors.foreground, background: colors.background }}>
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <p className="mt-3 font-mono text-[25px] font-semibold leading-none tabular-nums text-[#1a1a2e]">{value}</p>
      <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-3.5 text-[#6b7280]">{label}</p>
    </div>
  )
}
