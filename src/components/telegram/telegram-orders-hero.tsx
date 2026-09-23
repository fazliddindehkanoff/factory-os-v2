import Link from "next/link"

import { dashboardCopy } from "@/components/dashboard/dashboard-copy"
import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import { cn } from "@/lib/utils"

export type TelegramHomeShortcut = "all" | "active" | "late" | "urgent" | "waiting" | null

const labels = {
  uz: { active: "Faol", late: "Kechikayotgan", urgent: "Shoshilinch" },
  ru: { active: "Активные", late: "Просроченные", urgent: "Срочные" },
  tr: { active: "Aktif", late: "Geciken", urgent: "Acil" },
}

/** Compact greeting plus the three numbers that need attention; each one filters the list below. */
export function TelegramOrdersHero({ copy, lang, userName, roleNames, hour, activeCount, lateCount, urgentCount, activeShortcut, compact = false }: {
  copy: TelegramCopy
  lang: Locale
  userName: string
  roleNames: string[]
  hour: number
  activeCount: number
  lateCount: number
  urgentCount: number
  activeShortcut: TelegramHomeShortcut
  /** Filters only — the greeting lives on the home page. */
  compact?: boolean
}) {
  const text = labels[lang]
  const stats = [
    { key: "active" as const, label: text.active, value: activeCount, href: `/${lang}/telegram/orders?scope=active#orders`, tone: "text-white" },
    { key: "late" as const, label: text.late, value: lateCount, href: `/${lang}/telegram/orders?scope=late#orders`, tone: lateCount ? "text-[#ff8a7a]" : "text-white" },
    { key: "urgent" as const, label: text.urgent, value: urgentCount, href: `/${lang}/telegram/orders?urgency=urgent-group#orders`, tone: urgentCount ? "text-[#ffc56b]" : "text-white" },
  ]
  return (
    <section aria-label={copy.workOverview} className={cn("relative overflow-hidden bg-[#1a2b4a] px-5 pb-5 text-white", compact ? "pt-2" : "pt-1")}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[#2d7dd2]/35 blur-3xl" />
      <div className="relative">
        {!compact ? <>
          <p className="text-[13px] font-medium text-[#9db0d6]">{dashboardCopy[lang].greeting(hour)},</p>
          <h2 className="mt-0.5 truncate text-[24px] font-bold leading-tight tracking-[-0.02em]">{userName}</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(roleNames.length ? roleNames : [copy.employee]).map((role) => (
              <span key={role} className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-[#dce5f4] ring-1 ring-inset ring-white/15">{role}</span>
            ))}
          </div>
        </> : null}
        <nav aria-label={copy.workOverview} className={cn("grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl bg-white/[0.07] ring-1 ring-inset ring-white/12", !compact && "mt-4")}>
          {stats.map((stat) => {
            const active = activeShortcut === stat.key
            return (
              <Link
                key={stat.key}
                href={stat.href}
                scroll
                aria-current={active ? "page" : undefined}
                className={cn("relative touch-manipulation px-3 py-3 text-left transition-colors active:bg-white/10", active && "bg-white/10")}
              >
                <span className={cn("block font-mono text-[26px] font-semibold leading-none tabular-nums", stat.tone)}>{stat.value}</span>
                <span className="mt-1.5 block truncate text-[11px] font-semibold text-[#9db0d6]">{stat.label}</span>
                {active ? <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#5aa9ff]" /> : null}
              </Link>
            )
          })}
        </nav>
      </div>
    </section>
  )
}
