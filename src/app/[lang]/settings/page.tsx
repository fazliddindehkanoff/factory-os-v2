import { redirect } from "next/navigation"

export default async function SettingsPage({
  params,
}: PageProps<"/[lang]/settings">) {
  const { lang } = await params
  redirect(`/${lang}/settings/positions`)
}
