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
  hero,
  children,
}: {
  lang: Locale
  copy: TelegramCopy
  userName: string
  title: string
  subtitle?: string
  hero?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-[#c9d2df] text-[#1a1a2e] [font-family:var(--font-geist-sans),system-ui,sans-serif]">
      <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col overflow-x-hidden bg-[#f4f6f9] shadow-[0_0_36px_rgba(15,23,42,0.08)]">
        <header className="sticky top-0 z-40 bg-[#1a2b4a] pt-[env(safe-area-inset-top)] text-white">
          <div className="flex min-h-[88px] items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9db0d6]">{copy.appName}</p>
              <h1 className="mt-1 truncate text-[20px] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
              {subtitle ? <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#b8c6df]">{subtitle}</p> : null}
            </div>
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-white/10 text-sm font-bold text-white ring-1 ring-inset ring-white/10"
              aria-label={userName}
              title={userName}
            >
              {initials(userName)}
            </div>
          </div>
        </header>
        {hero}
        <main
          id="telegram-main"
          className="flex-1 px-4 pb-28 pt-4"
        >
          {children}
        </main>
        <TelegramBottomNav lang={lang} copy={copy} />
      </div>
    </div>
  )
}
