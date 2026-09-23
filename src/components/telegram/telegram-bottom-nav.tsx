"use client"

import * as React from "react"
import Link, { useLinkStatus } from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BanknoteIcon, ClipboardListIcon, Clock3Icon, HouseIcon, LoaderCircleIcon, SettingsIcon } from "lucide-react"
import { useAuthorization } from "@/components/auth/use-authorization"
import { messages } from "@/lib/i18n"

import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import { cn } from "@/lib/utils"

const homeLabel = { uz: "Bosh sahifa", ru: "Главная", tr: "Ana sayfa" } as const

export function TelegramBottomNav({ lang, copy }: { lang: Locale; copy: TelegramCopy }) {
  const { canViewFinance } = useAuthorization()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnScope = new URLSearchParams(searchParams.get("return") ?? "").get("scope")
  const waitingContext = searchParams.get("scope") === "waiting" || searchParams.get("from") === "waiting" || returnScope === "waiting"
  const items = [
    { href: `/${lang}/telegram/home`, label: homeLabel[lang], icon: HouseIcon, active: pathname.endsWith("/telegram/home") },
    { href: `/${lang}/telegram/orders`, label: copy.orders, icon: ClipboardListIcon, active: pathname.includes("/orders") && !waitingContext },
    { href: `/${lang}/telegram/orders?scope=waiting`, label: copy.waiting, icon: Clock3Icon, active: pathname.includes("/orders") && waitingContext },
    ...(canViewFinance ? [{ href: `/${lang}/telegram/finance`, label: messages[lang].finance, icon: BanknoteIcon, active: pathname.includes("/finance") }] : []),
    { href: `/${lang}/telegram/settings`, label: copy.settings, icon: SettingsIcon, active: pathname.includes("/settings") },
  ]

  React.useEffect(() => {
    router.prefetch(`/${lang}/telegram/orders`)
    router.prefetch(`/${lang}/telegram/orders?scope=waiting`)
    router.prefetch(`/${lang}/telegram/home`)
    router.prefetch(`/${lang}/telegram/settings`)
  }, [lang, router])

  return (
    <nav aria-label="Telegram Mini App" className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[560px] border-t border-[var(--tg-border)] bg-[color-mix(in_srgb,var(--tg-card)_95%,transparent)] pb-[max(env(safe-area-inset-bottom),var(--tg-content-safe-area-inset-bottom,0px),0.5rem)] shadow-[0_-2px_14px_-8px_rgba(16,30,60,0.22)] backdrop-blur-md">
      <div className={cn("grid h-16 px-2", canViewFinance ? "grid-cols-5" : "grid-cols-4")}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-12 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl text-[12px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:bg-[#e7f1fb]",
                item.active ? "font-bold bg-[var(--tg-card-muted)] text-[var(--tg-link)]" : "text-[var(--tg-text-secondary)]",
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
      <span className="max-w-full text-center leading-tight [overflow-wrap:anywhere]">{label}</span>
    </>
  )
}
