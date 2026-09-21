import { notFound } from "next/navigation"
import { FinanceWorkspace } from "@/components/finance/finance-workspace"
import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireSession } from "@/lib/auth/session"
import { isLocale, messages } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireSession(lang)
  return <TelegramShell lang={lang} copy={telegramCopy[lang]} userId={session.userId} title={messages[lang].finance}>
    <FinanceWorkspace lang={lang} webApp />
  </TelegramShell>
}
