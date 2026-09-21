"use client"

import { Input } from "@/components/ui/input"
import type { Locale } from "@/lib/i18n"
import { roundMoney } from "@/lib/order-payment"
import type { SupplierPaymentGroup } from "@/lib/order-payment-groups"
import { orderPaymentCopy } from "./order-payment-copy"

export type SupplierPaymentDraft = SupplierPaymentGroup & { file?: File }

export function SupplierPaymentFields({ group, lang, onChange }: {
  group: SupplierPaymentDraft; lang: Locale; onChange: (patch: Partial<SupplierPaymentDraft>) => void
}) {
  const copy = orderPaymentCopy[lang]
  return <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
    <label className="grid min-w-0 gap-1 text-xs sm:col-span-3">{copy.inn}
      <Input required maxLength={64} readOnly={group.innLocked} value={group.supplierInn} placeholder={copy.innRequired} onChange={(event) => onChange({ supplierInn: event.target.value })} />
      <span className="text-muted-foreground">{group.innLocked ? copy.innLocked : copy.innOnce}</span>
    </label>
    <label className="grid min-w-0 gap-1 text-xs">{copy.method}
      <select value={group.method} onChange={(event) => onChange({ method: event.target.value as SupplierPaymentDraft["method"] })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="bank">{copy.bank}</option><option value="cash">{copy.cash}</option>
        <option value="original">{copy.originalMethods}</option>
      </select>
    </label>
    <label className="grid min-w-0 gap-1 text-xs">{copy.percent}
      <Input type="number" min={0} max={100} step="0.01" required value={group.prepaidPercent} onChange={(event) => { const percent = Number(event.target.value); onChange({ prepaidPercent: percent, prepaidAmount: roundMoney(group.amount * percent / 100) }) }} />
    </label>
    <label className="grid min-w-0 gap-1 text-xs">{copy.advance}
      <Input type="number" min={0} max={group.amount} step="0.01" required value={group.prepaidAmount} onChange={(event) => { const amount = Number(event.target.value); onChange({ prepaidAmount: amount, prepaidPercent: roundMoney(amount / group.amount * 100) }) }} />
    </label>
    <label className="grid min-w-0 gap-1 text-xs">{copy.due}
      <Input type="date" required={group.prepaidAmount < group.amount} value={group.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} />
    </label>
    <label className="grid min-w-0 gap-1 text-xs">{copy.contract}
      <Input maxLength={150} placeholder={copy.optional} value={group.contractNumber} onChange={(event) => onChange({ contractNumber: event.target.value })} />
    </label>
    <label className="grid min-w-0 gap-1 text-xs">{copy.file}
      <Input type="file" className="text-xs" onChange={(event) => onChange({ file: event.target.files?.[0] })} />
    </label>
    <p className="text-xs text-muted-foreground sm:col-span-3">{copy.remaining}: <span className="font-mono tabular-nums">{roundMoney(group.amount - group.prepaidAmount).toLocaleString()} UZS</span></p>
  </div>
}
