"use client"

import * as React from "react"
import {
  BanknoteIcon,
  CheckCircle2Icon,
  Clock3Icon,
  EyeIcon,
  FileTextIcon,
  SearchIcon,
  WalletCardsIcon,
} from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  financePaymentBalance,
  initialFinancePayments,
  type FinancePayment,
  type FinancePaymentStatus,
  type FinanceRequestSnapshot,
  type FinanceTransaction,
} from "@/lib/finance"
import type { Locale } from "@/lib/i18n"
import { createAppRecord, loadAppRecords } from "@/lib/client-app-records"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | FinancePaymentStatus
type PersistedFinanceTransaction = FinanceTransaction & { paymentId: string }

export function FinanceWorkspace({ lang }: { lang: Locale }) {
  const { can } = useAuthorization()
  const copy = financeCopy[lang]
  const [payments, setPayments] = React.useState(initialFinancePayments)
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [selectedPayment, setSelectedPayment] = React.useState<FinancePayment | null>(null)
  const [selectedRequest, setSelectedRequest] = React.useState<FinanceRequestSnapshot | null>(null)
  const [paymentToRecord, setPaymentToRecord] = React.useState<FinancePayment | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void loadAppRecords<PersistedFinanceTransaction>("finance-transactions").then((transactions) => {
      if (cancelled) return
      setPayments((current) => current.map((payment) => {
        const persisted = transactions.filter((transaction) => transaction.paymentId === payment.id)
        if (!persisted.length) return payment
        const merged = new Map(payment.transactions.map((transaction) => [transaction.id, transaction]))
        for (const persistedTransaction of persisted) {
          const transaction: FinanceTransaction = {
            id: persistedTransaction.id,
            date: persistedTransaction.date,
            amount: persistedTransaction.amount,
            method: persistedTransaction.method,
            reference: persistedTransaction.reference,
          }
          merged.set(transaction.id, transaction)
        }
        const nextTransactions = [...merged.values()]
        const paidAmount = Math.min(payment.amount, nextTransactions.reduce((sum, item) => sum + item.amount, 0))
        return {
          ...payment,
          transactions: nextTransactions,
          paidAmount,
          status: paidAmount >= payment.amount ? "paid" : paidAmount > 0 ? "partial" : payment.status,
        }
      }))
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  if (!can("finance.view")) {
    return <AccessDenied lang={lang} permissions={["finance.view"]} />
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredPayments = payments.filter((payment) => {
    const searchText = [
      payment.id,
      payment.contractNumber,
      payment.supplier,
      payment.supplierTaxId,
      ...payment.requests.map((request) => request.number),
      ...payment.requests.flatMap((request) => request.positions.map((position) => position.name)),
    ].join(" ").toLocaleLowerCase()
    return (status === "all" || payment.status === status) &&
      (!normalizedQuery || searchText.includes(normalizedQuery))
  })
  const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const totalPaid = payments.reduce((sum, payment) => sum + payment.paidAmount, 0)
  const totalBalance = payments.reduce((sum, payment) => sum + financePaymentBalance(payment), 0)
  const readyPayments = payments.filter((payment) => payment.status === "ready")
  const approvalPayments = payments.filter((payment) => payment.status === "approval")

  function openRecordPayment(payment: FinancePayment) {
    setSelectedPayment(null)
    setPaymentToRecord(payment)
  }

  async function recordPayment(paymentId: string, amount: number, date: string, method: "bank" | "cash", reference: string) {
    const transaction: PersistedFinanceTransaction = {
      id: `transaction-${crypto.randomUUID()}`,
      paymentId,
      date,
      amount,
      method,
      reference: reference.trim() || copy.noReference,
    }
    await createAppRecord("finance-transactions", transaction)
    setPayments((current) => current.map((payment) => {
      if (payment.id !== paymentId) return payment
      const paidAmount = Math.min(payment.amount, payment.paidAmount + amount)
      return {
        ...payment,
        paidAmount,
        status: paidAmount >= payment.amount ? "paid" : "partial",
        transactions: [...payment.transactions, transaction],
      }
    }))
    setPaymentToRecord(null)
  }

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-5 px-4 pb-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <div className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-5">
        <SummaryButton label={copy.contractTotal} value={money(totalAmount, lang)} note={`${payments.length} ${copy.contracts}`} onClick={() => setStatus("all")} />
        <SummaryButton label={copy.inApproval} value={money(approvalPayments.reduce((sum, payment) => sum + payment.amount, 0), lang)} note={`${approvalPayments.length} ${copy.contracts}`} onClick={() => setStatus("approval")} tone="blue" />
        <SummaryButton label={copy.readyToPay} value={money(readyPayments.reduce((sum, payment) => sum + financePaymentBalance(payment), 0), lang)} note={`${readyPayments.length} ${copy.contracts}`} onClick={() => setStatus("ready")} tone="amber" />
        <SummaryButton label={copy.actuallyPaid} value={money(totalPaid, lang)} note={copy.includingPartial} onClick={() => setStatus("paid")} tone="green" />
        <SummaryButton label={copy.remaining} value={money(totalBalance, lang)} note={copy.currentBalance} onClick={() => setStatus("all")} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder={copy.search} />
        </div>
        <div className="flex flex-wrap gap-2" aria-label={copy.statusFilter}>
          {(["all", "draft", "approval", "ready", "partial", "paid"] as const).map((item) => (
            <Button key={item} type="button" size="sm" variant={status === item ? "default" : "outline"} onClick={() => setStatus(item)}>
              {copy.statuses[item]}
            </Button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[13%]">{copy.payment}</TableHead>
              <TableHead className="w-[14%]">{copy.requests}</TableHead>
              <TableHead className="w-[20%]">{copy.supplier}</TableHead>
              <TableHead className="w-[12%] text-right">{copy.contractAmount}</TableHead>
              <TableHead className="w-[15%] text-right">{copy.paidAndBalance}</TableHead>
              <TableHead className="w-[14%]">{copy.paymentStatus}</TableHead>
              <TableHead className="w-[12%] text-right">{copy.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length ? filteredPayments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="whitespace-normal">
                  <button type="button" className="cursor-pointer text-left font-mono text-xs font-semibold text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelectedPayment(payment)}>{payment.id}</button>
                  <div className="mt-1 text-xs text-muted-foreground">{date(payment.createdAt, lang)}</div>
                </TableCell>
                <TableCell className="whitespace-normal"><RequestButtons requests={payment.requests} onOpen={setSelectedRequest} /></TableCell>
                <TableCell className="whitespace-normal">
                  <div className="font-medium leading-snug">{payment.supplier}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{copy.contract} {payment.contractNumber} · {payment.supplierTaxId}</div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">{money(payment.amount, lang)}</TableCell>
                <TableCell className="whitespace-normal text-right text-xs">
                  <div className="font-mono font-medium text-emerald-700">{money(payment.paidAmount, lang)}</div>
                  <div className="mt-1 font-mono text-muted-foreground">{copy.balance}: {money(financePaymentBalance(payment), lang)}</div>
                </TableCell>
                <TableCell className="whitespace-normal"><PaymentStatusBadge status={payment.status} lang={lang} /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={copy.viewDetails} title={copy.viewDetails} onClick={() => setSelectedPayment(payment)}><EyeIcon /></Button>
                    {can("finance.mark_paid") && canRecord(payment) ? <Button variant="ghost" size="icon-sm" aria-label={copy.recordPayment} title={copy.recordPayment} onClick={() => openRecordPayment(payment)}><BanknoteIcon /></Button> : null}
                  </div>
                </TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">{copy.noPayments}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {filteredPayments.length ? filteredPayments.map((payment) => (
          <article key={payment.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button type="button" className="cursor-pointer font-mono text-sm font-semibold text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelectedPayment(payment)}>{payment.id}</button>
                <p className="mt-1 truncate font-medium">{payment.supplier}</p>
              </div>
              <PaymentStatusBadge status={payment.status} lang={lang} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label={copy.contract} value={payment.contractNumber} />
              <Info label={copy.contractAmount} value={money(payment.amount, lang)} />
              <Info label={copy.paid} value={money(payment.paidAmount, lang)} />
              <Info label={copy.balance} value={money(financePaymentBalance(payment), lang)} />
            </dl>
            <div className="mt-4 border-t pt-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">{copy.requests}</div>
              <RequestButtons requests={payment.requests} onOpen={setSelectedRequest} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedPayment(payment)}><EyeIcon />{copy.details}</Button>
              {can("finance.mark_paid") && canRecord(payment) ? <Button className="flex-1" onClick={() => openRecordPayment(payment)}><BanknoteIcon />{copy.recordPayment}</Button> : null}
            </div>
          </article>
        )) : <div className="rounded-xl border bg-card px-4 py-16 text-center text-sm text-muted-foreground">{copy.noPayments}</div>}
      </div>

      <PaymentDetailsDialog payment={selectedPayment} lang={lang} onOpenChange={(open) => !open && setSelectedPayment(null)} onOpenRequest={setSelectedRequest} onRecord={openRecordPayment} canMarkPaid={can("finance.mark_paid")} />
      <RequestDetailsDialog request={selectedRequest} lang={lang} onOpenChange={(open) => !open && setSelectedRequest(null)} />
      {paymentToRecord ? <RecordPaymentDialog key={paymentToRecord.id} payment={paymentToRecord} lang={lang} onOpenChange={(open) => !open && setPaymentToRecord(null)} onSubmit={recordPayment} /> : null}
    </div>
  )
}

function SummaryButton({ label, value, note, onClick, tone = "default" }: { label: string; value: string; note: string; onClick: () => void; tone?: "default" | "blue" | "amber" | "green" }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 cursor-pointer border-b p-4 text-left transition-colors hover:bg-primary/10 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:border-r xl:border-b-0 last:border-r-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-2 truncate font-mono text-lg font-semibold tabular-nums", tone === "blue" && "text-primary", tone === "amber" && "text-amber-700", tone === "green" && "text-emerald-700")}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </button>
  )
}

function RequestButtons({ requests, onOpen }: { requests: FinanceRequestSnapshot[]; onOpen: (request: FinanceRequestSnapshot) => void }) {
  return <div className="flex flex-wrap gap-1.5">{requests.map((request) => <button key={request.id} type="button" onClick={() => onOpen(request)} className="cursor-pointer rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{request.number}</button>)}</div>
}

function PaymentStatusBadge({ status, lang }: { status: FinancePaymentStatus; lang: Locale }) {
  const copy = financeCopy[lang]
  const Icon = status === "paid" ? CheckCircle2Icon : status === "ready" || status === "partial" ? BanknoteIcon : status === "approval" ? Clock3Icon : FileTextIcon
  return <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap", status === "paid" && "border-emerald-200 bg-emerald-50 text-emerald-800", status === "ready" && "border-amber-200 bg-amber-50 text-amber-800", status === "partial" && "border-blue-200 bg-blue-50 text-blue-800", status === "approval" && "border-violet-200 bg-violet-50 text-violet-800")}><Icon className="size-3" />{copy.statuses[status]}</Badge>
}

function PaymentDetailsDialog({ payment, lang, onOpenChange, onOpenRequest, onRecord, canMarkPaid }: { payment: FinancePayment | null; lang: Locale; onOpenChange: (open: boolean) => void; onOpenRequest: (request: FinanceRequestSnapshot) => void; onRecord: (payment: FinancePayment) => void; canMarkPaid: boolean }) {
  const copy = financeCopy[lang]
  return <Dialog open={Boolean(payment)} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto sm:max-w-3xl">
    {payment ? <>
      <DialogHeader><DialogTitle>{payment.id}</DialogTitle><DialogDescription>{payment.supplier} · {copy.contract} {payment.contractNumber}</DialogDescription></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={<WalletCardsIcon />} label={copy.contractAmount} value={money(payment.amount, lang)} />
        <InfoCard icon={<CheckCircle2Icon />} label={copy.paid} value={money(payment.paidAmount, lang)} />
        <InfoCard icon={<Clock3Icon />} label={copy.balance} value={money(financePaymentBalance(payment), lang)} />
        <InfoCard icon={<FileTextIcon />} label={copy.dueDate} value={date(payment.dueDate, lang)} />
      </div>
      <section className="rounded-xl border p-4"><h3 className="text-sm font-semibold">{copy.requestsAndPositions}</h3><p className="mt-1 text-xs text-muted-foreground">{copy.requestHint}</p><div className="mt-3"><RequestButtons requests={payment.requests} onOpen={onOpenRequest} /></div></section>
      <section className="rounded-xl border p-4"><h3 className="text-sm font-semibold">{copy.transactions}</h3><div className="mt-3 grid gap-2">{payment.transactions.length ? payment.transactions.map((transaction) => <div key={transaction.id} className="flex flex-col justify-between gap-2 rounded-lg bg-muted/60 p-3 text-sm sm:flex-row sm:items-center"><div><div className="font-medium">{transaction.reference}</div><div className="mt-1 text-xs text-muted-foreground">{date(transaction.date, lang)} · {transaction.method === "bank" ? copy.bank : copy.cash}</div></div><div className="font-mono font-semibold text-emerald-700">{money(transaction.amount, lang)}</div></div>) : <div className="text-sm text-muted-foreground">{copy.noTransactions}</div>}</div></section>
      <DialogFooter>{canMarkPaid && canRecord(payment) ? <Button onClick={() => onRecord(payment)}><BanknoteIcon />{copy.recordPayment}</Button> : null}</DialogFooter>
    </> : null}
  </DialogContent></Dialog>
}

function RequestDetailsDialog({ request, lang, onOpenChange }: { request: FinanceRequestSnapshot | null; lang: Locale; onOpenChange: (open: boolean) => void }) {
  const copy = financeCopy[lang]
  const financedTotal = request?.positions.reduce((sum, position) => sum + position.amount, 0) ?? 0
  return <Dialog open={Boolean(request)} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto sm:max-w-3xl">
    {request ? <>
      <DialogHeader><DialogTitle>{request.number}</DialogTitle><DialogDescription>{copy.requestPaymentExplanation}</DialogDescription></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-3"><InfoCard label={copy.applicant} value={request.applicant} /><InfoCard label={copy.department} value={request.department} /><InfoCard label={copy.financedAmount} value={money(financedTotal, lang)} /></div>
      <div className="rounded-xl border p-4"><div className="text-xs font-medium text-muted-foreground">{copy.purpose}</div><div className="mt-1 text-sm font-medium">{request.purpose}</div></div>
      <section><h3 className="text-sm font-semibold">{copy.financedPositions}</h3><div className="mt-3 grid gap-2">{request.positions.map((position, index) => <div key={`${request.id}-${position.name}`} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[2rem_minmax(0,1fr)_8rem_10rem] sm:items-center"><div className="flex size-7 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-semibold text-primary">{index + 1}</div><div><div className="font-medium">{position.name}</div><div className="mt-1 text-xs text-muted-foreground">{copy.requested}: {position.requestedQuantity} {position.unit}</div></div><div className="text-sm"><div className="text-xs text-muted-foreground">{copy.financed}</div><div className="mt-1 font-medium">{position.financedQuantity} {position.unit}</div></div><div className="text-sm sm:text-right"><div className="text-xs text-muted-foreground">{copy.amount}</div><div className="mt-1 font-mono font-semibold">{money(position.amount, lang)}</div></div></div>)}</div></section>
    </> : null}
  </DialogContent></Dialog>
}

function RecordPaymentDialog({ payment, lang, onOpenChange, onSubmit }: { payment: FinancePayment; lang: Locale; onOpenChange: (open: boolean) => void; onSubmit: (paymentId: string, amount: number, date: string, method: "bank" | "cash", reference: string) => Promise<void> }) {
  const copy = financeCopy[lang]
  const balance = financePaymentBalance(payment)
  const [amount, setAmount] = React.useState(String(balance))
  const [paymentDate, setPaymentDate] = React.useState("2026-08-24")
  const [method, setMethod] = React.useState<"bank" | "cash">("bank")
  const [reference, setReference] = React.useState("")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || value > balance) { setError(copy.invalidPayment.replace("{amount}", money(balance, lang))); return }
    setSaving(true)
    try {
      await onSubmit(payment.id, value, paymentDate, method, reference)
    } catch {
      setError(copy.invalidPayment.replace("{amount}", money(balance, lang)))
      setSaving(false)
    }
  }

  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><form onSubmit={submit} className="contents">
    <DialogHeader><DialogTitle>{copy.recordPayment}</DialogTitle><DialogDescription>{payment?.id} · {copy.availableBalance}: {money(balance, lang)}</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2"><Label htmlFor="finance-payment-amount">{copy.paymentAmount}</Label><Input id="finance-payment-amount" type="number" min="1" max={balance} value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
      <div className="grid gap-2"><Label htmlFor="finance-payment-date">{copy.paymentDate}</Label><Input id="finance-payment-date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></div>
      <div className="grid gap-2"><Label htmlFor="finance-payment-method">{copy.method}</Label><select id="finance-payment-method" className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" value={method} onChange={(event) => setMethod(event.target.value as "bank" | "cash")}><option value="bank">{copy.bank}</option><option value="cash">{copy.cash}</option></select></div>
      <div className="grid gap-2"><Label htmlFor="finance-payment-reference">{copy.reference}</Label><Input id="finance-payment-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="BANK-2026-..." /></div>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{copy.cancel}</Button><Button type="submit" disabled={saving}>{copy.savePayment}</Button></DialogFooter>
  </form></DialogContent></Dialog>
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-mono font-medium">{value}</dd></div> }
function InfoCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl border bg-muted/30 p-3"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon ? <span className="text-primary [&_svg]:size-4">{icon}</span> : null}{label}</div><div className="mt-2 break-words font-mono text-sm font-semibold">{value}</div></div> }
function canRecord(payment: FinancePayment) { return ["ready", "partial"].includes(payment.status) && financePaymentBalance(payment) > 0 }
function money(value: number, lang: Locale) { return new Intl.NumberFormat(localeCodes[lang], { style: "currency", currency: "UZS", maximumFractionDigits: 0 }).format(value) }
function date(value: string, lang: Locale) { return new Intl.DateTimeFormat(localeCodes[lang], { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`)) }
const localeCodes = { uz: "uz-UZ", ru: "ru-RU", tr: "tr-TR" } as const

const financeCopy = {
  uz: { title: "Moliya", description: "Bir qator — bitta shartnoma. Shartnoma bir nechta buyurtma pozitsiyalarini qamrab olishi mumkin.", contractTotal: "Shartnomalar summasi", inApproval: "Tasdiqlashda", readyToPay: "To‘lovga tayyor", actuallyPaid: "Amalda to‘langan", remaining: "To‘lov qoldig‘i", contracts: "shartnoma", includingPartial: "qisman to‘lovlar bilan", currentBalance: "joriy qoldiq", search: "To‘lov, shartnoma, firma yoki buyurtmani qidiring...", statusFilter: "To‘lov holati filtri", payment: "To‘lov", requests: "Buyurtmalar", supplier: "Yetkazib beruvchi / shartnoma", contractAmount: "Shartnoma summasi", paidAndBalance: "To‘langan / qoldiq", paymentStatus: "To‘lov holati", actions: "Amallar", contract: "Shartnoma", paid: "To‘langan", balance: "Qoldiq", viewDetails: "Tafsilotlarni ko‘rish", recordPayment: "To‘lovni qayd etish", details: "Batafsil", noPayments: "Mos to‘lovlar topilmadi", dueDate: "Reja sanasi", requestsAndPositions: "Buyurtmalar va pozitsiyalar", requestHint: "To‘lov nimaga asoslanganini ko‘rish uchun buyurtma raqamini bosing.", transactions: "To‘lovlar tarixi", noTransactions: "Hali to‘lov qayd etilmagan.", bank: "Bank", cash: "Naqd", requestPaymentExplanation: "Ushbu oynada aynan qaysi buyurtma pozitsiyalari bo‘yicha pul to‘lanayotgani ko‘rsatiladi.", applicant: "Arizachi", department: "Bo‘lim", financedAmount: "Moliyalashtirilgan summa", purpose: "Maqsad", financedPositions: "To‘lanayotgan pozitsiyalar", requested: "So‘ralgan", financed: "To‘lanadi", amount: "Summa", availableBalance: "Mavjud qoldiq", paymentAmount: "To‘lov summasi", paymentDate: "To‘lov sanasi", method: "Usul", reference: "Bank havolasi / to‘lov raqami", invalidPayment: "Summa noldan katta va {amount} dan oshmasligi kerak.", cancel: "Bekor qilish", savePayment: "To‘lovni saqlash", noReference: "Havolasiz", statuses: { all: "Barchasi", draft: "Qoralama", approval: "Tasdiqlashda", ready: "To‘lovga", partial: "Qisman", paid: "To‘langan" } },
  ru: { title: "Финансы", description: "Одна строка — один договор. Договор может включать позиции из нескольких заявок.", contractTotal: "Сумма договоров", inApproval: "На согласовании", readyToPay: "Готово к оплате", actuallyPaid: "Фактически оплачено", remaining: "Остаток к оплате", contracts: "договоров", includingPartial: "включая частичные оплаты", currentBalance: "текущий остаток", search: "Поиск: оплата, договор, фирма, заявка...", statusFilter: "Фильтр статуса оплаты", payment: "Оплата", requests: "Заявки", supplier: "Поставщик / договор", contractAmount: "Сумма договора", paidAndBalance: "Оплачено / остаток", paymentStatus: "Статус оплаты", actions: "Действия", contract: "Договор", paid: "Оплачено", balance: "Остаток", viewDetails: "Посмотреть детали", recordPayment: "Зафиксировать оплату", details: "Подробнее", noPayments: "Подходящие оплаты не найдены", dueDate: "Плановая дата", requestsAndPositions: "Заявки и позиции", requestHint: "Нажмите на номер заявки, чтобы увидеть основание оплаты.", transactions: "История оплат", noTransactions: "Оплаты ещё не зафиксированы.", bank: "Банк", cash: "Наличные", requestPaymentExplanation: "Здесь видно, по каким именно позициям заявки производится оплата.", applicant: "Заявитель", department: "Отдел", financedAmount: "Сумма финансирования", purpose: "Назначение", financedPositions: "Оплачиваемые позиции", requested: "Запрошено", financed: "Оплачивается", amount: "Сумма", availableBalance: "Доступный остаток", paymentAmount: "Сумма оплаты", paymentDate: "Дата оплаты", method: "Способ", reference: "Банковская ссылка / № платежа", invalidPayment: "Сумма должна быть больше нуля и не превышать {amount}.", cancel: "Отмена", savePayment: "Сохранить оплату", noReference: "без ссылки", statuses: { all: "Все", draft: "Черновики", approval: "На согласовании", ready: "К оплате", partial: "Частично", paid: "Оплачено" } },
  tr: { title: "Finans", description: "Her satır bir sözleşmedir. Bir sözleşme birden fazla sipariş kalemini kapsayabilir.", contractTotal: "Sözleşme toplamı", inApproval: "Onayda", readyToPay: "Ödemeye hazır", actuallyPaid: "Gerçekleşen ödeme", remaining: "Kalan ödeme", contracts: "sözleşme", includingPartial: "kısmi ödemeler dahil", currentBalance: "güncel bakiye", search: "Ödeme, sözleşme, firma veya sipariş ara...", statusFilter: "Ödeme durumu filtresi", payment: "Ödeme", requests: "Siparişler", supplier: "Tedarikçi / sözleşme", contractAmount: "Sözleşme tutarı", paidAndBalance: "Ödenen / kalan", paymentStatus: "Ödeme durumu", actions: "İşlemler", contract: "Sözleşme", paid: "Ödenen", balance: "Kalan", viewDetails: "Ayrıntıları görüntüle", recordPayment: "Ödemeyi kaydet", details: "Ayrıntılar", noPayments: "Eşleşen ödeme bulunamadı", dueDate: "Planlanan tarih", requestsAndPositions: "Siparişler ve kalemler", requestHint: "Ödemenin dayanağını görmek için sipariş numarasına tıklayın.", transactions: "Ödeme geçmişi", noTransactions: "Henüz ödeme kaydedilmedi.", bank: "Banka", cash: "Nakit", requestPaymentExplanation: "Burada ödemenin hangi sipariş kalemleri için yapıldığı gösterilir.", applicant: "Talep eden", department: "Departman", financedAmount: "Finanse edilen tutar", purpose: "Amaç", financedPositions: "Ödenen kalemler", requested: "Talep", financed: "Ödenecek", amount: "Tutar", availableBalance: "Kullanılabilir bakiye", paymentAmount: "Ödeme tutarı", paymentDate: "Ödeme tarihi", method: "Yöntem", reference: "Banka referansı / ödeme no", invalidPayment: "Tutar sıfırdan büyük ve {amount} değerini aşmamalıdır.", cancel: "İptal", savePayment: "Ödemeyi kaydet", noReference: "referans yok", statuses: { all: "Tümü", draft: "Taslak", approval: "Onayda", ready: "Ödenecek", partial: "Kısmi", paid: "Ödendi" } },
} as const
