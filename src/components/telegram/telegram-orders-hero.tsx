import Link from "next/link"
import { AlertTriangleIcon, Clock3Icon, FileTextIcon } from "lucide-react"

import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import { cn } from "@/lib/utils"

export function TelegramOrdersHero({
  copy,
  lang,
  userName,
  roleNames,
  totalCount,
  waitingCount,
  urgentCount,
  activeShortcut,
}: {
  copy: TelegramCopy
  lang: Locale
  userName: string
  roleNames: string[]
  totalCount: number
  waitingCount: number
  urgentCount: number
  activeShortcut: "all" | "waiting" | "urgent" | null
}) {
  return (
    <section aria-label={copy.workOverview}>
      <div className="bg-[#1a2b4a] px-5 pb-12 pt-1 text-white">
        <div>
          <p className="text-[13px] font-medium text-[#9db0d6]">{copy.goodDay}</p>
          <h2 className="mt-1 truncate text-[25px] font-bold leading-tight tracking-[-0.025em]">{userName}</h2>
          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-[9px] bg-[#2d7dd2] px-3 py-1.5 text-xs font-semibold shadow-[0_6px_18px_-9px_rgba(45,125,210,0.9)]">
            <span className="size-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
            <span className="truncate">{roleNames.length ? roleNames.join(" · ") : copy.employee}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-8 grid grid-cols-3 gap-2.5 px-4">
        <HeroMetric href={`/${lang}/telegram/orders#orders`} icon={FileTextIcon} label={copy.totalOrders} value={totalCount} tone="blue" active={activeShortcut === "all"} />
        <HeroMetric href={`/${lang}/telegram/orders?scope=waiting#orders`} icon={Clock3Icon} label={copy.actionRequired} value={waitingCount} tone="amber" active={activeShortcut === "waiting"} />
        <HeroMetric href={`/${lang}/telegram/orders?urgency=urgent-group#orders`} icon={AlertTriangleIcon} label={copy.urgentOrders} value={urgentCount} tone="red" active={activeShortcut === "urgent"} />
      </div>
    </section>
  )
}

function HeroMetric({
  icon: Icon,
  label,
  value,
  tone,
  href,
  active,
}: {
  icon: typeof FileTextIcon
  label: string
  value: number
  tone: "blue" | "amber" | "red"
  href: string
  active: boolean
}) {
  const colors = {
    blue: { foreground: "#2d7dd2", background: "#e7f1fb" },
    amber: { foreground: "#d9820b", background: "#fcf0dd" },
    red: { foreground: "#e04434", background: "#fbe8e5" },
  }[tone]

  return (
    <Link
      href={href}
      scroll
      aria-current={active ? "page" : undefined}
      className={cn(
        "tg-card min-w-0 touch-manipulation rounded-[14px] border p-3 shadow-[0_1px_2px_rgba(16,30,60,0.05),0_8px_22px_-10px_rgba(16,30,60,0.18)] transition-[border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:scale-[0.97] motion-reduce:transition-none",
        active && "border-[#2d7dd2] shadow-[0_0_0_2px_rgba(45,125,210,0.14),0_8px_22px_-10px_rgba(16,30,60,0.18)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-7 items-center justify-center rounded-[9px]" style={{ color: colors.foreground, background: colors.background }}>
          <Icon className="size-3.5" strokeWidth={2.1} />
        </span>
        <span className="font-mono text-[24px] font-semibold leading-none tabular-nums">{value}</span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-7 text-[10px] font-semibold leading-3.5 text-[var(--tg-text-secondary)]">{label}</p>
    </Link>
  )
}
