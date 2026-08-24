import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants"
import { defaultLocale, isLocale } from "@/lib/i18n"

const LOCALE_COOKIE = "factory-os-locale"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const firstSegment = pathname.split("/")[1]
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME)

  if (firstSegment && isLocale(firstSegment)) {
    const isLoginPage = pathname === `/${firstSegment}/login`
    if (!isLoginPage && !hasSession) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = `/${firstSegment}/login`
      loginUrl.search = ""
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(loginUrl)
    }

    const response = NextResponse.next()
    response.cookies.set(LOCALE_COOKIE, firstSegment, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    })
    return response
  }

  const savedLocale = request.cookies.get(LOCALE_COOKIE)?.value
  const locale = savedLocale && isLocale(savedLocale) ? savedLocale : defaultLocale
  const url = request.nextUrl.clone()
  const localizedPath = pathname === "/"
    ? `/${locale}/${hasSession ? "dashboard" : "login"}`
    : `/${locale}${pathname}`

  if (!hasSession && localizedPath !== `/${locale}/login`) {
    url.pathname = `/${locale}/login`
    url.search = ""
    url.searchParams.set("next", localizedPath)
  } else {
    url.pathname = localizedPath
  }

  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
