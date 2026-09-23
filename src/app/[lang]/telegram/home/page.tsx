import { notFound } from "next/navigation"

import { TelegramHome, TelegramHomeHero } from "@/components/telegram/telegram-home"
import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireTelegramSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"
import { getTelegramDashboard, getTelegramUserProfile } from "@/lib/telegram-orders"

const telegramHomeTitle = { uz: "Bosh sahifa", ru: "Главная", tr: "Ana sayfa" } as const

export default async function Page({ params }: PageProps<"/[lang]/telegram/home">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireTelegramSession(lang, `/${lang}/telegram/home`)
  const copy = telegramCopy[lang]
  const [model, profile] = await Promise.all([
    getTelegramDashboard(session.userId, lang),
    getTelegramUserProfile(session.userId, lang),
  ])
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", hourCycle: "h23" }).format(new Date()))

  return (
    <TelegramShell
      lang={lang}
      copy={copy}
      userId={session.userId}
      title={telegramHomeTitle[lang]}
      hero={<TelegramHomeHero model={model} lang={lang} copy={copy} userName={profile?.fullName ?? session.fullName} hour={hour} />}
    >
      <TelegramHome model={model} lang={lang} />
    </TelegramShell>
  )
}
