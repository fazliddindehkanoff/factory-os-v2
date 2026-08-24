import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { OrderWizard } from "@/components/orders/order-wizard"
import { isLocale, messages } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function Page({ params }: PageProps<"/[lang]/orders/new">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = messages[lang]

  return (
    <AppShell
      lang={lang}
      messages={dict}
      parentLabel={dict.orders}
      parentHref={`/${lang}/orders`}
      currentLabel={dict.newOrder}
    >
      <OrderWizard lang={lang} messages={dict} today={new Date().toISOString().slice(0, 10)} />
    </AppShell>
  )
}
