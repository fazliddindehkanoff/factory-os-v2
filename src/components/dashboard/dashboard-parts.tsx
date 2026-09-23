import type { Locale } from "@/lib/i18n"
import type { OrderRecord, UrgencyLevel } from "@/lib/orders"
import { getLocalizedTitle, type SettingsData } from "@/lib/settings"
import { cn } from "@/lib/utils"

export type DashboardData = Pick<SettingsData, "users" | "products" | "order-purposes">

/** Waiting-time colour scale shared by the flow map and queues. */
export function waitTone(days: number) {
  if (days < 2) return { bar: "bg-emerald-500/80", chip: "bg-emerald-50 text-emerald-700" }
  if (days <= 5) return { bar: "bg-amber-500/85", chip: "bg-amber-50 text-amber-800" }
  return { bar: "bg-red-500/85", chip: "bg-red-50 text-red-700" }
}

export const urgencyTone: Record<UrgencyLevel, string> = {
  critical: "bg-red-600",
  urgent: "bg-orange-500",
  high: "bg-amber-400",
  normal: "bg-slate-300",
}

export function UrgencyDot({ urgency }: { urgency: UrgencyLevel }) {
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
      {urgency === "critical" ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500/60 motion-reduce:hidden" /> : null}
      <span className={cn("relative inline-flex size-2.5 rounded-full", urgencyTone[urgency])} />
    </span>
  )
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join("") || "?"
}

const avatarPalette = ["bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-emerald-100 text-emerald-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-teal-100 text-teal-800"]

export function avatarTone(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return avatarPalette[hash % avatarPalette.length]
}

export function AvatarStack({ userIds, data, max = 3 }: { userIds: string[]; data: DashboardData; max?: number }) {
  if (!userIds.length) return null
  const users = userIds.map((id) => ({ id, name: data.users.find((user) => user.id === id)?.fullName ?? id }))
  return (
    <span className="flex items-center justify-center -space-x-1.5" title={users.map((user) => user.name).join(", ")}>
      {users.slice(0, max).map((user) => (
        <span key={user.id} className={cn("flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-card", avatarTone(user.id))}>
          {initials(user.name)}
        </span>
      ))}
      {users.length > max ? <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">+{users.length - max}</span> : null}
      <span className="sr-only">{users.map((user) => user.name).join(", ")}</span>
    </span>
  )
}

/** "Product title +2" — enough to recognise an order at a glance. */
export function orderSummary(order: OrderRecord, data: DashboardData, lang: Locale) {
  const product = data.products.find((item) => item.id === order.lines[0]?.productId)
  const purpose = data["order-purposes"].find((item) => item.id === order.purposeId)
  const title = product ? getLocalizedTitle(product, lang) : purpose ? getLocalizedTitle(purpose, lang) : order.number
  return order.lines.length > 1 ? `${title} +${order.lines.length - 1}` : title
}
