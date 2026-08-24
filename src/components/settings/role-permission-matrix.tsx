"use client"

import { CheckCheckIcon, CheckIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { Locale } from "@/lib/i18n"
import {
  getPermissionLabel,
  permissionCatalog,
  permissionModuleLabels,
  permissionModules,
  type PermissionCode,
} from "@/lib/rbac"

const copy = {
  uz: { selected: "ruxsat tanlandi", selectAll: "Barchasini tanlash", clear: "Tozalash", all: "Barcha joriy va kelajakdagi ruxsatlar" },
  ru: { selected: "прав выбрано", selectAll: "Выбрать все", clear: "Снять все", all: "Все текущие и будущие права" },
  tr: { selected: "izin seçildi", selectAll: "Tümünü seç", clear: "Temizle", all: "Tüm mevcut ve gelecekteki izinler" },
} as const

export function RolePermissionMatrix({
  locale,
  value,
  grantsAll,
  onChange,
}: {
  locale: Locale
  value: PermissionCode[]
  grantsAll?: boolean
  onChange: (value: PermissionCode[]) => void
}) {
  const text = copy[locale]
  const selected = new Set(value)

  function togglePermission(code: PermissionCode, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(code)
    else next.delete(code)
    onChange([...next])
  }

  function toggleModule(module: (typeof permissionModules)[number]) {
    const moduleCodes = permissionCatalog
      .filter((permission) => permission.module === module)
      .map((permission) => permission.code)
    const moduleIsSelected = moduleCodes.every((code) => selected.has(code))
    const next = new Set(selected)
    moduleCodes.forEach((code) => moduleIsSelected ? next.delete(code) : next.add(code))
    onChange([...next])
  }

  return (
    <div className="grid gap-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{text.selected}</span>
          <Badge variant="secondary" className="tabular-nums">{grantsAll ? permissionCatalog.length : value.length}</Badge>
        </div>
        {!grantsAll ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.length === permissionCatalog.length ? [] : permissionCatalog.map((permission) => permission.code))}>
            <CheckCheckIcon />
            {value.length === permissionCatalog.length ? text.clear : text.selectAll}
          </Button>
        ) : null}
      </div>

      {grantsAll ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium">
          {text.all}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {permissionModules.map((module) => {
          const permissions = permissionCatalog.filter((permission) => permission.module === module)
          const allSelected = permissions.every((permission) => selected.has(permission.code))
          const someSelected = permissions.some((permission) => selected.has(permission.code))
          return (
            <section key={module} className="rounded-xl border bg-muted/20 p-3">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => !grantsAll && toggleModule(module)}
                disabled={grantsAll}
              >
                <span className="font-medium">{permissionModuleLabels[module][locale]}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {permissions.filter((permission) => selected.has(permission.code)).length}/{permissions.length}
                  <span
                    className="flex size-4 items-center justify-center rounded-[4px] border border-input data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                    data-selected={grantsAll || allSelected || undefined}
                    aria-hidden="true"
                  >
                    {grantsAll || allSelected ? <CheckIcon className="size-3" /> : someSelected ? <span className="h-px w-2 bg-current" /> : null}
                  </span>
                </span>
              </button>
              <div className="mt-3 space-y-1 border-t pt-2">
                {permissions.map((permission) => (
                  <label key={permission.code} className="flex min-h-9 cursor-pointer items-start gap-2 rounded-md px-1.5 py-2 text-sm transition-colors hover:bg-muted/60 has-disabled:cursor-default">
                    <Checkbox
                      checked={grantsAll || selected.has(permission.code)}
                      disabled={grantsAll}
                      onCheckedChange={(checked) => togglePermission(permission.code, checked === true)}
                      aria-label={getPermissionLabel(permission.code, locale)}
                    />
                    <span className="grid min-w-0 gap-0.5 leading-tight">
                      <span>{getPermissionLabel(permission.code, locale)}</span>
                      <span className="break-all font-mono text-[11px] text-muted-foreground">{permission.code}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
