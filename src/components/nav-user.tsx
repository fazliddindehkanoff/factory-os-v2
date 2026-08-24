"use client"

import {
  BadgeCheckIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  CreditCardIcon,
  LogOutIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { useSettings } from "@/components/settings/settings-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Messages } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n"
import { getLocalizedTitle } from "@/lib/settings"

export function NavUser({
  lang,
  messages,
}: {
  lang: Locale
  messages: Messages
}) {
  const { isMobile } = useSidebar()
  const { currentUser, currentUserId, roles, setCurrentUserId } = useAuthorization()
  const { data } = useSettings()
  const user = {
    name: currentUser?.fullName ?? "Factory OS",
    email: currentUser?.username ?? "",
    avatar: "",
  }
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase()
  const previewLabel = lang === "ru" ? "Проверить доступ" : lang === "tr" ? "Erişimi önizle" : "Kirishni tekshirish"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {roles.map((role) => getLocalizedTitle(role, lang)).join(", ")}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ShieldCheckIcon />
                {previewLabel}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{previewLabel}</DropdownMenuLabel>
                  {data.users.map((candidate) => {
                    const candidateRoles = data.roles
                      .filter((role) => candidate.roleIds.includes(role.id))
                      .map((role) => getLocalizedTitle(role, lang))
                      .join(", ")
                    return (
                      <DropdownMenuItem
                        key={candidate.id}
                        onClick={() => setCurrentUserId(candidate.id)}
                        className="items-start py-2"
                      >
                        <CheckIcon className={candidate.id === currentUserId ? "mt-0.5 opacity-100" : "mt-0.5 opacity-0"} />
                        <span className="grid min-w-0 gap-0.5">
                          <span className="truncate font-medium">{candidate.fullName}</span>
                          <span className="truncate text-xs text-muted-foreground">{candidateRoles}</span>
                        </span>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <SparklesIcon />
                {messages.upgrade}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheckIcon />
                {messages.account}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                {messages.billing}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOutIcon />
              {messages.logOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
