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
        webApp.setHeaderColor?.("#ffffff")
        webApp.setBackgroundColor?.("#f4f7fb")
      }
      try {
        const response = await fetch("/api/telegram/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: webApp.initData }),
        })
        if (!response.ok) throw new Error("Telegram authentication failed")
        const requestedOrder = new URLSearchParams(window.location.search).get("order")
        const target = requestedOrder && /^[a-zA-Z0-9_-]{1,128}$/.test(requestedOrder)
          ? `/${lang}/telegram/orders/${encodeURIComponent(requestedOrder)}`
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
    <main className="flex min-h-dvh items-center justify-center bg-muted px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border bg-background p-7 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {failed ? <CircleAlertIcon className="size-7" /> : <ShieldCheckIcon className="size-7" />}
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{failed ? labels.failed : labels.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{failed ? labels.help : labels.body}</p>
        {!failed ? <LoaderCircleIcon className="mx-auto mt-5 size-5 animate-spin text-primary" aria-label={labels.body} /> : null}
      </div>
    </main>
  )
}
