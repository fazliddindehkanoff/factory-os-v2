"use client"
import Link from "next/link"
import { useParams } from "next/navigation"
import { isLocale } from "@/lib/i18n"
import { uxCopy } from "@/lib/ux-copy"
export default function TelegramError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams(); const lang = typeof params.lang === "string" && isLocale(params.lang) ? params.lang : "uz"
  const copy = uxCopy[lang]
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 p-6"><h1 className="text-xl font-semibold">Factory OS</h1><p role="alert">{copy.stale}</p><button className="min-h-11 rounded-lg border p-3" onClick={retry}>{copy.retry}</button><Link className="p-3 text-center underline" href={`/${lang}/telegram/orders`}>{copy.all}</Link></main>
}
