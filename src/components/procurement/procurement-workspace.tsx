"use client"

import Link from "next/link"
import { ArrowRightIcon, ClipboardListIcon } from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { useProcurement } from "@/components/procurement/procurement-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { Locale, Messages } from "@/lib/i18n"
import type { ProcurementStage } from "@/lib/procurement"
import { getLocalizedTitle } from "@/lib/settings"
import { cn } from "@/lib/utils"

export function ProcurementWorkspace({ lang, messages }: { lang: Locale; messages: Messages }) {
  const { can, currentUser } = useAuthorization()
  const { orders } = useOrders()
  const { data } = useSettings()
  const { cases, quotations } = useProcurement()
  const copy = procurementOverviewCopy(lang)
  const isSpecialist = currentUser?.roleIds.includes("role-procurement_manager") ?? false

  if (!can("procurement.view")) {
    return <AccessDenied lang={lang} permissions={["procurement.view"]} />
  }

  const visibleCases = isSpecialist
    ? cases.filter((item) => item.assigneeId === currentUser?.id)
    : cases

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-5 px-4 pb-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{messages.procurement}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <ClipboardListIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">{copy.ordersAreWorkspace}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.openOrderHint}</p>
        </div>
      </div>

      <section className="grid gap-3" aria-label={messages.procurementQueue}>
        {visibleCases.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{messages.noProcurementOrders}</div>
        ) : visibleCases.map((procurementCase) => {
          const order = orders.find((item) => item.id === procurementCase.orderId)
          if (!order) return null
          const assignee = data.users.find((item) => item.id === procurementCase.assigneeId)
          const offerCount = quotations.filter((item) => item.procurementCaseId === procurementCase.id).length
          const products = order.lines
            .filter((line) => line.fulfillmentStatus === "needs_procurement")
            .map((line) => data.products.find((item) => item.id === line.productId))
            .filter(Boolean)
            .map((product) => product ? getLocalizedTitle(product, lang) : "")
            .join(", ")
          return (
            <article key={procurementCase.id} className="grid min-w-0 gap-4 rounded-xl border bg-card p-4 shadow-xs md:grid-cols-[minmax(0,1.4fr)_minmax(12rem,.7fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{order.number}</span>
                  <StageBadge stage={procurementCase.stage} copy={copy} />
                </div>
                <p className="mt-2 break-words text-sm text-muted-foreground">{products || "—"}</p>
              </div>
              <div className="min-w-0 text-sm">
                <p className="text-xs text-muted-foreground">{messages.procurementSpecialist}</p>
                <p className="mt-1 truncate font-medium">{assignee?.fullName ?? copy.notAssigned}</p>
                <p className="mt-1 text-xs text-muted-foreground">{offerCount} {copy.offers}</p>
              </div>
              <Link href={`/${lang}/orders?order=${encodeURIComponent(order.id)}`} className={cn(buttonVariants({ variant: "outline" }), "w-full md:w-auto")}>
                {copy.openOrder}
                <ArrowRightIcon />
              </Link>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function StageBadge({ stage, copy }: { stage: ProcurementStage; copy: ReturnType<typeof procurementOverviewCopy> }) {
  const variant = stage === "approved" ? "default" : stage === "changes_requested" ? "destructive" : stage === "head_review" ? "secondary" : "outline"
  return <Badge variant={variant}>{copy.stages[stage]}</Badge>
}

function procurementOverviewCopy(lang: Locale) {
  if (lang === "ru") return {
    description: "Краткий обзор закупочных заявок.", ordersAreWorkspace: "Все действия теперь выполняются в заявке", openOrderHint: "Откройте заказ, чтобы назначить специалиста, добавить предложение или проверить цены.", openOrder: "Открыть заказ", notAssigned: "Не назначен", offers: "предложений",
    stages: { awaiting_assignment: "Ожидает назначения", collecting_offers: "Сбор предложений", head_review: "Проверка руководителя", changes_requested: "На доработке", approved: "Предложение одобрено" },
  }
  if (lang === "tr") return {
    description: "Satın alma siparişlerinin kısa özeti.", ordersAreWorkspace: "Tüm işlemler artık sipariş içinde yapılır", openOrderHint: "Uzman atamak, teklif eklemek veya fiyatları incelemek için siparişi açın.", openOrder: "Siparişi aç", notAssigned: "Atanmadı", offers: "teklif",
    stages: { awaiting_assignment: "Atama bekliyor", collecting_offers: "Teklif toplanıyor", head_review: "Yönetici incelemesi", changes_requested: "Yeniden çalışılıyor", approved: "Teklif onaylandı" },
  }
  return {
    description: "Xarid buyurtmalarining qisqa ko‘rinishi.", ordersAreWorkspace: "Barcha amallar endi buyurtma ichida bajariladi", openOrderHint: "Mutaxassis biriktirish, taklif qo‘shish yoki narxlarni tekshirish uchun buyurtmani oching.", openOrder: "Buyurtmani ochish", notAssigned: "Biriktirilmagan", offers: "taklif",
    stages: { awaiting_assignment: "Biriktirish kutilmoqda", collecting_offers: "Takliflar yig‘ilmoqda", head_review: "Rahbar tekshiruvi", changes_requested: "Qayta ishlanmoqda", approved: "Taklif tasdiqlandi" },
  }
}
