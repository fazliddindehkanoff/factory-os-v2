import type { Metadata } from "next"
import Link from "next/link"
import { CheckIcon, FactoryIcon } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { LoginForm, type LoginCopy } from "@/components/login-form"
import { getSessionUser } from "@/lib/auth/session"
import { isLocale, locales, type Locale } from "@/lib/i18n"

const loginCopy: Record<Locale, LoginCopy> = {
  uz: {
    title: "Tizimga kirish",
    description: "Factory OS ish maydoniga kirish uchun hisob ma’lumotlaringizni kiriting.",
    username: "Foydalanuvchi nomi",
    usernamePlaceholder: "Foydalanuvchi nomingiz",
    password: "Parol",
    showPassword: "Parolni ko‘rsat",
    hidePassword: "Parolni yashirish",
    submit: "Kirish",
    submitting: "Kirilmoqda...",
    requiredError: "Foydalanuvchi nomi va parolni kiriting.",
    invalidError: "Foydalanuvchi nomi yoki parol noto‘g‘ri.",
    help: "Kirishda muammo bo‘lsa, tizim administratoriga murojaat qiling.",
  },
  ru: {
    title: "Вход в систему",
    description: "Введите данные учетной записи для доступа к рабочему пространству Factory OS.",
    username: "Имя пользователя",
    usernamePlaceholder: "Ваше имя пользователя",
    password: "Пароль",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
    submit: "Войти",
    submitting: "Вход...",
    requiredError: "Введите имя пользователя и пароль.",
    invalidError: "Неверное имя пользователя или пароль.",
    help: "Если не удается войти, обратитесь к системному администратору.",
  },
  tr: {
    title: "Sisteme giriş",
    description: "Factory OS çalışma alanına erişmek için hesap bilgilerinizi girin.",
    username: "Kullanıcı adı",
    usernamePlaceholder: "Kullanıcı adınız",
    password: "Şifre",
    showPassword: "Şifreyi göster",
    hidePassword: "Şifreyi gizle",
    submit: "Giriş yap",
    submitting: "Giriş yapılıyor...",
    requiredError: "Kullanıcı adı ve şifreyi girin.",
    invalidError: "Kullanıcı adı veya şifre yanlış.",
    help: "Giriş yapamıyorsanız sistem yöneticinize başvurun.",
  },
}

const brandCopy: Record<Locale, { tagline: string; points: string[] }> = {
  uz: {
    tagline: "Buyurtmadan omborgacha — bitta shaffof jarayon.",
    points: ["Har bir buyurtma qaysi bosqichda ekanini ko‘ring", "Ta’minot, direktor va moliya bir joyda", "Telegram orqali ham ishlang"],
  },
  ru: {
    tagline: "От заявки до склада — один прозрачный процесс.",
    points: ["Видно, на каком этапе каждая заявка", "Снабжение, директор и финансы в одном месте", "Работайте и через Telegram"],
  },
  tr: {
    tagline: "Talepten depoya — tek şeffaf süreç.",
    points: ["Her talebin hangi aşamada olduğunu görün", "Satın alma, direktör ve finans tek yerde", "Telegram üzerinden de çalışın"],
  },
}

const languageNames: Record<Locale, string> = {
  uz: "O‘zbekcha",
  ru: "Русский",
  tr: "Türkçe",
}

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Factory OS",
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()

  const session = await getSessionUser()

  const nextValue = (await searchParams).next
  const returnTo = typeof nextValue === "string" && nextValue.startsWith(`/${lang}/`) && !nextValue.includes("\\") ? nextValue : undefined
  if (session) redirect(returnTo ?? `/${lang}/dashboard`)

  const brand = brandCopy[lang]
  return (
    <main className="relative grid min-h-svh w-full bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0b1f44] p-10 text-white lg:flex lg:flex-col lg:justify-between lg:gap-12 xl:p-14" aria-hidden="true">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 size-[28rem] rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.08)_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <FactoryIcon className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Factory OS</span>
        </div>
        <div className="relative my-auto max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">{brand.tagline}</h2>
          <ul className="mt-8 space-y-3 text-[15px] text-white/80">
            {brand.points.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10"><CheckIcon className="size-3.5" /></span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="relative flex items-center justify-center overflow-hidden p-4 sm:p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--color-primary)_0,transparent_30%)] opacity-[0.06] lg:hidden" />
      <nav aria-label="Language" className="absolute right-4 top-4 z-10 flex rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-sm sm:right-6 sm:top-6">
        {locales.map((locale) => (
          <Link
            key={locale}
            href={`/${locale}/login${returnTo ? `?next=${encodeURIComponent(returnTo.replace(`/${lang}/`, `/${locale}/`))}` : ""}`}
            hrefLang={locale}
            aria-current={locale === lang ? "page" : undefined}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {languageNames[locale]}
          </Link>
        ))}
      </nav>
      <div className="relative w-full max-w-md pt-16 sm:pt-10">
        <LoginForm lang={lang} returnTo={returnTo} copy={loginCopy[lang]} />
      </div>
      </div>
    </main>
  )
}
