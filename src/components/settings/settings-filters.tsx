"use client"

import { FilterIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getLocalizedTitle, type SettingsData, type SettingsSection } from "@/lib/settings"
import type { Locale, Messages } from "@/lib/i18n"
import { getPermissionLabel, permissionCatalog } from "@/lib/rbac"

export type SettingsFiltersState = Record<string, string>

export function SettingsFilters({
  section,
  data,
  lang,
  messages,
  value,
  onChange,
}: {
  section: SettingsSection
  data: SettingsData
  lang: Locale
  messages: Messages
  value: SettingsFiltersState
  onChange: (value: SettingsFiltersState) => void
}) {
  const setFilter = (name: string, nextValue: string) =>
    onChange({ ...value, [name]: nextValue })
  const localizedOptions = <T extends { id: string; titleUz: string; titleRu: string; titleTr: string }>(items: T[]) =>
    items.map((item) => ({ value: item.id, label: getLocalizedTitle(item, lang) }))
  const hasFilters = Object.values(value).some(Boolean)

  return (
    <div className="space-y-2 rounded-xl bg-muted/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FilterIcon className="size-4" />
          {messages.filters}
        </div>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            <XIcon />
            {messages.clearFilters}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {section !== "users" ? (
          <FilterSelect
            label={messages.translationStatus}
            value={value.translationStatus ?? ""}
            onChange={(nextValue) => setFilter("translationStatus", nextValue)}
            messages={messages}
            options={[
              { value: "complete", label: messages.translationsComplete },
              { value: "missing", label: messages.translationsMissing },
            ]}
          />
        ) : null}
        {section === "products" ? (
          <>
            <FilterSelect label={messages.category} value={value.categoryId ?? ""} onChange={(nextValue) => setFilter("categoryId", nextValue)} messages={messages} options={localizedOptions(data["product-categories"])} />
            <FilterSelect label={messages.unitType} value={value.unitTypeId ?? ""} onChange={(nextValue) => setFilter("unitTypeId", nextValue)} messages={messages} options={localizedOptions([...data["unit-types"]].sort((a, b) => a.order - b.order))} />
          </>
        ) : null}
        {section === "roles" ? (
          <FilterSelect label={messages.permissions} value={value.permission ?? ""} onChange={(nextValue) => setFilter("permission", nextValue)} messages={messages} options={permissionCatalog.map((permission) => ({ value: permission.code, label: getPermissionLabel(permission.code, lang) }))} />
        ) : null}
        {section === "warehouses" ? (
          <>
            <FilterSelect label={messages.branchesField} value={value.branchId ?? ""} onChange={(nextValue) => setFilter("branchId", nextValue)} messages={messages} options={localizedOptions(data.branches)} />
            <FilterSelect label={messages.responsibleUser} value={value.responsibleUserId ?? ""} onChange={(nextValue) => setFilter("responsibleUserId", nextValue)} messages={messages} options={data.users.map((user) => ({ value: user.id, label: user.fullName }))} />
          </>
        ) : null}
        {section === "departments" ? (
          <>
            <FilterSelect label={messages.branchesField} value={value.branchId ?? ""} onChange={(nextValue) => setFilter("branchId", nextValue)} messages={messages} options={localizedOptions(data.branches)} />
            <FilterSelect label={messages.warehousesField} value={value.warehouseId ?? ""} onChange={(nextValue) => setFilter("warehouseId", nextValue)} messages={messages} options={localizedOptions(data.warehouses)} />
          </>
        ) : null}
        {section === "users" ? (
          <>
            <FilterSelect label={messages.position} value={value.positionId ?? ""} onChange={(nextValue) => setFilter("positionId", nextValue)} messages={messages} options={localizedOptions(data.positions)} />
            <FilterSelect label={messages.departmentsField} value={value.departmentId ?? ""} onChange={(nextValue) => setFilter("departmentId", nextValue)} messages={messages} options={localizedOptions(data.departments)} />
            <FilterSelect label={messages.role} value={value.roleId ?? ""} onChange={(nextValue) => setFilter("roleId", nextValue)} messages={messages} options={localizedOptions(data.roles)} />
          </>
        ) : null}
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  messages,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  messages: Messages
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm font-normal text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">{messages.allOptions}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
