import type { ReactNode } from "react"

import { TelegramBottomNav } from "@/components/telegram/telegram-bottom-nav"
import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
}

export function TelegramShell({
  lang,
  copy,
  userName,
  title,
  subtitle,
  children,
}: {
  lang: Locale
  copy: TelegramCopy
  userName: string
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-muted/70 pb-24 [background:var(--tg-theme-secondary-bg-color,var(--muted))]">
      <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm [background:var(--tg-theme-bg-color,var(--background))]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{copy.appName}</p>
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm" aria-label={userName}>
            {initials(userName)}
          </div>
        </div>
      </header>
      <main id="telegram-main" className="mx-auto max-w-lg px-4 py-4">{children}</main>
      <TelegramBottomNav lang={lang} copy={copy} />
    </div>
  )
}
