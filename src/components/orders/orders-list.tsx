"use client"

import * as React from "react"
import Link from "next/link"
import { FilterIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react"

import { AccessDenied } from "@/components/auth/access-denied"
import { useAuthorization } from "@/components/auth/use-authorization"
import { useOrders } from "@/components/orders/orders-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Locale, Messages } from "@/lib/i18n"
import type { OrderRecord, OrderStatus, UrgencyLevel } from "@/lib/orders"
import { getLocalizedTitle } from "@/lib/settings"

type Filters = {
  type: string
  status: string
  urgency: string
  departmentId: string
  warehouseId: string
}

const initialFilters: Filters = {
  type: "",
  status: "",
  urgency: "",
  departmentId: "",
  warehouseId: "",
}

export function OrdersList({ lang, messages }: { lang: Locale; messages: Messages }) {
  const { orders, deleteOrders } = useOrders()
  const { data } = useSettings()
  const { can, canViewOrders, currentUser } = useAuthorization()
  const [query, setQuery] = React.useState("")
  const [filters, setFilters] = React.useState(initialFilters)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const canCreate = can("requests.create")
  const canDelete = can("requests.edit")
  const ownOnly = !can("requests.view") && can("requests.view_own")
  const normalizedQuery = query.trim().toLocaleLowerCase()

  const filteredOrders = orders.filter((order) => {
    const applicant = data.users.find((user) => user.id === order.applicantId)
    const productSearch = order.lines
      .map((line) => data.products.find((product) => product.id === line.productId))
      .filter(Boolean)
      .map((product) => `${product?.code} ${product?.titleUz} ${product?.titleRu} ${product?.titleTr}`)
      .join(" ")
    const searchText = `${order.number} ${applicant?.fullName ?? ""} ${productSearch}`.toLocaleLowerCase()

    return (!ownOnly || order.applicantId === currentUser?.id) &&
      (!normalizedQuery || searchText.includes(normalizedQuery)) &&
      (!filters.type || order.type === filters.type) &&
      (!filters.status || order.status === filters.status) &&
      (!filters.urgency || order.urgency === filters.urgency) &&
      (!filters.departmentId || order.departmentIds.includes(filters.departmentId)) &&
      (!filters.warehouseId || order.warehouseId === filters.warehouseId)
  })
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize)
  const pageIds = pageOrders.map((order) => order.id)
  const pageIdKey = pageIds.join("\u0000")
  const validSelectedIds = new Set([...selectedIds].filter((id) => filteredOrders.some((order) => order.id === id)))
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => validSelectedIds.has(id))
  const partiallySelected = pageIds.some((id) => validSelectedIds.has(id)) && !allPageSelected
  const hasFilters = Object.values(filters).some(Boolean)

  React.useEffect(() => {
    const ids = pageIdKey
    function selectPage(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && !target?.matches("input, textarea, select, [contenteditable='true']")) {
        event.preventDefault()
        setSelectedIds((current) => new Set([...current, ...(ids ? ids.split("\u0000") : [])]))
      }
    }
    window.addEventListener("keydown", selectPage)
    return () => window.removeEventListener("keydown", selectPage)
  }, [pageIdKey])

  if (!canViewOrders) {
    return <AccessDenied lang={lang} permissions={["requests.view", "requests.view_own"]} />
  }

  function togglePage(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      pageIds.forEach((id) => checked ? next.add(id) : next.delete(id))
      return next
    })
  }

  function toggleOrder(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
    setSelectedIds(new Set())
  }

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-4 px-4 pb-8 md:px-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{messages.orderList}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{messages.orderListDescription}</p>
        </div>
        {canCreate ? (
          <Link href={`/${lang}/orders/new`} className={buttonVariants({ className: "w-full sm:w-auto" })}>
            <PlusIcon />
            {messages.newOrder}
          </Link>
        ) : null}
      </div>

      <div className="relative max-w-lg">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={messages.searchOrders} className="pl-8" />
      </div>

      <div className="space-y-2 rounded-xl bg-muted/45 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium"><FilterIcon className="size-4" />{messages.filters}</div>
          {hasFilters ? <Button variant="ghost" size="sm" onClick={() => { setFilters(initialFilters); setPage(1) }}><XIcon />{messages.clearFilters}</Button> : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <OrderFilter label={messages.orderType} value={filters.type} onChange={(value) => updateFilter("type", value)} messages={messages} options={[{ value: "material", label: messages.material }, { value: "service", label: messages.service }]} />
          <OrderFilter label={messages.orderStatus} value={filters.status} onChange={(value) => updateFilter("status", value)} messages={messages} options={statusOptions(messages)} />
          <OrderFilter label={messages.urgency} value={filters.urgency} onChange={(value) => updateFilter("urgency", value)} messages={messages} options={urgencyOptions(messages)} />
          <OrderFilter label={messages.departmentsField} value={filters.departmentId} onChange={(value) => updateFilter("departmentId", value)} messages={messages} options={data.departments.map((item) => ({ value: item.id, label: getLocalizedTitle(item, lang) }))} />
          <OrderFilter label={messages.warehouse} value={filters.warehouseId} onChange={(value) => updateFilter("warehouseId", value)} messages={messages} options={data.warehouses.map((item) => ({ value: item.id, label: getLocalizedTitle(item, lang) }))} />
        </div>
      </div>

      {validSelectedIds.size === 0 ? <p className="text-xs text-muted-foreground">{messages.selectionShortcut}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><Checkbox checked={allPageSelected} indeterminate={partiallySelected} onCheckedChange={(checked) => togglePage(checked === true)} aria-label={messages.selectAllPage} /></TableHead>
            <TableHead>{messages.orderNumber}</TableHead>
            <TableHead>{messages.orderType}</TableHead>
            <TableHead>{messages.applicant}</TableHead>
            <TableHead>{messages.departmentsField}</TableHead>
            <TableHead>{messages.warehouse}</TableHead>
            <TableHead>{messages.positionsCount}</TableHead>
            <TableHead>{messages.expectedDate}</TableHead>
            <TableHead>{messages.urgency}</TableHead>
            <TableHead>{messages.orderStatus}</TableHead>
            <TableHead>{messages.createdAt}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageOrders.length === 0 ? <TableRow><TableCell colSpan={11} className="h-28 text-center text-muted-foreground">{messages.noRecords}</TableCell></TableRow> : pageOrders.map((order) => (
            <OrderRow key={order.id} order={order} lang={lang} messages={messages} selected={validSelectedIds.has(order.id)} onToggle={toggleOrder} data={data} />
          ))}
        </TableBody>
      </Table>

      {validSelectedIds.size > 0 ? (
        <div role="toolbar" aria-label={messages.bulkActions} className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border bg-popover p-1.5 shadow-lg">
          <span className="px-2 text-sm font-medium">{validSelectedIds.size} {messages.selectedRows}</span>
          {canDelete ? <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2Icon />{messages.delete}</Button> : null}
          <Button variant="ghost" size="icon-sm" aria-label={messages.cancel} onClick={() => setSelectedIds(new Set())}><XIcon /></Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">{messages.rowsPerPage}<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="h-8 rounded-lg border border-input bg-background px-2 text-foreground">{[10, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label>
        <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{safePage} {messages.pageOf} {pageCount}</span><Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))}>{messages.previousPage}</Button><Button variant="outline" size="sm" disabled={safePage === pageCount} onClick={() => setPage(Math.min(pageCount, safePage + 1))}>{messages.nextPage}</Button></div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{messages.deleteOrders}</DialogTitle><DialogDescription>{messages.deleteOrdersConfirmation}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmDelete(false)}>{messages.cancel}</Button><Button variant="destructive" onClick={() => { deleteOrders([...validSelectedIds]); setSelectedIds(new Set()); setConfirmDelete(false) }}><Trash2Icon />{messages.delete}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  )
}

function OrderRow({ order, lang, messages, selected, onToggle, data }: { order: OrderRecord; lang: Locale; messages: Messages; selected: boolean; onToggle: (id: string, checked: boolean) => void; data: ReturnType<typeof useSettings>["data"] }) {
  const applicant = data.users.find((user) => user.id === order.applicantId)
  const warehouse = data.warehouses.find((item) => item.id === order.warehouseId)
  const departments = order.departmentIds.map((id) => data.departments.find((item) => item.id === id)).filter(Boolean).map((item) => item ? getLocalizedTitle(item, lang) : "").join(", ")
  return <TableRow data-state={selected ? "selected" : undefined}><TableCell><Checkbox checked={selected} onCheckedChange={(checked) => onToggle(order.id, checked === true)} aria-label={`${messages.selectOption}: ${order.number}`} /></TableCell><TableCell className="font-medium">{order.number}</TableCell><TableCell>{order.type === "material" ? messages.material : messages.service}</TableCell><TableCell>{applicant?.fullName ?? "—"}</TableCell><TableCell>{departments || "—"}</TableCell><TableCell>{warehouse ? getLocalizedTitle(warehouse, lang) : "—"}</TableCell><TableCell>{order.lines.length}</TableCell><TableCell>{formatDate(order.expectedDate)}</TableCell><TableCell><UrgencyBadge urgency={order.urgency} messages={messages} /></TableCell><TableCell><StatusBadge status={order.status} messages={messages} /></TableCell><TableCell>{formatDate(order.createdAt.slice(0, 10))}</TableCell></TableRow>
}

function OrderFilter({ label, value, onChange, options, messages }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; messages: Messages }) {
  return <label className="grid gap-1 text-xs font-medium text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm font-normal text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><option value="">{messages.allOptions}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function statusOptions(messages: Messages) { return [{ value: "warehouse_check", label: messages.statusWarehouseCheck }, { value: "approved", label: messages.statusApproved }, { value: "rejected", label: messages.statusRejected }, { value: "draft", label: messages.statusDraft }] }
function urgencyOptions(messages: Messages) { return [{ value: "normal", label: messages.urgencyNormal }, { value: "high", label: messages.urgencyHigh }, { value: "urgent", label: messages.urgencyUrgent }, { value: "critical", label: messages.urgencyCritical }] }
function formatDate(date: string) {
  const [year, month, day] = date.split("-")
  return `${day}.${month}.${year}`
}
function StatusBadge({ status, messages }: { status: OrderStatus; messages: Messages }) { const labels = { warehouse_check: messages.statusWarehouseCheck, approved: messages.statusApproved, rejected: messages.statusRejected, draft: messages.statusDraft }; const variants = { warehouse_check: "secondary", approved: "default", rejected: "destructive", draft: "outline" } as const; return <Badge variant={variants[status]}>{labels[status]}</Badge> }
function UrgencyBadge({ urgency, messages }: { urgency: UrgencyLevel; messages: Messages }) { const labels = { normal: messages.urgencyNormal, high: messages.urgencyHigh, urgent: messages.urgencyUrgent, critical: messages.urgencyCritical }; const variants = { normal: "secondary", high: "outline", urgent: "default", critical: "destructive" } as const; return <Badge variant={variants[urgency]}>{labels[urgency]}</Badge> }
