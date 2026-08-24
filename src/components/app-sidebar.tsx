"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  AudioLinesIcon,
  ClipboardListIcon,
  FactoryIcon,
  LayoutDashboardIcon,
  PackageSearchIcon,
  WalletCardsIcon,
  PlusIcon,
  Settings2Icon,
  TruckIcon,
  TerminalIcon,
} from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { Locale, Messages } from "@/lib/i18n"
import type { SettingsSection } from "@/lib/settings"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  lang: Locale
  messages: Messages
}

export function AppSidebar({ lang, messages, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const isSettings = pathname.includes("/settings/")
  const { can, canViewOrders, canViewSettingsSection } = useAuthorization()
  const settingsItems = [
    { section: "positions", title: messages.positions },
    { section: "products", title: messages.productList },
    { section: "unit-types", title: messages.unitTypes },
    { section: "product-categories", title: messages.productCategories },
    { section: "order-purposes", title: messages.orderPurposes },
    { section: "roles", title: messages.roles },
    { section: "warehouses", title: messages.warehouses },
    { section: "departments", title: messages.departments },
    { section: "users", title: messages.users },
    { section: "branches", title: messages.branches },
  ]
    .filter((item) => canViewSettingsSection(item.section as SettingsSection))
    .map((item) => ({
      title: item.title,
      url: `/${lang}/settings/${item.section}`,
      isActive: pathname.endsWith(`/settings/${item.section}`),
    }))
  const data = {
    teams: [
      { name: "Acme Inc", logo: <FactoryIcon />, plan: "Enterprise" },
      { name: "Acme Corp.", logo: <AudioLinesIcon />, plan: "Startup" },
      { name: "Evil Corp.", logo: <TerminalIcon />, plan: "Free" },
    ],
    navMain: [
      {
        title: messages.dashboard,
        url: `/${lang}/dashboard`,
        icon: <LayoutDashboardIcon />,
        isActive: pathname.endsWith("/dashboard"),
      },
      ...(can("requests.create") ? [{
        title: messages.createNewOrder,
        url: `/${lang}/orders/new`,
        icon: <PlusIcon />,
        isActive: pathname.endsWith("/orders/new"),
      }] : []),
      ...(canViewOrders ? [{
        title: messages.orderList,
        url: `/${lang}/orders`,
        icon: <ClipboardListIcon />,
        isActive: pathname.endsWith("/orders"),
      }] : []),
      ...(can("procurement.view") ? [{
        title: messages.procurement,
        url: `/${lang}/procurement`,
        icon: <PackageSearchIcon />,
        isActive: pathname.includes("/procurement"),
      }] : []),
      ...(can("finance.view") ? [{
        title: messages.finance,
        url: `/${lang}/finance`,
        icon: <WalletCardsIcon />,
        isActive: pathname.includes("/finance"),
      }] : []),
      ...(can("suppliers.view") ? [{
        title: messages.suppliers,
        url: `/${lang}/suppliers`,
        icon: <TruckIcon />,
        isActive: pathname.includes("/suppliers"),
      }] : []),
      ...(settingsItems.length ? [{
        title: messages.settings,
        url: "#",
        icon: <Settings2Icon />,
        isActive: isSettings,
        items: settingsItems,
      }] : []),
    ],
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={data.teams}
          teamsLabel={messages.teams}
          addTeamLabel={messages.addTeam}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} label={messages.platform} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser lang={lang} messages={messages} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
