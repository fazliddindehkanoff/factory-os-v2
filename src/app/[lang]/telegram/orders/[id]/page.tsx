import Link from "next/link"
import { ArrowLeftIcon, BoxIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { TelegramShell } from "@/components/telegram/telegram-shell"
import { Badge } from "@/components/ui/badge"
import { requireSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"
import { getTelegramOrder } from "@/lib/telegram-orders"

export default async function Page({ params }: PageProps<"/[lang]/telegram/orders/[id]">) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireSession(lang)
  const copy = telegramCopy[lang]
  const order = await getTelegramOrder(session.userId, id, lang)
  if (!order) notFound()

  const facts = [
    [copy.applicant, order.applicant],
    [copy.department, order.department],
    [copy.warehouse, order.warehouse],
    [copy.purpose, order.purpose],
    [copy.expectedDate, order.expectedDate],
    [copy.type, order.type === "material" ? copy.material : copy.service],
    [copy.urgency, copy.urgencyLabels[order.urgency]],
  ]

  return (
    <TelegramShell lang={lang} copy={copy} userName={session.fullName} title={order.number} subtitle={copy.status[order.status]}>
      <Link href={`/${lang}/telegram/orders`} className="mb-3 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl px-2 text-sm font-medium text-primary active:bg-accent">
        <ArrowLeftIcon className="size-4" />{copy.backToOrders}
      </Link>
      <section className="rounded-2xl border bg-background p-4 shadow-sm">
        <div className="flex flex-wrap gap-2"><Badge>{copy.status[order.status]}</Badge><Badge variant="outline">{copy.urgencyLabels[order.urgency]}</Badge></div>
        <dl className="mt-4 divide-y">
          {facts.map(([label, value]) => <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}
        </dl>
        {order.comment ? <div className="mt-3 rounded-xl bg-muted p-3"><p className="text-xs font-medium text-muted-foreground">{copy.comment}</p><p className="mt-1 text-sm leading-6">{order.comment}</p></div> : null}
      </section>
      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold">{copy.positions} · {order.lines.length}</h2>
        <div className="grid gap-2">
          {order.lines.map((line, index) => (
            <article key={line.id} className="rounded-2xl border bg-background p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BoxIcon className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-5">{index + 1}. {line.product}</p><p className="mt-1 text-sm text-muted-foreground">{copy.quantity}: <span className="font-medium text-foreground">{line.quantity} {line.unit}</span></p>{line.note ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{line.note}</p> : null}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </TelegramShell>
  )
}
