"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { PaymentAction, PaymentCorrection, PaymentRequest } from "@/lib/finance-workflow"
import type { FinanceCopy } from "./finance-copy"

export function FinanceActionDialog({ action, payments, copy, onClose, onSubmit }: {
  action: PaymentAction; payments: PaymentRequest[]; copy: FinanceCopy; onClose: () => void
  onSubmit: (comment: string, correction?: PaymentCorrection) => Promise<void>
}) {
  const [comment, setComment] = React.useState("")
  const [correction, setCorrection] = React.useState<PaymentCorrection>({ method: payments[0].method, dueDate: payments[0].dueDate, contractNumber: payments[0].contractNumber })
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const required = ["return", "cancel", "resubmit"].includes(action)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (required && !comment.trim()) { setError(copy.required); return }
    setBusy(true); setError("")
    try { await onSubmit(comment, action === "resubmit" ? correction : undefined); onClose() }
    catch (error) { setError(error instanceof Error ? error.message : copy.error) }
    finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>{copy.actions[action]} · {payments.length} {copy.count}</DialogTitle>
        <DialogDescription>{action === "cancel" ? copy.cancelWarning : action === "paid" ? copy.paidWarning : action === "return" ? copy.returnWarning : action === "resubmit" ? copy.correction : copy.approveWarning}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <ul className="max-h-32 overflow-y-auto rounded-lg border p-3 text-sm">{payments.map((payment) => <li key={payment.id} className="py-1 break-words">{payment.orderNumber} · {payment.supplierName} · {copy[payment.kind]} · {payment.amount.toLocaleString()} UZS</li>)}</ul>
        {action === "resubmit" ? <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="finance-method">{copy.method}</Label><select id="finance-method" className="h-10 rounded-lg border bg-background px-3" value={correction.method} onChange={(event) => setCorrection({ ...correction, method: event.target.value as "bank" | "cash" })}><option value="bank">{copy.bank}</option><option value="cash">{copy.cash}</option></select></div>
          <div className="grid gap-2"><Label htmlFor="finance-due">{copy.dueDate}</Label><Input id="finance-due" type="date" required={payments[0].kind === "balance"} value={correction.dueDate} onChange={(event) => setCorrection({ ...correction, dueDate: event.target.value })} /></div>
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="finance-contract">{copy.contract}</Label><Input id="finance-contract" maxLength={150} value={correction.contractNumber} onChange={(event) => setCorrection({ ...correction, contractNumber: event.target.value })} /></div>
        </div> : null}
        <div className="grid gap-2"><Label htmlFor="finance-comment">{copy.comment}{required ? " *" : ""}</Label><Textarea id="finance-comment" required={required} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} /></div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{copy.close}</Button><Button type="submit" disabled={busy} variant={action === "cancel" ? "destructive" : "default"}>{busy ? copy.loading : copy.confirm}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
