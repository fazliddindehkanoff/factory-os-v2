import type { Metadata } from "next"
import Link from "next/link"
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
  if (session) redirect(`/${lang}/dashboard`)

  const nextValue = (await searchParams).next
  const returnTo = typeof nextValue === "string" ? nextValue : undefined

  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background p-4 sm:p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--color-primary)_0,transparent_30%)] opacity-[0.06]" />
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
    </main>
  )
}
