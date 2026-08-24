import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { notFound } from "next/navigation"

import { TooltipProvider } from "@/components/ui/tooltip"
import { SettingsProvider } from "@/components/settings/settings-provider"
import { OrdersProvider } from "@/components/orders/orders-provider"
import { ProcurementProvider } from "@/components/procurement/procurement-provider"
import { isLocale, locales } from "@/lib/i18n"

import "../globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Factory OS",
    template: "%s · Factory OS",
  },
  description: "Factory operations management workspace",
}

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params

  if (!isLocale(lang)) notFound()

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <SettingsProvider>
            <OrdersProvider>
              <ProcurementProvider>{children}</ProcurementProvider>
            </OrdersProvider>
          </SettingsProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
