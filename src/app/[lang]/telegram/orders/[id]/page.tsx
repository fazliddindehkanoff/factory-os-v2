import Link from "next/link"
import { ArrowLeftIcon, BoxIcon, CircleDotIcon, HashIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { TelegramStatusPill, telegramStatusVisual } from "@/components/telegram/telegram-order-card"
import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"
import { getTelegramOrder } from "@/lib/telegram-orders"

export default async function Page({ params, searchParams }: PageProps<"/[lang]/telegram/orders/[id]">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const session = await requireSession(lang)
  const copy = telegramCopy[lang]
  const order = await getTelegramOrder(session.userId, id, lang)
  if (!order) notFound()
  const localeTag = lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"
  const formatDate = (value: string) => new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value))
  const visual = telegramStatusVisual[order.status]

  const facts = [
    [copy.applicant, order.applicant],
    [copy.department, order.department],
    [copy.warehouse, order.warehouse],
    [copy.purpose, order.purpose],
    [copy.expectedDate, formatDate(`${order.expectedDate}T00:00:00`)],
    [copy.createdAt, formatDate(order.createdAt)],
    [copy.type, order.type === "material" ? copy.material : copy.service],
    [copy.urgency, copy.urgencyLabels[order.urgency]],
  ]

  return (
    <TelegramShell lang={lang} copy={copy} userName={session.fullName} title={order.number} subtitle={copy.status[order.status]}>
      <Link href={`/${lang}/telegram/orders${query.from === "waiting" ? "?scope=waiting" : ""}`} className="mb-3 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl px-2 text-[13px] font-semibold text-[#2d7dd2] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:bg-[#e7f1fb]">
        <ArrowLeftIcon className="size-4" />{copy.backToOrders}
      </Link>

      <section className="rounded-[14px] border border-[#e2e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(16,30,60,0.06),0_8px_22px_-14px_rgba(16,30,60,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold tracking-wide text-[#2d7dd2]">{order.number}</p>
            <h2 className="mt-1 text-lg font-bold leading-6 text-[#1a1a2e]">{order.purpose}</h2>
          </div>
          <TelegramStatusPill order={order} copy={copy} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#edf0f4] pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa3b2]">{copy.status[order.status]}</p>
            <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">{copy.urgencyLabels[order.urgency]}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9aa3b2]">{copy.positions}</p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#1a1a2e]">{order.lines.length}</p>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#697386]">{copy.orderProgress}</h2>
        <div className="rounded-[14px] border border-[#e2e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 font-semibold" style={{ color: visual.color }}><CircleDotIcon className="size-4 shrink-0" />{copy.status[order.status]}</span>
            <span className="font-mono font-semibold tabular-nums text-[#8a94a4]">{visual.progress}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e7ecf3]">
            <span className="block h-full rounded-full" style={{ width: `${visual.progress}%`, background: visual.color }} />
          </div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#697386]">{copy.orderInformation}</h2>
        <dl className="divide-y divide-[#edf0f4] rounded-[14px] border border-[#e2e7ef] bg-white px-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
          {facts.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-3 text-[13px]">
              <dt className="text-[#8a94a4]">{label}</dt>
              <dd className="break-words text-right font-semibold leading-5 text-[#39445a]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {order.comment ? (
        <section className="mt-5">
          <h2 className="mb-2.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#697386]">{copy.comment}</h2>
          <div className="rounded-[14px] border border-[#e2e7ef] bg-white p-4 text-[13px] leading-6 text-[#39445a] shadow-[0_1px_2px_rgba(16,30,60,0.05)]">{order.comment}</div>
        </section>
      ) : null}

      <section className="mt-4">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#697386]">{copy.positions}</h2>
          <span className="font-mono text-[11px] font-semibold text-[#9aa3b2]">{order.lines.length}</span>
        </div>
        <div className="grid gap-2.5">
          {order.lines.map((line, index) => (
            <article key={line.id} className="rounded-[14px] border border-[#e2e7ef] bg-white p-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#e7f1fb] text-[#2d7dd2]"><BoxIcon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-5 text-[#1a1a2e]">{index + 1}. {line.product}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[#7a8596]"><HashIcon className="size-3.5" />{copy.quantity}: <span className="font-mono font-semibold tabular-nums text-[#39445a]">{line.quantity} {line.unit}</span></div>
                  {line.note ? <p className="mt-2 border-t border-[#edf0f4] pt-2 text-xs leading-5 text-[#6b7280]">{line.note}</p> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </TelegramShell>
  )
}
