import { NextResponse } from "next/server"

import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import { isLocale, locales, type Locale } from "@/lib/i18n"

type TranslateRequest = {
  text?: string
  sourceLocale?: string
}

type TranslationSource = Locale | "auto"

async function translate(text: string, source: TranslationSource, target: Locale) {
  if (source === target) return text

  const url = new URL("https://translate.googleapis.com/translate_a/single")
  url.searchParams.set("client", "gtx")
  url.searchParams.set("sl", source)
  url.searchParams.set("tl", target)
  url.searchParams.set("dt", "t")
  url.searchParams.set("q", text)

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      })

      if (response.ok) {
        const payload = (await response.json()) as [Array<[string]>]
        return payload[0].map((part) => part[0]).join("")
      }
    } catch {
      if (attempt === 3) throw new Error("Translation service request failed")
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 300))
    }
  }

  throw new Error("Translation service request failed")
}

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const [canManageSettings, canCreateRequests] = await Promise.all([
    userHasPermission(session.userId, "settings.manage"),
    userHasPermission(session.userId, "requests.create"),
  ])
  if (!canManageSettings && !canCreateRequests) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json()) as TranslateRequest
  const text = body.text?.trim()
  const sourceLocale = body.sourceLocale

  if (!text || !sourceLocale || (sourceLocale !== "auto" && !isLocale(sourceLocale))) {
    return NextResponse.json({ error: "Invalid translation request" }, { status: 400 })
  }

  try {
    const translated = await Promise.all(
      locales.map(async (locale) => [locale, await translate(text, sourceLocale, locale)]),
    )
    return NextResponse.json(Object.fromEntries(translated))
  } catch {
    return NextResponse.json({ error: "Translation service unavailable" }, { status: 502 })
  }
}
