"use client"

import * as React from "react"
import { CircleAlertIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react"

import Link from "next/link"
import { uxCopy } from "@/lib/ux-copy"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        colorScheme?: "light" | "dark"
        onEvent?: (event: string, callback: () => void) => void
        offEvent?: (event: string, callback: () => void) => void
        BackButton?: { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick: (callback: () => void) => void }
        initData: string
        initDataUnsafe?: { user?: { language_code?: string } }
        ready: () => void
        expand: () => void
        isVersionAtLeast?: (version: string) => boolean
        setHeaderColor?: (color: string) => void
        setBackgroundColor?: (color: string) => void
      }
    }
  }
}

const copy = {
  uz: { title: "Factory OS ochilmoqda", body: "Telegram hisobingiz tekshirilmoqda.", failed: "Kirish tasdiqlanmadi", help: "Botga qayting, /start buyrug‘ini yuboring va telefon raqamingizni tasdiqlang." },
  ru: { title: "Открываем Factory OS", body: "Проверяем ваш Telegram-аккаунт.", failed: "Вход не подтверждён", help: "Вернитесь к боту, отправьте /start и подтвердите номер телефона." },
  tr: { title: "Factory OS açılıyor", body: "Telegram hesabınız doğrulanıyor.", failed: "Giriş doğrulanamadı", help: "Bota dönün, /start gönderin ve telefon numaranızı doğrulayın." },
} satisfies Record<Locale, { title: string; body: string; failed: string; help: string }>

export function TelegramBootstrap({ lang }: { lang: Locale }) {
  const [failed, setFailed] = React.useState("")
  const [attempt, setAttempt] = React.useState(0)
  const [next, setNext] = React.useState(`/${lang}/telegram/orders`)
  const labels = copy[lang]

  React.useEffect(() => {
    let cancelled = false
    let attempts = 0
    let timer: number | undefined
    const controller = new AbortController()
    const launchParams = new URLSearchParams(window.location.search)
    const requestedOrder = launchParams.get("order")
    const requestedComment = launchParams.get("comment")
    const returnPath = launchParams.get("next")
    const target = requestedOrder && /^[a-zA-Z0-9_-]{1,128}$/.test(requestedOrder)
      ? `/${lang}/telegram/orders/${encodeURIComponent(requestedOrder)}${requestedComment && /^[a-zA-Z0-9_-]{1,128}$/.test(requestedComment) ? `?comment=${encodeURIComponent(requestedComment)}#order-comment-${encodeURIComponent(requestedComment)}` : ""}`
      : returnPath?.startsWith(`/${lang}/telegram/`) && !returnPath.includes("\\") ? returnPath : `/${lang}/telegram/orders`
    queueMicrotask(() => { if (!cancelled) setNext(target) })

    async function authenticate() {
      if (cancelled) return
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) {
        attempts += 1
        if (attempts < 30) timer = window.setTimeout(authenticate, 100)
        else if (!cancelled) setFailed("outside")
        return
      }
      webApp.ready()
      webApp.expand()
      if (webApp.isVersionAtLeast?.("6.1")) {
        webApp.setHeaderColor?.("#1a2b4a")
        webApp.setBackgroundColor?.("#f4f6f9")
      }
      try {
        const response = await fetch("/api/telegram/auth", {
          method: "POST",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: webApp.initData, lang }),
        })
        if (!response.ok) {
          if (!cancelled) setFailed(response.status === 403 ? "unlinked" : response.status === 401 ? "expired" : "network")
          return
        }
        if (cancelled) return
        window.location.replace(target)
      } catch {
        if (!cancelled) setFailed("network")
      }
    }

    void authenticate()
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort() }
  }, [lang, attempt])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#1a2b4a] px-6 py-12 text-[#1a1a2e]">
      <div className="w-full max-w-sm rounded-[18px] border border-white/10 bg-white p-7 text-center shadow-[0_24px_60px_-24px_rgba(4,10,24,0.65)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e8db0]">Factory OS</p>
        <div className="mx-auto mt-5 flex size-14 items-center justify-center rounded-[16px] bg-[#e7f1fb] text-[var(--tg-link,#2365a9)]">
          {failed ? <CircleAlertIcon className="size-7" /> : <ShieldCheckIcon className="size-7" />}
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight">{failed ? labels.failed : labels.title}</h1>
        <p className="mt-2 text-[13px] leading-5 text-[#6b7280]">{failed ? recovery[lang][failed as keyof typeof recovery.uz] : labels.body}</p>
        {failed ? <div className="mt-5 grid gap-3"><Button onClick={() => { setFailed(""); setAttempt((value) => value + 1) }}>{uxCopy[lang].retry}</Button><Link className="text-sm underline" href={`/${lang}/login?next=${encodeURIComponent(next)}`}>{uxCopy[lang].openWeb}</Link><p className="text-xs text-slate-600">{labels.help}</p></div> : null}
        {!failed ? <LoaderCircleIcon className="mx-auto mt-5 size-5 animate-spin text-[var(--tg-link,#2365a9)] motion-reduce:animate-none" aria-label={labels.body} /> : null}
      </div>
    </main>
  )
}

const recovery = {
  uz: { outside: "Ilovani Telegram bot ichidan oching yoki web hisobingiz bilan kiring.", unlinked: "Telegram hisobingiz ishchi hisobiga bog‘lanmagan.", expired: "Telegram sessiyasi eskirgan. Ilovani bot orqali qayta oching.", network: "Ulanish amalga oshmadi. Internetni tekshirib, qayta urinib ko‘ring." },
  ru: { outside: "Откройте приложение через Telegram-бота или войдите в веб-аккаунт.", unlinked: "Telegram-аккаунт не связан с рабочим аккаунтом.", expired: "Сессия Telegram истекла. Откройте приложение заново через бота.", network: "Не удалось подключиться. Проверьте интернет и повторите попытку." },
  tr: { outside: "Uygulamayı Telegram botundan açın veya web hesabınızla giriş yapın.", unlinked: "Telegram hesabınız iş hesabına bağlı değil.", expired: "Telegram oturumu sona erdi. Uygulamayı bottan tekrar açın.", network: "Bağlanılamadı. İnternetinizi kontrol edip tekrar deneyin." },
}
