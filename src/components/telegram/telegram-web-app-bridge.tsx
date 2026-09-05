"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

export function TelegramWebAppBridge() {
  const pathname = usePathname()

  React.useEffect(() => {
    const app = window.Telegram?.WebApp
    if (!app) return
    app.ready()
    app.expand()
    if (app.isVersionAtLeast?.("6.1")) {
      app.setHeaderColor?.("#1a2b4a")
    }
  }, [pathname])

  return null
}
