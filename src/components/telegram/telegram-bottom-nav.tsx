"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { BellIcon, ClipboardListIcon, Clock3Icon } from "lucide-react"

import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import { cn } from "@/lib/utils"

export function TelegramBottomNav({ lang, copy }: { lang: Locale; copy: TelegramCopy }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const waitingContext = searchParams.get("scope") === "waiting" || searchParams.get("from") === "waiting"
  const items = [
    { href: `/${lang}/telegram/orders`, label: copy.orders, icon: ClipboardListIcon, active: pathname.includes("/orders") && !waitingContext },
    { href: `/${lang}/telegram/orders?scope=waiting`, label: copy.waiting, icon: Clock3Icon, active: pathname.includes("/orders") && waitingContext },
    { href: `/${lang}/telegram/notifications`, label: copy.notifications, icon: BellIcon, active: pathname.includes("/notifications") },
  ]

  return (
    <nav aria-label="Telegram Mini App" className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[560px] border-t border-[#dfe5ee] bg-white/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-2px_14px_-8px_rgba(16,30,60,0.22)] backdrop-blur-md">
      <div className="grid h-16 grid-cols-3 px-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-12 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:bg-[#e7f1fb]",
                item.active ? "font-bold text-[#2d7dd2]" : "text-[#8b97aa]",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={item.active ? 2.35 : 1.9} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
