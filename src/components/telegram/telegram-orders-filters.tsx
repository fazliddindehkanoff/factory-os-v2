"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FilterIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"

import type { Locale } from "@/lib/i18n"
import type { TelegramOrderFilterValues } from "@/lib/telegram-order-filters"
import type { TelegramCopy } from "@/lib/telegram-copy"

export function TelegramOrdersFilters({
  lang,
  copy,
  values,
  waitingOnly,
  departments,
  warehouses,
}: {
  lang: Locale
  copy: TelegramCopy
  values: TelegramOrderFilterValues
  waitingOnly: boolean
  departments: string[]
  warehouses: string[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const activeCount = Object.values(values).filter(Boolean).length
  const clearHref = waitingOnly ? `/${lang}/telegram/orders?scope=waiting#orders` : `/${lang}/telegram/orders#orders`

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    for (const [key, value] of formData.entries()) {
      const text = String(value).trim()
      if (text) params.set(key, text)
    }
    const queryString = params.toString()
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}#orders`)
  }

  return (
    <details className="tg-card group mb-4 overflow-hidden rounded-[14px] border shadow-[0_1px_2px_rgba(16,30,60,0.05)]" open={activeCount > 0}>
      <summary className="flex min-h-12 cursor-pointer touch-manipulation list-none items-center justify-between gap-3 px-3.5 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2d7dd2] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#e7f1fb] text-[#2d7dd2]">
            <SlidersHorizontalIcon className="size-4" />
          </span>
          <span>{copy.filters}</span>
          {activeCount ? <span className="rounded-full bg-[#2d7dd2] px-2 py-0.5 font-mono text-[10px] text-white">{activeCount}</span> : null}
        </span>
        <FilterIcon className="size-4 text-[#8a94a4] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>

      <form action={`/${lang}/telegram/orders#orders`} method="get" onSubmit={applyFilters} className="tg-divider grid gap-3 border-t p-3.5">
        {waitingOnly ? <input type="hidden" name="scope" value="waiting" /> : null}
        <label className="grid gap-1.5 text-[11px] font-bold text-[var(--tg-text-secondary)]">
          {copy.searchOrders}
          <span className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--tg-text-muted)]" />
            <input
              key={values.q}
              name="q"
              defaultValue={values.q}
              maxLength={120}
              enterKeyHint="search"
              className="tg-input h-12 w-full rounded-[11px] border pl-9 pr-3 text-base outline-none transition-[border-color,box-shadow] focus:border-[#2d7dd2] focus:ring-3 focus:ring-[#2d7dd2]/15"
              placeholder={copy.searchPlaceholder}
            />
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <FilterSelect label={copy.type} name="type" value={values.type} allLabel={copy.allOptions} options={[
            ["material", copy.material],
            ["service", copy.service],
          ]} />
          <FilterSelect label={copy.statusLabel} name="status" value={values.status} allLabel={copy.allOptions} options={Object.entries(copy.status)} />
          <FilterSelect label={copy.urgency} name="urgency" value={values.urgency} allLabel={copy.allOptions} options={[
            ["urgent-group", copy.urgentOrders],
            ...Object.entries(copy.urgencyLabels),
          ]} />
          <FilterSelect label={copy.department} name="department" value={values.department} allLabel={copy.allOptions} options={departments.map((value) => [value, value])} />
          <div className="col-span-2">
            <FilterSelect label={copy.warehouse} name="warehouse" value={values.warehouse} allLabel={copy.allOptions} options={warehouses.map((value) => [value, value])} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <Link href={clearHref} className="tg-secondary-button flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-[11px] border px-3 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] active:opacity-70">
            <XIcon className="size-4" />
            {copy.clearFilters}
          </Link>
          <button type="submit" className="flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-[11px] bg-[#2d7dd2] px-3 text-[13px] font-bold text-white shadow-[0_8px_20px_-12px_rgba(45,125,210,0.9)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7dd2] focus-visible:ring-offset-2 active:bg-[#246caf]">
            <FilterIcon className="size-4" />
            {copy.applyFilters}
          </button>
        </div>
      </form>
    </details>
  )
}

function FilterSelect({
  label,
  name,
  value,
  allLabel,
  options,
}: {
  label: string
  name: keyof TelegramOrderFilterValues
  value: string
  allLabel: string
  options: Array<[string, string]>
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-[11px] font-bold text-[var(--tg-text-secondary)]">
      {label}
      <select key={`${name}:${value}`} name={name} defaultValue={value} className="tg-input h-11 min-w-0 rounded-[11px] border px-3 text-[13px] outline-none transition-[border-color,box-shadow] focus:border-[#2d7dd2] focus:ring-3 focus:ring-[#2d7dd2]/15">
        <option value="">{allLabel}</option>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}
