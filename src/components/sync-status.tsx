"use client"
import Link from "next/link"
import { useOrders } from "@/components/orders/orders-provider"
import { useProcurement } from "@/components/procurement/procurement-provider"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import { uxCopy } from "@/lib/ux-copy"
export function SyncStatus({ lang }: { lang: Locale }) {
  const orders = useOrders(); const procurement = useProcurement(); const copy = uxCopy[lang]
  if (!orders.storageReady || !procurement.storageReady) return <p role="status" className="px-4 py-2 text-sm text-muted-foreground">{copy.loading}</p>
  if (!orders.syncError && !procurement.syncError) return null
  return <div role="alert" className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-3 text-sm"><p>{copy.stale}</p><Button variant="outline" onClick={() => window.dispatchEvent(new Event("factory-os:orders-changed"))}>{copy.retry}</Button><Link href={`/${lang}/login?next=${encodeURIComponent(typeof window === "undefined" ? `/${lang}/orders` : window.location.pathname + window.location.search)}`} className="underline">{copy.reauth}</Link></div>
}
