import Link from "next/link"
import { BellIcon } from "lucide-react"
import { notFound } from "next/navigation"

import { TelegramShell } from "@/components/telegram/telegram-shell"
import { requireSession } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { telegramCopy } from "@/lib/telegram-copy"
import { getTelegramNotifications } from "@/lib/telegram-orders"

export default async function Page({ params }: PageProps<"/[lang]/telegram/notifications">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const session = await requireSession(lang)
  const copy = telegramCopy[lang]
  const notifications = await getTelegramNotifications(session.userId)

  return (
    <TelegramShell lang={lang} copy={copy} userName={session.fullName} title={copy.notifications}>
      {notifications.length ? <div className="grid gap-2">{notifications.map((notification) => {
        const content = <><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-primary">{notification.title}</p>{!notification.readAt ? <span className="mt-1 size-2 rounded-full bg-primary" aria-label="Unread" /> : null}</div><p className="mt-1 text-sm leading-6">{notification.body}</p><time className="mt-2 block text-[11px] text-muted-foreground">{new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</time></>
        return notification.orderId
          ? <Link key={notification.id} href={`/${lang}/telegram/orders/${encodeURIComponent(notification.orderId)}`} className="min-h-24 touch-manipulation rounded-2xl border bg-background p-4 shadow-sm active:bg-accent">{content}</Link>
          : <article key={notification.id} className="rounded-2xl border bg-background p-4 shadow-sm">{content}</article>
      })}</div> : <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed bg-background px-8 text-center"><BellIcon className="size-9 text-primary" /><h2 className="mt-4 text-base font-semibold">{copy.noNotifications}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.noNotificationsBody}</p></div>}
    </TelegramShell>
  )
}
