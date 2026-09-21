"use client"
import * as React from "react"
import { useSearchParams } from "next/navigation"

// Keep filters and the selected detail in the URL across reloads and locale changes.
export function useUrlState<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const search = useSearchParams()
  function parse(raw: string | null): T {
    if (raw === null) return fallback
    try {
      const value: unknown = typeof fallback === "string" || fallback === null ? raw : JSON.parse(raw)
      if (fallback === null) return value as T
      if (typeof value !== typeof fallback || value === null) return fallback
      if (typeof fallback === "number" && (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 10000)) return fallback
      if (typeof fallback === "object") {
        if (Array.isArray(value)) return fallback
        const result: T = { ...fallback }
        for (const name of Object.keys(fallback as object)) {
          const field = name as keyof T
          const candidate = (value as T)[field]
          if (typeof candidate === typeof fallback[field]) result[field] = candidate
        }
        return result
      }
      return value as T
    } catch { return fallback }
  }
  const value = parse(search.get(key))
  const setValue: React.Dispatch<React.SetStateAction<T>> = (next) => {
    const url = new URL(window.location.href)
    const resolved = typeof next === "function" ? (next as (previous: T) => T)(parse(url.searchParams.get(key))) : next
    if (resolved === null || resolved === "" || JSON.stringify(resolved) === JSON.stringify(fallback)) url.searchParams.delete(key)
    else url.searchParams.set(key, typeof resolved === "string" ? resolved : JSON.stringify(resolved))
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }
  return [value, setValue]
}

export function safeReturnPath(value: string | null, lang: string): string | null {
  return value?.startsWith(`/${lang}/`) && !value.includes("\\") ? value : null
}
