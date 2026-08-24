import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { SettingsWorkspace } from "@/components/settings/settings-workspace"
import { isLocale, messages } from "@/lib/i18n"
import {
  getSectionTitle,
  isSettingsSection,
  settingsSections,
} from "@/lib/settings"

export function generateStaticParams() {
  return settingsSections.map((section) => ({ section }))
}

export default async function SettingsSectionPage({
  params,
}: PageProps<"/[lang]/settings/[section]">) {
  const { lang, section } = await params
  if (!isLocale(lang) || !isSettingsSection(section)) notFound()

  const dict = messages[lang]
  const title = getSectionTitle(section, dict)

  return (
    <AppShell
      lang={lang}
      messages={dict}
      parentLabel={dict.settings}
      parentHref={`/${lang}/settings/positions`}
      currentLabel={title}
    >
      <SettingsWorkspace section={section} lang={lang} messages={dict} />
    </AppShell>
  )
}
