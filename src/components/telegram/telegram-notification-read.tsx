"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useOrders } from "@/components/orders/orders-provider"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import { uxCopy } from "@/lib/ux-copy"
export function TelegramNotificationRead({ lang, id, href, children, className, style }: { lang: Locale; id?: string; href?: string; children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { markNotificationsRead } = useOrders()
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState(false)
  async function read() {
    if (pending) return
    setPending(true)
    const ok = await markNotificationsRead(id ? [id] : undefined)
    setPending(false); setError(!ok)
    if (ok) { if (href) router.push(href); router.refresh() }
  }
  return <>{error ? <p role="alert" className="text-sm text-red-600">{uxCopy[lang].markFailed}</p> : null}{href ? <Link href={href} className={className} style={style} aria-busy={pending} onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey) return; event.preventDefault(); void read() }}>{children}</Link> : <Button variant="outline" disabled={pending} onClick={() => void read()}>{uxCopy[lang].markAll}</Button>}</>
}
