import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { FinanceWorkspace } from "@/components/finance/finance-workspace"
import { isLocale, messages } from "@/lib/i18n"

export default async function Page({ params }: PageProps<"/[lang]/finance">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = messages[lang]

  return (
    <AppShell lang={lang} messages={dict} currentLabel={dict.finance}>
      <FinanceWorkspace lang={lang} />
    </AppShell>
  )
}
