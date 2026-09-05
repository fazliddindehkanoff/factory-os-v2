import Link from "next/link"
import { BellIcon, ChevronRightIcon, MailCheckIcon } from "lucide-react"
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
  const unreadCount = notifications.filter((notification) => !notification.readAt).length
  const localeTag = lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"

  return (
    <TelegramShell lang={lang} copy={copy} userId={session.userId} title={copy.notifications}>
      <section aria-label={copy.notifications} className="grid grid-cols-2 gap-2.5">
        <div className="tg-card rounded-[14px] border p-3.5 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#e7f1fb] text-[#2d7dd2]"><BellIcon className="size-4" /></span>
          <p className="mt-3 font-mono text-[25px] font-semibold leading-none text-[var(--tg-text)]">{notifications.length}</p>
          <p className="mt-2 text-[11px] font-semibold text-[var(--tg-text-secondary)]">{copy.notifications}</p>
        </div>
        <div className="tg-card rounded-[14px] border p-3.5 shadow-[0_1px_2px_rgba(16,30,60,0.05)]">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#fcf0dd] text-[#d9820b]"><MailCheckIcon className="size-4" /></span>
          <p className="mt-3 font-mono text-[25px] font-semibold leading-none text-[var(--tg-text)]">{unreadCount}</p>
          <p className="mt-2 text-[11px] font-semibold text-[var(--tg-text-secondary)]">{copy.unread}</p>
        </div>
      </section>

      <div className="mb-3 mt-6 flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--tg-text-secondary)]">{copy.notifications}</h2>
        <span className="font-mono text-[11px] font-semibold text-[var(--tg-text-muted)]">{notifications.length}</span>
      </div>

      {notifications.length ? <div className="grid gap-2.5">{notifications.map((notification) => {
        const unread = !notification.readAt
        const content = <><div className="flex items-start gap-2.5">{unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#2d7dd2]" aria-label={copy.unread} /> : null}<p className="min-w-0 flex-1 text-[14px] font-bold leading-5 text-[var(--tg-text)]">{notification.title}</p>{notification.orderId ? <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-[var(--tg-text-muted)]" /> : null}</div><p className="mt-1.5 text-[13px] leading-5 text-[var(--tg-text-secondary)]">{notification.body}</p><time className="mt-2.5 block font-mono text-[10px] font-medium text-[var(--tg-text-muted)]">{new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</time></>
        return notification.orderId
          ? <Link key={notification.id} href={`/${lang}/telegram/orders/${encodeURIComponent(notification.orderId)}${notification.commentId ? `?comment=${encodeURIComponent(notification.commentId)}#order-comment-${encodeURIComponent(notification.commentId)}` : ""}`} className="tg-card min-h-24 touch-manipulation rounded-[14px] border border-l-[3px] p-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)] transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:opacity-80" style={{ borderLeftColor: unread ? "#2d7dd2" : "var(--tg-border)" }}>{content}</Link>
          : <article key={notification.id} className="tg-card rounded-[14px] border border-l-[3px] p-4 shadow-[0_1px_2px_rgba(16,30,60,0.05)]" style={{ borderLeftColor: unread ? "#2d7dd2" : "var(--tg-border)" }}>{content}</article>
      })}</div> : <div className="tg-card flex min-h-72 flex-col items-center justify-center rounded-[14px] border border-dashed px-8 text-center"><span className="flex size-[76px] items-center justify-center rounded-[22px] bg-[#edf1f6] text-[#8b97aa]"><BellIcon className="size-8" /></span><h2 className="mt-4 text-base font-bold text-[var(--tg-text)]">{copy.noNotifications}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--tg-text-secondary)]">{copy.noNotificationsBody}</p></div>}
    </TelegramShell>
  )
}
