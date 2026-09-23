import type { Locale } from "./i18n"

const localeTag = { uz: "uz-UZ", ru: "ru-RU", tr: "tr-TR" } as const

const millions = { uz: "mln", ru: "млн", tr: "mn" } as const
const thousands = { uz: "ming", ru: "тыс.", tr: "bin" } as const

/** One consistent short money format: 9,2 mln / 850 ming. */
export function formatMoneyShort(value: number, lang: Locale) {
  const number = (amount: number) => new Intl.NumberFormat(localeTag[lang], { maximumFractionDigits: amount < 10 ? 1 : 0 }).format(amount)
  if (Math.abs(value) >= 1_000_000) return `${number(value / 1_000_000)} ${millions[lang]}`
  if (Math.abs(value) >= 1_000) return `${number(value / 1_000)} ${thousands[lang]}`
  return number(value)
}
