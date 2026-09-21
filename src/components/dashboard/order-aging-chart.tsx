"use client"

import Link from "next/link"
import { orderAging } from "@/lib/order-aging"
import type { OrderRecord } from "@/lib/orders"
import type { Locale } from "@/lib/i18n"

const copy = {
  uz: { title: "Ochiq buyurtmalar yoshi", description: "Yaratilganidan beri o‘tgan kunlar. Bu to‘lov yoki yetkazish muddati emas.", days: "kun", oldest: "Eng oldin ochilganlar", empty: "Ochiq buyurtmalar yo‘q" },
  ru: { title: "Возраст открытых заявок", description: "Дни с момента создания. Это не срок оплаты или поставки.", days: "дней", oldest: "Самые ранние заявки", empty: "Открытых заявок нет" },
  tr: { title: "Açık taleplerin yaşı", description: "Oluşturulmasından bu yana geçen günler. Ödeme veya teslimat vadesi değildir.", days: "gün", oldest: "En eski talepler", empty: "Açık talep yok" },
}
export function OrderAgingChart({ orders, lang, now }: { orders: OrderRecord[]; lang: Locale; now: number }) {
  const text = copy[lang]
  const { buckets, oldest } = orderAging(orders, now)
  const max = Math.max(1, ...buckets)
  return <section className="rounded-xl border bg-card p-5">
    <h2 className="font-semibold">{text.title}</h2><p className="mt-1 text-sm text-muted-foreground">{text.description}</p>
    {!oldest.length ? <p className="mt-5 text-sm text-muted-foreground">{text.empty}</p> : <div className="mt-5 grid gap-6 md:grid-cols-2">
      <ul className="space-y-4">{buckets.map((count, index) => <li key={index} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-3 text-sm"><span>{["0–3", "4–7", "8–14", "15+"][index]} {text.days}</span><div aria-hidden="true" className="h-3 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${count / max * 100}%` }} /></div><span className="text-right tabular-nums">{count}</span></li>)}</ul>
      <div><h3 className="mb-2 text-sm font-medium">{text.oldest}</h3><ul className="divide-y">{oldest.map((order) => <li key={order.id}><Link className="flex min-h-11 items-center justify-between gap-3 text-sm underline underline-offset-4" href={`/${lang}/orders?order=${encodeURIComponent(order.id)}`}><span className="break-all">{order.number}</span><span className="shrink-0 tabular-nums">{Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 86400000))} {text.days}</span></Link></li>)}</ul></div>
    </div>}
  </section>
}
