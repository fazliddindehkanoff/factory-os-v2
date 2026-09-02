import Script from "next/script"

import { TelegramWebAppBridge } from "@/components/telegram/telegram-web-app-bridge"

export default function TelegramLayout({ children }: LayoutProps<"/[lang]/telegram">) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="afterInteractive" />
      <TelegramWebAppBridge />
      {children}
    </>
  )
}
