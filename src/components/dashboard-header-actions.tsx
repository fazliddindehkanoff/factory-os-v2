"use client"

import { usePathname, useRouter } from "next/navigation"
import { BellIcon, CheckIcon, LanguagesIcon } from "lucide-react"

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
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <BellIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{messages.notifications}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {messages.noNotifications}
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
