import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { ProcurementWorkspace } from "@/components/procurement/procurement-workspace"
import { isLocale, messages } from "@/lib/i18n"

export default async function Page({ params }: PageProps<"/[lang]/procurement">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = messages[lang]

  return (
    <AppShell lang={lang} messages={dict} currentLabel={dict.procurement}>
      <ProcurementWorkspace lang={lang} messages={dict} />
    </AppShell>
  )
}
