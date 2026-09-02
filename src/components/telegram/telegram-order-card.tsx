import Link from "next/link"
import { CalendarDaysIcon, ChevronRightIcon, CircleDotIcon, PackageIcon, UserRoundIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import type { TelegramOrderSummary } from "@/lib/telegram-orders"
import { cn } from "@/lib/utils"

const localeTag = { uz: "uz-UZ", ru: "ru-RU", tr: "tr-TR" } as const

export function TelegramOrderCard({ order, lang, copy }: { order: TelegramOrderSummary; lang: Locale; copy: TelegramCopy }) {
  const urgent = order.urgency === "urgent" || order.urgency === "critical"
  return (
    <Link
      href={`/${lang}/telegram/orders/${encodeURIComponent(order.id)}`}
      className="group relative block min-h-44 touch-manipulation overflow-hidden rounded-2xl border bg-background p-4 pl-5 shadow-sm transition-colors active:bg-accent/60"
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", urgent ? "bg-destructive" : order.waitingForMe ? "bg-amber-500" : "bg-primary")} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-wide text-primary">{order.number}</p>
          <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-5">{order.purpose}</h2>
        </div>
        <ChevronRightIcon className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-active:translate-x-0.5" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline">{copy.status[order.status]}</Badge>
        <Badge variant={urgent ? "destructive" : "secondary"}>{copy.urgencyLabels[order.urgency]}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5"><UserRoundIcon className="size-3.5 shrink-0" /><span className="truncate">{order.applicant}</span></span>
        <span className="flex items-center gap-1.5"><PackageIcon className="size-3.5 shrink-0" />{order.itemCount} {copy.items}</span>
        <span className="flex items-center gap-1.5"><CalendarDaysIcon className="size-3.5 shrink-0" />{new Intl.DateTimeFormat(localeTag[lang], { day: "2-digit", month: "short" }).format(new Date(`${order.expectedDate}T00:00:00`))}</span>
        <span className="flex min-w-0 items-center gap-1.5"><CircleDotIcon className="size-3.5 shrink-0" /><span className="truncate">{order.department}</span></span>
      </div>
    </Link>
  )
}
