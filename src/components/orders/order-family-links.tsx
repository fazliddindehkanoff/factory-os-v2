"use client"

import Link from "next/link"
import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { useSettings } from "@/components/settings/settings-provider"
import type { Locale } from "@/lib/i18n"
import { canViewParentOrderLink, type OrderRecord } from "@/lib/orders"

export function OrderFamilyLinks({ order, lang }: { order: OrderRecord; lang: Locale }) {
  const { orders } = useOrders()
  const { data } = useSettings()
  const { roles } = useAuthorization()
  const children = orders.filter((item) => item.parentOrderId === order.id)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
  const copy = {
    uz: { parent: "Asosiy buyurtma va avvalgi muhokama", children: "Mustaqil buyurtmalar", sourcing: "Takliflar yig‘ilmoqda", price_check: "Rahbar tekshiruvi", director: "Direktor tasdig‘i", procurement_order: "Xarid qilish", warehouse_receipt: "Ombor qabuli", complete: "Yakunlangan", rejected: "Rad etilgan" },
    ru: { parent: "Исходная заявка и обсуждение", children: "Самостоятельные заказы", sourcing: "Сбор предложений", price_check: "Проверка руководителя", director: "Утверждение директора", procurement_order: "Оформление заказа", warehouse_receipt: "Приёмка склада", complete: "Завершён", rejected: "Отклонён" },
    tr: { parent: "Ana talep ve önceki görüşme", children: "Bağımsız siparişler", sourcing: "Teklif toplanıyor", price_check: "Yönetici incelemesi", director: "Direktör onayı", procurement_order: "Sipariş veriliyor", warehouse_receipt: "Depo kabulü", complete: "Tamamlandı", rejected: "Reddedildi" },
  }[lang]
  if (!order.parentOrderId && !children.length) return null
  if (order.parentOrderId && !canViewParentOrderLink(roles.map((role) => role.code))) return null
  return <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
    {order.parentOrderId ? <Link className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4" href={`/${lang}/orders?order=${encodeURIComponent(order.parentOrderId)}`}>
      {copy.parent}: {order.parentOrderNumber}
    </Link> : <>
      <h3 className="text-sm font-semibold">{copy.children}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {children.map((child) => <Link key={child.id} href={`/${lang}/orders?order=${encodeURIComponent(child.id)}`} className="flex min-h-16 flex-col gap-1 rounded-lg border bg-background p-3 text-sm hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <span className="font-mono font-semibold text-primary">{child.number}</span>
          <span>{data.users.find((user) => user.id === child.procurementSpecialistUserId)?.fullName}</span>
          <span className="text-xs text-muted-foreground">{child.status === "rejected" ? copy.rejected : copy[child.currentStep as keyof typeof copy] ?? child.currentStep} · {child.lines.length}</span>
        </Link>)}
      </div>
    </>}
  </section>
}
