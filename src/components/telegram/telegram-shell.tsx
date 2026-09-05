import type { ReactNode } from "react"

import { TelegramChrome } from "@/components/telegram/telegram-chrome"
import type { Locale } from "@/lib/i18n"
import type { TelegramCopy } from "@/lib/telegram-copy"
import { getTelegramNotifications } from "@/lib/telegram-orders"

export async function TelegramShell({
  lang,
  copy,
  userId,
  title,
  subtitle,
  hero,
  children,
}: {
  lang: Locale
  copy: TelegramCopy
  userId: string
  title: string
  subtitle?: string
  hero?: ReactNode
  children: ReactNode
}) {
  const notifications = await getTelegramNotifications(userId)
  const unreadCount = notifications.filter((notification) => !notification.readAt).length

  return (
    <TelegramChrome lang={lang} copy={copy} title={title} subtitle={subtitle} unreadCount={unreadCount} hero={hero}>
      {children}
    </TelegramChrome>
  )
}
