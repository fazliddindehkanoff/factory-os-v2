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
  const items = [
    { href: `/${lang}/telegram/orders`, label: copy.orders, icon: ClipboardListIcon, active: pathname.includes("/orders") && searchParams.get("scope") !== "waiting" },
    { href: `/${lang}/telegram/orders?scope=waiting`, label: copy.waiting, icon: Clock3Icon, active: pathname.includes("/orders") && searchParams.get("scope") === "waiting" },
    { href: `/${lang}/telegram/notifications`, label: copy.notifications, icon: BellIcon, active: pathname.includes("/notifications") },
  ]

  return (
    <nav aria-label="Telegram Mini App" className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-sm">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-3 px-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-12 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors active:bg-accent",
                item.active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={item.active ? 2.4 : 2} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
