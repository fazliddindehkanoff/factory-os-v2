"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { useSettings } from "@/components/settings/settings-provider"
import { groupPaymentLines } from "@/lib/order-payment-groups"
import { paymentLineKey, type OrderPaymentLine } from "@/lib/order-payment"
import type { OrderRecord } from "@/lib/orders"
import type { Locale } from "@/lib/i18n"
import { getLocalizedTitle } from "@/lib/settings"
import { orderPaymentCopy } from "./order-payment-copy"

export type PlacementSelection = {
  lines: OrderPaymentLine[]
  selectedLineIds: string[]
  onSelectionChange: (ids: string[]) => void
}

export function OrderPlacementSelection({ order, lang, lines, selectedLineIds, onSelectionChange }: PlacementSelection & { order: OrderRecord; lang: Locale }) {
  const { data } = useSettings()
  const copy = orderPaymentCopy[lang]
  const groups = groupPaymentLines(lines)
  function toggle(ids: string[], checked: boolean) {
    onSelectionChange(checked ? [...new Set([...selectedLineIds, ...ids])] : selectedLineIds.filter((id) => !ids.includes(id)))
  }
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{copy.selectionHint}</p>
    {groups.map((group) => {
      const ids = [...new Set(group.lines.map((line) => line.orderLineId))]
      const count = ids.filter((id) => selectedLineIds.includes(id)).length
      return <section key={group.supplierId} aria-label={group.supplierName} className="min-w-0 rounded-lg border border-primary/25 bg-background p-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
          <Checkbox checked={count === ids.length} indeterminate={count > 0 && count < ids.length} aria-label={`${copy.selectSupplier}: ${group.supplierName}`} onCheckedChange={(checked) => toggle(ids, checked === true)} />
          <span className="min-w-0 flex-1 break-words">{group.supplierName}</span>
          <span className="text-xs text-muted-foreground">{count}/{ids.length}</span>
        </label>
        <div className="mt-2 space-y-2">{group.lines.map((line) => {
          const productId = order.lines.find((item) => item.id === line.orderLineId)?.productId
          const product = data.products.find((item) => item.id === productId)
          const title = product ? getLocalizedTitle(product, lang) : productId ?? line.orderLineId
          return <label key={paymentLineKey(line)} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-muted/40 p-3">
            <Checkbox checked={selectedLineIds.includes(line.orderLineId)} aria-label={`${copy.selectPosition}: ${title}`} onCheckedChange={(checked) => toggle([line.orderLineId], checked === true)} />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block break-words text-sm font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{line.quantity} × {line.unitPrice.toLocaleString()} UZS · {line.method === "cash" ? copy.cash : copy.bank}</span>
              <span className="block font-mono text-sm">{line.amount.toLocaleString()} UZS</span>
            </span>
          </label>
        })}</div>
      </section>
    })}
    <p role="status" className="text-sm font-medium">{copy.selected}: {new Set(lines.filter((line) => selectedLineIds.includes(line.orderLineId)).map((line) => line.orderLineId)).size}</p>
  </div>
}
