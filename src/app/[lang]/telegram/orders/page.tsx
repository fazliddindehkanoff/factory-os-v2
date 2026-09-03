import { ClipboardListIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { TelegramOrderCard } from "@/components/telegram/telegram-order-card"
import { TelegramOrdersHero } from "@/components/telegram/telegram-orders-hero"
import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"
import { getTelegramOrders, getTelegramUserProfile } from "@/lib/telegram-orders"

export default async function Page({ params, searchParams }: PageProps<"/[lang]/telegram/orders">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireSession(lang)
  const query = await searchParams
  const waitingOnly = query.scope === "waiting"
  const [allOrders, profile, copy] = await Promise.all([
    getTelegramOrders(session.userId, lang),
    getTelegramUserProfile(session.userId, lang),
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
      hero={(
        <TelegramOrdersHero
          copy={copy}
          userName={profile?.fullName ?? session.fullName}
          roleNames={profile?.roles ?? []}
          totalCount={allOrders.length}
          waitingCount={waitingCount}
          urgentCount={urgentCount}
        />
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
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
