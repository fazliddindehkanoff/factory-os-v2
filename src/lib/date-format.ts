import type { Locale } from "./i18n"

const uzMonths = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"]
const uzWeekdays = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"]
const localeTag = { uz: "uz-UZ", ru: "ru-RU", tr: "tr-TR" } as const

// Browsers often ship without Uzbek CLDR data and fall back to "M09"-style output.
export function formatLongDate(date: Date, lang: Locale) {
  if (lang === "uz") return `${uzWeekdays[date.getDay()]}, ${date.getDate()}-${uzMonths[date.getMonth()]}`
  return new Intl.DateTimeFormat(localeTag[lang], { weekday: "long", day: "numeric", month: "long" }).format(date)
}

export function formatShortDate(date: Date, lang: Locale) {
  if (lang === "uz") return `${date.getDate()}-${uzMonths[date.getMonth()].slice(0, 3)}`
  return new Intl.DateTimeFormat(localeTag[lang], { day: "numeric", month: "short" }).format(date)
}
