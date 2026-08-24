"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { db } from "@/db/client"
import { users } from "@/db/schema"
import { verifyPassword } from "@/lib/auth/password"
import { createSession, destroySession } from "@/lib/auth/session"
import { defaultLocale, isLocale } from "@/lib/i18n"

export type LoginState = {
  error?: "required" | "invalid"
}

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLocaleLowerCase()
  const password = String(formData.get("password") ?? "")
  const requestedLocale = String(formData.get("locale") ?? "")
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale
  const requestedReturnTo = String(formData.get("returnTo") ?? "")

  if (!username || !password || username.length > 100 || password.length > 256) {
    return { error: "required" }
  }

  const [user] = await db.select({
    id: users.id,
    passwordHash: users.passwordHash,
  })
    .from(users)
    .where(and(eq(users.username, username), eq(users.isActive, true)))
    .limit(1)

  const valid = user?.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : false

  if (!user || !valid) return { error: "invalid" }

  await createSession(user.id)

  const safeReturnTo = requestedReturnTo.startsWith(`/${locale}/`) && !requestedReturnTo.startsWith("//")
    ? requestedReturnTo
    : `/${locale}/dashboard`
  redirect(safeReturnTo)
}

export async function logoutAction(formData: FormData) {
  const requestedLocale = String(formData.get("locale") ?? "")
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale
  await destroySession()
  redirect(`/${locale}/login`)
}
