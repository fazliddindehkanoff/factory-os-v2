"use client"
import Link from "next/link"
import { useParams } from "next/navigation"
import { isLocale } from "@/lib/i18n"
import { uxCopy } from "@/lib/ux-copy"
export default function NotFound() {
  const params = useParams(); const lang = typeof params.lang === "string" && isLocale(params.lang) ? params.lang : "uz"
  const title = lang === "ru" ? "Заявка недоступна" : lang === "tr" ? "Talep kullanılamıyor" : "Buyurtma mavjud emas yoki sizga ochilmagan"
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 p-6"><h1 className="text-xl font-semibold">{title}</h1><Link className="flex min-h-11 items-center justify-center rounded-lg border p-3" href={`/${lang}/telegram/orders`}>{uxCopy[lang].all}</Link></main>
}
