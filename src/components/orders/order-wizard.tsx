"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  FileIcon,
  ImageIcon,
  LanguagesIcon,
  LoaderCircleIcon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Locale, Messages } from "@/lib/i18n"
import { saveOrderAttachments } from "@/lib/order-attachments"
import type { OrderAttachment, OrderRecord } from "@/lib/orders"
import { getLocalizedTitle, type Product } from "@/lib/settings"
import { cn } from "@/lib/utils"

type OrderLine = {
  id: string
  productId: string
  unitTypeId: string
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
  existingAttachmentNames: string[]
  existingAttachments: OrderAttachment[]
}

const emptyLine = (): OrderLine => ({
  id: crypto.randomUUID(),
  productId: "",
  unitTypeId: "",
  quantity: "",
  note: "",
})

export function OrderWizard({
  lang,
  messages,
  today,
  reviseOrderId,
}: {
  lang: Locale
  messages: Messages
  today: string
  reviseOrderId?: string
}) {
  const { orders, storageReady } = useOrders()
  const { currentUser } = useAuthorization()
  const revisionOrder = reviseOrderId
    ? orders.find((order) => order.id === reviseOrderId)
    : undefined

  if (reviseOrderId && !storageReady) {
    return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">{revisionCopy(lang).loading}</div>
  }
  if (
    reviseOrderId &&
    (!revisionOrder ||
      revisionOrder.status !== "rejected" ||
      revisionOrder.createdByUserId !== currentUser?.id)
  ) {
    return <AccessDenied lang={lang} permissions={["requests.create"]} />
  }

  return (
    <OrderWizardForm
      key={`${revisionOrder?.id ?? "new-order"}:${currentUser?.id ?? "anonymous"}`}
      lang={lang}
      messages={messages}
      today={today}
      revisionOrder={revisionOrder}
    />
  )
}

function OrderWizardForm({
  lang,
  messages,
  today,
  revisionOrder,
}: {
  lang: Locale
  messages: Messages
  today: string
  revisionOrder?: OrderRecord
}) {
  const { data, mergeProduct } = useSettings()
  const { addOrder, resubmitOrder } = useOrders()
  const { can, currentUser } = useAuthorization()
  const assistantCreatesForSupervisors = currentUser?.roleIds.includes("role-requester") ?? false
  const applicantIsCurrentUser = Boolean(currentUser && !assistantCreatesForSupervisors)
  const isDepartmentSupervisor = currentUser?.roleIds.includes("role-dept_head") ?? false
  const assignedDepartmentIds = data.departments
    .filter((department) => currentUser?.departmentIds.includes(department.id))
    .map((department) => department.id)
  const initialDepartmentIds = applicantIsCurrentUser && assignedDepartmentIds.length === 1
    ? assignedDepartmentIds
    : []
  const initialBranchIds = getBranchIds(initialDepartmentIds)
  const selectedInitialBranchIds = initialBranchIds.length === 1 ? initialBranchIds : []
  const initialWarehouses = getWarehouses(initialDepartmentIds, selectedInitialBranchIds)
  const revisionSupervisor = revisionOrder && assistantCreatesForSupervisors
    ? data.users.find(
        (user) =>
          user.roleIds.includes("role-dept_head") &&
          user.departmentIds.some((id) => revisionOrder.departmentIds.includes(id)),
      )
    : undefined
  const fixedRevisionApplicant = applicantIsCurrentUser ? currentUser : revisionSupervisor
  const revisionApplicantId = fixedRevisionApplicant?.id ?? revisionOrder?.applicantId ?? ""
  const revisionDepartmentIds = fixedRevisionApplicant
    ? revisionOrder?.departmentIds.filter((id) => fixedRevisionApplicant.departmentIds.includes(id)) ?? []
    : revisionOrder?.departmentIds ?? []
  const normalizedRevisionDepartmentIds = revisionDepartmentIds.length
    ? revisionDepartmentIds
    : fixedRevisionApplicant?.departmentIds ?? []
  const revisionAllowedBranchIds = [
    ...new Set(
      data.departments
        .filter((department) => normalizedRevisionDepartmentIds.includes(department.id))
        .flatMap((department) => department.branchIds),
    ),
  ]
  const matchingRevisionBranchIds = revisionOrder?.branchIds.filter((id) =>
    revisionAllowedBranchIds.includes(id),
  ) ?? []
  const normalizedRevisionBranchIds = matchingRevisionBranchIds.length
    ? matchingRevisionBranchIds
    : revisionAllowedBranchIds.length === 1
      ? revisionAllowedBranchIds
      : []
  const revisionAllowedWarehouseIds = new Set(
    data.departments
      .filter((department) => normalizedRevisionDepartmentIds.includes(department.id))
      .flatMap((department) => department.warehouseIds),
  )
  const matchingRevisionWarehouseId = revisionOrder &&
    revisionAllowedWarehouseIds.has(revisionOrder.warehouseId) &&
    data.warehouses
      .find((warehouse) => warehouse.id === revisionOrder.warehouseId)
      ?.branchIds.some((id) => normalizedRevisionBranchIds.includes(id))
    ? revisionOrder.warehouseId
    : ""
  const revisionWarehouses = getWarehouses(
    normalizedRevisionDepartmentIds,
    normalizedRevisionBranchIds,
  )
  const normalizedRevisionWarehouseId = matchingRevisionWarehouseId ||
    (revisionWarehouses.length === 1 ? revisionWarehouses[0].id : "")
  const legacyApplicantAdjusted = Boolean(
    revisionOrder && fixedRevisionApplicant && revisionOrder.applicantId !== fixedRevisionApplicant.id,
  )
  const [step, setStep] = React.useState(1)
  const [error, setError] = React.useState("")
  const [publishedOrderNumber, setPublishedOrderNumber] = React.useState("")
  const [publishing, setPublishing] = React.useState(false)
  const [productDialog, setProductDialog] = React.useState<{
    lineId: string
    initialTitle: string
  } | null>(null)
  const [draft, setDraft] = React.useState<OrderDraft>(() =>
    revisionOrder
      ? {
          type: revisionOrder.type,
          applicantId: revisionApplicantId,
          departmentIds: normalizedRevisionDepartmentIds,
          branchIds: normalizedRevisionBranchIds,
          warehouseId: normalizedRevisionWarehouseId,
          purposeId: revisionOrder.purposeId,
          expectedDate: revisionOrder.expectedDate,
          lines: revisionOrder.lines.map((line) => ({
            id: line.id,
            productId: line.productId,
            unitTypeId: line.unitTypeId ?? data.products.find((product) => product.id === line.productId)?.unitTypeId ?? "",
            quantity: String(line.quantity),
            note: line.note,
          })),
          comment: revisionOrder.comment,
          files: [],
          existingAttachmentNames: revisionOrder.attachmentNames,
          existingAttachments: revisionOrder.attachments ?? [],
        }
      : {
          type: "material",
          applicantId: applicantIsCurrentUser ? currentUser?.id ?? "" : "",
          departmentIds: initialDepartmentIds,
          branchIds: selectedInitialBranchIds,
          warehouseId: initialWarehouses.length === 1 ? initialWarehouses[0].id : "",
          purposeId: "",
          expectedDate: "",
          lines: [{ id: "order-line-initial", productId: "", unitTypeId: "", quantity: "", note: "" }],
          comment: "",
          files: [],
          existingAttachmentNames: [],
          existingAttachments: [],
        },
  )

  const availableApplicants = assistantCreatesForSupervisors
    ? data.users.filter((user) => user.roleIds.includes("role-dept_head"))
    : []
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

  function getBranchIds(departmentIds: string[]) {
    return [...new Set(
      data.departments
        .filter((department) => departmentIds.includes(department.id))
        .flatMap((department) => department.branchIds),
    )]
  }

  function getWarehouses(departmentIds: string[], branchIds: string[]) {
    const warehouseIds = new Set(
      data.departments
        .filter((department) => departmentIds.includes(department.id))
        .flatMap((department) => department.warehouseIds),
    )
    return data.warehouses.filter(
      (warehouse) =>
        warehouseIds.has(warehouse.id) &&
        warehouse.branchIds.some((branchId) => branchIds.includes(branchId)),
    )
  }

  function selectApplicant(applicantId: string) {
    const user = data.users.find((candidate) => candidate.id === applicantId)
    const departmentIds = user?.departmentIds ?? []
    const selectedDepartmentIds = departmentIds.length === 1 ? departmentIds : []
    const branchIds = data.departments
      .filter((department) => selectedDepartmentIds.includes(department.id))
      .flatMap((department) => department.branchIds)
    const uniqueBranchIds = [...new Set(branchIds)]
    const selectedBranchIds = uniqueBranchIds.length === 1 ? uniqueBranchIds : []
    const warehouses = getWarehouses(selectedDepartmentIds, selectedBranchIds)

    setDraft((current) => ({
      ...current,
      applicantId,
      departmentIds: selectedDepartmentIds,
      branchIds: selectedBranchIds,
      warehouseId: warehouses.length === 1 ? warehouses[0].id : "",
    }))
  }

  function selectDepartments(departmentIds: string[]) {
    const branchIds = getBranchIds(departmentIds)
    setDraft((current) => {
      const selectedBranchIds = branchIds.length === 1
        ? branchIds
        : current.branchIds.filter((id) => branchIds.includes(id))
      const warehouses = getWarehouses(departmentIds, selectedBranchIds)
      return {
        ...current,
        departmentIds,
        branchIds: selectedBranchIds,
        warehouseId: warehouses.length === 1
          ? warehouses[0].id
          : warehouses.some((warehouse) => warehouse.id === current.warehouseId)
            ? current.warehouseId
            : "",
      }
    })
  }

  function selectBranches(branchIds: string[]) {
    const validWarehouses = getWarehouses(draft.departmentIds, branchIds)
    setDraft((current) => ({
      ...current,
      branchIds,
      warehouseId: validWarehouses.length === 1
        ? validWarehouses[0].id
        : validWarehouses.some((warehouse) => warehouse.id === current.warehouseId)
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
        ? [{ id: "order-line-reset", productId: "", unitTypeId: "", quantity: "", note: "" }]
        : current.lines.filter((line) => line.id !== id),
    }))
  }

  function selectCreatedProduct(product: Product) {
    mergeProduct(product)
    if (productDialog) updateLine(productDialog.lineId, "productId", product.id)
    setProductDialog(null)
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
      const hasInvalidLine = draft.lines.some(
        (line) => !line.productId || !line.unitTypeId || Number(line.quantity) <= 0,
      )
      if (!draft.purposeId || !draft.expectedDate || hasInvalidLine) {
        setError(hasInvalidLine ? messages.atLeastOnePosition : messages.requiredFields)
        return
      }
      setStep(3)
    }
  }

  async function publishOrder() {
    setError("")
    setPublishing(true)
    let uploadedAttachments: OrderAttachment[]
    try {
      uploadedAttachments = await saveOrderAttachments(draft.files)
    } catch {
      setError(messages.attachmentSaveFailed)
      setPublishing(false)
      return
    }

    const payload = {
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
      attachmentNames: [
        ...draft.existingAttachmentNames,
        ...draft.files.map((file) => file.name),
      ],
      attachments: [...draft.existingAttachments, ...uploadedAttachments],
    }
    let order: OrderRecord | undefined
    try {
      order = revisionOrder
        ? resubmitOrder(revisionOrder.id, payload)
        : addOrder(payload)
    } catch {
      setError(revisionCopy(lang).unableToResubmit)
      setPublishing(false)
      return
    }
    if (!order) {
      setError(revisionCopy(lang).unableToResubmit)
      setPublishing(false)
      return
    }
    setPublishedOrderNumber(order.number)
    setPublishing(false)
  }

  if (publishedOrderNumber) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 text-center">
        <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mx-auto mb-4 w-fit rounded-full bg-emerald-500/10 p-4 text-emerald-600">
            <CheckCircle2Icon className="size-10" />
          </div>
          <h1 className="text-2xl font-semibold">
            {revisionOrder ? revisionCopy(lang).resubmitted : messages.orderPublished}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {revisionOrder ? revisionCopy(lang).resubmittedDescription : messages.orderPublishedDescription}
          </p>
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
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              {revisionOrder ? revisionCopy(lang).editTitle : messages.createOrder}
            </h1>
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

      {legacyApplicantAdjusted ? (
        <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm" role="status">
          {revisionCopy(lang).supervisorAdjusted}
        </p>
      ) : null}

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
            {applicantIsCurrentUser ? (
              <Field label={messages.applicant} hint={supervisorApplicantHint(lang)}>
                <div
                  className="flex min-h-9 items-center rounded-lg border bg-muted/35 px-3 text-sm font-medium"
                  aria-label={messages.applicant}
                >
                  {currentUser?.fullName ?? "—"}
                </div>
              </Field>
            ) : (
              <Field
                label={messages.applicant}
                hint={assistantCreatesForSupervisors ? supervisorOnlyHint(lang) : undefined}
              >
                <SearchableSelect
                  options={availableApplicants.map((user) => {
                    const roleNames = data.roles
                      .filter((role) => user.roleIds.includes(role.id))
                      .map((role) => getLocalizedTitle(role, lang))
                    const departmentNames = data.departments
                      .filter((department) => user.departmentIds.includes(department.id))
                      .map((department) => getLocalizedTitle(department, lang))
                    const roleLabel = roleNames.join(", ") || "—"
                    const departmentLabel = departmentNames.join(", ") || "—"

                    return {
                      value: user.id,
                      label: user.fullName,
                      searchValue: `${user.fullName} ${user.username} ${user.phoneNumber} ${roleLabel} ${departmentLabel}`,
                      details: [roleLabel, departmentLabel],
                    }
                  })}
                  value={draft.applicantId}
                  onChange={selectApplicant}
                  placeholder={messages.selectApplicant}
                  searchPlaceholder={messages.searchOptions}
                  emptyText={messages.noOptions}
                  ariaLabel={messages.applicant}
                />
              </Field>
            )}
            <Field label={messages.departmentsField} hint={availableDepartments.length === 1 ? messages.singleAutoSelected : undefined}>
              {isDepartmentSupervisor ? (
                <SearchableSelect
                  options={availableDepartments.map((department) => ({ value: department.id, label: getLocalizedTitle(department, lang) }))}
                  value={draft.departmentIds[0] ?? ""}
                  onChange={(value) => selectDepartments([value])}
                  placeholder={messages.selectOption}
                  searchPlaceholder={messages.searchOptions}
                  emptyText={messages.noOptions}
                  ariaLabel={messages.departmentsField}
                  disabled={!applicant || availableDepartments.length === 1}
                />
              ) : (
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
              )}
            </Field>
            <Field label={messages.branchesField} hint={availableBranches.length === 1 ? messages.singleAutoSelected : undefined}>
              {isDepartmentSupervisor ? (
                <SearchableSelect
                  options={availableBranches.map((branch) => ({ value: branch.id, label: getLocalizedTitle(branch, lang) }))}
                  value={draft.branchIds[0] ?? ""}
                  onChange={(value) => selectBranches([value])}
                  placeholder={messages.selectOption}
                  searchPlaceholder={messages.searchOptions}
                  emptyText={messages.noOptions}
                  ariaLabel={messages.branchesField}
                  disabled={!draft.departmentIds.length || availableBranches.length === 1}
                />
              ) : (
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
              )}
            </Field>
            <Field label={messages.warehouse} hint={availableWarehouses.length === 1 ? messages.singleAutoSelected : undefined}>
              <SearchableSelect
                options={availableWarehouses.map((warehouse) => ({ value: warehouse.id, label: getLocalizedTitle(warehouse, lang) }))}
                value={draft.warehouseId}
                onChange={(value) => updateDraft("warehouseId", value)}
                placeholder={messages.selectOption}
                searchPlaceholder={messages.searchOptions}
                emptyText={messages.noOptions}
                ariaLabel={messages.warehouse}
                disabled={!draft.branchIds.length || availableWarehouses.length === 1}
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
              <Input
                id="order-expected-date"
                type="date"
                min={today}
                value={draft.expectedDate}
                onClick={(event) => event.currentTarget.showPicker()}
                onChange={(event) => updateDraft("expectedDate", event.target.value)}
              />
            </Field>
            <Field label={messages.urgency}>
              <div className="flex h-9 items-center">
                <Badge variant={urgency.variant}>{urgency.label}</Badge>
              </div>
            </Field>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold">{messages.orderPositions}</h2>
            <div className="space-y-3">
              {draft.lines.map((line, index) => {
                return (
                  <div key={line.id} className="grid gap-3 rounded-xl border bg-muted/25 p-4 shadow-xs lg:grid-cols-[minmax(14rem,2fr)_minmax(7rem,.7fr)_minmax(8rem,.8fr)_minmax(12rem,1.4fr)_auto] lg:items-start">
                    <Field label={`${index + 1}. ${messages.product}`}>
                      <div className="space-y-2">
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
                          createFromSearch={{
                            label: (query) => messages.createProductFromSearch.replace("{query}", query),
                            onSelect: (query) => setProductDialog({ lineId: line.id, initialTitle: query }),
                          }}
                        />
                      </div>
                    </Field>
                    <Field label={messages.quantity} htmlFor={`quantity-${line.id}`}>
                      <Input id={`quantity-${line.id}`} type="number" min="0.001" step="any" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} />
                    </Field>
                    <Field label={messages.unit}>
                      <SearchableSelect
                        options={[...data["unit-types"]]
                          .sort((a, b) => a.order - b.order)
                          .map((unit) => ({
                            value: unit.id,
                            label: `${getLocalizedTitle(unit, lang)} (${unit.code})`,
                            searchValue: `${unit.code} ${unit.titleUz} ${unit.titleRu} ${unit.titleTr}`,
                          }))}
                        value={line.unitTypeId}
                        onChange={(value) => updateLine(line.id, "unitTypeId", value)}
                        placeholder={messages.selectOption}
                        searchPlaceholder={messages.searchOptions}
                        emptyText={messages.noOptions}
                        ariaLabel={`${messages.unit} ${index + 1}`}
                      />
                    </Field>
                    <Field label={messages.note} htmlFor={`note-${line.id}`}>
                      <Textarea id={`note-${line.id}`} rows={3} value={line.note} onChange={(event) => updateLine(line.id, "note", event.target.value)} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive lg:mt-6" aria-label={messages.removePosition} title={messages.removePosition} onClick={() => removeLine(line.id)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                )
              })}
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-12 w-full border-dashed"
                onClick={() => updateDraft("lines", [...draft.lines, emptyLine()])}
              >
                <PlusIcon />
                {messages.addPosition}
              </Button>
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
                  {draft.existingAttachmentNames.map((name, index) => (
                    <Badge key={`existing-${name}-${index}`} variant="outline" className="gap-1.5 py-1">
                      <FileIcon />
                      <span className="max-w-40 truncate">{name}</span>
                      <button
                        type="button"
                        aria-label={`${messages.delete}: ${name}`}
                        onClick={() => setDraft((current) => ({
                          ...current,
                          existingAttachmentNames: current.existingAttachmentNames.filter((_, itemIndex) => itemIndex !== index),
                          existingAttachments: current.existingAttachments.filter((attachment) => attachment.name !== name),
                        }))}
                      >×</button>
                    </Badge>
                  ))}
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
          <Button type="button" onClick={publishOrder} disabled={publishing}>
            {publishing ? <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" /> : <SendIcon />}
            {revisionOrder ? revisionCopy(lang).resend : messages.sendOrder}
          </Button>
        )}
      </div>

      {productDialog ? (
        <CreateProductDialog
          lang={lang}
          messages={messages}
          categories={data["product-categories"]}
          initialTitle={productDialog.initialTitle}
          onOpenChange={(open) => { if (!open) setProductDialog(null) }}
          onCreated={selectCreatedProduct}
        />
      ) : null}
    </div>
  )
}

function CreateProductDialog({
  lang,
  messages,
  categories,
  initialTitle,
  onOpenChange,
  onCreated,
}: {
  lang: Locale
  messages: Messages
  categories: ReturnType<typeof useSettings>["data"]["product-categories"]
  initialTitle: string
  onOpenChange: (open: boolean) => void
  onCreated: (product: Product) => void
}) {
  const [form, setForm] = React.useState(() => ({
    categoryId: "",
    titleUz: lang === "uz" ? initialTitle : "",
    titleRu: lang === "ru" ? initialTitle : "",
    titleTr: lang === "tr" ? initialTitle : "",
  }))
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [translating, setTranslating] = React.useState(false)

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!form.categoryId) {
      setError(messages.requiredFields)
      return
    }
    if (![form.titleUz, form.titleRu, form.titleTr].some((title) => title.trim())) {
      setError(messages.oneTitleRequired)
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const result = await response.json() as { product?: Product; error?: string }
      if (!response.ok || !result.product) {
        setError(result.error === "product-code-exists" ? messages.productCodeExists : messages.productCreateFailed)
        return
      }
      onCreated(result.product)
    } catch {
      setError(messages.productCreateFailed)
    } finally {
      setSaving(false)
    }
  }

  async function translateTitles() {
    setError("")
    const source = [
      { locale: "uz" as const, value: form.titleUz },
      { locale: "ru" as const, value: form.titleRu },
      { locale: "tr" as const, value: form.titleTr },
    ].find((item) => item.value.trim())
    if (!source) {
      setError(messages.oneTitleRequired)
      return
    }

    setTranslating(true)
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source.value, sourceLocale: source.locale }),
      })
      if (!response.ok) throw new Error("translation-failed")
      const translated = await response.json() as Record<Locale, string>
      setForm((current) => ({
        ...current,
        titleUz: current.titleUz || translated.uz,
        titleRu: current.titleRu || translated.ru,
        titleTr: current.titleTr || translated.tr,
      }))
    } catch {
      setError(messages.translationFailed)
    } finally {
      setTranslating(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={createProduct}>
          <DialogHeader>
            <DialogTitle>{messages.createProduct}</DialogTitle>
            <DialogDescription>{messages.createProductDescription}</DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Button type="button" variant="outline" onClick={translateTitles} disabled={saving || translating}>
              {translating ? <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" /> : <LanguagesIcon />}
              {translating ? messages.translating : messages.autoFillTranslations}
            </Button>
          </div>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label={messages.category}>
              <SearchableSelect
                options={categories.map((category) => ({ value: category.id, label: getLocalizedTitle(category, lang) }))}
                value={form.categoryId}
                onChange={(value) => updateField("categoryId", value)}
                placeholder={messages.selectOption}
                searchPlaceholder={messages.searchOptions}
                emptyText={messages.noOptions}
                ariaLabel={messages.category}
              />
            </Field>
            <div className="hidden sm:block" />
            <Field label={messages.titleUz} htmlFor="new-product-title-uz">
              <Input id="new-product-title-uz" value={form.titleUz} onChange={(event) => updateField("titleUz", event.target.value)} autoFocus={lang === "uz"} />
            </Field>
            <Field label={messages.titleRu} htmlFor="new-product-title-ru">
              <Input id="new-product-title-ru" value={form.titleRu} onChange={(event) => updateField("titleRu", event.target.value)} autoFocus={lang === "ru"} />
            </Field>
            <Field label={messages.titleTr} htmlFor="new-product-title-tr">
              <Input id="new-product-title-tr" value={form.titleTr} onChange={(event) => updateField("titleTr", event.target.value)} autoFocus={lang === "tr"} />
            </Field>
          </div>
          {error ? <p role="alert" className="pb-4 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{messages.cancel}</Button>
            <Button type="submit" disabled={saving}>{messages.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

function supervisorOnlyHint(lang: Locale) {
  return lang === "ru"
    ? "Ассистент может создать заявку только для руководителя отдела."
    : lang === "tr"
      ? "Asistan yalnızca bir bölüm yöneticisi için talep oluşturabilir."
      : "Assistant buyurtmani faqat bo‘lim rahbari uchun yaratishi mumkin."
}

function supervisorApplicantHint(lang: Locale) {
  return lang === "ru"
    ? "Вы автоматически указаны как заявитель."
    : lang === "tr"
      ? "Talep sahibi olarak otomatik atandınız."
      : "Siz avtomatik ravishda arizachi sifatida belgilandingiz."
}

function revisionCopy(lang: Locale) {
  if (lang === "ru") return {
    loading: "Загрузка заявки…",
    editTitle: "Изменить отклонённую заявку",
    resend: "Отправить снова",
    resubmitted: "Заявка отправлена повторно",
    resubmittedDescription: "Изменённая заявка снова отправлена руководителю отдела.",
    unableToResubmit: "Не удалось отправить заявку повторно. Обновите страницу и попробуйте ещё раз.",
    supervisorAdjusted: "Для этой старой заявки заявитель автоматически изменён на руководителя выбранного отдела. Проверьте данные и отправьте заявку снова.",
  }
  if (lang === "tr") return {
    loading: "Talep yükleniyor…",
    editTitle: "Reddedilen talebi düzenle",
    resend: "Yeniden gönder",
    resubmitted: "Talep yeniden gönderildi",
    resubmittedDescription: "Düzenlenen talep bölüm yöneticisine tekrar gönderildi.",
    unableToResubmit: "Talep yeniden gönderilemedi. Sayfayı yenileyip tekrar deneyin.",
    supervisorAdjusted: "Bu eski talebin sahibi otomatik olarak seçili bölümün yöneticisiyle değiştirildi. Bilgileri kontrol edip yeniden gönderin.",
  }
  return {
    loading: "Buyurtma yuklanmoqda…",
    editTitle: "Rad etilgan buyurtmani tahrirlash",
    resend: "Qayta yuborish",
    resubmitted: "Buyurtma qayta yuborildi",
    resubmittedDescription: "Tahrirlangan buyurtma bo‘lim rahbariga qayta yuborildi.",
    unableToResubmit: "Buyurtmani qayta yuborib bo‘lmadi. Sahifani yangilab, qayta urinib ko‘ring.",
    supervisorAdjusted: "Ushbu eski buyurtmaning arizachisi avtomatik ravishda tanlangan bo‘lim rahbariga o‘zgartirildi. Ma’lumotlarni tekshirib, qayta yuboring.",
  }
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
              const unit = data["unit-types"].find((item) => item.id === line.unitTypeId)
              return <tr key={line.id} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2 font-medium">{product ? `${product.code} · ${getLocalizedTitle(product, lang)}` : "—"}</td><td className="p-2">{line.quantity}</td><td className="p-2">{unit ? `${getLocalizedTitle(unit, lang)} (${unit.code})` : "—"}</td><td className="p-2">{line.note || "—"}</td></tr>
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReviewValue label={messages.comment} value={draft.comment || "—"} />
        <ReviewValue
          label={messages.attachments}
          value={[
            ...draft.existingAttachmentNames,
            ...draft.files.map((file) => file.name),
          ].join(", ") || "—"}
        />
      </div>
    </section>
  )
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>
}
