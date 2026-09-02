"use client"

import * as React from "react"
import {
  DownloadIcon,
  LanguagesIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { RolePermissionMatrix } from "@/components/settings/role-permission-matrix"
import { SettingsList, type SettingsTableRow } from "@/components/settings/settings-list"
import { SettingsFilters, type SettingsFiltersState } from "@/components/settings/settings-filters"
import { SearchableMultiSelect } from "@/components/settings/searchable-multi-select"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Locale, Messages } from "@/lib/i18n"
import { PRODUCT_TITLE_MAX_LENGTH } from "@/lib/product-input"
import { permissionCatalog, type PermissionCode } from "@/lib/rbac"
import {
  getLocalizedTitle,
  getSectionTitle,
  type LocalizedTitle,
  type SettingsSection,
} from "@/lib/settings"

type FormValue = string | string[] | boolean
type FormState = Record<string, FormValue>
type ProductExcelResponse = {
  created?: number
  updated?: number
  products?: ReturnType<typeof useSettings>["data"]["products"]
  error?: string
  issues?: Array<{ row: number; message: string }>
}

const emptyLocalizedTitle = {
  titleUz: "",
  titleRu: "",
  titleTr: "",
}

export function SettingsWorkspace({
  section,
  lang,
  messages,
}: {
  section: SettingsSection
  lang: Locale
  messages: Messages
}) {
  const {
    data,
    addRecord,
    updateRecord,
    deleteRecord,
    updateLocalizedTitles,
    reorderUnitType,
    replaceProducts,
  } = useSettings()
  const [query, setQuery] = React.useState("")
  const [filters, setFilters] = React.useState<SettingsFiltersState>({})
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [deletingIds, setDeletingIds] = React.useState<string[]>([])
  const [formError, setFormError] = React.useState("")
  const [listError, setListError] = React.useState("")
  const [listNotice, setListNotice] = React.useState("")
  const [excelOperation, setExcelOperation] = React.useState<"upload" | "download" | null>(null)
  const [translating, setTranslating] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [form, setForm] = React.useState<FormState>(createInitialForm(section))
  const sectionTitle = getSectionTitle(section, messages)
  const { canViewSettingsSection, canManageSettingsSection } = useAuthorization()

  const branchOptions = data.branches.map((item) => ({
    value: item.id,
    label: getLocalizedTitle(item, lang),
  }))
  const warehouseOptions = data.warehouses.map((item) => ({
    value: item.id,
    label: getLocalizedTitle(item, lang),
  }))
  const departmentOptions = data.departments.map((item) => ({
    value: item.id,
    label: getLocalizedTitle(item, lang),
  }))
  const rows = getRows(section, data, lang)
    .filter((row) => row.searchText.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .filter((row) => matchesSettingsFilters(section, data, row.id, filters))
  const columns = getColumns(section, messages)
  const canView = canViewSettingsSection(section)
  const canManage = canManageSettingsSection(section)
  const canCreate = canManage
  const canEdit = canManage
  const canDelete = canManage
  const canTranslate = canManage && section !== "users" && section !== "roles"

  function updateField(name: string, value: FormValue) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function openCreateDialog() {
    setEditingId(null)
    setFormError("")
    setForm(createInitialForm(section))
    setDialogOpen(true)
  }

  function openEditDialog(id: string) {
    setEditingId(id)
    setFormError("")
    setForm(createFormFromRecord(section, data, id))
    setDialogOpen(true)
  }

  function persistRecord<K extends SettingsSection>(
    targetSection: K,
    record: (typeof data)[K][number],
  ) {
    if (editingId) updateRecord(targetSection, record)
    else addRecord(targetSection, record)
  }

  function submitRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      section !== "users" &&
      ![form.titleUz, form.titleRu, form.titleTr].some((value) => String(value ?? "").trim())
    ) {
      setFormError(messages.oneTitleRequired)
      return
    }
    if (
      section === "products" &&
      [form.titleUz, form.titleRu, form.titleTr]
        .some((value) => String(value ?? "").length > PRODUCT_TITLE_MAX_LENGTH)
    ) {
      setFormError(messages.productTitleTooLong)
      return
    }
    const id = editingId ?? `${section}-${crypto.randomUUID()}`
    const localized = {
      titleUz: String(form.titleUz ?? ""),
      titleRu: String(form.titleRu ?? ""),
      titleTr: String(form.titleTr ?? ""),
    }

    switch (section) {
      case "positions":
        persistRecord("positions", { id, ...localized })
        break
      case "product-categories":
        persistRecord("product-categories", { id, ...localized })
        break
      case "order-purposes":
        persistRecord("order-purposes", { id, ...localized })
        break
      case "branches":
        persistRecord("branches", { id, ...localized })
        break
      case "unit-types":
        persistRecord("unit-types", {
          id,
          ...localized,
          code: String(form.code),
          order: editingId
            ? (data["unit-types"].find((item) => item.id === editingId)?.order ?? 1)
            : data["unit-types"].length + 1,
        })
        break
      case "products":
        persistRecord("products", {
          id,
          ...localized,
          code: String(form.code),
          categoryId: String(form.categoryId),
        })
        break
      case "roles": {
        const existingRole = data.roles.find((role) => role.id === editingId)
        persistRecord("roles", {
          id,
          ...localized,
          code: String(form.code),
          permissions: form.permissions as PermissionCode[],
          isSystem: existingRole?.isSystem ?? false,
          grantsAll: existingRole?.grantsAll,
        })
        break
      }
      case "warehouses":
        persistRecord("warehouses", {
          id,
          ...localized,
          branchIds: form.branchIds as string[],
          responsibleUserId: String(form.responsibleUserId),
        })
        break
      case "departments":
        persistRecord("departments", {
          id,
          ...localized,
          branchIds: form.branchIds as string[],
          warehouseIds: form.warehouseIds as string[],
        })
        break
      case "users":
        persistRecord("users", {
          id,
          fullName: String(form.fullName),
          positionId: String(form.positionId),
          username: String(form.username),
          password: String(form.password),
          telegramChatId: String(form.telegramChatId),
          phoneNumber: String(form.phoneNumber),
          departmentIds: form.departmentIds as string[],
          roleIds: form.roleIds as string[],
        })
        break
    }

    setDialogOpen(false)
    setEditingId(null)
  }

  async function requestTranslations(title: LocalizedTitle): Promise<LocalizedTitle> {
    const sourceText = [title.titleUz, title.titleRu, title.titleTr]
      .find((value) => value.trim())
    if (!sourceText) throw new Error(messages.oneTitleRequired)
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sourceText, sourceLocale: "auto" }),
    })
    if (!response.ok) throw new Error(messages.translationFailed)
    const translated = (await response.json()) as Record<Locale, string>
    return {
      titleUz: translated.uz,
      titleRu: translated.ru,
      titleTr: translated.tr,
    }
  }

  async function translateForm() {
    setFormError("")
    setTranslating(true)
    try {
      const translated = await requestTranslations({
        titleUz: String(form.titleUz ?? ""),
        titleRu: String(form.titleRu ?? ""),
        titleTr: String(form.titleTr ?? ""),
      })
      setForm((current) => ({ ...current, ...translated }))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : messages.translationFailed)
    } finally {
      setTranslating(false)
    }
  }

  async function translateRecords(ids: string[]) {
    if (section === "users") return
    setListError("")
    setListNotice("")
    setTranslating(true)
    try {
      const records = data[section].filter((item) => ids.includes(item.id))
      const translatedRecords: Array<LocalizedTitle & { id: string }> = []
      let failedCount = 0
      for (const record of records) {
        try {
          const translated = await requestTranslations(record)
          translatedRecords.push({ id: record.id, ...translated })
        } catch {
          failedCount += 1
        }
      }

      if (translatedRecords.length) {
        const response = await fetch("/api/settings/translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, records: translatedRecords }),
        })
        if (!response.ok) throw new Error(messages.translationFailed)
        for (const record of translatedRecords) {
          updateLocalizedTitles(section, record.id, record)
        }
        setListNotice(messages.translationsUpdated.replace("{count}", String(translatedRecords.length)))
      }
      if (failedCount) setListError(messages.translationFailed)
    } catch {
      setListError(messages.translationFailed)
    } finally {
      setTranslating(false)
    }
  }

  async function downloadProducts() {
    setListError("")
    setListNotice("")
    setExcelOperation("download")
    try {
      const response = await fetch("/api/products/excel", { cache: "no-store" })
      if (!response.ok) throw new Error(messages.productExportFailed)

      const blob = await response.blob()
      const contentDisposition = response.headers.get("Content-Disposition") ?? ""
      const filename = contentDisposition.match(/filename="([^"]+)"/)?.[1] ?? "factory-os-products.xlsx"
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setListError(error instanceof Error ? error.message : messages.productExportFailed)
    } finally {
      setExcelOperation(null)
    }
  }

  async function uploadProducts(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setListError("")
    setListNotice("")
    setExcelOperation("upload")
    try {
      const formData = new FormData()
      formData.set("file", file)
      const response = await fetch("/api/products/excel", { method: "POST", body: formData })
      const payload = await response.json() as ProductExcelResponse
      if (!response.ok || !payload.products) {
        const details = payload.issues?.slice(0, 3)
          .map((issue) => `Row ${issue.row}: ${issue.message}`)
          .join(" ")
        throw new Error(details || payload.error || messages.productImportFailed)
      }

      replaceProducts(payload.products)
      setListNotice(messages.productsImported
        .replace("{created}", String(payload.created ?? 0))
        .replace("{updated}", String(payload.updated ?? 0)))
    } catch (error) {
      setListError(error instanceof Error ? error.message : messages.productImportFailed)
    } finally {
      setExcelOperation(null)
    }
  }

  if (!canView) {
    const required: PermissionCode[] = section === "roles"
      ? ["roles.manage"]
      : section === "users"
        ? ["users.view", "users.manage"]
        : ["settings.manage"]
    return <AccessDenied lang={lang} permissions={required} />
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 md:p-6 md:pt-0">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sectionTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{messages.settingsDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {section === "products" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={downloadProducts}
                disabled={excelOperation !== null}
                className="flex-1 sm:flex-none"
              >
                {excelOperation === "download" ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
                {excelOperation === "download" ? messages.downloadingExcel : messages.downloadExcel}
              </Button>
              {canManage ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={uploadProducts}
                    className="sr-only"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={excelOperation !== null}
                    className="flex-1 sm:flex-none"
                  >
                    {excelOperation === "upload" ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
                    {excelOperation === "upload" ? messages.uploadingProducts : messages.uploadProducts}
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {canCreate ? (
            <DialogTrigger
              onClick={openCreateDialog}
              className={buttonVariants({ className: "w-full sm:w-auto" })}
            >
              <PlusIcon />
              {messages.addRecord}
            </DialogTrigger>
          ) : null}
          <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
            <form onSubmit={submitRecord}>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? messages.editRecord : messages.addRecord}: {sectionTitle}
                </DialogTitle>
                <DialogDescription>{messages.settingsDescription}</DialogDescription>
              </DialogHeader>
              {section !== "users" && canTranslate ? (
                <div className="pt-4">
                  <Button type="button" variant="outline" onClick={translateForm} disabled={translating}>
                    {translating ? <LoaderCircleIcon className="animate-spin" /> : <LanguagesIcon />}
                    {translating ? messages.translating : messages.autoFillTranslations}
                  </Button>
                </div>
              ) : null}
              <div className="grid gap-4 py-5 sm:grid-cols-2">
                <SettingsForm
                  section={section}
                  form={form}
                  updateField={updateField}
                  data={data}
                  lang={lang}
                  messages={messages}
                  branchOptions={branchOptions}
                  warehouseOptions={warehouseOptions}
                  departmentOptions={departmentOptions}
                />
              </div>
              {formError ? <p role="alert" className="pb-3 text-sm text-destructive">{formError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {messages.cancel}
                </Button>
                <Button type="submit">{messages.save}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {section === "products" ? (
        <p className="text-sm text-muted-foreground">{messages.productImportHelp}</p>
      ) : null}

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={messages.searchRecords}
          className="pl-8"
        />
      </div>

      <SettingsFilters
        section={section}
        data={data}
        lang={lang}
        messages={messages}
        value={filters}
        onChange={setFilters}
      />

      {listError ? <p role="alert" className="text-sm text-destructive">{listError}</p> : null}
      {listNotice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{listNotice}</p> : null}

      <SettingsList
        key={`${section}:${query}:${JSON.stringify(filters)}`}
        section={section}
        rows={rows}
        columns={columns}
        messages={messages}
        canEdit={canEdit}
        canDelete={canDelete}
        canTranslate={canTranslate}
        translating={translating}
        onEdit={openEditDialog}
        onDelete={(ids) => {
          const deletableIds = section === "roles"
            ? ids.filter((id) => !data.roles.find((role) => role.id === id)?.isSystem)
            : ids
          setDeletingIds(deletableIds)
        }}
        onTranslate={translateRecords}
        onReorder={reorderUnitType}
      />

      <Dialog open={deletingIds.length > 0} onOpenChange={(open) => !open && setDeletingIds([])}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{messages.deleteRecord}</DialogTitle>
            <DialogDescription>
              {deletingIds.length > 1 ? messages.deleteSelectedConfirmation : messages.deleteConfirmation}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingIds([])}>
              {messages.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deletingIds.forEach((id) => deleteRecord(section, id))
                setDeletingIds([])
              }}
            >
              <Trash2Icon />
              {messages.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SettingsForm({
  section,
  form,
  updateField,
  data,
  lang,
  messages,
  branchOptions,
  warehouseOptions,
  departmentOptions,
}: {
  section: SettingsSection
  form: FormState
  updateField: (name: string, value: FormValue) => void
  data: ReturnType<typeof useSettings>["data"]
  lang: Locale
  messages: Messages
  branchOptions: { value: string; label: string }[]
  warehouseOptions: { value: string; label: string }[]
  departmentOptions: { value: string; label: string }[]
}) {
  const localizedFields = section !== "users" ? (
    <>
      <TextField label={messages.titleUz} name="titleUz" value={form.titleUz} onChange={updateField} required={false} maxLength={section === "products" ? PRODUCT_TITLE_MAX_LENGTH : undefined} descriptionId={section === "products" ? "settings-product-title-limit" : undefined} />
      <TextField label={messages.titleRu} name="titleRu" value={form.titleRu} onChange={updateField} required={false} maxLength={section === "products" ? PRODUCT_TITLE_MAX_LENGTH : undefined} descriptionId={section === "products" ? "settings-product-title-limit" : undefined} />
      <TextField label={messages.titleTr} name="titleTr" value={form.titleTr} onChange={updateField} required={false} maxLength={section === "products" ? PRODUCT_TITLE_MAX_LENGTH : undefined} descriptionId={section === "products" ? "settings-product-title-limit" : undefined} />
      <p className="text-xs text-muted-foreground sm:col-span-2">{messages.oneTitleRequired}</p>
      {section === "products" ? (
        <p id="settings-product-title-limit" className="text-xs text-muted-foreground sm:col-span-2">{messages.productTitleLimit}</p>
      ) : null}
    </>
  ) : null

  return (
    <>
      {localizedFields}
      {section === "unit-types" || section === "products" || section === "roles" ? (
        <TextField label={messages.code} name="code" value={form.code} onChange={updateField} />
      ) : null}
      {section === "products" ? (
        <SelectField
          label={messages.category}
          name="categoryId"
          value={form.categoryId}
          onChange={updateField}
          placeholder={messages.selectOption}
          options={data["product-categories"].map((item) => ({ value: item.id, label: getLocalizedTitle(item, lang) }))}
        />
      ) : null}
      {section === "roles" ? (
        <RolePermissionMatrix
          locale={lang}
          value={(form.permissions as PermissionCode[]) ?? []}
          grantsAll={Boolean(form.grantsAll)}
          onChange={(value) => updateField("permissions", value)}
        />
      ) : null}
      {section === "warehouses" ? (
        <>
          <MultiSelectField label={messages.branchesField} name="branchIds" form={form} updateField={updateField} options={branchOptions} messages={messages} />
          <SelectField
            label={messages.responsibleUser}
            name="responsibleUserId"
            value={form.responsibleUserId}
            onChange={updateField}
            placeholder={messages.selectOption}
            options={data.users.map((item) => ({ value: item.id, label: item.fullName }))}
          />
        </>
      ) : null}
      {section === "departments" ? (
        <>
          <MultiSelectField label={messages.branchesField} name="branchIds" form={form} updateField={updateField} options={branchOptions} messages={messages} />
          <MultiSelectField label={messages.warehousesField} name="warehouseIds" form={form} updateField={updateField} options={warehouseOptions} messages={messages} />
        </>
      ) : null}
      {section === "users" ? (
        <>
          <TextField label={messages.fullName} name="fullName" value={form.fullName} onChange={updateField} />
          <SelectField label={messages.position} name="positionId" value={form.positionId} onChange={updateField} placeholder={messages.selectOption} options={data.positions.map((item) => ({ value: item.id, label: getLocalizedTitle(item, lang) }))} />
          <TextField label={messages.username} name="username" value={form.username} onChange={updateField} />
          <TextField label={messages.password} name="password" value={form.password} onChange={updateField} type="password" />
          <TextField label={messages.telegramChatId} name="telegramChatId" value={form.telegramChatId} onChange={updateField} required={false} />
          <TextField label={messages.phoneNumber} name="phoneNumber" value={form.phoneNumber} onChange={updateField} type="tel" />
          <MultiSelectField label={messages.departmentsField} name="departmentIds" form={form} updateField={updateField} options={departmentOptions} messages={messages} />
          <MultiSelectField label={messages.role} name="roleIds" form={form} updateField={updateField} options={data.roles.map((item) => ({ value: item.id, label: getLocalizedTitle(item, lang) }))} messages={messages} />
        </>
      ) : null}
    </>
  )
}

function TextField({ label, name, value, onChange, type = "text", required = true, maxLength, descriptionId }: {
  label: string
  name: string
  value: FormValue
  onChange: (name: string, value: FormValue) => void
  type?: string
  required?: boolean
  maxLength?: number
  descriptionId?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} maxLength={maxLength} aria-describedby={descriptionId} value={String(value ?? "")} onChange={(event) => onChange(name, event.target.value)} />
    </div>
  )
}

function SelectField({ label, name, value, onChange, options, placeholder }: {
  label: string
  name: string
  value: FormValue
  onChange: (name: string, value: FormValue) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required
        value={String(value ?? "")}
        onChange={(event) => onChange(name, event.target.value)}
        className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

function MultiSelectField({ label, name, form, updateField, options, messages }: {
  label: string
  name: string
  form: FormState
  updateField: (name: string, value: FormValue) => void
  options: { value: string; label: string }[]
  messages: Messages
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <SearchableMultiSelect
        options={options}
        value={(form[name] as string[]) ?? []}
        onChange={(value) => updateField(name, value)}
        placeholder={messages.selectOption}
        searchPlaceholder={messages.searchOptions}
        emptyText={messages.noOptions}
        selectedText={messages.selectedCount}
        clearText={messages.clearSelection}
        doneText={messages.done}
        ariaLabel={label}
      />
    </div>
  )
}

function createInitialForm(section: SettingsSection): FormState {
  if (section === "users") {
    return {
      fullName: "",
      positionId: "",
      username: "",
      password: "",
      telegramChatId: "",
      phoneNumber: "",
      departmentIds: [],
      roleIds: [],
    }
  }

  return {
    ...emptyLocalizedTitle,
    code: "",
    categoryId: "",
    unitTypeId: "",
    permissions: [],
    grantsAll: false,
    branchIds: [],
    responsibleUserId: "",
    warehouseIds: [],
  }
}

function createFormFromRecord(
  section: SettingsSection,
  data: ReturnType<typeof useSettings>["data"],
  id: string,
): FormState {
  switch (section) {
    case "positions":
    case "product-categories":
    case "order-purposes":
    case "branches": {
      const record = data[section].find((item) => item.id === id)
      return record ? { ...record } : createInitialForm(section)
    }
    case "unit-types": {
      const record = data[section].find((item) => item.id === id)
      return record
        ? {
            titleUz: record.titleUz,
            titleRu: record.titleRu,
            titleTr: record.titleTr,
            code: record.code,
          }
        : createInitialForm(section)
    }
    case "products": {
      const record = data.products.find((item) => item.id === id)
      return record ? { ...record } : createInitialForm(section)
    }
    case "roles": {
      const record = data.roles.find((item) => item.id === id)
      return record ? { ...record, permissions: [...record.permissions], grantsAll: Boolean(record.grantsAll) } : createInitialForm(section)
    }
    case "warehouses": {
      const record = data.warehouses.find((item) => item.id === id)
      return record ? { ...record, branchIds: [...record.branchIds] } : createInitialForm(section)
    }
    case "departments": {
      const record = data.departments.find((item) => item.id === id)
      return record
        ? { ...record, branchIds: [...record.branchIds], warehouseIds: [...record.warehouseIds] }
        : createInitialForm(section)
    }
    case "users": {
      const record = data.users.find((item) => item.id === id)
      return record ? { ...record, departmentIds: [...record.departmentIds], roleIds: [...record.roleIds] } : createInitialForm(section)
    }
  }
}

function getColumns(section: SettingsSection, messages: Messages) {
  switch (section) {
    case "positions":
    case "product-categories":
    case "order-purposes":
    case "branches":
      return [messages.title]
    case "unit-types":
      return [messages.order, messages.code, messages.title]
    case "products":
      return [messages.code, messages.title, messages.category]
    case "roles":
      return [messages.code, messages.title, messages.permissions]
    case "warehouses":
      return [messages.title, messages.branchesField, messages.responsibleUser]
    case "departments":
      return [messages.title, messages.branchesField, messages.warehousesField]
    case "users":
      return [messages.fullName, messages.username, messages.position, messages.departmentsField, messages.role, messages.phoneNumber]
  }
}

function matchesSettingsFilters(
  section: SettingsSection,
  data: ReturnType<typeof useSettings>["data"],
  id: string,
  filters: SettingsFiltersState,
) {
  if (section !== "users" && filters.translationStatus) {
    const record = data[section].find((item) => item.id === id)
    const complete = Boolean(record?.titleUz && record.titleRu && record.titleTr)
    if (filters.translationStatus === "complete" && !complete) return false
    if (filters.translationStatus === "missing" && complete) return false
  }

  switch (section) {
    case "products": {
      const record = data.products.find((item) => item.id === id)
      return !filters.categoryId || record?.categoryId === filters.categoryId
    }
    case "roles":
      return !filters.permission || data.roles.find((item) => item.id === id)?.permissions.includes(filters.permission as PermissionCode)
    case "warehouses": {
      const record = data.warehouses.find((item) => item.id === id)
      return (!filters.branchId || record?.branchIds.includes(filters.branchId)) &&
        (!filters.responsibleUserId || record?.responsibleUserId === filters.responsibleUserId)
    }
    case "departments": {
      const record = data.departments.find((item) => item.id === id)
      return (!filters.branchId || record?.branchIds.includes(filters.branchId)) &&
        (!filters.warehouseId || record?.warehouseIds.includes(filters.warehouseId))
    }
    case "users": {
      const record = data.users.find((item) => item.id === id)
      return (!filters.positionId || record?.positionId === filters.positionId) &&
        (!filters.departmentId || record?.departmentIds.includes(filters.departmentId)) &&
        (!filters.roleId || record?.roleIds.includes(filters.roleId))
    }
    default:
      return true
  }
}

function getRows(
  section: SettingsSection,
  data: ReturnType<typeof useSettings>["data"],
  lang: Locale,
): SettingsTableRow[] {
  const title = (item: LocalizedTitle) => getLocalizedTitle(item, lang)
  const findTitle = (items: (LocalizedTitle & { id: string })[], id?: string) => {
    const item = items.find((candidate) => candidate.id === id)
    return item ? title(item) : "—"
  }
  const joinTitles = (items: (LocalizedTitle & { id: string })[], ids: string[]) =>
    ids.map((id) => findTitle(items, id)).join(", ") || "—"

  switch (section) {
    case "positions":
    case "product-categories":
    case "order-purposes":
    case "branches":
      return data[section].map((item) => ({ id: item.id, cells: [title(item)], searchText: title(item) }))
    case "unit-types":
      return [...data[section]].sort((a, b) => a.order - b.order).map((item) => ({ id: item.id, order: item.order, cells: [item.order, item.code, title(item)], searchText: `${item.code} ${title(item)}` }))
    case "products":
      return data.products.map((item) => ({ id: item.id, cells: [item.code, title(item), findTitle(data["product-categories"], item.categoryId)], searchText: `${item.code} ${title(item)}` }))
    case "roles":
      return data.roles.map((item) => ({
        id: item.id,
        canDelete: !item.isSystem,
        cells: [
          <span key={`${item.id}-code`} className="font-mono text-xs">{item.code}</span>,
          <div key={`${item.id}-title`} className="flex flex-wrap items-center gap-2">
            <span>{title(item)}</span>
            {item.isSystem ? <Badge variant="outline">{lang === "ru" ? "Системная" : lang === "tr" ? "Sistem" : "Tizim"}</Badge> : null}
          </div>,
          <div key={`${item.id}-permissions`} className="flex items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">{item.grantsAll ? permissionCatalog.length : item.permissions.length}</Badge>
          </div>,
        ],
        searchText: `${item.code} ${title(item)} ${item.permissions.join(" ")}`,
      }))
    case "warehouses":
      return data.warehouses.map((item) => ({ id: item.id, cells: [title(item), joinTitles(data.branches, item.branchIds), data.users.find((user) => user.id === item.responsibleUserId)?.fullName ?? "—"], searchText: `${title(item)} ${joinTitles(data.branches, item.branchIds)}` }))
    case "departments":
      return data.departments.map((item) => ({ id: item.id, cells: [title(item), joinTitles(data.branches, item.branchIds), joinTitles(data.warehouses, item.warehouseIds)], searchText: `${title(item)} ${joinTitles(data.branches, item.branchIds)}` }))
    case "users":
      return data.users.map((item) => ({ id: item.id, cells: [item.fullName, item.username, findTitle(data.positions, item.positionId), joinTitles(data.departments, item.departmentIds), joinTitles(data.roles, item.roleIds), item.phoneNumber], searchText: `${item.fullName} ${item.username} ${item.phoneNumber}` }))
  }
}
