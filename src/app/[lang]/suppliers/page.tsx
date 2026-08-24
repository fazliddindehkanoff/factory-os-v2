import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { SuppliersWorkspace } from "@/components/procurement/suppliers-workspace"
import { isLocale, messages } from "@/lib/i18n"

export default async function Page({ params }: PageProps<"/[lang]/suppliers">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = messages[lang]

  return (
    <AppShell lang={lang} messages={dict} currentLabel={dict.suppliers}>
      <SuppliersWorkspace lang={lang} messages={dict} />
    </AppShell>
  )
}
