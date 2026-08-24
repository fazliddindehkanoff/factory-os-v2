"use client"

import * as React from "react"
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  FilePlus2Icon,
  SearchIcon,
} from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { useProcurement } from "@/components/procurement/procurement-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Locale, Messages } from "@/lib/i18n"
import type { ProcurementCase, ProcurementStage } from "@/lib/procurement"
import { getLocalizedTitle } from "@/lib/settings"

const stageOrder: ProcurementStage[] = ["needs_quote", "comparing", "supplier_selected"]

export function ProcurementWorkspace({ lang, messages }: { lang: Locale; messages: Messages }) {
  const { can } = useAuthorization()
  const { orders } = useOrders()
  const { data } = useSettings()
  const { cases, quotations } = useProcurement()
  const [query, setQuery] = React.useState("")
  const [stage, setStage] = React.useState<ProcurementStage | "">("")
  const [selectedCase, setSelectedCase] = React.useState<ProcurementCase | null>(null)

  if (!can("procurement.view")) {
    return <AccessDenied lang={lang} permissions={["procurement.view"]} />
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredCases = cases.filter((procurementCase) => {
    const order = orders.find((item) => item.id === procurementCase.orderId)
    const assignee = data.users.find((item) => item.id === procurementCase.assigneeId)
    const products = order?.lines.map((line) => {
      const product = data.products.find((item) => item.id === line.productId)
      return product ? `${product.code} ${product.titleUz} ${product.titleRu} ${product.titleTr}` : ""
    }).join(" ") ?? ""
    const haystack = `${order?.number ?? ""} ${assignee?.fullName ?? ""} ${products}`.toLocaleLowerCase()
    return (!stage || procurementCase.stage === stage) && (!normalizedQuery || haystack.includes(normalizedQuery))
  })

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-5 px-4 pb-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{messages.procurement}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{messages.procurementDescription}</p>
      </div>

      <section aria-labelledby="procurement-stages" className="overflow-hidden rounded-xl border bg-card">
        <h2 id="procurement-stages" className="sr-only">{messages.procurementQueue}</h2>
        <div className="grid sm:grid-cols-3">
          {stageOrder.map((item, index) => {
            const count = cases.filter((procurementCase) => procurementCase.stage === item).length
            const active = stage === item
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => setStage(active ? "" : item)}
                className={`group flex min-h-24 items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50 ${index > 0 ? "border-t sm:border-l sm:border-t-0" : ""} ${active ? "bg-muted" : ""}`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-semibold ${active ? "border-foreground bg-foreground text-background" : "bg-background"}`}>
                  {count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">0{index + 1}</span>
                  <span className="mt-0.5 block text-sm font-medium">{stageLabel(item, messages)}</span>
                </span>
                {index < stageOrder.length - 1 ? <ArrowRightIcon className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-lg">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={messages.searchProcurement} className="pl-8" />
        </div>
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value as ProcurementStage | "")}
          aria-label={messages.allStages}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-60"
        >
          <option value="">{messages.allStages}</option>
          {stageOrder.map((item) => <option key={item} value={item}>{stageLabel(item, messages)}</option>)}
        </select>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.orderNumber}</TableHead>
              <TableHead>{messages.product}</TableHead>
              <TableHead>{messages.procurementSpecialist}</TableHead>
              <TableHead>{messages.status}</TableHead>
              <TableHead>{messages.quotations}</TableHead>
              <TableHead>{messages.bestOffer}</TableHead>
              <TableHead>{messages.leadTime}</TableHead>
              <TableHead className="w-28 text-right">{messages.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCases.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-28 text-center text-muted-foreground">{messages.noProcurementOrders}</TableCell></TableRow>
            ) : filteredCases.map((procurementCase) => {
              const order = orders.find((item) => item.id === procurementCase.orderId)
              const assignee = data.users.find((item) => item.id === procurementCase.assigneeId)
              const caseQuotes = quotations.filter((item) => item.procurementCaseId === procurementCase.id)
              const bestQuote = [...caseQuotes].sort((a, b) => a.amount - b.amount)[0]
              const products = order?.lines.map((line) => data.products.find((item) => item.id === line.productId)).filter(Boolean) ?? []
              return (
                <TableRow key={procurementCase.id}>
                  <TableCell className="font-mono font-medium">{order?.number ?? "—"}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    <span className="font-medium">{products[0] ? getLocalizedTitle(products[0], lang) : "—"}</span>
                    {products.length > 1 ? <span className="ml-1 text-xs text-muted-foreground">+{products.length - 1}</span> : null}
                  </TableCell>
                  <TableCell>{assignee?.fullName ?? "—"}</TableCell>
                  <TableCell><StageBadge stage={procurementCase.stage} messages={messages} /></TableCell>
                  <TableCell className="font-mono tabular-nums">{caseQuotes.length}</TableCell>
                  <TableCell className="font-mono tabular-nums">{bestQuote ? formatMoney(bestQuote.amount) : "—"}</TableCell>
                  <TableCell>{bestQuote ? `${bestQuote.leadTimeDays} ${messages.days}` : "—"}</TableCell>
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setSelectedCase(procurementCase)}>{messages.details}</Button></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {selectedCase ? (
        <ProcurementDialog
          key={selectedCase.id}
          procurementCase={selectedCase}
          lang={lang}
          messages={messages}
          open
          onOpenChange={(open) => !open && setSelectedCase(null)}
        />
      ) : null}
    </div>
  )
}

function ProcurementDialog({ procurementCase, lang, messages, open, onOpenChange }: {
  procurementCase: ProcurementCase
  lang: Locale
  messages: Messages
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = useAuthorization()
  const { orders } = useOrders()
  const { data } = useSettings()
  const { cases, quotations, suppliers, addQuotation, selectQuotation } = useProcurement()
  const liveCase = cases.find((item) => item.id === procurementCase.id) ?? procurementCase
  const activeSuppliers = suppliers.filter((item) => item.status === "active")
  const caseQuotes = quotations.filter((item) => item.procurementCaseId === procurementCase.id)
  const order = orders.find((item) => item.id === procurementCase.orderId)
  const [supplierId, setSupplierId] = React.useState(activeSuppliers[0]?.id ?? "")
  const [amount, setAmount] = React.useState("")
  const [leadTimeDays, setLeadTimeDays] = React.useState("")
  const [paymentTerms, setPaymentTerms] = React.useState("")
  const [ndsIncluded, setNdsIncluded] = React.useState(true)

  function submitQuote() {
    const numericAmount = Number(amount)
    const numericLeadTime = Number(leadTimeDays)
    if (!supplierId || !Number.isFinite(numericAmount) || numericAmount <= 0 || !Number.isFinite(numericLeadTime) || numericLeadTime <= 0) return
    addQuotation({
      procurementCaseId: procurementCase.id,
      supplierId,
      amount: numericAmount,
      leadTimeDays: numericLeadTime,
      paymentTerms: paymentTerms.trim(),
      ndsIncluded,
    })
    setAmount("")
    setLeadTimeDays("")
    setPaymentTerms("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{order?.number ?? messages.procurementQueue}</DialogTitle>
          <DialogDescription>{messages.procurementDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={liveCase.stage} messages={messages} />
            {order?.lines.map((line) => {
              const product = data.products.find((item) => item.id === line.productId)
              return product ? <Badge key={line.id} variant="outline">{getLocalizedTitle(product, lang)} · {line.quantity}</Badge> : null
            })}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">{messages.quotations}</h3>
            {caseQuotes.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{messages.needsQuotation}</p> : caseQuotes.map((quote) => {
              const supplier = suppliers.find((item) => item.id === quote.supplierId)
              return (
                <div key={quote.id} className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] ${quote.selected ? "border-foreground bg-muted/45" : ""}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{supplier?.name ?? "—"}</span>
                      {quote.selected ? <Badge>{messages.supplierSelected}</Badge> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CircleDollarSignIcon className="size-3.5" />{formatMoney(quote.amount)}</span>
                      <span className="inline-flex items-center gap-1"><CalendarClockIcon className="size-3.5" />{quote.leadTimeDays} {messages.days}</span>
                      {quote.ndsIncluded ? <span>{messages.ndsIncluded}</span> : null}
                    </div>
                    {quote.paymentTerms ? <p className="mt-1.5 text-xs text-muted-foreground">{messages.paymentTerms}: {quote.paymentTerms}</p> : null}
                  </div>
                  {can("procurement.select_supplier") && !quote.selected ? (
                    <Button size="sm" variant="outline" onClick={() => selectQuotation(procurementCase.id, quote.id)}>{messages.selectSupplier}</Button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {can("procurement.quote") ? (
            <section className="space-y-3 rounded-xl bg-muted/45 p-3" aria-labelledby="add-quotation-title">
              <h3 id="add-quotation-title" className="flex items-center gap-2 text-sm font-medium"><FilePlus2Icon className="size-4" />{messages.addQuotation}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={messages.suppliers}>
                  <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={selectClassName}>
                    {activeSuppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </FormField>
                <FormField label={messages.amount}><Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))} placeholder="0 UZS" /></FormField>
                <FormField label={messages.leadTime}><Input inputMode="numeric" value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value.replace(/[^0-9]/g, ""))} placeholder={messages.days} /></FormField>
                <FormField label={messages.paymentTerms}><Input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></FormField>
              </div>
              <label className="flex w-fit items-center gap-2 text-sm"><Checkbox checked={ndsIncluded} onCheckedChange={(checked) => setNdsIncluded(checked === true)} />{messages.ndsIncluded}</label>
              <Button onClick={submitQuote} disabled={!supplierId || Number(amount) <= 0 || Number(leadTimeDays) <= 0}><FilePlus2Icon />{messages.addQuotation}</Button>
            </section>
          ) : null}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{messages.done}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
}

function StageBadge({ stage, messages }: { stage: ProcurementStage; messages: Messages }) {
  const variant = stage === "supplier_selected" ? "default" : stage === "comparing" ? "secondary" : "outline"
  return <Badge variant={variant}>{stageLabel(stage, messages)}</Badge>
}

function stageLabel(stage: ProcurementStage, messages: Messages) {
  if (stage === "needs_quote") return messages.needsQuotation
  if (stage === "comparing") return messages.quotationsReceived
  return messages.supplierSelected
}

function formatMoney(value: number) {
  return `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} UZS`
}

const selectClassName = "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
