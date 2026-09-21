"use client"

import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"
import { useSettings } from "@/components/settings/settings-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { loadAppRecords } from "@/lib/client-app-records"
import type { Locale } from "@/lib/i18n"
import { approvedPaymentLines, paymentLineKey, roundMoney, validateOrderPayments } from "@/lib/order-payment"
import { groupPaymentLines, expandPaymentGroups } from "@/lib/order-payment-groups"
import type { OrderRecord } from "@/lib/orders"
import type { QuotationRecord, SupplierRecord } from "@/lib/procurement"
import { getLocalizedTitle } from "@/lib/settings"
import { orderPaymentCopy } from "./order-payment-copy"
import { SupplierPaymentFields, type SupplierPaymentDraft } from "./supplier-payment-fields"

type Props = { order: OrderRecord; lang: Locale; selectedOrderLineIds: string[]; onSubmit: (id: string, form: FormData) => Promise<boolean> }
const money = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)

export function OrderPaymentDialog(props: Props) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const copy = orderPaymentCopy[props.lang]
  return <Dialog open={open} onOpenChange={(value) => { if (!pending) setOpen(value) }}>
    <DialogTrigger render={<Button disabled={!props.selectedOrderLineIds.length} />}>{copy.title} ({props.selectedOrderLineIds.length})</DialogTrigger>
    <DialogContent showCloseButton={!pending} className="flex max-h-[90svh] w-[calc(100vw-2rem)] max-w-7xl flex-col overflow-hidden sm:max-w-7xl lg:max-h-[75svh]">
      <DialogHeader className="pr-7">
        <DialogTitle>{copy.title} · {props.order.number}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>
      {open ? <PaymentForm {...props} pending={pending} setPending={setPending} onClose={() => setOpen(false)} /> : null}
    </DialogContent>
  </Dialog>
}

function PaymentForm({ order, lang, selectedOrderLineIds, onSubmit, pending, setPending, onClose }: Props & {
  pending: boolean; setPending: (value: boolean) => void; onClose: () => void
}) {
  const copy = orderPaymentCopy[lang]
  const { data } = useSettings()
  const [quotes, setQuotes] = React.useState<QuotationRecord[]>([])
  const [groups, setGroups] = React.useState<SupplierPaymentDraft[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [retry, setRetry] = React.useState(0)
  const initial = React.useRef({ order, selectedOrderLineIds })
  React.useEffect(() => {
    let active = true
    Promise.all([loadAppRecords<QuotationRecord>("quotations"), loadAppRecords<SupplierRecord>("suppliers")]).then(([items, suppliers]) => {
      if (!active) return
      const ids = new Set(initial.current.selectedOrderLineIds)
      const lines = approvedPaymentLines(initial.current.order, items).filter((line) => ids.has(line.orderLineId))
      // Never silently omit a position that was selected in the previous screen.
      if (!ids.size || new Set(lines.map((line) => line.orderLineId)).size !== ids.size) {
        setError(copy.changed); return
      }
      setQuotes(items)
      setGroups(groupPaymentLines(lines).map((group) => {
        const inn = suppliers.find((supplier) => supplier.id === group.supplierId)?.inn?.trim() ?? ""
        return { ...group, innLocked: Boolean(inn), supplierInn: inn }
      }))
    }).catch(() => { if (active) setError(copy.failed) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry, copy])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError("")
    try {
      const validated = validateOrderPayments(order, quotes, expandPaymentGroups(groups))
      if (groups.some((group) => !group.supplierInn.trim())) { setError(copy.innRequired); return }
      if (groups.some((group) => group.file && group.file.size > 5 * 1024 * 1024) || groups.reduce((sum, group) => sum + (group.file?.size ?? 0), 0) >= 20 * 1024 * 1024) {
        setError(copy.large); return
      }
      const form = new FormData()
      form.set("payments", JSON.stringify(validated))
      groups.forEach((group) => {
        if (group.file) form.set(`supplier-contract-${validated.findIndex((line) => line.supplierId === group.supplierId)}`, group.file)
      })
      setPending(true)
      if (await onSubmit(order.id, form)) onClose()
      else setError(copy.failed)
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : ""
      setError(reason === "supplier-inn-locked" ? copy.innLocked : reason === "supplier-inn-required" ? copy.innRequired : reason === "order-changed" || reason === "approved-offers-incomplete" ? copy.changed :
        reason.includes("file") ? copy.large : reason.includes("payment") || reason.includes("contract-number") ? copy.invalid : copy.failed)
    } finally { setPending(false) }
  }
  return <form onSubmit={submit} className="flex min-h-0 flex-col gap-4" aria-busy={pending || loading}>
    <div className="min-h-0 overflow-y-auto overscroll-contain">
      {loading ? <p role="status" className="py-8 text-center text-muted-foreground">{copy.loading}</p> : null}
      <fieldset disabled={pending || loading} className="min-w-0 space-y-4 disabled:opacity-70">
        {groups.map((group) => <section key={group.supplierId} aria-label={group.supplierName} className="min-w-0 rounded-lg border p-3">
          <div className="mb-3 flex flex-wrap justify-between gap-2 border-b pb-3">
            <h3 className="break-words text-sm font-semibold">{group.supplierName}</h3>
            <p className="font-mono text-sm font-semibold">{money(group.amount)} UZS</p>
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(0,3fr)]">
            <ul className="min-w-0 space-y-2">{group.lines.map((line) => {
              const productId = order.lines.find((item) => item.id === line.orderLineId)?.productId
              const product = data.products.find((item) => item.id === productId)
              return <li key={paymentLineKey(line)} className="rounded-lg bg-muted/40 p-3">
                <p className="break-words text-sm font-medium">{product ? getLocalizedTitle(product, lang) : productId ?? line.orderLineId}</p>
                <p className="mt-1 font-mono text-xs">{money(line.quantity)} × {money(line.unitPrice)} UZS</p>
                <p className="mt-1 text-xs text-muted-foreground">{(group.method === "original" ? line.method : group.method) === "cash" ? copy.cash : copy.bank}</p>
              </li>
            })}</ul>
            <SupplierPaymentFields group={group} lang={lang} onChange={(patch) => setGroups((current) => current.map((item) => item.supplierId === group.supplierId ? { ...item, ...patch } : item))} />
          </div>
        </section>)}
      </fieldset>
      <p className="mt-3 text-xs text-muted-foreground">{copy.hint}</p>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <DialogFooter className="m-0 shrink-0 rounded-lg p-3">
      <p className="mr-auto self-center text-sm font-medium">{copy.total}: <span className="font-mono">{money(groups.reduce((sum, group) => sum + group.amount, 0))} UZS</span></p>
      <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{copy.cancel}</Button>
      {!loading && !groups.length ? <Button type="button" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1) }}>{copy.retry}</Button> :
        <Button type="submit" disabled={pending || loading || !groups.length}>{pending ? <LoaderCircleIcon className="animate-spin" /> : null}{pending ? copy.saving : copy.save}</Button>}
    </DialogFooter>
  </form>
}

export function OrderPaymentSummary({ order, lang }: Pick<Props, "order" | "lang">) {
  const { data } = useSettings()
  const copy = orderPaymentCopy[lang]
  if (!order.placement) return null
  return <details className="min-w-0 rounded-xl border p-4">
    <summary className="cursor-pointer font-semibold">{copy.saved}</summary>
    <div className="mt-3 divide-y">{order.placement.lines.map((row) => {
      const product = data.products.find((item) => item.id === order.lines.find((line) => line.id === row.orderLineId)?.productId)
      return <div key={paymentLineKey(row)} className="space-y-1 py-3 text-sm">
        <p className="font-medium">{product ? getLocalizedTitle(product, lang) : row.orderLineId} · {row.supplierName}</p>
        {row.supplierInn ? <p>{copy.inn}: {row.supplierInn}</p> : null}
        <p>{row.method === "bank" ? copy.bank : copy.cash} · {copy.total}: {money(row.amount)} UZS · {copy.advance}: {money(row.prepaidAmount)} ({row.prepaidPercent}%)</p>
        <p>{copy.remaining}: {money(roundMoney(row.amount - row.prepaidAmount))} UZS{row.dueDate ? ` · ${copy.due}: ${row.dueDate}` : ""}</p>
        {row.contractNumber ? <p>{copy.contract}: {row.contractNumber}</p> : null}
        {row.contract ? <a className="inline-flex min-h-9 items-center break-all text-primary underline" href={`/api/orders/${encodeURIComponent(order.id)}/contracts/${encodeURIComponent(row.contract.id)}`} download>{row.contract.name}</a> : null}
      </div>
    })}</div>
  </details>
}
