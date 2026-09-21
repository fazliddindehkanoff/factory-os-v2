"use client"
import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

export function TelegramWebAppBridge() {
  const pathname = usePathname()
  const router = useRouter()
  React.useEffect(() => {
    const app = window.Telegram?.WebApp
    if (!app) return
    app.ready(); app.expand()
    if (app.isVersionAtLeast?.("6.1")) app.setHeaderColor?.("#1a2b4a")
    const back = () => {
      if (document.querySelector('[data-slot="dialog-content"][data-open]')) { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return }
      if (window.history.length > 1) router.back()
      else router.push(`/${pathname.split("/")[1]}/telegram/orders`)
    }
    const detail = /\/orders\/[^/]+/.test(pathname)
    const syncBackButton = () => {
      if (detail || document.querySelector('[data-slot="dialog-content"][data-open]')) app.BackButton?.show()
      else app.BackButton?.hide()
    }
    app.BackButton?.onClick(back)
    syncBackButton()
    const observer = new MutationObserver(syncBackButton)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-open"] })
    return () => { observer.disconnect(); app.BackButton?.offClick(back); app.BackButton?.hide() }
  }, [pathname, router])
  React.useEffect(() => {
    const refresh = () => {
      if (document.hidden || document.querySelector('[data-slot="dialog-content"][data-open]') || document.activeElement?.matches("input, textarea, [contenteditable=true]")) return
      router.refresh()
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("factory-os:notifications-changed", refresh)
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("factory-os:notifications-changed", refresh) }
  }, [router])
  return null
}
