"use client"

import * as React from "react"
import {
  BanknoteIcon,
  CalculatorIcon,
  CheckCircle2Icon,
  CheckIcon,
  Clock3Icon,
  FilePlus2Icon,
  PhoneIcon,
  SendIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"

import { useAuthorization } from "@/components/auth/use-authorization"
import { useProcurement } from "@/components/procurement/procurement-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Locale, Messages } from "@/lib/i18n"
import type { OrderRecord } from "@/lib/orders"
import { getLocalDateInputValue, isExpectedDeliveryDateAllowed, normalizeSupplierPhone, type ProcurementStage, type QuotationRecord } from "@/lib/procurement"
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
    assignSpecialist,
    addQuotation,
    submitForReview,
    approveQuotation,
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
    "procurement_supervisor",
    "warehouse_receipt",
    "warehouse_supervisor",
    "complete",
  ].includes(order.currentStep)
  const selectedQuotation = caseQuotes.find((quotation) => quotation.selected)
  const isAssignedSpecialist = currentUser?.id === procurementCase?.assigneeId
  const canAssignSpecialist = isHead && can("procurement.select_supplier")
  const canEnterOffers = isAssignedSpecialist && can("procurement.quote")
  const canApproveOffer = isHead && can("procurement.select_supplier") && can("approvals.approve")
  const canRejectOffers = isHead && can("procurement.select_supplier") && can("approvals.reject")
  const specialists = data.users.filter(
    (user) =>
      user.roleIds.includes("role-procurement_manager") &&
      user.departmentIds.some((id) => currentUser?.departmentIds.includes(id)),
  )
  const workloadFor = (userId: string) => cases.filter(
    (item) => item.assigneeId === userId && item.stage !== "approved",
  ).length
  const [specialistId, setSpecialistId] = React.useState(
    procurementCase?.assigneeId ?? specialists[0]?.id ?? "",
  )
  const [supplierPhone, setSupplierPhone] = React.useState("")
  const [newSupplierName, setNewSupplierName] = React.useState("")
  const [unitPrices, setUnitPrices] = React.useState<Record<string, string>>({})
  const [expectedDeliveryDates, setExpectedDeliveryDates] = React.useState<Record<string, string>>({})
  const [ndsByLine, setNdsByLine] = React.useState<Record<string, boolean>>({})
  const [reviewComment, setReviewComment] = React.useState("")
  const [error, setError] = React.useState("")
  const matchedSupplier = findSupplierByPhone(supplierPhone)
  const selectedSpecialist = specialists.find((specialist) => specialist.id === specialistId)
  const selectedSpecialistWorkload = selectedSpecialist ? workloadFor(selectedSpecialist.id) : 0
  const today = getLocalDateInputValue()
  const draftTotal = requiredLines.reduce((total, line) => {
    const remaining = Math.max(0, line.quantity - (line.availableQuantity ?? 0))
    return total + remaining * (Number(unitPrices[line.id]) || 0)
  }, 0)

  if (!can("procurement.view") && !directorCanReviewCosts) return null

  if (!procurementCase) {
    return (
      <section className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {copy.preparingProcurement}
      </section>
    )
  }
  const procurementCaseId = procurementCase.id

  function handleAssign() {
    setError("")
    if (!specialistId || !assignSpecialist(procurementCaseId, specialistId)) {
      setError(copy.actionFailed)
    }
  }

  function handlePhoneChange(phone: string) {
    setSupplierPhone(phone)
    if (!findSupplierByPhone(phone)) setNewSupplierName("")
  }

  function handleAddOffer() {
    setError("")
    const lines = requiredLines.map((line) => ({
      orderLineId: line.id,
      quantity: Math.max(0, line.quantity - (line.availableQuantity ?? 0)),
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
      lines.some((line) => line.quantity <= 0 || line.unitPrice <= 0 || !line.expectedDeliveryDate)
    ) {
      setError(copy.completeOffer)
      return
    }
    const added = addQuotation({
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
    setUnitPrices({})
    setExpectedDeliveryDates({})
    setNdsByLine({})
  }

  function handleSubmitReview() {
    setError("")
    if (!submitForReview(procurementCaseId)) setError(copy.addOfferFirst)
  }

  function handleApprove(quotationId: string) {
    setError("")
    if (!approveQuotation(procurementCaseId, quotationId)) setError(copy.actionFailed)
  }

  function handleReject() {
    setError("")
    if (!reviewComment.trim()) {
      setError(copy.commentRequired)
      return
    }
    if (!rejectOffers(procurementCaseId, reviewComment)) setError(copy.actionFailed)
  }

  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-primary/20 bg-primary/[0.025] p-4" aria-labelledby="order-procurement-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="order-procurement-title" className="text-sm font-semibold">{directorCanReviewCosts ? copy.expenseReview : copy.procurementActions}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{directorCanReviewCosts ? copy.expenseReviewDescription : copy.workHere}</p>
        </div>
        <StageBadge stage={procurementCase.stage} copy={copy} />
      </div>

      {directorCanReviewCosts && selectedQuotation ? (
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center" role="status">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BanknoteIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{copy.selectedOfferExpense}</p>
              <p className="mt-1 break-words text-sm font-medium">{selectedQuotation.supplierName}</p>
            </div>
          </div>
          <p className="break-words font-mono text-2xl font-semibold tabular-nums text-primary">{formatMoney(selectedQuotation.amount, lang)}</p>
        </div>
      ) : null}

      {procurementCase.reviewComment ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="status">
          <p className="text-sm font-semibold text-destructive">{copy.changesRequested}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{procurementCase.reviewComment}</p>
        </div>
      ) : null}

      {canAssignSpecialist && ["procurement_accept", "sourcing", "price_check"].includes(order.currentStep) ? (
        <div className="space-y-3 rounded-lg border bg-background p-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><UserRoundIcon className="size-4" />{procurementCase.assigneeId ? copy.editSpecialist : copy.assignSpecialist}</h4>
          <FormField label={messages.procurementSpecialist} htmlFor="order-procurement-specialist">
            <select id="order-procurement-specialist" value={specialistId} onChange={(event) => setSpecialistId(event.target.value)} className={selectClassName}>
              {specialists.map((specialist) => {
                const workload = workloadFor(specialist.id)
                return <option key={specialist.id} value={specialist.id}>{specialist.fullName} — {specialistStatusLabel(workload, copy)}</option>
              })}
            </select>
          </FormField>
          {selectedSpecialist ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm" role="status">
              <span className="font-medium">{selectedSpecialist.fullName}</span>
              <Badge variant={selectedSpecialistWorkload ? "secondary" : "outline"}>{specialistStatusLabel(selectedSpecialistWorkload, copy)}</Badge>
            </div>
          ) : null}
          <Button onClick={handleAssign} disabled={!specialistId || specialistId === procurementCase.assigneeId}><UserRoundIcon />{procurementCase.assigneeId ? copy.updateAssignment : copy.assign}</Button>
        </div>
      ) : null}

      <OfferList
        quotations={caseQuotes}
        order={order}
        lang={lang}
        messages={messages}
        copy={copy}
        canApprove={canApproveOffer && order.currentStep === "price_check"}
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
            <legend className="text-sm font-medium">{copy.unitPrices}</legend>
            {requiredLines.map((line, index) => {
              const product = data.products.find((item) => item.id === line.productId)
              const remaining = Math.max(0, line.quantity - (line.availableQuantity ?? 0))
              const unitPrice = Number(unitPrices[line.id]) || 0
              return (
                <div key={line.id} className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{index + 1}. {product ? getLocalizedTitle(product, lang) : line.productId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{copy.quantity}: {remaining}</p>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
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
                    <div className="sm:col-span-3 sm:text-right">
                      <p className="text-xs font-medium text-muted-foreground">{copy.positionTotal}</p>
                      <p className="mt-2 break-words font-mono text-sm font-semibold tabular-nums">{formatMoney(remaining * unitPrice, lang)}</p>
                    </div>
                  </div>
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
          {caseQuotes.length ? <Button variant="outline" onClick={handleSubmitReview}><SendIcon />{copy.sendForReview}</Button> : null}
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

function OfferList({ quotations, order, lang, messages, copy, canApprove, onApprove }: {
  quotations: QuotationRecord[]
  order: OrderRecord
  lang: Locale
  messages: Messages
  copy: ReturnType<typeof procurementOrderCopy>
  canApprove: boolean
  onApprove: (quotationId: string) => void
}) {
  const { data } = useSettings()
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{copy.supplierOffers}</h4>
        <Badge variant="outline">{quotations.length}</Badge>
      </div>
      {!quotations.length ? <p className="rounded-lg border border-dashed bg-background p-3 text-sm text-muted-foreground">{copy.noOffers}</p> : quotations.map((quotation) => (
        <article key={quotation.id} className={`min-w-0 space-y-3 rounded-lg border bg-background p-3 ${quotation.selected ? "border-primary/40 bg-primary/5" : ""}`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words font-semibold">{quotation.supplierName}</p>
                {quotation.selected ? <Badge><CheckIcon />{copy.approvedOffer}</Badge> : null}
              </div>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><PhoneIcon className="size-3.5" />{quotation.supplierPhone}</p>
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
          {canApprove && !quotation.selected ? <Button onClick={() => onApprove(quotation.id)}><CheckIcon />{copy.approveOffer}</Button> : null}
        </article>
      ))}
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

function specialistStatusLabel(workload: number, copy: ReturnType<typeof procurementOrderCopy>) {
  return workload ? copy.activeAssignments(workload) : copy.available
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

const selectClassName = "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function procurementOrderCopy(lang: Locale) {
  if (lang === "ru") return {
    procurementActions: "Работа снабжения", workHere: "Назначение, предложения и проверка выполняются прямо в заявке.", preparingProcurement: "Подготавливаем закупочную часть заявки…", assignSpecialist: "Назначить специалиста", editSpecialist: "Изменить назначенного специалиста", assign: "Назначить", updateAssignment: "Сохранить назначение", available: "Свободен", activeAssignments: (count: number) => `В работе: ${count}`, addOffer: "Добавить предложение", supplierPhone: "Телефон поставщика", phoneLookupHint: "Номер с + проверяется полностью; без + — по последним цифрам без кода страны.", supplierName: "Название поставщика", supplierFound: "Поставщик найден и заполнен автоматически.", supplierWillBeCreated: "Если номера нет в базе, поставщик будет создан при сохранении предложения.", enterNewSupplierName: "Введите название нового поставщика", unitPrices: "Цена за единицу по позициям", quantity: "Количество", unitPrice: "Цена за единицу", positionTotal: "Сумма позиции", offerTotal: "Итого по предложению", saveOffer: "Сохранить предложение", sendForReview: "Отправить руководителю", supplierOffers: "Предложения поставщиков", noOffers: "Предложений пока нет.", withNds: "С НДС", withoutNds: "Без НДС", approvedOffer: "Одобрено", approveOffer: "Одобрить предложение", returnForRevision: "Вернуть на доработку", rejectionComment: "Комментарий руководителя", explainChanges: "Укажите, что нужно исправить…", rejectOffers: "Вернуть специалисту", changesRequested: "Требуются изменения", completeOffer: "Введите телефон, название нового поставщика, цену и ожидаемую дату поставки каждой позиции.", addOfferFirst: "Добавьте хотя бы одно полное предложение.", commentRequired: "Добавьте комментарий для специалиста.", actionFailed: "Действие не выполнено. Обновите страницу и повторите попытку.",
    expenseReview: "Расходы по закупке",
    expenseReviewDescription: "Все предложения поставщиков, выбранное предложение и стоимость каждой позиции.",
    selectedOfferExpense: "Итоговая стоимость выбранного предложения",
    waitingUntilOffersSent: "Заявка останется в статусе «Ожидает меня», пока вы не отправите предложения руководителю снабжения.",
    deliveryDateNotPast: "Ожидаемая дата поставки не может быть раньше сегодняшней даты.",
    stages: { awaiting_assignment: "Ожидает назначения", collecting_offers: "Сбор предложений", head_review: "Проверка руководителя", changes_requested: "На доработке", approved: "Предложение одобрено" },
  }
  if (lang === "tr") return {
    procurementActions: "Satın alma işlemleri", workHere: "Atama, teklifler ve inceleme doğrudan sipariş içinde yapılır.", preparingProcurement: "Siparişin satın alma bölümü hazırlanıyor…", assignSpecialist: "Uzman ata", editSpecialist: "Atanan uzmanı değiştir", assign: "Ata", updateAssignment: "Atamayı kaydet", available: "Müsait", activeAssignments: (count: number) => `Aktif sipariş: ${count}`, addOffer: "Teklif ekle", supplierPhone: "Tedarikçi telefonu", phoneLookupHint: "+ ile başlayan numara tamamen; + olmadan girilen numara ülke kodu hariç son rakamlarla eşleştirilir.", supplierName: "Tedarikçi adı", supplierFound: "Tedarikçi bulundu ve otomatik dolduruldu.", supplierWillBeCreated: "Numara kayıtlı değilse teklif kaydedilirken tedarikçi otomatik oluşturulur.", enterNewSupplierName: "Yeni tedarikçi adını girin", unitPrices: "Kalem bazında birim fiyat", quantity: "Miktar", unitPrice: "Birim fiyat", positionTotal: "Kalem toplamı", offerTotal: "Teklif toplamı", saveOffer: "Teklifi kaydet", sendForReview: "Yöneticiye gönder", supplierOffers: "Tedarikçi teklifleri", noOffers: "Henüz teklif yok.", withNds: "KDV dahil", withoutNds: "KDV hariç", approvedOffer: "Onaylandı", approveOffer: "Teklifi onayla", returnForRevision: "Yeniden çalışmaya gönder", rejectionComment: "Yönetici yorumu", explainChanges: "Nelerin düzeltilmesi gerektiğini yazın…", rejectOffers: "Uzmana geri gönder", changesRequested: "Değişiklik gerekli", completeOffer: "Telefonu, yeni tedarikçi adını, fiyatı ve her kalemin beklenen teslim tarihini girin.", addOfferFirst: "En az bir eksiksiz teklif ekleyin.", commentRequired: "Uzman için yorum ekleyin.", actionFailed: "İşlem tamamlanamadı. Sayfayı yenileyip tekrar deneyin.",
    expenseReview: "Satın alma giderleri",
    expenseReviewDescription: "Tüm tedarikçi teklifleri, seçilen teklif ve her kalemin maliyet dökümü.",
    selectedOfferExpense: "Seçilen teklifin toplam maliyeti",
    waitingUntilOffersSent: "Teklifleri Satın Alma Yöneticisine gönderene kadar sipariş ‘Beni bekliyor’ durumunda kalır.",
    deliveryDateNotPast: "Beklenen teslim tarihi bugünden önce olamaz.",
    stages: { awaiting_assignment: "Atama bekliyor", collecting_offers: "Teklif toplanıyor", head_review: "Yönetici incelemesi", changes_requested: "Yeniden çalışılıyor", approved: "Teklif onaylandı" },
  }
  return {
    procurementActions: "Ta’minot ishlari", workHere: "Biriktirish, taklif kiritish va tekshirish bevosita buyurtma ichida bajariladi.", preparingProcurement: "Buyurtmaning ta’minot qismi tayyorlanmoqda…", assignSpecialist: "Mutaxassisni biriktirish", editSpecialist: "Biriktirilgan mutaxassisni o‘zgartirish", assign: "Biriktirish", updateAssignment: "Biriktirishni saqlash", available: "Bo‘sh", activeAssignments: (count: number) => `Faol buyurtmalar: ${count}`, addOffer: "Taklif qo‘shish", supplierPhone: "Yetkazib beruvchi telefoni", phoneLookupHint: "+ bilan boshlangan raqam to‘liq; + siz kiritilgan raqam esa mamlakat kodisiz oxirgi raqamlar bo‘yicha tekshiriladi.", supplierName: "Yetkazib beruvchi nomi", supplierFound: "Yetkazib beruvchi topildi va avtomatik to‘ldirildi.", supplierWillBeCreated: "Raqam bazada bo‘lmasa, taklif saqlanganda yangi yetkazib beruvchi avtomatik yaratiladi.", enterNewSupplierName: "Yangi yetkazib beruvchi nomini kiriting", unitPrices: "Pozitsiyalar bo‘yicha birlik narxi", quantity: "Miqdor", unitPrice: "Birlik narxi", positionTotal: "Pozitsiya summasi", offerTotal: "Taklifning umumiy summasi", saveOffer: "Taklifni saqlash", sendForReview: "Rahbarga yuborish", supplierOffers: "Yetkazib beruvchi takliflari", noOffers: "Hozircha takliflar yo‘q.", withNds: "QQS bilan", withoutNds: "QQSsiz", approvedOffer: "Tasdiqlandi", approveOffer: "Taklifni tasdiqlash", returnForRevision: "Qayta ishlashga yuborish", rejectionComment: "Rahbar izohi", explainChanges: "Nimani o‘zgartirish kerakligini yozing…", rejectOffers: "Mutaxassisga qaytarish", changesRequested: "O‘zgartirish talab qilindi", completeOffer: "Telefon, yangi yetkazib beruvchi nomi, narx va har bir pozitsiyaning kutilayotgan yetkazib berish sanasini kiriting.", addOfferFirst: "Kamida bitta to‘liq taklif qo‘shing.", commentRequired: "Mutaxassis uchun izoh kiriting.", actionFailed: "Amal bajarilmadi. Sahifani yangilab, qayta urinib ko‘ring.",
    expenseReview: "Xarid xarajatlari",
    expenseReviewDescription: "Barcha yetkazib beruvchi takliflari, tanlangan taklif va har bir pozitsiya xarajatlari.",
    selectedOfferExpense: "Tanlangan taklifning umumiy xarajati",
    waitingUntilOffersSent: "Takliflarni Ta’minot rahbariga yubormaguningizcha buyurtma “Meni kutmoqda” holatida qoladi.",
    deliveryDateNotPast: "Kutilayotgan yetkazib berish sanasi bugungi sanadan oldin bo‘lishi mumkin emas.",
    stages: { awaiting_assignment: "Biriktirish kutilmoqda", collecting_offers: "Takliflar yig‘ilmoqda", head_review: "Rahbar tekshiruvi", changes_requested: "Qayta ishlanmoqda", approved: "Taklif tasdiqlandi" },
  }
}
