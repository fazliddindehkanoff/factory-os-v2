import { notFound, redirect } from "next/navigation"

import { TelegramBootstrap } from "@/components/telegram/telegram-bootstrap"
import { isLocale } from "@/lib/i18n"

export default async function Page({ params, searchParams }: PageProps<"/[lang]/telegram">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const query = await searchParams
  const phone = typeof query.phone === "string" ? query.phone.trim() : ""
  if (phone) {
    const type = query.type === "web-app" ? "web-app" : "dashboard"
    const target = new URLSearchParams({ phone, lang, type })
    redirect(`/api/telegram/test-access?${target.toString()}`)
  }

  return <TelegramBootstrap lang={lang} />
}
