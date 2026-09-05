import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { OrdersList } from "@/components/orders/orders-list"
import { isLocale, messages } from "@/lib/i18n"

export default async function Page({ params, searchParams }: PageProps<"/[lang]/orders">) {
  const { lang } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const dict = messages[lang]

  return (
    <AppShell lang={lang} messages={dict} currentLabel={dict.orderList}>
      <OrdersList
        key={`${typeof query.order === "string" ? query.order : ""}:${typeof query.comment === "string" ? query.comment : ""}`}
        lang={lang}
        messages={dict}
      />
    </AppShell>
  )
}
