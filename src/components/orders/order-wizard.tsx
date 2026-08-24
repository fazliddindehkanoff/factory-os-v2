"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  FileIcon,
  ImageIcon,
  PaperclipIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { SearchableMultiSelect } from "@/components/settings/searchable-multi-select"
import { SearchableSelect } from "@/components/settings/searchable-select"
import { useSettings } from "@/components/settings/settings-provider"
import { useOrders } from "@/components/orders/orders-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Locale, Messages } from "@/lib/i18n"
import { getLocalizedTitle } from "@/lib/settings"
import { cn } from "@/lib/utils"

type OrderLine = {
  id: string
  productId: string
  quantity: string
  note: string
}

type OrderDraft = {
  type: "material" | "service"
  applicantId: string
  departmentIds: string[]
  branchIds: string[]
  warehouseId: string
  purposeId: string
  expectedDate: string
  lines: OrderLine[]
  comment: string
  files: File[]
}

const emptyLine = (): OrderLine => ({
  id: crypto.randomUUID(),
  productId: "",
  quantity: "",
  note: "",
})

export function OrderWizard({ lang, messages, today }: { lang: Locale; messages: Messages; today: string }) {
  const { data } = useSettings()
  const { addOrder } = useOrders()
  const { can } = useAuthorization()
  const [step, setStep] = React.useState(1)
  const [error, setError] = React.useState("")
  const [publishedOrderNumber, setPublishedOrderNumber] = React.useState("")
  const [draft, setDraft] = React.useState<OrderDraft>({
    type: "material",
    applicantId: "",
    departmentIds: [],
    branchIds: [],
    warehouseId: "",
    purposeId: "",
    expectedDate: "",
    lines: [{ id: "order-line-initial", productId: "", quantity: "", note: "" }],
    comment: "",
    files: [],
  })

  const applicant = data.users.find((user) => user.id === draft.applicantId)
  const availableDepartments = data.departments.filter((department) =>
    applicant?.departmentIds.includes(department.id),
  )
  const selectedDepartments = data.departments.filter((department) =>
    draft.departmentIds.includes(department.id),
  )
  const availableBranchIds = [...new Set(selectedDepartments.flatMap((department) => department.branchIds))]
  const availableBranches = data.branches.filter((branch) => availableBranchIds.includes(branch.id))
  const allowedWarehouseIds = new Set(selectedDepartments.flatMap((department) => department.warehouseIds))
  const availableWarehouses = data.warehouses.filter(
    (warehouse) =>
      allowedWarehouseIds.has(warehouse.id) &&
      warehouse.branchIds.some((branchId) => draft.branchIds.includes(branchId)),
  )
  const urgency = getUrgency(draft.expectedDate, today, messages)

  if (!can("requests.create")) {
    return <AccessDenied lang={lang} permissions={["requests.create"]} />
  }

  function updateDraft<K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function selectApplicant(applicantId: string) {
    const user = data.users.find((candidate) => candidate.id === applicantId)
    const departmentIds = user?.departmentIds ?? []
    const selectedDepartmentIds = departmentIds.length === 1 ? departmentIds : []
    const branchIds = data.departments
      .filter((department) => selectedDepartmentIds.includes(department.id))
      .flatMap((department) => department.branchIds)
    const uniqueBranchIds = [...new Set(branchIds)]

    setDraft((current) => ({
      ...current,
      applicantId,
      departmentIds: selectedDepartmentIds,
      branchIds: uniqueBranchIds.length === 1 ? uniqueBranchIds : [],
      warehouseId: "",
    }))
  }

  function selectDepartments(departmentIds: string[]) {
    const branchIds = [...new Set(
      data.departments
        .filter((department) => departmentIds.includes(department.id))
        .flatMap((department) => department.branchIds),
    )]
    setDraft((current) => ({
      ...current,
      departmentIds,
      branchIds: branchIds.length === 1 ? branchIds : current.branchIds.filter((id) => branchIds.includes(id)),
      warehouseId: "",
    }))
  }

  function selectBranches(branchIds: string[]) {
    const validWarehouses = data.warehouses.filter((warehouse) =>
      allowedWarehouseIds.has(warehouse.id) && warehouse.branchIds.some((id) => branchIds.includes(id)),
    )
    setDraft((current) => ({
      ...current,
      branchIds,
      warehouseId: validWarehouses.some((warehouse) => warehouse.id === current.warehouseId)
        ? current.warehouseId
        : "",
    }))
  }

  function updateLine(id: string, key: keyof Omit<OrderLine, "id">, value: string) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => line.id === id ? { ...line, [key]: value } : line),
    }))
  }

  function removeLine(id: string) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.length === 1
        ? [{ id: "order-line-reset", productId: "", quantity: "", note: "" }]
        : current.lines.filter((line) => line.id !== id),
    }))
  }

  function goNext() {
    setError("")
    if (step === 1) {
      if (!draft.applicantId || !draft.departmentIds.length || !draft.branchIds.length || !draft.warehouseId) {
        setError(messages.requiredFields)
        return
      }
      setStep(2)
      return
    }
    if (step === 2) {
      const hasInvalidLine = draft.lines.some((line) => !line.productId || Number(line.quantity) <= 0)
      if (!draft.purposeId || !draft.expectedDate || hasInvalidLine) {
        setError(hasInvalidLine ? messages.atLeastOnePosition : messages.requiredFields)
        return
      }
      setStep(3)
    }
  }

  function publishOrder() {
    const order = addOrder({
      type: draft.type,
      applicantId: draft.applicantId,
      departmentIds: draft.departmentIds,
      branchIds: draft.branchIds,
      warehouseId: draft.warehouseId,
      purposeId: draft.purposeId,
      expectedDate: draft.expectedDate,
      urgency: urgency.key,
      lines: draft.lines.map((line) => ({ ...line, quantity: Number(line.quantity) })),
      comment: draft.comment,
      attachmentNames: draft.files.map((file) => file.name),
    })
    setPublishedOrderNumber(order.number)
  }

  if (publishedOrderNumber) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 text-center">
        <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mx-auto mb-4 w-fit rounded-full bg-emerald-500/10 p-4 text-emerald-600">
            <CheckCircle2Icon className="size-10" />
          </div>
          <h1 className="text-2xl font-semibold">{messages.orderPublished}</h1>
          <p className="mt-2 text-muted-foreground">{messages.orderPublishedDescription}</p>
          <Badge variant="outline" className="mt-4">{publishedOrderNumber}</Badge>
          <div className="mt-6">
            <Link href={`/${lang}/orders`} className={buttonVariants()}>{messages.orderList}</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 pb-8 md:px-6">
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-muted/40 p-5 shadow-sm md:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{messages.orders}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{messages.createOrder}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{step} / 3 {messages.stepOf}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{draft.type === "material" ? messages.material : messages.service}</Badge>
            {applicant ? <Badge variant="outline">{applicant.fullName}</Badge> : null}
            {draft.expectedDate ? <Badge variant={urgency.variant}>{urgency.label}</Badge> : null}
          </div>
        </div>
        <div className="mt-6">
          <OrderStepper step={step} messages={messages} />
        </div>
      </div>

      {step === 1 ? (
        <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm md:p-7">
          <SectionHeading number="1" title={messages.requestContext} />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={messages.orderType}>
              <div className="grid grid-cols-2 gap-2">
                {(["material", "service"] as const).map((type) => (
                  <Button key={type} type="button" variant={draft.type === type ? "default" : "outline"} aria-pressed={draft.type === type} onClick={() => updateDraft("type", type)}>
                    {type === "material" ? messages.material : messages.service}
                  </Button>
                ))}
              </div>
            </Field>
            <Field label={messages.applicant}>
              <SearchableSelect
                options={data.users.map((user) => ({ value: user.id, label: user.fullName, searchValue: `${user.fullName} ${user.username} ${user.phoneNumber}` }))}
                value={draft.applicantId}
                onChange={selectApplicant}
                placeholder={messages.selectApplicant}
                searchPlaceholder={messages.searchOptions}
                emptyText={messages.noOptions}
                ariaLabel={messages.applicant}
              />
            </Field>
            <Field label={messages.departmentsField} hint={availableDepartments.length === 1 ? messages.singleAutoSelected : undefined}>
              <SearchableMultiSelect
                options={availableDepartments.map((department) => ({ value: department.id, label: getLocalizedTitle(department, lang) }))}
                value={draft.departmentIds}
                onChange={selectDepartments}
                placeholder={messages.selectOption}
                searchPlaceholder={messages.searchOptions}
                emptyText={messages.noOptions}
                selectedText={messages.selectedCount}
                clearText={messages.clearSelection}
                doneText={messages.done}
                ariaLabel={messages.departmentsField}
                disabled={!applicant || availableDepartments.length === 1}
              />
            </Field>
            <Field label={messages.branchesField} hint={availableBranches.length === 1 ? messages.singleAutoSelected : undefined}>
              <SearchableMultiSelect
                options={availableBranches.map((branch) => ({ value: branch.id, label: getLocalizedTitle(branch, lang) }))}
                value={draft.branchIds}
                onChange={selectBranches}
                placeholder={messages.selectOption}
                searchPlaceholder={messages.searchOptions}
                emptyText={messages.noOptions}
                selectedText={messages.selectedCount}
                clearText={messages.clearSelection}
                doneText={messages.done}
                ariaLabel={messages.branchesField}
                disabled={!draft.departmentIds.length || availableBranches.length === 1}
              />
            </Field>
            <Field label={messages.warehouse}>
              <SearchableSelect
                options={availableWarehouses.map((warehouse) => ({ value: warehouse.id, label: getLocalizedTitle(warehouse, lang) }))}
                value={draft.warehouseId}
                onChange={(value) => updateDraft("warehouseId", value)}
                placeholder={messages.selectOption}
                searchPlaceholder={messages.searchOptions}
                emptyText={messages.noOptions}
                ariaLabel={messages.warehouse}
                disabled={!draft.branchIds.length}
              />
            </Field>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm md:p-7">
          <SectionHeading number="2" title={messages.orderDetails} />
          <div className="grid gap-5 md:grid-cols-3">
            <Field label={messages.purpose}>
              <SearchableSelect
                options={data["order-purposes"].map((purpose) => ({ value: purpose.id, label: getLocalizedTitle(purpose, lang) }))}
                value={draft.purposeId}
                onChange={(value) => updateDraft("purposeId", value)}
                placeholder={messages.selectOption}
                searchPlaceholder={messages.searchOptions}
                emptyText={messages.noOptions}
                ariaLabel={messages.purpose}
              />
            </Field>
            <Field label={messages.expectedDate} htmlFor="order-expected-date">
              <Input id="order-expected-date" type="date" min={today} value={draft.expectedDate} onChange={(event) => updateDraft("expectedDate", event.target.value)} />
            </Field>
            <Field label={messages.urgency}>
              <div className="flex h-9 items-center">
                <Badge variant={urgency.variant}>{urgency.label}</Badge>
              </div>
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{messages.orderPositions}</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => updateDraft("lines", [...draft.lines, emptyLine()])}>
                <PlusIcon />
                {messages.addPosition}
              </Button>
            </div>
            <div className="space-y-3">
              {draft.lines.map((line, index) => {
                const product = data.products.find((candidate) => candidate.id === line.productId)
                const unit = data["unit-types"].find((candidate) => candidate.id === product?.unitTypeId)
                return (
                  <div key={line.id} className="grid gap-3 rounded-xl border bg-muted/25 p-4 shadow-xs md:grid-cols-[minmax(14rem,2fr)_minmax(7rem,.7fr)_minmax(8rem,.8fr)_minmax(12rem,1.4fr)_auto] md:items-end">
                    <Field label={`${index + 1}. ${messages.product}`}>
                      <SearchableSelect
                        options={data.products.map((item) => ({
                          value: item.id,
                          label: `${item.code} · ${getLocalizedTitle(item, lang)}`,
                          searchValue: `${item.code} ${item.titleUz} ${item.titleRu} ${item.titleTr}`,
                        }))}
                        value={line.productId}
                        onChange={(value) => updateLine(line.id, "productId", value)}
                        placeholder={messages.selectOption}
                        searchPlaceholder={messages.productSearch}
                        emptyText={messages.noProducts}
                        ariaLabel={`${messages.product} ${index + 1}`}
                      />
                    </Field>
                    <Field label={messages.quantity} htmlFor={`quantity-${line.id}`}>
                      <Input id={`quantity-${line.id}`} type="number" min="0.001" step="any" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} />
                    </Field>
                    <Field label={messages.unit}>
                      <Input disabled value={unit ? `${getLocalizedTitle(unit, lang)} (${unit.code})` : "—"} />
                    </Field>
                    <Field label={messages.note} htmlFor={`note-${line.id}`}>
                      <Input id={`note-${line.id}`} value={line.note} onChange={(event) => updateLine(line.id, "note", event.target.value)} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={messages.removePosition} title={messages.removePosition} onClick={() => removeLine(line.id)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label={messages.comment} htmlFor="order-comment">
              <Textarea id="order-comment" rows={5} value={draft.comment} onChange={(event) => updateDraft("comment", event.target.value)} />
            </Field>
            {can("requests.upload_attachment") ? <Field label={messages.attachments}>
              <div className="space-y-3">
                <Label htmlFor="order-files" className={buttonVariants({ variant: "outline", className: "w-fit cursor-pointer" })}>
                  <PaperclipIcon />
                  {messages.addFiles}
                </Label>
                <Input id="order-files" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="sr-only" onChange={(event) => updateDraft("files", [...draft.files, ...Array.from(event.target.files ?? [])])} />
                <div className="flex flex-wrap gap-2">
                  {draft.files.map((file, index) => (
                    <Badge key={`${file.name}-${index}`} variant="secondary" className="gap-1.5 py-1">
                      {file.type.startsWith("image/") ? <ImageIcon /> : <FileIcon />}
                      <span className="max-w-40 truncate">{file.name}</span>
                      <button type="button" aria-label={`${messages.delete}: ${file.name}`} onClick={() => updateDraft("files", draft.files.filter((_, fileIndex) => fileIndex !== index))}>×</button>
                    </Badge>
                  ))}
                </div>
              </div>
            </Field> : null}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <ReviewOrder draft={draft} data={data} lang={lang} messages={messages} urgency={urgency.label} />
      ) : null}

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="sticky bottom-3 z-10 flex items-center justify-between rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur md:px-5">
        <Button type="button" variant="outline" disabled={step === 1} onClick={() => { setError(""); setStep((current) => Math.max(1, current - 1)) }}>
          <ArrowLeftIcon />
          {messages.back}
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={goNext}>
            {messages.next}
            <ArrowRightIcon />
          </Button>
        ) : (
          <Button type="button" onClick={publishOrder}>
            <SendIcon />
            {messages.sendOrder}
          </Button>
        )}
      </div>
    </div>
  )
}

function OrderStepper({ step, messages }: { step: number; messages: Messages }) {
  const steps = [messages.requestContext, messages.orderDetails, messages.reviewAndSend]
  return (
    <ol className="grid grid-cols-3 gap-2 md:gap-3" aria-label={messages.createOrder}>
      {steps.map((label, index) => {
        const number = index + 1
        return (
          <li
            key={label}
            className={cn(
              "min-w-0 rounded-xl border p-2.5 transition-colors md:p-3",
              number === step ? "border-primary/30 bg-primary/5" : "border-transparent bg-muted/45",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", number <= step ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>{number}</span>
              <span className={cn("line-clamp-2 text-[11px] leading-tight md:text-xs", number === step ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b pb-3">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">{number}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  )
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function getUrgency(date: string, todayDate: string, messages: Messages) {
  if (!date) return { key: "normal" as const, label: messages.urgencyNormal, variant: "secondary" as const }
  const today = new Date(`${todayDate}T00:00:00`)
  const expected = new Date(`${date}T00:00:00`)
  const days = Math.ceil((expected.getTime() - today.getTime()) / 86_400_000)
  if (days <= 1) return { key: "critical" as const, label: messages.urgencyCritical, variant: "destructive" as const }
  if (days <= 3) return { key: "urgent" as const, label: messages.urgencyUrgent, variant: "destructive" as const }
  if (days <= 7) return { key: "high" as const, label: messages.urgencyHigh, variant: "default" as const }
  return { key: "normal" as const, label: messages.urgencyNormal, variant: "secondary" as const }
}

function ReviewOrder({
  draft,
  data,
  lang,
  messages,
  urgency,
}: {
  draft: OrderDraft
  data: ReturnType<typeof useSettings>["data"]
  lang: Locale
  messages: Messages
  urgency: string
}) {
  const title = (items: Array<{ id: string; titleUz: string; titleRu: string; titleTr: string }>, id: string) => {
    const item = items.find((candidate) => candidate.id === id)
    return item ? getLocalizedTitle(item, lang) : "—"
  }
  const applicant = data.users.find((user) => user.id === draft.applicantId)

  return (
    <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm md:p-7">
      <SectionHeading number="3" title={messages.reviewAndSend} />
      <div className="grid gap-4 rounded-xl bg-muted/45 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReviewValue label={messages.orderType} value={draft.type === "material" ? messages.material : messages.service} />
        <ReviewValue label={messages.applicant} value={applicant?.fullName ?? "—"} />
        <ReviewValue label={messages.departmentsField} value={draft.departmentIds.map((id) => title(data.departments, id)).join(", ")} />
        <ReviewValue label={messages.branchesField} value={draft.branchIds.map((id) => title(data.branches, id)).join(", ")} />
        <ReviewValue label={messages.warehouse} value={title(data.warehouses, draft.warehouseId)} />
        <ReviewValue label={messages.purpose} value={title(data["order-purposes"], draft.purposeId)} />
        <ReviewValue label={messages.expectedDate} value={draft.expectedDate} />
        <ReviewValue label={messages.urgency} value={urgency} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left">
            <tr><th className="p-2">#</th><th className="p-2">{messages.product}</th><th className="p-2">{messages.quantity}</th><th className="p-2">{messages.unit}</th><th className="p-2">{messages.note}</th></tr>
          </thead>
          <tbody>
            {draft.lines.map((line, index) => {
              const product = data.products.find((item) => item.id === line.productId)
              const unit = data["unit-types"].find((item) => item.id === product?.unitTypeId)
              return <tr key={line.id} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2 font-medium">{product ? `${product.code} · ${getLocalizedTitle(product, lang)}` : "—"}</td><td className="p-2">{line.quantity}</td><td className="p-2">{unit ? `${getLocalizedTitle(unit, lang)} (${unit.code})` : "—"}</td><td className="p-2">{line.note || "—"}</td></tr>
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReviewValue label={messages.comment} value={draft.comment || "—"} />
        <ReviewValue label={messages.attachments} value={draft.files.map((file) => file.name).join(", ") || "—"} />
      </div>
    </section>
  )
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>
}
