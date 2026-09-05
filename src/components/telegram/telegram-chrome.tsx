"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BellIcon, MoonIcon, SunIcon } from "lucide-react"

import { TelegramBottomNav } from "@/components/telegram/telegram-bottom-nav"
import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"

type TelegramTheme = "light" | "dark"

export function TelegramChrome({
  lang,
  copy,
  title,
  subtitle,
  unreadCount,
  hero,
  children,
}: {
  lang: Locale
  copy: TelegramCopy
  title: string
  subtitle?: string
  unreadCount: number
  hero?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = React.useState<TelegramTheme>("light")

  React.useEffect(() => {
    const savedTheme = window.localStorage.getItem("factory-os-telegram-theme")
    const telegramTheme = (window.Telegram?.WebApp as { colorScheme?: TelegramTheme } | undefined)?.colorScheme
    const preferredTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : telegramTheme === "dark" ? "dark" : "light"
    const frame = window.requestAnimationFrame(() => setTheme(preferredTheme))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  React.useEffect(() => {
    window.localStorage.setItem("factory-os-telegram-theme", theme)
    const app = window.Telegram?.WebApp
    if (app?.isVersionAtLeast?.("6.1")) {
      app.setHeaderColor?.("#1a2b4a")
      app.setBackgroundColor?.(theme === "dark" ? "#101827" : "#f4f6f9")
    }
  }, [theme])

  function changeLanguage(nextLang: Locale) {
    const nextPath = pathname.replace(/^\/(uz|ru|tr)(?=\/|$)/, `/${nextLang}`)
    router.push(`${nextPath}${window.location.search}${window.location.hash}`)
  }

  return (
    <div className="telegram-app min-h-dvh [font-family:var(--font-geist-sans),system-ui,sans-serif]" data-theme={theme}>
      <div className="tg-phone mx-auto flex min-h-dvh max-w-[560px] flex-col overflow-x-hidden shadow-[0_0_36px_rgba(15,23,42,0.08)]">
        <header className="sticky top-0 z-40 bg-[#1a2b4a] pt-[env(safe-area-inset-top)] text-white">
          <div className="flex min-h-[84px] items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9db0d6]">{copy.appName}</p>
              <h1 className="mt-1 truncate text-[19px] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
              {subtitle ? <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-[#b8c6df]">{subtitle}</p> : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <label className="relative flex h-11 min-w-14 items-center rounded-[12px] bg-white/10 ring-1 ring-inset ring-white/10 focus-within:ring-2 focus-within:ring-white/70">
                <span className="pointer-events-none absolute left-2.5 text-[11px] font-bold uppercase" aria-hidden="true">{lang}</span>
                <select
                  aria-label={copy.language}
                  value={lang}
                  onChange={(event) => changeLanguage(event.target.value as Locale)}
                  className="h-11 w-full cursor-pointer appearance-none bg-transparent pl-2.5 pr-6 text-transparent outline-none"
                >
                  <option value="uz">UZ</option>
                  <option value="ru">RU</option>
                  <option value="tr">TR</option>
                </select>
                <svg className="pointer-events-none absolute right-2 size-3 text-[#c9d5e8]" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </label>

              <Link
                href={`/${lang}/telegram/notifications`}
                aria-label={`${copy.notifications}${unreadCount ? `: ${unreadCount} ${copy.unread}` : ""}`}
                className="relative flex size-11 touch-manipulation items-center justify-center rounded-[12px] bg-white/10 text-[#dce5f4] ring-1 ring-inset ring-white/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:bg-white/20"
              >
                <BellIcon className="size-[19px]" strokeWidth={1.9} />
                {unreadCount ? (
                  <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#1a2b4a] bg-[#e45745] px-1 font-mono text-[9px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>

              <button
                type="button"
                aria-label={copy.switchTheme}
                aria-pressed={theme === "dark"}
                onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
                className="flex size-11 touch-manipulation items-center justify-center rounded-[12px] bg-white/10 text-[#dce5f4] ring-1 ring-inset ring-white/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:bg-white/20"
              >
                {theme === "dark" ? <SunIcon className="size-[19px]" strokeWidth={1.9} /> : <MoonIcon className="size-[19px]" strokeWidth={1.9} />}
              </button>
            </div>
          </div>
        </header>
        {hero}
        <main id="telegram-main" className="flex-1 px-4 pb-28 pt-4">
          {children}
        </main>
        <TelegramBottomNav lang={lang} copy={copy} />
      </div>
    </div>
  )
}
