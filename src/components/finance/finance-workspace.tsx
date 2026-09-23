"use client"
import * as React from "react"
import Link from "next/link"
import { financeInsights, type FinanceLifecycle } from "@/lib/finance-insights"
import { useUrlState } from "@/lib/use-url-state"
import { uxCopy } from "@/lib/ux-copy"
import { useAuthorization } from "@/components/auth/use-authorization"
import { ArrowRightIcon, BanknoteIcon, CircleCheckBigIcon, Clock3Icon, EyeIcon, SearchIcon, TriangleAlertIcon, WalletIcon, XIcon } from "lucide-react"
import { formatMoneyShort } from "@/lib/money-format"
import { PageHeader, StatTile, Surface } from "@/components/page-header"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasFinanceAccess, paymentActions, type FinanceActor, type PaymentAction, type PaymentCorrection, type PaymentRequest, type PaymentStage } from "@/lib/finance-workflow"
import type { Locale } from "@/lib/i18n"
import { FinanceActionDialog } from "./finance-action-dialog"
import { FinanceDetails } from "./finance-details"
import { financeCopy, type FinanceCopy } from "./finance-copy"

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
  function actionButtons(payment: PaymentRequest) {
    return <div className="flex flex-wrap items-center gap-1.5">
      {actions(payment).map((action) => <Button key={action} size="sm"
        variant={action === "cancel" ? "ghost" : action === "return" ? "outline" : "default"}
        className={action === "cancel" ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : undefined}
        onClick={() => setPending({ action, payments: [payment] })}>{copy.actions[action]}</Button>)}
      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDetailId(payment.id)}><EyeIcon />{copy.details}</Button>
    </div>
  }
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
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tashkent" }).format(new Date())
  const lifecycleCounts = (value: FinanceLifecycle | "all") => value === "all" ? insights.orders.size : [...insights.orders.values()].filter((state) => state === value).length
  const flowSteps = copy.flow.split("→").map((step) => step.trim())
  return <div className={cn("flex min-w-0 flex-1 flex-col gap-5 pb-10", webApp ? "telegram-finance" : "mx-auto w-full max-w-7xl px-4 md:px-6")}>
    {!webApp ? <PageHeader
      icon={BanknoteIcon}
      title={copy.title}
      meta={flowSteps.map((step, index) => <span key={step} className="inline-flex items-center gap-2">
        {index ? <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">{step}</span>
      </span>)}
    /> : <p className="text-sm text-muted-foreground">{copy.flow}</p>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: copy.mine, value: loading ? "…" : String(mine.length), hint: copy.count, icon: Clock3Icon, tone: "amber" as const, active: tab === "mine" && stage === "all" && !overdueOnly, click: () => { filterCard("all"); setTab("mine") } },
      { label: copy.outstanding, value: loading ? "…" : formatMoneyShort(insights.outstanding, lang), hint: amount(insights.outstanding), icon: WalletIcon, tone: "primary" as const, active: stage === "outstanding", click: () => { filterCard("outstanding") } },
      { label: copy.overdue, value: loading ? "…" : formatMoneyShort(insights.overdue, lang), hint: amount(insights.overdue), icon: TriangleAlertIcon, tone: insights.overdue ? "red" as const : "default" as const, active: overdueOnly, click: () => filterCard("all", true) },
      { label: copy.paidTotal, value: loading ? "…" : formatMoneyShort(insights.paid, lang), hint: amount(insights.paid), icon: CircleCheckBigIcon, tone: "emerald" as const, active: stage === "paid", click: () => filterCard("paid") },
    ].map((card) => <button key={card.label} type="button" onClick={card.click} aria-pressed={card.active} className="min-w-0 text-left focus-visible:outline-none [&>article]:transition-colors hover:[&>article]:border-primary/40 focus-visible:[&>article]:ring-3 focus-visible:[&>article]:ring-ring/50">
      <StatTile label={card.label} value={card.value} hint={card.hint} icon={card.icon} tone={card.tone} active={card.active} />
    </button>)}</div>

    <Surface className="p-3 md:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex w-fit shrink-0 rounded-xl border bg-muted/50 p-1" role="group" aria-label={copy.paymentList}>
          {(["mine", "all"] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => { setTab(value); setSelected([]) }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm">
            {copy[value]}<span className="rounded-full bg-muted px-1.5 font-mono text-xs">{value === "mine" ? mine.length : payments.length}</span>
          </button>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-10 rounded-xl pl-9" aria-label={copy.search} placeholder={copy.search} value={query} onChange={(event) => { setQuery(event.target.value); setSelected([]) }} />
        </div>
        <select aria-label={copy.status} className="h-10 max-w-full rounded-xl border bg-background px-3 text-sm" value={stage} onChange={(event) => { setStage(event.target.value as typeof stage); setSelected([]) }}><option value="all">{copy.all}</option><option value="outstanding">{copy.outstanding}</option>{Object.entries(copy.stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>
      <div className="mt-3 border-t pt-3" aria-label={copy.orderLifecycle}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-muted-foreground">{copy.orderLifecycle}:</span>
          {(["all", "unpaid", "in_progress", "closed", "cancelled"] as const).map((value) => <button key={value} type="button" aria-pressed={lifecycle === value} onClick={() => { filterCard("all"); setLifecycle(value) }}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground">
            {copy.lifecycle[value]}<span className="font-mono opacity-80">{lifecycleCounts(value)}</span>
          </button>)}
          {overdueOnly ? <button type="button" onClick={() => setOverdueOnly(false)} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">{copy.overdue}<XIcon className="size-3" aria-hidden="true" /></button> : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{copy.scopeNote}</p>
      </div>
    </Surface>

    {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}

    <Surface className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <label className="flex min-h-8 cursor-pointer items-center gap-3 text-sm"><Checkbox checked={visible.length > 0 && selectedPayments.length === visible.length} indeterminate={selectedPayments.length > 0 && selectedPayments.length < visible.length} disabled={!visible.length} onCheckedChange={(checked) => setSelected(checked ? visible.map((payment) => payment.id) : [])} />{copy.selectAll}</label>
        <span className="text-sm text-muted-foreground">{copy.selected}: <b className="font-mono text-foreground">{selectedPayments.length}</b></span>
        {commonActions.map((action) => <Button key={action} size="sm" variant={action === "cancel" ? "destructive" : "default"} onClick={() => setPending({ action, payments: selectedPayments })}>{copy.actions[action]} ({selectedPayments.length})</Button>)}
        {selected.length ? <Button size="sm" variant="ghost" onClick={() => setSelected([])}>{copy.clear} (Esc)</Button> : null}
        {selectedPayments.length > 0 && !commonActions.length ? <p className="w-full text-xs text-muted-foreground">{copy.mixed}</p> : null}
      </div>
      {loading ? <div className="space-y-2 p-4" role="status" aria-label={copy.loading}>{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div> : !visible.length ? <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><BanknoteIcon className="size-7" aria-hidden="true" /></span>
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
        {query || stage !== "all" || tab === "mine" || lifecycle !== "all" || overdueOnly ? <Button variant="outline" onClick={() => { filterCard("all") }}>{uxCopy[lang].clear}</Button> : <Link className="text-sm text-primary underline" href={`/${lang}/${webApp ? "telegram/" : ""}orders`}>{copy.order}</Link>}
      </div> : <>
        {!webApp ? <div className="hidden lg:block"><Table><TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent"><TableHead className="w-12 pl-4">#</TableHead><TableHead>{copy.order}</TableHead><TableHead>{copy.supplier}</TableHead><TableHead className="text-right">{copy.amount}</TableHead><TableHead>{copy.status}</TableHead><TableHead className="pr-4"><span className="sr-only">{copy.details}</span></TableHead></TableRow></TableHeader><TableBody>{visible.map((payment, index) => {
          const overdue = insights.overdueIds.has(payment.id)
          return <TableRow key={payment.id} data-state={selected.includes(payment.id) ? "selected" : undefined}>
            <TableCell className="pl-4"><Checkbox aria-label={`${copy.select} ${payment.orderNumber} ${payment.supplierName} ${copy[payment.kind]}`} checked={selected.includes(payment.id)} onCheckedChange={(checked) => toggle(payment.id, checked)} /><span className="mt-1 block font-mono text-[11px] text-muted-foreground">{index + 1}</span></TableCell>
            <TableCell><button type="button" className="font-mono text-sm font-semibold text-primary hover:underline" onClick={() => setDetailId(payment.id)}>{payment.orderNumber}</button><p className="mt-0.5"><KindPill kind={payment.kind} copy={copy} /></p></TableCell>
            <TableCell className="max-w-60 whitespace-normal break-words"><span className="font-medium">{payment.supplierName}</span><p className="font-mono text-xs text-muted-foreground">{copy.inn}: {payment.supplierInn || "—"}</p></TableCell>
            <TableCell className="text-right"><span className="font-mono text-sm font-semibold tabular-nums">{amount(payment.amount)}</span><p className={cn("mt-0.5 font-mono text-xs", overdue ? "font-semibold text-red-600" : "text-muted-foreground")}>{payment.dueDate ? `${copy.dueDate}: ${payment.dueDate}` : "—"}</p></TableCell>
            <TableCell><StagePill stage={payment.stage} copy={copy} /></TableCell>
            <TableCell className="pr-4">{actionButtons(payment)}</TableCell>
          </TableRow>
        })}</TableBody></Table></div> : null}
        <div className={cn("grid gap-0 divide-y", !webApp && "lg:hidden")}>{visible.map((payment) => {
          const overdue = insights.overdueIds.has(payment.id)
          return <article key={payment.id} className={cn("min-w-0 space-y-3 p-4", overdue && "bg-red-50/50")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Checkbox aria-label={`${copy.select} ${payment.orderNumber} ${copy[payment.kind]}`} checked={selected.includes(payment.id)} onCheckedChange={(checked) => toggle(payment.id, checked)} />
                <button type="button" className="break-all text-left font-mono text-sm font-semibold text-primary" onClick={() => setDetailId(payment.id)}>{payment.orderNumber}</button>
                <KindPill kind={payment.kind} copy={copy} />
              </div>
              <StagePill stage={payment.stage} copy={copy} />
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-medium">{payment.supplierName}</p>
              <div className="shrink-0 text-right">
                <p className="font-mono text-base font-semibold tabular-nums">{amount(payment.amount)}</p>
                {payment.dueDate ? <p className={cn("font-mono text-xs", overdue || payment.dueDate < today ? "font-semibold text-red-600" : "text-muted-foreground")}>{payment.dueDate}</p> : null}
              </div>
            </div>
            {actionButtons(payment)}
          </article>
        })}</div>
      </>}
    </Surface>
    {detail ? <FinanceDetails key={detail.id} payment={detail} lang={lang} onClose={() => setDetailId(null)} /> : null}
    {pending ? <FinanceActionDialog action={pending.action} payments={pending.payments} copy={copy} onClose={() => setPending(null)} onSubmit={submit} /> : null}
  </div>
}

const stageTone: Record<PaymentStage, string> = {
  head_review: "bg-amber-50 text-amber-800",
  director_review: "bg-violet-50 text-violet-800",
  payment: "bg-sky-50 text-sky-800",
  returned: "bg-orange-50 text-orange-800",
  paid: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-muted text-muted-foreground",
}

function StagePill({ stage, copy }: { stage: PaymentStage; copy: FinanceCopy }) {
  return <span className={cn("inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", stageTone[stage])}>
    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{copy.stages[stage]}
  </span>
}

function KindPill({ kind, copy }: { kind: PaymentRequest["kind"]; copy: FinanceCopy }) {
  return <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium", kind === "advance" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{copy[kind]}</span>
}
