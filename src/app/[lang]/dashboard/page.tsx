import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { DashboardOverview } from "@/components/dashboard/dashboard-overview"
import { isLocale, messages } from "@/lib/i18n"

export default async function Page({ params }: PageProps<"/[lang]/dashboard">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = messages[lang]

  return (
    <AppShell
      lang={lang}
      messages={dict}
      currentLabel={dict.dashboard}
    >
      <DashboardOverview lang={lang} messages={dict} />
    </AppShell>
  )
}
