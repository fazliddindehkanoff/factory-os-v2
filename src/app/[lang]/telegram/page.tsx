import { notFound } from "next/navigation"

import { TelegramBootstrap } from "@/components/telegram/telegram-bootstrap"
import { isLocale } from "@/lib/i18n"

export default async function Page({ params }: PageProps<"/[lang]/telegram">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()

  return <TelegramBootstrap lang={lang} />
}
