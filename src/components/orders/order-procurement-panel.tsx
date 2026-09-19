"use client"

import * as React from "react"
import {
  BanknoteIcon,
  CalculatorIcon,
  CheckCircle2Icon,
  CheckIcon,
  Clock3Icon,
  FilePlus2Icon,
  PackageCheckIcon,
  PhoneIcon,
  SendIcon,
  XIcon,
} from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { ProcurementLineAssignment } from "@/components/orders/procurement-line-assignment"
import { useProcurement } from "@/components/procurement/procurement-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Locale, Messages } from "@/lib/i18n"
import { getAssignedProcurementLineIds, getProcurementSuborderForSpecialist, type OrderRecord } from "@/lib/orders"
import { getLocalDateInputValue, getRequiredProcurementQuantity, isExpectedDeliveryDateAllowed, normalizeSupplierPhone, quotationLinesCoverRequirements, type ProcurementStage, type QuotationRecord } from "@/lib/procurement"
import { getLocalizedTitle } from "@/lib/settings"

export function OrderProcurementPanel({ order, lang, messages }: {
  order: OrderRecord
  lang: Locale
  messages: Messages
}) {
  const { can, currentUser } = useAuthorization()
  const { data } = useSettings()
  const {
    cases,
    quotations,
    findSupplierByPhone,
    addQuotation,
    submitForReview,
    approveQuotations,
    rejectOffers,
  } = useProcurement()
  const copy = procurementOrderCopy(lang)
  const procurementCase = cases.find((item) => item.orderId === order.id)
  const requiredLines = order.lines.filter((line) => line.fulfillmentStatus === "needs_procurement")
  const caseQuotes = procurementCase
    ? quotations.filter((item) => item.procurementCaseId === procurementCase.id)
    : []
  const isHead = currentUser?.roleIds.includes("role-procurement_head") ?? false
  const isDirector = currentUser?.roleIds.includes("role-director") ?? false
  const directorCanReviewCosts = isDirector && [
    "director",
    "procurement_order",
    "warehouse_receipt",
    "complete",
  ].includes(order.currentStep)
  const approvedQuotations = caseQuotes.filter((quotation) => quotation.selected)
  const assignedLineIds = new Set(getAssignedProcurementLineIds(order, currentUser?.id))
  const currentSuborder = getProcurementSuborderForSpecialist(order, currentUser?.id)
  const offerableLines = requiredLines.filter((line) => assignedLineIds.has(line.id))
  const isAssignedSpecialist = assignedLineIds.size > 0
  const canAssignSpecialist = isHead && can("procurement.select_supplier")
  const canEnterOffers = isAssignedSpecialist && can("procurement.quote")
  const canApproveOffer = isHead && can("procurement.select_supplier") && can("approvals.approve")
  const canRejectOffers = isHead && can("procurement.select_supplier") && can("approvals.reject")
  const [supplierPhone, setSupplierPhone] = React.useState("")
  const [newSupplierName, setNewSupplierName] = React.useState("")
  const [selectedLineIds, setSelectedLineIds] = React.useState<string[]>([])
  const [quantities, setQuantities] = React.useState<Record<string, string>>({})
  const [unitPrices, setUnitPrices] = React.useState<Record<string, string>>({})
  const [expectedDeliveryDates, setExpectedDeliveryDates] = React.useState<Record<string, string>>({})
  const [ndsByLine, setNdsByLine] = React.useState<Record<string, boolean>>({})
  const [quotationIdsForApproval, setQuotationIdsForApproval] = React.useState<string[]>([])
  const [reviewComment, setReviewComment] = React.useState("")
  const [error, setError] = React.useState("")
  const matchedSupplier = findSupplierByPhone(supplierPhone)
  const today = getLocalDateInputValue()
  const draftTotal = offerableLines.reduce((total, line) => {
    if (!selectedLineIds.includes(line.id)) return total
    return total + (Number(quantities[line.id]) || 0) * (Number(unitPrices[line.id]) || 0)
  }, 0)
  const quotedLineIds = new Set(caseQuotes.flatMap((quotation) => quotation.lines.map((line) => line.orderLineId)))
  const quotedLines = caseQuotes.flatMap((quotation) => quotation.lines)
  const coveredLineCount = requiredLines.filter((line) => quotationLinesCoverRequirements([line], quotedLines)).length
  const selectedExpense = approvedQuotations.reduce((total, quotation) => total + quotation.amount, 0)
  const visibleCaseQuotes = isHead || directorCanReviewCosts
    ? caseQuotes
    : caseQuotes.filter((quotation) => quotation.createdByUserId === currentUser?.id)

  if (!can("procurement.view") && !directorCanReviewCosts) return null

  if (!procurementCase) {
    return (
      <section className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {copy.preparingProcurement}
      </section>
    )
  }
  const procurementCaseId = procurementCase.id

  function handlePhoneChange(phone: string) {
    setSupplierPhone(phone)
    if (!findSupplierByPhone(phone)) setNewSupplierName("")
  }

  async function handleAddOffer() {
    setError("")
    const lines = offerableLines.filter((line) => selectedLineIds.includes(line.id)).map((line) => ({
      orderLineId: line.id,
      quantity: Number(quantities[line.id]),
      unitPrice: Number(unitPrices[line.id]),
      expectedDeliveryDate: expectedDeliveryDates[line.id] ?? "",
      ndsIncluded: ndsByLine[line.id] ?? true,
    }))
    if (lines.some((line) => line.expectedDeliveryDate && !isExpectedDeliveryDateAllowed(line.expectedDeliveryDate, today))) {
      setError(copy.deliveryDateNotPast)
      return
    }
    if (
      normalizeSupplierPhone(supplierPhone).length < 7 ||
      (!matchedSupplier && !newSupplierName.trim()) ||
      !lines.length ||
      lines.some((line) => {
        const requiredLine = offerableLines.find((item) => item.id === line.orderLineId)
        return !requiredLine ||
          line.quantity <= 0 ||
          line.quantity > getRequiredProcurementQuantity(requiredLine) ||
          line.unitPrice <= 0 ||
          !line.expectedDeliveryDate
      })
    ) {
      setError(copy.completeOffer)
      return
    }
    const added = await addQuotation({
      procurementCaseId,
      supplierPhone,
      supplierName: matchedSupplier?.name ?? newSupplierName,
      lines,
    })
    if (!added) {
      setError(copy.actionFailed)
      return
    }
    setSupplierPhone("")
    setNewSupplierName("")
    setSelectedLineIds([])
    setQuantities({})
    setUnitPrices({})
    setExpectedDeliveryDates({})
    setNdsByLine({})
  }

  async function handleSubmitReview() {
    setError("")
    if (!await submitForReview(procurementCaseId)) setError(copy.addOfferFirst)
  }

  async function handleApprove() {
    setError("")
    const selectedQuotes = caseQuotes.filter((quotation) => quotationIdsForApproval.includes(quotation.id))
    if (!quotationLinesCoverRequirements(requiredLines, selectedQuotes.flatMap((quotation) => quotation.lines), "exact")) {
      setError(copy.completeSelectionRequired)
      return
    }
    if (!await approveQuotations(procurementCaseId, quotationIdsForApproval)) setError(copy.actionFailed)
  }

  function toggleOfferLine(lineId: string, checked: boolean) {
    setSelectedLineIds((current) => checked
      ? [...new Set([...current, lineId])]
      : current.filter((id) => id !== lineId))
    if (checked) {
      const line = offerableLines.find((item) => item.id === lineId)
      if (line) setQuantities((current) => ({
        ...current,
        [lineId]: current[lineId] ?? String(getRequiredProcurementQuantity(line)),
      }))
    }
  }

  async function handleReject() {
    setError("")
    if (!reviewComment.trim()) {
      setError(copy.commentRequired)
      return
    }
    if (!await rejectOffers(procurementCaseId, reviewComment)) setError(copy.actionFailed)
  }

  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-primary/20 bg-primary/[0.025] p-4" aria-labelledby="order-procurement-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="order-procurement-title" className="text-sm font-semibold">{directorCanReviewCosts ? copy.expenseReview : copy.procurementActions}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{directorCanReviewCosts ? copy.expenseReviewDescription : copy.workHere}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentSuborder ? (
            <Badge className="font-mono">{currentSuborder.number}</Badge>
          ) : null}
          <StageBadge stage={procurementCase.stage} copy={copy} />
        </div>
      </div>

      {directorCanReviewCosts && approvedQuotations.length ? (
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center" role="status">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BanknoteIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{copy.selectedOfferExpense}</p>
              <p className="mt-1 break-words text-sm font-medium">{approvedQuotations.map((quotation) => quotation.supplierName).join(", ")}</p>
            </div>
          </div>
          <p className="break-words font-mono text-2xl font-semibold tabular-nums text-primary">{formatMoney(selectedExpense, lang)}</p>
        </div>
      ) : null}

      {procurementCase.reviewComment ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="status">
          <p className="text-sm font-semibold text-destructive">{copy.changesRequested}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{procurementCase.reviewComment}</p>
        </div>
      ) : null}

      {canAssignSpecialist && ["procurement_accept", "sourcing"].includes(order.currentStep) ? (
        <ProcurementLineAssignment
          order={order}
          procurementCaseId={procurementCaseId}
          lang={lang}
        />
      ) : null}

      <OfferList
        quotations={visibleCaseQuotes}
        order={order}
        lang={lang}
        messages={messages}
        copy={copy}
        canApprove={canApproveOffer && order.currentStep === "price_check"}
        selectedQuotationIds={quotationIdsForApproval}
        onToggleQuotation={(quotationId, checked) => setQuotationIdsForApproval((current) => checked
          ? [...new Set([...current, quotationId])]
          : current.filter((id) => id !== quotationId))}
        onApprove={handleApprove}
      />

      {canEnterOffers && order.currentStep === "sourcing" ? (
        <div className="space-y-4 rounded-lg border bg-background p-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><FilePlus2Icon className="size-4" />{copy.addOffer}</h4>

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm" role="status">
            <Clock3Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p>{copy.waitingUntilOffersSent}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={copy.supplierPhone} htmlFor="order-supplier-phone" hint={copy.phoneLookupHint}>
              <Input
                id="order-supplier-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={supplierPhone}
                onChange={(event) => handlePhoneChange(event.target.value)}
                placeholder="+998 90 123 45 67"
              />
            </FormField>
            <FormField
              label={copy.supplierName}
              htmlFor={matchedSupplier ? undefined : "order-new-supplier-name"}
              hint={matchedSupplier ? copy.supplierFound : supplierPhone.trim() ? copy.supplierWillBeCreated : undefined}
            >
              {matchedSupplier ? (
                <div className="flex min-h-11 items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 text-sm font-medium" role="status">
                  <CheckCircle2Icon className="size-4 text-primary" />
                  {matchedSupplier.name}
                </div>
              ) : (
                <Input
                  id="order-new-supplier-name"
                  value={newSupplierName}
                  onChange={(event) => setNewSupplierName(event.target.value)}
                  disabled={!supplierPhone.trim()}
                  placeholder={copy.enterNewSupplierName}
                />
              )}
            </FormField>
          </div>

          <fieldset className="space-y-2">
            <legend className="sr-only">{copy.selectPositions}</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{copy.selectPositions}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{copy.selectedPositions(selectedLineIds.length, offerableLines.length)}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const selectAll = selectedLineIds.length !== offerableLines.length
                    const nextIds = selectAll ? offerableLines.map((line) => line.id) : []
                    setSelectedLineIds(nextIds)
                    if (selectAll) setQuantities((current) => Object.fromEntries(offerableLines.map((line) => [
                      line.id,
                      current[line.id] ?? String(getRequiredProcurementQuantity(line)),
                    ])))
                  }}
                >
                  {selectedLineIds.length === offerableLines.length ? copy.clearSelection : copy.selectAll}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{copy.positionSelectionHint}</p>
            {offerableLines.map((line, index) => {
              const product = data.products.find((item) => item.id === line.productId)
              const unit = data["unit-types"].find((item) => item.id === line.unitTypeId)
              const remaining = getRequiredProcurementQuantity(line)
              const selected = selectedLineIds.includes(line.id)
              const quantity = Number(quantities[line.id]) || 0
              const unitPrice = Number(unitPrices[line.id]) || 0
              return (
                <div key={line.id} className={`min-w-0 overflow-hidden rounded-lg border transition-colors ${selected ? "border-primary/35 bg-primary/[0.025]" : "bg-muted/20"}`}>
                  <label className="flex min-h-14 cursor-pointer items-start gap-3 p-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={selected}
                      onCheckedChange={(checked) => toggleOfferLine(line.id, checked === true)}
                      aria-label={`${copy.selectPosition}: ${product ? getLocalizedTitle(product, lang) : line.productId}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium">{index + 1}. {product ? getLocalizedTitle(product, lang) : line.productId}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{copy.requiredQuantity}: {remaining} {unit ? getLocalizedTitle(unit, lang) : ""}</span>
                    </span>
                    {quotedLineIds.has(line.id) ? <Badge variant="secondary">{copy.hasOffer}</Badge> : null}
                  </label>
                  {selected ? (
                    <div className="grid min-w-0 gap-3 border-t bg-background p-3 sm:grid-cols-2">
                      <FormField label={copy.quantity} htmlFor={`order-quantity-${line.id}`}>
                        <Input id={`order-quantity-${line.id}`} type="number" min="0.01" max={remaining} step="0.01" inputMode="decimal" value={quantities[line.id] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))} />
                      </FormField>
                      <FormField label={copy.unitPrice} htmlFor={`order-unit-price-${line.id}`}>
                        <Input id={`order-unit-price-${line.id}`} type="number" min="1" step="1" inputMode="numeric" value={unitPrices[line.id] ?? ""} onChange={(event) => setUnitPrices((current) => ({ ...current, [line.id]: event.target.value }))} />
                      </FormField>
                      <FormField label={messages.expectedDate} htmlFor={`order-delivery-date-${line.id}`}>
                        <Input id={`order-delivery-date-${line.id}`} type="date" min={today} value={expectedDeliveryDates[line.id] ?? ""} onChange={(event) => setExpectedDeliveryDates((current) => ({ ...current, [line.id]: event.target.value }))} />
                      </FormField>
                      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 whitespace-nowrap text-sm sm:self-end">
                        <Checkbox checked={ndsByLine[line.id] ?? true} onCheckedChange={(checked) => setNdsByLine((current) => ({ ...current, [line.id]: checked === true }))} />
                        {messages.ndsIncluded}
                      </label>
                      <div className="sm:col-span-2 sm:text-right">
                        <p className="text-xs font-medium text-muted-foreground">{copy.positionTotal}</p>
                        <p className="mt-1 break-words font-mono text-sm font-semibold tabular-nums">{formatMoney(quantity * unitPrice, lang)}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </fieldset>

          <div className="flex flex-col justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs text-muted-foreground">{copy.offerTotal}</p>
              <p className="mt-1 break-words font-mono text-lg font-semibold tabular-nums">{formatMoney(draftTotal, lang)}</p>
            </div>
            <Button onClick={handleAddOffer}><CalculatorIcon />{copy.saveOffer}</Button>
          </div>
          {caseQuotes.length ? (
            <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium">{copy.offerCoverage(coveredLineCount, requiredLines.length)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{copy.coverageHint}</p>
              </div>
              <Button variant="outline" onClick={handleSubmitReview} disabled={coveredLineCount !== requiredLines.length}><SendIcon />{copy.sendForReview}</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canRejectOffers && order.currentStep === "price_check" ? (
        <div className="space-y-3 rounded-lg border border-destructive/20 bg-background p-3">
          <h4 className="text-sm font-semibold">{copy.returnForRevision}</h4>
          <FormField label={copy.rejectionComment} htmlFor="order-offer-rejection-comment">
            <Textarea id="order-offer-rejection-comment" rows={3} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder={copy.explainChanges} />
          </FormField>
          <Button variant="destructive" onClick={handleReject}><XIcon />{copy.rejectOffers}</Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </section>
  )
}

function OfferList({ quotations, order, lang, messages, copy, canApprove, selectedQuotationIds, onToggleQuotation, onApprove }: {
  quotations: QuotationRecord[]
  order: OrderRecord
  lang: Locale
  messages: Messages
  copy: ReturnType<typeof procurementOrderCopy>
  canApprove: boolean
  selectedQuotationIds: string[]
  onToggleQuotation: (quotationId: string, checked: boolean) => void
  onApprove: () => void
}) {
  const { data } = useSettings()
  const selectedTotal = quotations
    .filter((quotation) => selectedQuotationIds.includes(quotation.id))
    .reduce((total, quotation) => total + quotation.amount, 0)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{copy.supplierOffers}</h4>
        <Badge variant="outline">{quotations.length}</Badge>
      </div>
      {!quotations.length ? <p className="rounded-lg border border-dashed bg-background p-3 text-sm text-muted-foreground">{copy.noOffers}</p> : quotations.map((quotation) => (
        <article key={quotation.id} className={`min-w-0 space-y-3 rounded-lg border bg-background p-3 ${quotation.selected || selectedQuotationIds.includes(quotation.id) ? "border-primary/40 bg-primary/5" : ""}`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="flex min-w-0 items-start gap-3">
              {canApprove ? (
                <Checkbox
                  className="mt-0.5"
                  checked={selectedQuotationIds.includes(quotation.id)}
                  onCheckedChange={(checked) => onToggleQuotation(quotation.id, checked === true)}
                  aria-label={`${copy.selectSupplierOffer}: ${quotation.supplierName}`}
                />
              ) : null}
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words font-semibold">{quotation.supplierName}</p>
                {quotation.procurementSuborderNumber ? (
                  <Badge variant="outline" className="font-mono">
                    {quotation.procurementSuborderNumber}
                  </Badge>
                ) : null}
                {quotation.selected ? <Badge><CheckIcon />{copy.approvedOffer}</Badge> : null}
              </div>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><PhoneIcon className="size-3.5" />{quotation.supplierPhone}</p>
              </div>
            </div>
            <div className="min-w-0 text-left sm:text-right">
              <p className="break-words font-mono text-lg font-semibold tabular-nums">{formatMoney(quotation.amount, lang)}</p>
            </div>
          </div>
          <div className="grid gap-2">
            {quotation.lines.map((quoteLine) => {
              const orderLine = order.lines.find((item) => item.id === quoteLine.orderLineId)
              const product = data.products.find((item) => item.id === orderLine?.productId)
              return (
                <div key={quoteLine.orderLineId} className="grid min-w-0 gap-2 rounded-lg bg-muted/35 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{product ? getLocalizedTitle(product, lang) : quoteLine.orderLineId}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{messages.expectedDate}: {formatDeliveryDate(quoteLine.expectedDeliveryDate, lang)}</span>
                      <Badge variant="outline">{quoteLine.ndsIncluded ? copy.withNds : copy.withoutNds}</Badge>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="break-words font-mono tabular-nums">{quoteLine.quantity} × {formatMoney(quoteLine.unitPrice, lang)}</p>
                    <p className="mt-1 break-words font-mono font-semibold tabular-nums">{formatMoney(quoteLine.quantity * quoteLine.unitPrice, lang)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      ))}
      {canApprove && quotations.length ? (
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium">{copy.selectedSupplierPackages(selectedQuotationIds.length)}</p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{formatMoney(selectedTotal, lang)}</p>
          </div>
          <Button onClick={onApprove} disabled={!selectedQuotationIds.length}><PackageCheckIcon />{copy.approveSelectedOffers}</Button>
        </div>
      ) : null}
    </div>
  )
}

function FormField({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}</div>
}

function StageBadge({ stage, copy }: { stage: ProcurementStage; copy: ReturnType<typeof procurementOrderCopy> }) {
  const variant = stage === "approved" ? "default" : stage === "changes_requested" ? "destructive" : stage === "head_review" ? "secondary" : "outline"
  return <Badge variant={variant}>{copy.stages[stage]}</Badge>
}

function formatMoney(value: number, lang: Locale) {
  const locale = lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} UZS`
}

function formatDeliveryDate(value: string, lang: Locale) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value || "—"
  const locale = lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

function procurementOrderCopy(lang: Locale) {
  if (lang === "ru") return {
    procurementActions: "Работа снабжения", workHere: "Назначение, предложения и проверка выполняются прямо в заявке.", preparingProcurement: "Подготавливаем закупочную часть заявки…", assignSpecialist: "Назначить специалиста", editSpecialist: "Изменить назначенного специалиста", assign: "Назначить", updateAssignment: "Сохранить назначение", available: "Свободен", activeAssignments: (count: number) => `В работе: ${count}`, addOffer: "Добавить предложение", supplierPhone: "Телефон поставщика", phoneLookupHint: "Номер с + проверяется полностью; без + — по последним цифрам без кода страны.", supplierName: "Название поставщика", supplierFound: "Поставщик найден и заполнен автоматически.", supplierWillBeCreated: "Если номера нет в базе, поставщик будет создан при сохранении предложения.", enterNewSupplierName: "Введите название нового поставщика", unitPrices: "Цена за единицу по позициям", quantity: "Количество", unitPrice: "Цена за единицу", positionTotal: "Сумма позиции", offerTotal: "Итого по предложению", saveOffer: "Сохранить предложение", sendForReview: "Отправить руководителю", supplierOffers: "Предложения поставщиков", noOffers: "Предложений пока нет.", withNds: "С НДС", withoutNds: "Без НДС", approvedOffer: "Одобрено", approveOffer: "Одобрить предложение", returnForRevision: "Вернуть на доработку", rejectionComment: "Комментарий руководителя", explainChanges: "Укажите, что нужно исправить…", rejectOffers: "Вернуть специалисту", changesRequested: "Требуются изменения", completeOffer: "Введите телефон, название нового поставщика, цену и ожидаемую дату поставки каждой позиции.", addOfferFirst: "Добавьте хотя бы одно полное предложение.", commentRequired: "Добавьте комментарий для специалиста.", actionFailed: "Действие не выполнено. Обновите страницу и повторите попытку.",
    selectPositions: "Выберите позиции для этого поставщика",
    selectedPositions: (count: number, total: number) => `Выбрано: ${count} из ${total}`,
    clearSelection: "Снять выбор",
    selectAll: "Выбрать все",
    positionSelectionHint: "В предложение войдут только отмеченные позиции. Для остальных позиций можно добавить другого поставщика.",
    selectPosition: "Выбрать позицию",
    requiredQuantity: "Нужно закупить",
    hasOffer: "Есть предложение",
    offerCoverage: (count: number, total: number) => `Предложения покрывают ${count} из ${total} позиций`,
    coverageHint: "Отправка руководителю станет доступна, когда предложения покроют все позиции.",
    completeSelectionRequired: "Выбранные пакеты поставщиков должны точно покрывать количество каждой позиции.",
    selectSupplierOffer: "Выбрать пакет поставщика",
    selectedSupplierPackages: (count: number) => `Выбрано пакетов: ${count}`,
    approveSelectedOffers: "Утвердить выбранные пакеты",
    expenseReview: "Расходы по закупке",
    expenseReviewDescription: "Все предложения поставщиков, выбранное предложение и стоимость каждой позиции.",
    selectedOfferExpense: "Итоговая стоимость выбранного предложения",
    waitingUntilOffersSent: "Заявка останется в статусе «Ожидает меня», пока вы не отправите предложения руководителю снабжения.",
    deliveryDateNotPast: "Ожидаемая дата поставки не может быть раньше сегодняшней даты.",
    stages: { awaiting_assignment: "Ожидает назначения", collecting_offers: "Сбор предложений", head_review: "Проверка руководителя", changes_requested: "На доработке", approved: "Предложение одобрено" },
  }
  if (lang === "tr") return {
    procurementActions: "Satın alma işlemleri", workHere: "Atama, teklifler ve inceleme doğrudan sipariş içinde yapılır.", preparingProcurement: "Siparişin satın alma bölümü hazırlanıyor…", assignSpecialist: "Uzman ata", editSpecialist: "Atanan uzmanı değiştir", assign: "Ata", updateAssignment: "Atamayı kaydet", available: "Müsait", activeAssignments: (count: number) => `Aktif sipariş: ${count}`, addOffer: "Teklif ekle", supplierPhone: "Tedarikçi telefonu", phoneLookupHint: "+ ile başlayan numara tamamen; + olmadan girilen numara ülke kodu hariç son rakamlarla eşleştirilir.", supplierName: "Tedarikçi adı", supplierFound: "Tedarikçi bulundu ve otomatik dolduruldu.", supplierWillBeCreated: "Numara kayıtlı değilse teklif kaydedilirken tedarikçi otomatik oluşturulur.", enterNewSupplierName: "Yeni tedarikçi adını girin", unitPrices: "Kalem bazında birim fiyat", quantity: "Miktar", unitPrice: "Birim fiyat", positionTotal: "Kalem toplamı", offerTotal: "Teklif toplamı", saveOffer: "Teklifi kaydet", sendForReview: "Yöneticiye gönder", supplierOffers: "Tedarikçi teklifleri", noOffers: "Henüz teklif yok.", withNds: "KDV dahil", withoutNds: "KDV hariç", approvedOffer: "Onaylandı", approveOffer: "Teklifi onayla", returnForRevision: "Yeniden çalışmaya gönder", rejectionComment: "Yönetici yorumu", explainChanges: "Nelerin düzeltilmesi gerektiğini yazın…", rejectOffers: "Uzmana geri gönder", changesRequested: "Değişiklik gerekli", completeOffer: "Telefonu, yeni tedarikçi adını, fiyatı ve her kalemin beklenen teslim tarihini girin.", addOfferFirst: "En az bir eksiksiz teklif ekleyin.", commentRequired: "Uzman için yorum ekleyin.", actionFailed: "İşlem tamamlanamadı. Sayfayı yenileyip tekrar deneyin.",
    selectPositions: "Bu tedarikçi için kalemleri seçin",
    selectedPositions: (count: number, total: number) => `Seçilen: ${count}/${total}`,
    clearSelection: "Seçimi temizle",
    selectAll: "Tümünü seç",
    positionSelectionHint: "Teklife yalnızca seçilen kalemler dahil edilir. Diğer kalemler için ayrı bir tedarikçi ekleyebilirsiniz.",
    selectPosition: "Kalemi seç",
    requiredQuantity: "Satın alınacak miktar",
    hasOffer: "Teklif var",
    offerCoverage: (count: number, total: number) => `Teklif kapsamı: ${count}/${total} kalem`,
    coverageHint: "Tüm kalemler kapsandığında teklifler yöneticiye gönderilebilir.",
    completeSelectionRequired: "Seçilen tedarikçi paketleri her kalemin miktarını tam olarak karşılamalıdır.",
    selectSupplierOffer: "Tedarikçi paketini seç",
    selectedSupplierPackages: (count: number) => `Seçilen paket: ${count}`,
    approveSelectedOffers: "Seçilen paketleri onayla",
    expenseReview: "Satın alma giderleri",
    expenseReviewDescription: "Tüm tedarikçi teklifleri, seçilen teklif ve her kalemin maliyet dökümü.",
    selectedOfferExpense: "Seçilen teklifin toplam maliyeti",
    waitingUntilOffersSent: "Teklifleri Satın Alma Yöneticisine gönderene kadar sipariş ‘Beni bekliyor’ durumunda kalır.",
    deliveryDateNotPast: "Beklenen teslim tarihi bugünden önce olamaz.",
    stages: { awaiting_assignment: "Atama bekliyor", collecting_offers: "Teklif toplanıyor", head_review: "Yönetici incelemesi", changes_requested: "Yeniden çalışılıyor", approved: "Teklif onaylandı" },
  }
  return {
    procurementActions: "Ta’minot ishlari", workHere: "Biriktirish, taklif kiritish va tekshirish bevosita buyurtma ichida bajariladi.", preparingProcurement: "Buyurtmaning ta’minot qismi tayyorlanmoqda…", assignSpecialist: "Mutaxassisni biriktirish", editSpecialist: "Biriktirilgan mutaxassisni o‘zgartirish", assign: "Biriktirish", updateAssignment: "Biriktirishni saqlash", available: "Bo‘sh", activeAssignments: (count: number) => `Faol buyurtmalar: ${count}`, addOffer: "Taklif qo‘shish", supplierPhone: "Yetkazib beruvchi telefoni", phoneLookupHint: "+ bilan boshlangan raqam to‘liq; + siz kiritilgan raqam esa mamlakat kodisiz oxirgi raqamlar bo‘yicha tekshiriladi.", supplierName: "Yetkazib beruvchi nomi", supplierFound: "Yetkazib beruvchi topildi va avtomatik to‘ldirildi.", supplierWillBeCreated: "Raqam bazada bo‘lmasa, taklif saqlanganda yangi yetkazib beruvchi avtomatik yaratiladi.", enterNewSupplierName: "Yangi yetkazib beruvchi nomini kiriting", unitPrices: "Pozitsiyalar bo‘yicha birlik narxi", quantity: "Miqdor", unitPrice: "Birlik narxi", positionTotal: "Pozitsiya summasi", offerTotal: "Taklifning umumiy summasi", saveOffer: "Taklifni saqlash", sendForReview: "Rahbarga yuborish", supplierOffers: "Yetkazib beruvchi takliflari", noOffers: "Hozircha takliflar yo‘q.", withNds: "QQS bilan", withoutNds: "QQSsiz", approvedOffer: "Tasdiqlandi", approveOffer: "Taklifni tasdiqlash", returnForRevision: "Qayta ishlashga yuborish", rejectionComment: "Rahbar izohi", explainChanges: "Nimani o‘zgartirish kerakligini yozing…", rejectOffers: "Mutaxassisga qaytarish", changesRequested: "O‘zgartirish talab qilindi", completeOffer: "Telefon, yangi yetkazib beruvchi nomi, narx va har bir pozitsiyaning kutilayotgan yetkazib berish sanasini kiriting.", addOfferFirst: "Kamida bitta to‘liq taklif qo‘shing.", commentRequired: "Mutaxassis uchun izoh kiriting.", actionFailed: "Amal bajarilmadi. Sahifani yangilab, qayta urinib ko‘ring.",
    selectPositions: "Ushbu supplier uchun pozitsiyalarni tanlang",
    selectedPositions: (count: number, total: number) => `Tanlangan: ${count}/${total}`,
    clearSelection: "Tanlovni tozalash",
    selectAll: "Barchasini tanlash",
    positionSelectionHint: "Taklifga faqat tanlangan pozitsiyalar kiradi. Qolgan pozitsiyalar uchun boshqa supplier qo‘shishingiz mumkin.",
    selectPosition: "Pozitsiyani tanlash",
    requiredQuantity: "Xarid qilinadigan miqdor",
    hasOffer: "Taklif bor",
    offerCoverage: (count: number, total: number) => `Taklif bilan qoplangan: ${count}/${total} pozitsiya`,
    coverageHint: "Barcha pozitsiyalar taklif bilan qoplangach, rahbarga yuborish mumkin.",
    completeSelectionRequired: "Tanlangan supplier paketlari har bir pozitsiya miqdorini aniq to‘liq qoplashi kerak.",
    selectSupplierOffer: "Supplier paketini tanlash",
    selectedSupplierPackages: (count: number) => `Tanlangan paketlar: ${count}`,
    approveSelectedOffers: "Tanlangan paketlarni tasdiqlash",
    expenseReview: "Xarid xarajatlari",
    expenseReviewDescription: "Barcha yetkazib beruvchi takliflari, tanlangan taklif va har bir pozitsiya xarajatlari.",
    selectedOfferExpense: "Tanlangan taklifning umumiy xarajati",
    waitingUntilOffersSent: "Takliflarni Ta’minot rahbariga yubormaguningizcha buyurtma “Meni kutmoqda” holatida qoladi.",
    deliveryDateNotPast: "Kutilayotgan yetkazib berish sanasi bugungi sanadan oldin bo‘lishi mumkin emas.",
    stages: { awaiting_assignment: "Biriktirish kutilmoqda", collecting_offers: "Takliflar yig‘ilmoqda", head_review: "Rahbar tekshiruvi", changes_requested: "Qayta ishlanmoqda", approved: "Taklif tasdiqlandi" },
  }
}
