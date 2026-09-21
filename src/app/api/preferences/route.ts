import { getSessionUser } from "@/lib/auth/session"
import { isLocale } from "@/lib/i18n"
import { saveUserLocale } from "@/lib/user-locale"
export async function PATCH(request: Request) {
  const session = await getSessionUser()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || !isLocale(body.locale)) return Response.json({ error: "invalid-locale" }, { status: 400 })
  await saveUserLocale(session.userId, body.locale)
  return Response.json({ ok: true })
}
