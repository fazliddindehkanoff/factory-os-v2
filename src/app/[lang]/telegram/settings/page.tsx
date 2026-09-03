import { notFound } from "next/navigation"

import { TelegramSettings } from "@/components/telegram/telegram-settings"
import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"
import { getTelegramUserProfile } from "@/lib/telegram-orders"

export default async function Page({ params }: PageProps<"/[lang]/telegram/settings">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireSession(lang)
  const copy = telegramCopy[lang]
  const profile = await getTelegramUserProfile(session.userId, lang)
  if (!profile) notFound()

  return (
    <TelegramShell
      lang={lang}
      copy={copy}
      userName={profile.fullName}
      title={copy.settings}
      subtitle={copy.settingsSubtitle}
    >
      <TelegramSettings copy={copy} initialProfile={profile} />
    </TelegramShell>
  )
}
