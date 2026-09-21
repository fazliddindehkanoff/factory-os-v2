"use client"
import Link from "next/link"
import { useSettings } from "@/components/settings/settings-provider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PaymentRequest } from "@/lib/finance-workflow"
import type { Locale } from "@/lib/i18n"
import { getLocalizedTitle } from "@/lib/settings"
import { financeCopy } from "./finance-copy"

export function FinanceDetails({ payment, lang, webApp, onClose }: { payment: PaymentRequest; lang: Locale; webApp?: boolean; onClose: () => void }) {
  const { data } = useSettings()
  const copy = financeCopy[lang]
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>{payment.supplierName} · {copy[payment.kind]}</DialogTitle><DialogDescription>{copy.stages[payment.stage]}</DialogDescription></DialogHeader>
    <Link className="w-fit text-primary underline" href={webApp ? `/${lang}/telegram/orders/${encodeURIComponent(payment.orderId)}` : `/${lang}/orders?order=${encodeURIComponent(payment.orderId)}`}>{payment.orderNumber}</Link>
    <dl className="grid grid-cols-2 gap-3 text-sm">{[
      [copy.amount, `${payment.amount.toLocaleString()} UZS`], [copy.inn, payment.supplierInn || "—"],
      [copy.method, copy[payment.method]], [copy.dueDate, payment.dueDate || "—"], [copy.contract, payment.contractNumber || "—"],
      [copy.specialist, data.users.find((user) => user.id === payment.specialistUserId)?.fullName ?? payment.specialistUserId],
    ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
    {payment.comment ? <p className="rounded-lg border bg-muted/40 p-3 whitespace-pre-wrap">{payment.comment}</p> : null}
    <section><h3 className="mb-2 font-semibold">{copy.products}</h3><ul className="divide-y rounded-lg border px-3">{payment.lines.map((line) => {
      const product = data.products.find((product) => product.id === line.productId)
      return <li key={`${line.quotationId}:${line.orderLineId}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
      <span>{product ? getLocalizedTitle(product, lang) : line.productId ?? line.orderLineId}</span>
      <span className="font-mono">{line.quantity} × {line.unitPrice.toLocaleString()} UZS</span>
      {line.contract ? <a className="w-full text-primary underline" href={`/api/orders/${encodeURIComponent(payment.orderId)}/contracts/${encodeURIComponent(line.contract.id)}`} download>{line.contract.name}</a> : null}
    </li>})}</ul></section>
    <section><h3 className="mb-2 font-semibold">{copy.history}</h3><ol className="space-y-3 text-sm">{payment.history.map((item, index) => <li key={index} className="border-l-2 pl-3">
      <p className="font-medium">{copy.actions[item.action]} · {data.users.find((user) => user.id === item.actorUserId)?.fullName ?? item.actorUserId}</p>
      <p className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString(lang)} · {copy.stages[item.to]}</p>
      {item.comment ? <p className="mt-1 whitespace-pre-wrap">{item.comment}</p> : null}
    </li>)}</ol></section>
  </DialogContent></Dialog>
}
