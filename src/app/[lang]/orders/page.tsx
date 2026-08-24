import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { OrdersList } from "@/components/orders/orders-list"
import { isLocale, messages } from "@/lib/i18n"

export default async function Page({ params }: PageProps<"/[lang]/orders">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = messages[lang]

  return (
    <AppShell lang={lang} messages={dict} currentLabel={dict.orderList}>
      <OrdersList lang={lang} messages={dict} />
    </AppShell>
  )
}
