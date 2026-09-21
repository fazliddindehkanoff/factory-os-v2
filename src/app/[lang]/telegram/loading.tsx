"use client"
import { useParams } from "next/navigation"
import { isLocale } from "@/lib/i18n"
import { uxCopy } from "@/lib/ux-copy"
export default function Loading() {
  const params = useParams(); const lang = typeof params.lang === "string" && isLocale(params.lang) ? params.lang : "uz"
  return <p role="status" className="p-6 text-sm">{uxCopy[lang].loading}</p>
}
