"use client"

import { usePathname, useRouter } from "next/navigation"
import { BellIcon, CheckIcon, LanguagesIcon } from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { locales, type Locale, type Messages } from "@/lib/i18n"
import { formatWorkflowNotification } from "@/lib/orders"

const languageNames: Record<Locale, string> = {
  uz: "O‘zbekcha",
  ru: "Русский",
  tr: "Türkçe",
}

export function DashboardHeaderActions({
  lang,
  messages,
}: {
  lang: Locale
  messages: Messages
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser } = useAuthorization()
  const { notifications, markNotificationsRead } = useOrders()
  const userNotifications = notifications.filter((item) => item.userId === currentUser?.id)
  const unreadCount = userNotifications.filter((item) => !item.read).length

  function changeLanguage(locale: Locale) {
    const segments = pathname.split("/")
    segments[1] = locale
    router.push(segments.join("/"))
  }

  return (
    <div className="flex items-center gap-1 px-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={messages.language}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "uppercase",
          })}
        >
          <LanguagesIcon />
          {lang}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{messages.language}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {locales.map((locale) => (
              <DropdownMenuItem
                key={locale}
                onClick={() => changeLanguage(locale)}
              >
                <CheckIcon
                  className={locale === lang ? "opacity-100" : "opacity-0"}
                />
                {languageNames[locale]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={messages.notifications}
          className={buttonVariants({ variant: "ghost", size: "icon", className: "relative" })}
          onClick={markNotificationsRead}
        >
          <BellIcon />
          {unreadCount ? <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{messages.notifications}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {userNotifications.length ? <div className="max-h-80 overflow-y-auto p-1">{userNotifications.map((notification) => <DropdownMenuItem key={notification.id} className="block whitespace-normal px-2 py-2"><p className="text-xs font-semibold text-primary">{notification.orderNumber}</p><p className="mt-0.5 text-xs leading-relaxed">{formatWorkflowNotification(notification, lang)}</p></DropdownMenuItem>)}</div> : <p className="px-3 py-6 text-center text-sm text-muted-foreground">{messages.noNotifications}</p>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
