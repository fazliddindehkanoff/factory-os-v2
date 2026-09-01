"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  ArrowUpDownIcon,
  ClipboardCheckIcon,
  FileSpreadsheetIcon,
  PackageSearchIcon,
  SearchIcon,
  ShoppingCartIcon,
  UserRoundPlusIcon,
} from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { useProcurement } from "@/components/procurement/procurement-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Locale, Messages } from "@/lib/i18n"
import type { ProcurementStage } from "@/lib/procurement"
import { getLocalizedTitle } from "@/lib/settings"
import { cn } from "@/lib/utils"

type ProcurementGridRow = {
  id: string
  orderId: string
  updatedAt: string
  orderNumber: string
  applicant: string
  department: string
  warehouse: string
  productName: string
  productCode: string
  unit: string
  requested: number
  available: number
  purchaseQuantity: number
  assignee: string
  offerCount: number
  stage: ProcurementRegisterStage
}

type ProcurementRegisterStage = ProcurementStage | "not_started"

type SortKey = keyof Pick<
  ProcurementGridRow,
  | "updatedAt"
  | "orderNumber"
  | "applicant"
  | "department"
  | "warehouse"
  | "productName"
  | "productCode"
  | "unit"
  | "requested"
  | "available"
  | "purchaseQuantity"
  | "assignee"
  | "offerCount"
  | "stage"
>

export function ProcurementWorkspace({ lang, messages }: { lang: Locale; messages: Messages }) {
  const { can } = useAuthorization()
  const { orders } = useOrders()
  const { data } = useSettings()
  const { cases, quotations } = useProcurement()
  const [search, setSearch] = React.useState("")
  const [stageFilter, setStageFilter] = React.useState<ProcurementRegisterStage | "all">("all")
  const [sort, setSort] = React.useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "updatedAt",
    direction: "desc",
  })
  const copy = procurementOverviewCopy(lang)

  if (!can("procurement.view")) {
    return <AccessDenied lang={lang} permissions={["procurement.view"]} />
  }

  const casesByOrderId = new Map(cases.map((item) => [item.orderId, item]))
  const rows = orders.flatMap((order): ProcurementGridRow[] => {
    const procurementCase = casesByOrderId.get(order.id)
    const applicant = data.users.find((item) => item.id === order.applicantId)
    const assignee = data.users.find((item) => item.id === procurementCase?.assigneeId)
    const warehouse = data.warehouses.find((item) => item.id === order.warehouseId)
    const department = order.departmentIds
      .map((id) => data.departments.find((item) => item.id === id))
      .filter((item) => item !== undefined)
      .map((item) => getLocalizedTitle(item, lang))
      .join(", ")
    const offerCount = quotations.filter(
      (item) => item.procurementCaseId === procurementCase?.id,
    ).length

    return order.lines
      .map((line) => {
        const product = data.products.find((item) => item.id === line.productId)
        const unit = data["unit-types"].find(
          (item) => item.id === (line.unitTypeId ?? product?.unitTypeId),
        )
        const available = line.availableQuantity ?? 0
        return {
          id: `${order.id}-${line.id}`,
          orderId: order.id,
          updatedAt: procurementCase?.updatedAt ?? order.createdAt,
          orderNumber: order.number,
          applicant: applicant?.fullName ?? "—",
          department: department || "—",
          warehouse: warehouse ? getLocalizedTitle(warehouse, lang) : "—",
          productName: product ? getLocalizedTitle(product, lang) : "—",
          productCode: product?.code ?? "—",
          unit: unit ? getLocalizedTitle(unit, lang) : "—",
          requested: line.quantity,
          available,
          purchaseQuantity: Math.max(0, line.quantity - available),
          assignee: assignee?.fullName ?? copy.notAssigned,
          offerCount,
          stage: procurementCase?.stage ?? "not_started",
        }
      })
  })

  const normalizedSearch = search.trim().toLocaleLowerCase(localeFor(lang))
  const filteredRows = rows
    .filter((row) => stageFilter === "all" || row.stage === stageFilter)
    .filter((row) => !normalizedSearch || [
      row.orderNumber,
      row.applicant,
      row.department,
      row.warehouse,
      row.productName,
      row.productCode,
      row.unit,
      row.assignee,
      copy.stages[row.stage],
    ].some((value) => value.toLocaleLowerCase(localeFor(lang)).includes(normalizedSearch)))
    .sort((left, right) => compareRows(left, right, sort))

  const statCards = [
    {
      label: copy.metrics.requests,
      value: orders.length,
      note: copy.metrics.requestsNote,
      icon: ShoppingCartIcon,
      tone: "text-primary bg-primary/10",
    },
    {
      label: copy.metrics.awaitingAssignment,
      value: cases.filter((item) => item.stage === "awaiting_assignment").length,
      note: copy.metrics.awaitingAssignmentNote,
      icon: UserRoundPlusIcon,
      tone: "text-amber-700 bg-amber-500/10 dark:text-amber-300",
    },
    {
      label: copy.metrics.positions,
      value: rows.length,
      note: copy.metrics.positionsNote,
      icon: PackageSearchIcon,
      tone: "text-sky-700 bg-sky-500/10 dark:text-sky-300",
    },
    {
      label: copy.metrics.review,
      value: cases.filter((item) => item.stage === "head_review").length,
      note: copy.metrics.reviewNote,
      icon: ClipboardCheckIcon,
      tone: "text-violet-700 bg-violet-500/10 dark:text-violet-300",
    },
    {
      label: copy.metrics.offers,
      value: quotations.length,
      note: copy.metrics.offersNote,
      icon: FileSpreadsheetIcon,
      tone: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300",
    },
  ]

  function changeSort(key: SortKey) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "updatedAt" ? "desc" : "asc" })
  }

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-5 px-4 pb-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{messages.procurement}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={copy.metricsLabel}>
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <article key={stat.label} className="rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-foreground/20 hover:bg-muted/20 lg:p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{stat.label}</p>
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", stat.tone)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.note}</p>
            </article>
          )
        })}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-xs" aria-labelledby="procurement-register-title">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileSpreadsheetIcon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 id="procurement-register-title" className="text-sm font-semibold">{copy.tableTitle}</h2>
                <p className="text-xs text-muted-foreground">{copy.tableDescription}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
                className="h-9 pl-8"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value as ProcurementRegisterStage | "all")}
              aria-label={copy.stageFilter}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">{copy.allStages}</option>
              {(Object.keys(copy.stages) as ProcurementRegisterStage[]).map((stage) => (
                <option key={stage} value={stage}>{copy.stages[stage]}</option>
              ))}
            </select>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "h-9")}
              onClick={() => {
                setSearch("")
                setStageFilter("all")
              }}
              disabled={!search && stageFilter === "all"}
            >
              {copy.reset}
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100dvh-23rem)] min-h-64 overflow-auto">
          <table className="w-full min-w-[1540px] border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <GroupHead colSpan={3}>{copy.groups.request}</GroupHead>
                <GroupHead colSpan={2}>{copy.groups.destination}</GroupHead>
                <GroupHead colSpan={6}>{copy.groups.product}</GroupHead>
                <GroupHead colSpan={3}>{copy.groups.procurement}</GroupHead>
                <GroupHead className="sticky right-0 z-40 border-r-0" aria-label={copy.columns.actions} />
              </tr>
              <tr>
                <SortableHead label={copy.columns.updatedAt} sortKey="updatedAt" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.orderNumber} sortKey="orderNumber" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.applicant} sortKey="applicant" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.department} sortKey="department" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.warehouse} sortKey="warehouse" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.product} sortKey="productName" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.productCode} sortKey="productCode" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.unit} sortKey="unit" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.requested} sortKey="requested" sort={sort} onSort={changeSort} numeric />
                <SortableHead label={copy.columns.available} sortKey="available" sort={sort} onSort={changeSort} numeric />
                <SortableHead label={copy.columns.toPurchase} sortKey="purchaseQuantity" sort={sort} onSort={changeSort} numeric />
                <SortableHead label={copy.columns.assignee} sortKey="assignee" sort={sort} onSort={changeSort} />
                <SortableHead label={copy.columns.offers} sortKey="offerCount" sort={sort} onSort={changeSort} numeric />
                <SortableHead label={copy.columns.stage} sortKey="stage" sort={sort} onSort={changeSort} />
                <th className="sticky top-8 right-0 z-30 w-28 border-b border-l bg-muted/95 px-3 py-2 text-left font-medium backdrop-blur-sm">
                  {copy.columns.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="h-48 border-b px-4 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? messages.noProcurementOrders : copy.noMatchingRows}
                  </td>
                </tr>
              ) : filteredRows.map((row) => (
                <tr key={row.id} className="group/row even:bg-muted/15 hover:bg-muted/30">
                  <GridCell className="font-mono tabular-nums">{formatGridDate(row.updatedAt, lang)}</GridCell>
                  <GridCell className="font-mono font-semibold text-primary">{row.orderNumber}</GridCell>
                  <GridCell>{row.applicant}</GridCell>
                  <GridCell>{row.department}</GridCell>
                  <GridCell>{row.warehouse}</GridCell>
                  <GridCell className="max-w-60 font-medium" title={row.productName}>{row.productName}</GridCell>
                  <GridCell className="font-mono text-muted-foreground">{row.productCode}</GridCell>
                  <GridCell>{row.unit}</GridCell>
                  <GridCell numeric>{formatNumber(row.requested, lang)}</GridCell>
                  <GridCell numeric>{formatNumber(row.available, lang)}</GridCell>
                  <GridCell numeric className="font-semibold">{formatNumber(row.purchaseQuantity, lang)}</GridCell>
                  <GridCell>{row.assignee}</GridCell>
                  <GridCell numeric>{formatNumber(row.offerCount, lang)}</GridCell>
                  <GridCell><StageBadge stage={row.stage} copy={copy} /></GridCell>
                  <td className="sticky right-0 z-10 border-b border-l bg-card px-3 py-2 group-even/row:bg-muted group-hover/row:bg-muted">
                    <Link
                      href={`/${lang}/orders?order=${encodeURIComponent(row.orderId)}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 w-full")}
                    >
                      {copy.openOrder}
                      <ArrowRightIcon />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-1 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{copy.showing.replace("{shown}", String(filteredRows.length)).replace("{total}", String(rows.length))}</span>
          <span>{copy.sortHint}</span>
        </div>
      </section>
    </div>
  )
}

function GroupHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "sticky top-0 z-30 h-8 border-r border-b bg-background/95 px-3 text-center text-[10px] font-semibold tracking-[0.16em] text-primary uppercase backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  )
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  numeric,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; direction: "asc" | "desc" }
  onSort: (key: SortKey) => void
  numeric?: boolean
}) {
  const active = sort.key === sortKey
  return (
    <th
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("sticky top-8 z-20 border-r border-b bg-muted/95 px-3 py-2 font-medium backdrop-blur-sm", numeric && "text-right")}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 text-left text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          numeric && "justify-end text-right",
          active && "text-foreground",
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{label}</span>
        <ArrowUpDownIcon className={cn("size-3 shrink-0", active && "text-primary")} aria-hidden="true" />
      </button>
    </th>
  )
}

function GridCell({ numeric, className, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "max-w-52 truncate border-r border-b px-3 py-2.5 align-middle",
        numeric && "text-right font-mono tabular-nums",
        className,
      )}
      {...props}
    />
  )
}

function StageBadge({ stage, copy }: { stage: ProcurementRegisterStage; copy: ReturnType<typeof procurementOverviewCopy> }) {
  const variant = stage === "approved" ? "default" : stage === "changes_requested" ? "destructive" : stage === "head_review" ? "secondary" : "outline"
  return <Badge variant={variant}>{copy.stages[stage]}</Badge>
}

function compareRows(
  left: ProcurementGridRow,
  right: ProcurementGridRow,
  sort: { key: SortKey; direction: "asc" | "desc" },
) {
  const direction = sort.direction === "asc" ? 1 : -1
  const leftValue = left[sort.key]
  const rightValue = right[sort.key]
  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return (leftValue - rightValue) * direction
  }
  return String(leftValue).localeCompare(String(rightValue), undefined, {
    numeric: true,
    sensitivity: "base",
  }) * direction
}

function localeFor(lang: Locale) {
  return lang === "ru" ? "ru-RU" : lang === "tr" ? "tr-TR" : "uz-UZ"
}

function formatGridDate(value: string, lang: Locale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatNumber(value: number, lang: Locale) {
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 2 }).format(value)
}

function procurementOverviewCopy(lang: Locale) {
  if (lang === "ru") return {
    description: "Реестр заявок снабжения в формате рабочей Excel-таблицы.",
    openOrder: "Открыть", notAssigned: "Не назначен", metricsLabel: "Статистика снабжения",
    searchPlaceholder: "Поиск по таблице…", stageFilter: "Фильтр по этапу", allStages: "Все этапы", reset: "Очистить",
    tableTitle: "Реестр снабжения", tableDescription: "Одна строка — одна позиция заказа", noMatchingRows: "Нет строк под выбранные фильтры.",
    showing: "Показаны {shown} из {total}", sortHint: "Нажмите на заголовок, чтобы отсортировать столбец.",
    groups: { request: "Заявка", destination: "Адресат", product: "Товар", procurement: "Снабжение" },
    columns: { updatedAt: "Дата", orderNumber: "Номер заказа", applicant: "Заявитель", department: "Отдел", warehouse: "Склад", product: "Наименование товара", productCode: "Код товара", unit: "Ед. изм.", requested: "Запрошено", available: "На складе", toPurchase: "К закупке", assignee: "Снабженец", offers: "Предложений", stage: "Статус", actions: "Действия" },
    metrics: { requests: "Заявки", requestsNote: "В реестре снабжения", awaitingAssignment: "Без исполнителя", awaitingAssignmentNote: "Ожидают назначения", positions: "Позиции", positionsNote: "Товары к закупке", review: "На проверке", reviewNote: "У руководителя", offers: "Предложения", offersNote: "Коммерческие предложения" },
    stages: { not_started: "Ещё не в снабжении", awaiting_assignment: "Ожидает назначения", collecting_offers: "Сбор предложений", head_review: "Проверка руководителя", changes_requested: "На доработке", approved: "Предложение одобрено" },
  }
  if (lang === "tr") return {
    description: "Excel çalışma tablosu biçiminde satın alma talepleri kaydı.",
    openOrder: "Aç", notAssigned: "Atanmadı", metricsLabel: "Satın alma istatistikleri",
    searchPlaceholder: "Tabloda ara…", stageFilter: "Aşamaya göre filtrele", allStages: "Tüm aşamalar", reset: "Temizle",
    tableTitle: "Satın alma kaydı", tableDescription: "Her satır bir sipariş kalemidir", noMatchingRows: "Seçilen filtrelere uygun satır yok.",
    showing: "{total} satırdan {shown} tanesi gösteriliyor", sortHint: "Sütunu sıralamak için başlığa tıklayın.",
    groups: { request: "Sipariş", destination: "Hedef", product: "Ürün", procurement: "Satın alma" },
    columns: { updatedAt: "Tarih", orderNumber: "Sipariş no.", applicant: "Talep eden", department: "Departman", warehouse: "Depo", product: "Ürün adı", productCode: "Ürün kodu", unit: "Birim", requested: "Talep", available: "Stokta", toPurchase: "Satın alınacak", assignee: "Uzman", offers: "Teklif", stage: "Durum", actions: "İşlemler" },
    metrics: { requests: "Siparişler", requestsNote: "Satın alma kaydında", awaitingAssignment: "Atanmamış", awaitingAssignmentNote: "Atama bekliyor", positions: "Kalemler", positionsNote: "Satın alınacak ürünler", review: "İncelemede", reviewNote: "Yönetici bekleniyor", offers: "Teklifler", offersNote: "Ticari teklifler" },
    stages: { not_started: "Henüz satın almada değil", awaiting_assignment: "Atama bekliyor", collecting_offers: "Teklif toplanıyor", head_review: "Yönetici incelemesi", changes_requested: "Yeniden çalışılıyor", approved: "Teklif onaylandı" },
  }
  return {
    description: "Ta’minot buyurtmalari Excel ishchi jadvali ko‘rinishida.",
    openOrder: "Ochish", notAssigned: "Biriktirilmagan", metricsLabel: "Ta’minot statistikasi",
    searchPlaceholder: "Jadvaldan qidirish…", stageFilter: "Bosqich bo‘yicha filtrlash", allStages: "Barcha bosqichlar", reset: "Tozalash",
    tableTitle: "Ta’minot reyestri", tableDescription: "Har bir qator — buyurtmaning bitta pozitsiyasi", noMatchingRows: "Tanlangan filtrlarga mos qatorlar yo‘q.",
    showing: "{total} tadan {shown} tasi ko‘rsatilmoqda", sortHint: "Ustunni saralash uchun sarlavhani bosing.",
    groups: { request: "Buyurtma", destination: "Manzil", product: "Mahsulot", procurement: "Ta’minot" },
    columns: { updatedAt: "Sana", orderNumber: "Buyurtma raqami", applicant: "Arizachi", department: "Bo‘lim", warehouse: "Ombor", product: "Mahsulot nomi", productCode: "Mahsulot kodi", unit: "O‘lchov birligi", requested: "So‘ralgan", available: "Omborda", toPurchase: "Xarid qilinadi", assignee: "Ta’minotchi", offers: "Takliflar", stage: "Holati", actions: "Amallar" },
    metrics: { requests: "Buyurtmalar", requestsNote: "Ta’minot reyestrida", awaitingAssignment: "Ijrochisiz", awaitingAssignmentNote: "Biriktirish kutilmoqda", positions: "Pozitsiyalar", positionsNote: "Xarid qilinadigan mahsulotlar", review: "Tekshiruvda", reviewNote: "Rahbar harakatini kutmoqda", offers: "Takliflar", offersNote: "Tijorat takliflari" },
    stages: { not_started: "Hali ta’minotda emas", awaiting_assignment: "Biriktirish kutilmoqda", collecting_offers: "Takliflar yig‘ilmoqda", head_review: "Rahbar tekshiruvi", changes_requested: "Qayta ishlanmoqda", approved: "Taklif tasdiqlandi" },
  }
}
