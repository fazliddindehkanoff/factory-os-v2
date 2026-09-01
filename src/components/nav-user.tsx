"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  UserRoundIcon,
} from "lucide-react"

import { logoutAction } from "@/app/[lang]/login/actions"
import { useAuthorization } from "@/components/auth/use-authorization"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  const { currentUser, roles } = useAuthorization()
  const [avatarVersion, setAvatarVersion] = React.useState(0)
  React.useEffect(() => {
    const refreshAvatar = () => setAvatarVersion((current) => current + 1)
    window.addEventListener("factory-os-profile-photo-updated", refreshAvatar)
    return () => window.removeEventListener("factory-os-profile-photo-updated", refreshAvatar)
  }, [])
  const user = {
    name: currentUser?.fullName ?? "Factory OS",
    email: currentUser?.username ?? "",
    avatar: `/api/profile/photo?v=${avatarVersion}`,
  }
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase()
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
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={`/${lang}/profile`} />}>
                <UserRoundIcon />
                {messages.profile}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={lang} />
              <DropdownMenuItem
                nativeButton
                render={<button type="submit" className="w-full" />}
              >
                <LogOutIcon />
                {messages.logOut}
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
