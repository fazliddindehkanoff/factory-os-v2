import { redirect } from "next/navigation"

export default async function LocalePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params
  redirect(`/${lang}/dashboard`)
}
