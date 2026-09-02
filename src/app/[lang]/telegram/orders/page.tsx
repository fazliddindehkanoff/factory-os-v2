import { ClipboardListIcon } from "lucide-react"
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
  const [orders, copy] = await Promise.all([
    getTelegramOrders(session.userId, lang, waitingOnly),
    Promise.resolve(telegramCopy[lang]),
  ])

  return (
    <TelegramShell
      lang={lang}
      copy={copy}
      userName={session.fullName}
      title={waitingOnly ? copy.waitingOrders : copy.allOrders}
      subtitle={waitingOnly ? copy.waitingSubtitle : copy.ordersSubtitle}
    >
      {orders.length ? (
        <div className="grid gap-3">{orders.map((order) => <TelegramOrderCard key={order.id} order={order} lang={lang} copy={copy} />)}</div>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed bg-background px-8 text-center">
          <ClipboardListIcon className="size-9 text-primary" />
          <h2 className="mt-4 text-base font-semibold">{waitingOnly ? copy.noWaiting : copy.noOrders}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{waitingOnly ? copy.noWaitingBody : copy.noOrdersBody}</p>
        </div>
      )}
    </TelegramShell>
  )
}
