import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { appRecords } from "@/db/schema"
import { isLocale, type Locale } from "@/lib/i18n"
export async function getUserLocale(userId: string): Promise<Locale> {
  const [row] = await db.select().from(appRecords).where(and(eq(appRecords.namespace, "user-preferences"), eq(appRecords.id, userId)))
  return isLocale(String(row?.payload.locale)) ? row.payload.locale as Locale : "uz"
}
export async function saveUserLocale(userId: string, locale: Locale) {
  await db.insert(appRecords).values({ namespace: "user-preferences", id: userId, createdByUserId: userId, payload: { locale } }).onConflictDoUpdate({ target: [appRecords.namespace, appRecords.id], set: { payload: { locale }, updatedAt: new Date().toISOString() } })
}
