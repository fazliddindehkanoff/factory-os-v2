"use client"

import Link from "next/link"
import { ShieldAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import type { PermissionCode } from "@/lib/rbac"

const copy = {
  uz: {
    title: "Kirish cheklangan",
    description: "Bu bo‘limni ochish uchun hisobingizga kerakli ruxsat biriktirilmagan.",
    action: "Boshqaruv paneliga qaytish",
    required: "Kerakli ruxsat",
  },
  ru: {
    title: "Доступ ограничен",
    description: "У вашей учётной записи нет разрешения, необходимого для этого раздела.",
    action: "Вернуться на главную",
    required: "Требуется право",
  },
  tr: {
    title: "Erişim kısıtlandı",
    description: "Hesabınızda bu bölümü açmak için gereken izin bulunmuyor.",
    action: "Kontrol paneline dön",
    required: "Gerekli izin",
  },
} as const

export function AccessDenied({
  lang,
  permissions,
}: {
  lang: Locale
  permissions: readonly PermissionCode[]
}) {
  const text = copy[lang]

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4 pb-10">
      <section className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-xs sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlertIcon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{text.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text.description}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2" aria-label={text.required}>
          {permissions.map((permission) => (
            <Badge key={permission} variant="secondary" className="font-mono font-normal">
              {permission}
            </Badge>
          ))}
        </div>
        <Link href={`/${lang}/dashboard`} className={buttonVariants({ className: "mt-6" })}>
          {text.action}
        </Link>
      </section>
    </div>
  )
}
