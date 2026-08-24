import { NextResponse, type NextRequest } from "next/server"

import { defaultLocale, isLocale } from "@/lib/i18n"

const LOCALE_COOKIE = "factory-os-locale"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const firstSegment = pathname.split("/")[1]

  if (firstSegment && isLocale(firstSegment)) {
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
  url.pathname = pathname === "/" ? `/${locale}/dashboard` : `/${locale}${pathname}`

  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
