"use client"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { OrderDetailsDialog } from "@/components/orders/orders-list"
import { useOrders } from "@/components/orders/orders-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { useAuthorization } from "@/components/auth/use-authorization"
import { Button } from "@/components/ui/button"
import { getOrderActionView, isOrderWaitingForUser } from "@/lib/orders"
import { messages, type Locale } from "@/lib/i18n"
import { uxCopy } from "@/lib/ux-copy"
export function TelegramOrderActions({ id, lang }: { id: string; lang: Locale }) {
  const [open, setOpen] = React.useState(false)
  const { orders, storageReady, approveOrder, rejectOrder, submitWarehouseReport } = useOrders()
  const { data } = useSettings(); const { can, currentUserId } = useAuthorization(); const router = useRouter()
  const stored = orders.find((item) => item.id === id)
  const order = stored ? getOrderActionView(stored, currentUserId) : undefined
  const complete = (ok: boolean) => { if (ok) { setOpen(false); router.refresh() }; return ok }
  return <section className="my-4 grid gap-3">
    <Button className="min-h-12" disabled={!storageReady || !order} onClick={() => setOpen(true)}>{!storageReady ? uxCopy[lang].loading : uxCopy[lang].actions}</Button>
    <Link className="flex min-h-11 items-center justify-center text-sm text-primary underline" href={`/${lang}/orders?order=${encodeURIComponent(id)}&return=${encodeURIComponent(`/${lang}/telegram/orders/${id}`)}`}>{uxCopy[lang].openWeb}</Link>
    {open && order ? <OrderDetailsDialog showComments={false} order={order} lang={lang} messages={messages[lang]} data={data} open onOpenChange={setOpen}
      isCurrentAssignee={isOrderWaitingForUser(order, currentUserId, data.warehouses.find((item) => item.id === order.warehouseId)?.responsibleUserId)}
      canApprove={can("approvals.approve") || (order.currentStep === "procurement_order" && can("procurement.quote")) || (order.currentStep === "warehouse_receipt" && can("warehouse.receive"))}
      canReject={can("approvals.reject") && !["procurement_order", "warehouse_receipt"].includes(order.currentStep)} canWarehouseReport={can("warehouse.check_stock")}
      canRevise={order.status === "rejected" && !order.financeCancellation && order.createdByUserId === currentUserId}
      onApprove={async (id, form) => { const ok = await approveOrder(id, form); if (form) { if (ok) router.refresh(); return ok }; return complete(ok) }} onReject={async (id) => complete(await rejectOrder(id))} onWarehouseReport={async (id, quantities) => complete(await submitWarehouseReport(id, quantities))} /> : null}
  </section>
}
