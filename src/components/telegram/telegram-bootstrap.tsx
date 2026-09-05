"use client"

import * as React from "react"
import { CircleAlertIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react"

import type { Locale } from "@/lib/i18n"

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
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
  const [failed, setFailed] = React.useState(false)
  const labels = copy[lang]

  React.useEffect(() => {
    let cancelled = false
    let attempts = 0

    async function authenticate() {
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) {
        attempts += 1
        if (attempts < 30) window.setTimeout(authenticate, 100)
        else if (!cancelled) setFailed(true)
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: webApp.initData }),
        })
        if (!response.ok) throw new Error("Telegram authentication failed")
        const launchParams = new URLSearchParams(window.location.search)
        const requestedOrder = launchParams.get("order")
        const requestedComment = launchParams.get("comment")
        const target = requestedOrder && /^[a-zA-Z0-9_-]{1,128}$/.test(requestedOrder)
          ? `/${lang}/telegram/orders/${encodeURIComponent(requestedOrder)}${requestedComment && /^[a-zA-Z0-9_-]{1,128}$/.test(requestedComment) ? `?comment=${encodeURIComponent(requestedComment)}#order-comment-${encodeURIComponent(requestedComment)}` : ""}`
          : `/${lang}/telegram/orders`
        window.location.replace(target)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    void authenticate()
    return () => { cancelled = true }
  }, [lang])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#1a2b4a] px-6 py-12 text-[#1a1a2e]">
      <div className="w-full max-w-sm rounded-[18px] border border-white/10 bg-white p-7 text-center shadow-[0_24px_60px_-24px_rgba(4,10,24,0.65)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e8db0]">Factory OS</p>
        <div className="mx-auto mt-5 flex size-14 items-center justify-center rounded-[16px] bg-[#e7f1fb] text-[#2d7dd2]">
          {failed ? <CircleAlertIcon className="size-7" /> : <ShieldCheckIcon className="size-7" />}
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight">{failed ? labels.failed : labels.title}</h1>
        <p className="mt-2 text-[13px] leading-5 text-[#6b7280]">{failed ? labels.help : labels.body}</p>
        {!failed ? <LoaderCircleIcon className="mx-auto mt-5 size-5 animate-spin text-[#2d7dd2] motion-reduce:animate-none" aria-label={labels.body} /> : null}
      </div>
    </main>
  )
}
