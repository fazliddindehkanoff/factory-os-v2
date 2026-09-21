"use client"

import { useAuthorization } from "@/components/auth/use-authorization"
import { useSettings } from "@/components/settings/settings-provider"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { messages, type Locale } from "@/lib/i18n"
import { getOrderActionView, isOrderWaitingForUser } from "@/lib/orders"
import { uxCopy } from "@/lib/ux-copy"
import { OrderDetailsDialog } from "./orders-list"
import { useOrders } from "./orders-provider"

/** Render inside the originating Dialog so Back restores its scroll and state. */
export function LinkedOrderDialog({ id, lang, onClose }: { id: string; lang: Locale; onClose: () => void }) {
  const { orders, storageReady, syncError, approveOrder, rejectOrder, submitWarehouseReport } = useOrders()
  const { data } = useSettings()
  const { can, currentUserId } = useAuthorization()
  const stored = orders.find((item) => item.id === id)
  const order = stored ? getOrderActionView(stored, currentUserId) : undefined
  if (!order) return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent>
    <DialogHeader><DialogTitle>{messages[lang].orderNumber}</DialogTitle><DialogDescription>{!storageReady ? uxCopy[lang].loading : syncError ? uxCopy[lang].stale : lang === "ru" ? "Заявка недоступна или удалена." : lang === "tr" ? "Talep kullanılamıyor veya silinmiş." : "Buyurtma mavjud emas yoki ko‘rish huquqi yo‘q."}</DialogDescription></DialogHeader>
  </DialogContent></Dialog>
  return <OrderDetailsDialog order={order} lang={lang} messages={messages[lang]} data={data} open onOpenChange={(open) => { if (!open) onClose() }}
    isCurrentAssignee={isOrderWaitingForUser(order, currentUserId, data.warehouses.find((item) => item.id === order.warehouseId)?.responsibleUserId)}
    canApprove={can("approvals.approve") || (order.currentStep === "procurement_order" && can("procurement.quote")) || (order.currentStep === "warehouse_receipt" && can("warehouse.receive"))}
    canReject={can("approvals.reject") && !["procurement_order", "warehouse_receipt"].includes(order.currentStep)} canWarehouseReport={can("warehouse.check_stock")}
    canRevise={order.status === "rejected" && !order.financeCancellation && order.createdByUserId === currentUserId}
    onApprove={approveOrder} onReject={rejectOrder} onWarehouseReport={submitWarehouseReport} />
}
