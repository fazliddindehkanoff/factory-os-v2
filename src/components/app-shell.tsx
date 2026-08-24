import type { ReactNode } from "react"
import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeaderActions } from "@/components/dashboard-header-actions"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import type { Locale, Messages } from "@/lib/i18n"
import { requireSession } from "@/lib/auth/session"

export async function AppShell({
  lang,
  messages,
  parentLabel,
  parentHref = "#",
  currentLabel,
  children,
}: {
  lang: Locale
  messages: Messages
  parentLabel?: string
  parentHref?: string
  currentLabel: string
  children: ReactNode
}) {
  await requireSession(lang)
  const sidebarCookie = (await cookies()).get("sidebar_state")
  const sidebarDefaultOpen = sidebarCookie?.value !== "false"

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <AppSidebar lang={lang} messages={messages} />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex min-w-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <Breadcrumb className="min-w-0">
              <BreadcrumbList className="flex-nowrap">
                {parentLabel ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href={parentHref}>{parentLabel}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                ) : null}
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate">{currentLabel}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <DashboardHeaderActions lang={lang} messages={messages} />
        </header>
        <div className="flex min-w-0 flex-1 flex-col pt-5 md:pt-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
