"use client"
import * as React from "react"
import Link from "next/link"
import { financeInsights, type FinanceLifecycle } from "@/lib/finance-insights"
import { useUrlState } from "@/lib/use-url-state"
import { uxCopy } from "@/lib/ux-copy"
import { useAuthorization } from "@/components/auth/use-authorization"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasFinanceAccess, paymentActions, type FinanceActor, type PaymentAction, type PaymentCorrection, type PaymentRequest, type PaymentStage } from "@/lib/finance-workflow"
import type { Locale } from "@/lib/i18n"
import { FinanceActionDialog } from "./finance-action-dialog"
import { FinanceDetails } from "./finance-details"
import { financeCopy } from "./finance-copy"

export function FinanceWorkspace({ lang, webApp = false }: { lang: Locale; webApp?: boolean }) {
  const { roles, can, currentUserId } = useAuthorization()
  const copy = financeCopy[lang]
  const [payments, setPayments] = React.useState<PaymentRequest[]>([])
  const [actor, setActor] = React.useState<FinanceActor | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [tab, setTab] = useUrlState<"all" | "mine">("tab", "mine")
  const [lifecycle, setLifecycle] = useUrlState<FinanceLifecycle | "all">("lifecycle", "all")
  const [overdueOnly, setOverdueOnly] = useUrlState("overdue", false)
  const [stage, setStage] = useUrlState<PaymentStage | "all" | "outstanding">("stage", "all")
  const [query, setQuery] = useUrlState("q", "")
  const [selected, setSelected] = React.useState<string[]>([])
  const [detailId, setDetailId] = useUrlState<string | null>("payment", null)
  const [pending, setPending] = React.useState<{ action: PaymentAction; payments: PaymentRequest[] } | null>(null)
  const reload = React.useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/finance/payments", { cache: "no-store", signal })
    if (!response.ok) throw new Error(copy.error)
    const result = await response.json()
    setPayments(result.payments); setActor(result.actor); setError("")
  }, [copy.error])
  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => reload(controller.signal)).catch(() => { if (!controller.signal.aborted) setError(copy.error) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    const refresh = () => { if (!document.hidden) void reload().catch(() => setError(copy.error)) }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener("focus", refresh)
    window.addEventListener("factory-os:orders-changed", refresh)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("factory-os:orders-changed", refresh) }
  }, [reload, currentUserId, copy.error])
  React.useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === "Escape" && !document.querySelector('[data-slot="dialog-content"][data-open]')) setSelected([]) }
    window.addEventListener("keydown", escape)
    return () => window.removeEventListener("keydown", escape)
  }, [])
  if (!hasFinanceAccess(roles.map((role) => role.code), can("finance.view"))) return <p className="p-6">{copy.noAccess}</p>
  const actions = (payment: PaymentRequest) => actor ? paymentActions(payment, actor) : []
  const mine = payments.filter((payment) => actions(payment).length > 0)
  const insights = financeInsights(payments, new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tashkent" }).format(new Date()))
  const visible = (tab === "mine" ? mine : payments).filter((payment) => (stage === "all" || payment.stage === stage || (stage === "outstanding" && !["paid", "cancelled"].includes(payment.stage))) && (lifecycle === "all" || insights.orders.get(payment.orderId) === lifecycle) && (!overdueOnly || insights.overdueIds.has(payment.id)) &&
    [payment.orderNumber, payment.supplierName, payment.supplierInn, payment.contractNumber].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selectedPayments = visible.filter((payment) => selected.includes(payment.id))
  const commonActions = selectedPayments.length ? actions(selectedPayments[0]).filter((action) => selectedPayments.every((payment) => actions(payment).includes(action)) && (action !== "resubmit" || selectedPayments.length === 1)) : []
  const detail = payments.find((payment) => payment.id === detailId)
  const amount = (value: number) => `${value.toLocaleString(lang)} UZS`
  function filterCard(nextStage: PaymentStage | "all" | "outstanding", overdue = false) {
    setTab("all"); setStage(nextStage); setLifecycle("all"); setOverdueOnly(overdue); setQuery(""); setSelected([])
  }
  function toggle(id: string, checked: boolean) { setSelected((items) => checked ? [...new Set([...items, id])] : items.filter((item) => item !== id)) }
  function actionButtons(payment: PaymentRequest) { return <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setDetailId(payment.id)}>{copy.details}</Button>{actions(payment).map((action) => <Button key={action} size="sm" variant={action === "cancel" ? "destructive" : action === "return" ? "outline" : "default"} onClick={() => setPending({ action, payments: [payment] })}>{copy.actions[action]}</Button>)}</div> }
  async function submit(comment: string, correction?: PaymentCorrection) {
    if (!pending) return
    const response = await fetch("/api/finance/payments", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: pending.action, items: pending.payments.map(({ id, revision }) => ({ id, revision })), comment, correction }) })
    if (!response.ok) throw new Error(response.status === 409 ? copy.changed : copy.error)
    setNotice(copy.success)
    if (pending.action === "cancel") window.dispatchEvent(new Event("factory-os:orders-changed"))
    // A refresh failure must not invite a second submission of a successful payment.
    await reload().catch(() => setError(copy.error))
  }
  return <div className={`flex min-w-0 flex-1 flex-col gap-5 pb-8 ${webApp ? "telegram-finance" : "px-4 md:px-6"}`}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div>{!webApp ? <h1 className="text-2xl font-semibold">{copy.title}</h1> : null}<p className="mt-1 text-sm text-muted-foreground">{copy.flow}</p></div>{!webApp ? <Button variant="outline" onClick={() => { void reload().catch(() => setError(copy.error)) }}>{copy.refresh}</Button> : null}</header>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: copy.mine, value: `${mine.length} ${copy.count}`, click: () => { filterCard("all"); setTab("mine") } },
      { label: copy.outstanding, value: amount(insights.outstanding), click: () => { filterCard("outstanding") } },
      { label: copy.overdue, value: amount(insights.overdue), click: () => filterCard("all", true) },
      { label: copy.paidTotal, value: amount(insights.paid), click: () => filterCard("paid") },
    ].map((card) => <button key={card.label} onClick={card.click} className="min-w-0 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"><span className="text-xs text-muted-foreground sm:text-sm">{card.label}</span><span className="mt-2 block break-words text-base font-semibold tabular-nums sm:text-xl">{loading ? "…" : card.value}</span></button>)}</div>
    <section className="space-y-3" aria-label={copy.orderLifecycle}>
      <h2 className="text-sm font-semibold">{copy.orderLifecycle}</h2>
      <div className="flex flex-wrap gap-2">{(["all", "unpaid", "in_progress", "closed", "cancelled"] as const).map((value) => <Button key={value} aria-pressed={lifecycle === value} variant={lifecycle === value ? "default" : "outline"} onClick={() => { filterCard("all"); setLifecycle(value) }}>{copy.lifecycle[value]} ({value === "all" ? insights.orders.size : [...insights.orders.values()].filter((state) => state === value).length})</Button>)}</div>
      <p className="text-xs text-muted-foreground">{copy.scopeNote}</p>
    </section>
    {overdueOnly ? <div className="flex items-center gap-3 text-sm"><Badge variant="destructive">{copy.overdue}</Badge><Button variant="ghost" size="sm" onClick={() => setOverdueOnly(false)}>{uxCopy[lang].clear}</Button></div> : null}
    <div className="flex flex-wrap gap-2" aria-label={copy.paymentList}>{(["mine", "all"] as const).map((value) => <Button key={value} aria-pressed={tab === value} variant={tab === value ? "default" : "outline"} onClick={() => { setTab(value); setSelected([]) }}>{copy[value]} ({value === "mine" ? mine.length : payments.length})</Button>)}</div>
    <div className="flex flex-wrap gap-3"><Input className="min-w-0 flex-1 basis-60" aria-label={copy.search} placeholder={copy.search} value={query} onChange={(event) => { setQuery(event.target.value); setSelected([]) }} /><select aria-label={copy.status} className="h-10 max-w-full rounded-lg border bg-background px-3 text-sm" value={stage} onChange={(event) => { setStage(event.target.value as typeof stage); setSelected([]) }}><option value="all">{copy.all}</option><option value="outstanding">{copy.outstanding}</option>{Object.entries(copy.stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{notice ? <p role="status" className="text-sm">{notice}</p> : null}
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3"><label className="flex min-h-8 cursor-pointer items-center gap-3 text-sm"><Checkbox checked={visible.length > 0 && selectedPayments.length === visible.length} indeterminate={selectedPayments.length > 0 && selectedPayments.length < visible.length} disabled={!visible.length} onCheckedChange={(checked) => setSelected(checked ? visible.map((payment) => payment.id) : [])} />{copy.selectAll}</label><span className="text-sm text-muted-foreground">{copy.selected}: {selectedPayments.length}</span>{commonActions.map((action) => <Button key={action} size="sm" variant={action === "cancel" ? "destructive" : "outline"} onClick={() => setPending({ action, payments: selectedPayments })}>{copy.actions[action]}</Button>)}{selected.length ? <Button size="sm" variant="ghost" onClick={() => setSelected([])}>{copy.clear} (Esc)</Button> : null}{selectedPayments.length > 0 && !commonActions.length ? <p className="w-full text-xs text-muted-foreground">{copy.mixed}</p> : null}</div>
    {loading ? <p role="status">{copy.loading}</p> : !visible.length ? <div className="space-y-3 rounded-xl border border-dashed p-10 text-center"><p className="text-muted-foreground">{copy.empty}</p>{query || stage !== "all" || tab === "mine" || lifecycle !== "all" || overdueOnly ? <Button variant="outline" onClick={() => { filterCard("all") }}>{uxCopy[lang].clear}</Button> : <Link className="underline" href={`/${lang}/${webApp ? "telegram/" : ""}orders`}>{copy.order}</Link>}</div> : <>
      {!webApp ? <div className="hidden rounded-xl border lg:block"><Table><TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>{copy.order}</TableHead><TableHead>{copy.supplier}</TableHead><TableHead>{copy.amount}</TableHead><TableHead>{copy.status}</TableHead><TableHead>{copy.details}</TableHead></TableRow></TableHeader><TableBody>{visible.map((payment, index) => <TableRow key={payment.id}><TableCell><Checkbox aria-label={`${copy.select} ${payment.orderNumber} ${payment.supplierName} ${copy[payment.kind]}`} checked={selected.includes(payment.id)} onCheckedChange={(checked) => toggle(payment.id, checked)} /><span className="mt-1 block text-xs text-muted-foreground">{index + 1}</span></TableCell><TableCell><button className="text-primary underline" onClick={() => setDetailId(payment.id)}>{payment.orderNumber}</button><p className="mt-1 text-xs text-muted-foreground">{copy[payment.kind]}</p></TableCell><TableCell className="max-w-60 whitespace-normal break-words">{payment.supplierName}<p className="text-xs text-muted-foreground">{payment.supplierInn}</p></TableCell><TableCell className="font-mono text-xs">{amount(payment.amount)}<p className="mt-1 text-muted-foreground">{payment.dueDate}</p></TableCell><TableCell><Badge variant="outline">{copy.stages[payment.stage]}</Badge></TableCell><TableCell>{actionButtons(payment)}</TableCell></TableRow>)}</TableBody></Table></div> : null}
      <div className={`grid gap-3 ${webApp ? "" : "lg:hidden"}`}>{visible.map((payment) => <article key={payment.id} className="min-w-0 space-y-3 rounded-xl border bg-card p-4"><div className="flex items-center gap-3"><Checkbox aria-label={`${copy.select} ${payment.orderNumber} ${copy[payment.kind]}`} checked={selected.includes(payment.id)} onCheckedChange={(checked) => toggle(payment.id, checked)} /><button className="break-all text-left font-medium text-primary underline" onClick={() => setDetailId(payment.id)}>{payment.orderNumber}</button></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{copy[payment.kind]}</Badge><Badge variant="outline">{copy.stages[payment.stage]}</Badge></div><p className="break-words">{payment.supplierName}</p><p className="font-mono text-sm font-semibold">{amount(payment.amount)}</p>{actionButtons(payment)}</article>)}</div>
    </>}
    {detail ? <FinanceDetails key={detail.id} payment={detail} lang={lang} onClose={() => setDetailId(null)} /> : null}
    {pending ? <FinanceActionDialog action={pending.action} payments={pending.payments} copy={copy} onClose={() => setPending(null)} onSubmit={submit} /> : null}
  </div>
}
