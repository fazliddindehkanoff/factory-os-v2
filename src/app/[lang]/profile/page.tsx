import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { ProfilePage } from "@/components/profile/profile-page"
import { isLocale, messages } from "@/lib/i18n"

export default async function Page({ params }: PageProps<"/[lang]/profile">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = messages[lang]

  return (
    <AppShell lang={lang} messages={dict} currentLabel={dict.profile}>
      <ProfilePage lang={lang} messages={dict} />
    </AppShell>
  )
}
