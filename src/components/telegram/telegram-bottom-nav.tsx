"use client"

import * as React from "react"
import Link, { useLinkStatus } from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BellIcon, ClipboardListIcon, Clock3Icon, LoaderCircleIcon, SettingsIcon } from "lucide-react"

import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import { cn } from "@/lib/utils"

export function TelegramBottomNav({ lang, copy }: { lang: Locale; copy: TelegramCopy }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnScope = new URLSearchParams(searchParams.get("return") ?? "").get("scope")
  const waitingContext = searchParams.get("scope") === "waiting" || searchParams.get("from") === "waiting" || returnScope === "waiting"
  const items = [
    { href: `/${lang}/telegram/orders`, label: copy.orders, icon: ClipboardListIcon, active: pathname.includes("/orders") && !waitingContext },
    { href: `/${lang}/telegram/orders?scope=waiting`, label: copy.waiting, icon: Clock3Icon, active: pathname.includes("/orders") && waitingContext },
    { href: `/${lang}/telegram/notifications`, label: copy.notifications, icon: BellIcon, active: pathname.includes("/notifications") },
    { href: `/${lang}/telegram/settings`, label: copy.settings, icon: SettingsIcon, active: pathname.includes("/settings") },
  ]

  React.useEffect(() => {
    router.prefetch(`/${lang}/telegram/orders`)
    router.prefetch(`/${lang}/telegram/orders?scope=waiting`)
    router.prefetch(`/${lang}/telegram/notifications`)
    router.prefetch(`/${lang}/telegram/settings`)
  }, [lang, router])

  return (
    <nav aria-label="Telegram Mini App" className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[560px] border-t border-[var(--tg-border)] bg-[color-mix(in_srgb,var(--tg-card)_95%,transparent)] pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-2px_14px_-8px_rgba(16,30,60,0.22)] backdrop-blur-md">
      <div className="grid h-16 grid-cols-4 px-2">
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
              <TelegramNavItem icon={Icon} label={item.label} active={item.active} />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function TelegramNavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof ClipboardListIcon
  label: string
  active: boolean
}) {
  const { pending } = useLinkStatus()

  return (
    <>
      <span className="relative flex size-[22px] items-center justify-center" aria-hidden="true">
        <Icon className={cn("size-[22px]", pending && "opacity-0")} strokeWidth={active ? 2.35 : 1.9} />
        {pending ? <LoaderCircleIcon className="absolute size-5 animate-spin motion-reduce:animate-none" strokeWidth={2.2} /> : null}
      </span>
      <span>{label}</span>
    </>
  )
}
