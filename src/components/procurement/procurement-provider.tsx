"use client"

import * as React from "react"

import { useOrders } from "@/components/orders/orders-provider"
import { useSettings } from "@/components/settings/settings-provider"
import {
  calculateQuotationTotal,
  isExpectedDeliveryDateAllowed,
  normalizeSupplierPhone,
  supplierPhoneMatches,
  type ProcurementCase,
  type QuotationRecord,
  type SupplierRecord,
} from "@/lib/procurement"
import { hasPermission, type PermissionCode } from "@/lib/rbac"

const initialSuppliers: SupplierRecord[] = [
  {
    id: "supplier-tashkent-metall",
    name: "Toshkent Metall Savdo",
    inn: "305 678 912",
    phone: "+998 71 200 45 60",
    email: "sales@tm-supply.uz",
    contactPerson: "Sardor Aliyev",
    category: "Metall va xomashyo",
    status: "active",
  },
  {
    id: "supplier-asia-cable",
    name: "Asia Cable Group",
    inn: "307 114 820",
    phone: "+998 78 122 48 80",
    email: "orders@asiacable.uz",
    contactPerson: "Kamola Nurmatova",
    category: "Elektr jihozlari",
    status: "active",
  },
  {
    id: "supplier-samtex-service",
    name: "SamTex Service",
    inn: "309 441 736",
    phone: "+998 66 240 18 12",
    email: "office@samtex.uz",
    contactPerson: "Akmal Ismoilov",
    category: "Servis va montaj",
    status: "active",
  },
]

const CASES_STORAGE_KEY = "factory-os-procurement-cases-v2"
const QUOTATIONS_STORAGE_KEY = "factory-os-procurement-quotations-v2"
const SUPPLIERS_STORAGE_KEY = "factory-os-procurement-suppliers-v2"

type SupplierInput = Omit<SupplierRecord, "id" | "status">
type QuotationInput = Pick<
  QuotationRecord,
  "procurementCaseId" | "lines"
> & {
  supplierPhone: string
  supplierName: string
}

type LegacyQuotationRecord = QuotationRecord & {
  ndsIncluded?: boolean
  paymentTerms?: string
  leadTimeDays?: number
}

type ProcurementContextValue = {
  cases: ProcurementCase[]
  quotations: QuotationRecord[]
  suppliers: SupplierRecord[]
  storageReady: boolean
  addSupplier: (supplier: SupplierInput) => void
  updateSupplier: (supplier: SupplierRecord) => void
  archiveSupplier: (id: string) => void
  findSupplierByPhone: (phone: string) => SupplierRecord | undefined
  assignSpecialist: (procurementCaseId: string, specialistUserId: string) => boolean
  addQuotation: (quotation: QuotationInput) => boolean
  submitForReview: (procurementCaseId: string) => boolean
  approveQuotation: (procurementCaseId: string, quotationId: string) => boolean
  rejectOffers: (procurementCaseId: string, comment: string) => boolean
}

const ProcurementContext = React.createContext<ProcurementContextValue | null>(null)

export function ProcurementProvider({ children }: { children: React.ReactNode }) {
  const {
    orders,
    storageReady: ordersReady,
    assignProcurementSpecialist,
    submitProcurementOffers,
    reviewProcurementOffers,
  } = useOrders()
  const { currentUserId, data } = useSettings()
  const [storedCases, setStoredCases] = React.useState<ProcurementCase[]>([])
  const [quotations, setQuotations] = React.useState<QuotationRecord[]>([])
  const [suppliers, setSuppliers] = React.useState(initialSuppliers)
  const [storageReady, setStorageReady] = React.useState(false)
  const currentUser = data.users.find((user) => user.id === currentUserId)
  const currentRoles = data.roles.filter((role) => currentUser?.roleIds.includes(role.id))
  const can = (permission: PermissionCode) => hasPermission(currentRoles, permission)

  React.useEffect(() => {
    try {
      const savedCases = window.localStorage.getItem(CASES_STORAGE_KEY)
      const savedQuotations = window.localStorage.getItem(QUOTATIONS_STORAGE_KEY)
      const savedSuppliers = window.localStorage.getItem(SUPPLIERS_STORAGE_KEY)
      if (savedCases) setStoredCases(JSON.parse(savedCases) as ProcurementCase[])
      if (savedQuotations) {
        const parsed = JSON.parse(savedQuotations) as LegacyQuotationRecord[]
        setQuotations(parsed.map(migrateQuotation))
      }
      if (savedSuppliers) setSuppliers(JSON.parse(savedSuppliers) as SupplierRecord[])
    } finally {
      setStorageReady(true)
    }
  }, [])

  React.useEffect(() => {
    if (!storageReady) return
    window.localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(storedCases))
    window.localStorage.setItem(QUOTATIONS_STORAGE_KEY, JSON.stringify(quotations))
    window.localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers))
  }, [quotations, storageReady, storedCases, suppliers])

  const cases = React.useMemo(() => {
    if (!ordersReady || !storageReady) return storedCases
    const procurementOrders = orders.filter((order) =>
      order.lines.some((line) => line.fulfillmentStatus === "needs_procurement") &&
      [
        "procurement_accept",
        "sourcing",
        "price_check",
        "director",
        "procurement_order",
        "warehouse_receipt",
        "complete",
      ].includes(order.currentStep),
    )
    const next = [...storedCases]
    for (const order of procurementOrders) {
      const index = next.findIndex((item) => item.orderId === order.id)
      const existing = index >= 0 ? next[index] : undefined
      const stage = order.currentStep === "procurement_accept"
        ? "awaiting_assignment" as const
        : order.currentStep === "sourcing"
          ? existing?.reviewComment ? "changes_requested" as const : "collecting_offers" as const
          : order.currentStep === "price_check"
            ? "head_review" as const
            : "approved" as const
      const normalized: ProcurementCase = {
        id: existing?.id ?? `procurement-${order.id}`,
        orderId: order.id,
        assigneeId: order.procurementSpecialistUserId,
        stage,
        reviewComment: stage === "changes_requested" ? existing?.reviewComment : undefined,
        updatedAt: existing?.updatedAt ?? order.createdAt,
      }
      if (!existing) next.push(normalized)
      else next[index] = normalized
    }
    return next
  }, [orders, ordersReady, storageReady, storedCases])

  function addSupplier(supplier: SupplierInput) {
    if (!can("suppliers.manage")) return
    setSuppliers((current) => [
      { ...supplier, id: `supplier-${crypto.randomUUID()}`, status: "active" },
      ...current,
    ])
  }

  function updateSupplier(supplier: SupplierRecord) {
    if (!can("suppliers.manage")) return
    setSuppliers((current) => current.map((item) => item.id === supplier.id ? supplier : item))
  }

  function archiveSupplier(id: string) {
    if (!can("suppliers.manage")) return
    setSuppliers((current) => current.map((item) => item.id === id ? { ...item, status: "archived" } : item))
  }

  function findSupplierByPhone(phone: string) {
    const normalizedPhone = normalizeSupplierPhone(phone)
    if (normalizedPhone.length < 7) return undefined
    const exactMatch = suppliers.find(
      (supplier) => normalizeSupplierPhone(supplier.phone) === normalizedPhone,
    )
    if (exactMatch) return exactMatch
    if (phone.trimStart().startsWith("+")) return undefined
    const suffixMatches = suppliers.filter((supplier) => supplierPhoneMatches(phone, supplier.phone))
    const uniqueMatchedPhones = new Set(
      suffixMatches.map((supplier) => normalizeSupplierPhone(supplier.phone)),
    )
    return uniqueMatchedPhones.size === 1 ? suffixMatches[0] : undefined
  }

  function updateCase(procurementCaseId: string, changes: Partial<ProcurementCase>) {
    const derivedCase = cases.find((item) => item.id === procurementCaseId)
    if (!derivedCase) return
    setStoredCases((current) => {
      const existing = current.find((item) => item.id === procurementCaseId)
      const updated = { ...(existing ?? derivedCase), ...changes }
      return existing
        ? current.map((item) => item.id === procurementCaseId ? updated : item)
        : [...current, updated]
    })
  }

  function assignSpecialist(procurementCaseId: string, specialistUserId: string) {
    if (!can("procurement.select_supplier")) return false
    const procurementCase = cases.find((item) => item.id === procurementCaseId)
    if (!procurementCase || !assignProcurementSpecialist(procurementCase.orderId, specialistUserId)) return false
    updateCase(procurementCaseId, {
      assigneeId: specialistUserId,
      stage: procurementCase.stage === "awaiting_assignment"
        ? "collecting_offers"
        : procurementCase.stage,
      reviewComment: procurementCase.reviewComment,
      updatedAt: new Date().toISOString(),
    })
    return true
  }

  function addQuotation(quotation: QuotationInput) {
    if (!can("procurement.quote")) return false
    const procurementCase = cases.find((item) => item.id === quotation.procurementCaseId)
    const matchedSupplier = findSupplierByPhone(quotation.supplierPhone)
    const supplierName = matchedSupplier?.name ?? quotation.supplierName.trim()
    const supplierPhone = matchedSupplier?.phone ?? quotation.supplierPhone.trim()
    const supplier = matchedSupplier ?? (supplierName && normalizeSupplierPhone(supplierPhone).length >= 7
      ? {
          id: `supplier-${crypto.randomUUID()}`,
          name: supplierName,
          phone: supplierPhone,
          inn: "",
          email: "",
          contactPerson: "",
          category: "",
          status: "active" as const,
        }
      : undefined)
    const order = orders.find((item) => item.id === procurementCase?.orderId)
    const requiredLines = order?.lines.filter(
      (line) => line.fulfillmentStatus === "needs_procurement",
    ) ?? []
    const requiredLineIds = requiredLines.map((line) => line.id)
    if (
      !procurementCase ||
      !supplier ||
      procurementCase.assigneeId !== currentUserId ||
      order?.currentStep !== "sourcing" ||
      requiredLineIds.length !== quotation.lines.length ||
      !requiredLineIds.every((id) => quotation.lines.some((line) => line.orderLineId === id)) ||
      quotation.lines.some(
        (line) =>
          line.quantity <= 0 ||
          line.unitPrice <= 0 ||
          !isExpectedDeliveryDateAllowed(line.expectedDeliveryDate),
      )
    ) return false
    if (!matchedSupplier) setSuppliers((current) => [supplier, ...current])
    const normalizedLines = requiredLines.map((line) => ({
      orderLineId: line.id,
      quantity: Math.max(0, line.quantity - (line.availableQuantity ?? 0)),
      unitPrice: quotation.lines.find((item) => item.orderLineId === line.id)?.unitPrice ?? 0,
      expectedDeliveryDate: quotation.lines.find((item) => item.orderLineId === line.id)?.expectedDeliveryDate ?? "",
      ndsIncluded: quotation.lines.find((item) => item.orderLineId === line.id)?.ndsIncluded ?? false,
    }))
    const record: QuotationRecord = {
      procurementCaseId: quotation.procurementCaseId,
      lines: normalizedLines,
      id: `quote-${crypto.randomUUID()}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierPhone: supplier.phone,
      amount: calculateQuotationTotal(normalizedLines),
      selected: false,
      createdByUserId: currentUserId,
      createdAt: new Date().toISOString(),
    }
    setQuotations((current) => [...current, record])
    updateCase(quotation.procurementCaseId, { updatedAt: record.createdAt })
    return true
  }

  function submitForReview(procurementCaseId: string) {
    if (!can("procurement.quote")) return false
    const procurementCase = cases.find((item) => item.id === procurementCaseId)
    const hasOffers = quotations.some((item) => item.procurementCaseId === procurementCaseId)
    if (!procurementCase || !hasOffers || !submitProcurementOffers(procurementCase.orderId)) return false
    updateCase(procurementCaseId, {
      stage: "head_review",
      reviewComment: undefined,
      updatedAt: new Date().toISOString(),
    })
    return true
  }

  function approveQuotation(procurementCaseId: string, quotationId: string) {
    if (!can("procurement.select_supplier") || !can("approvals.approve")) return false
    const procurementCase = cases.find((item) => item.id === procurementCaseId)
    const quotation = quotations.find((item) => item.id === quotationId && item.procurementCaseId === procurementCaseId)
    if (!procurementCase || !quotation || !reviewProcurementOffers(procurementCase.orderId, true)) return false
    setQuotations((current) => current.map((item) => item.procurementCaseId === procurementCaseId
      ? { ...item, selected: item.id === quotationId }
      : item))
    updateCase(procurementCaseId, {
      stage: "approved",
      reviewComment: undefined,
      updatedAt: new Date().toISOString(),
    })
    return true
  }

  function rejectOffers(procurementCaseId: string, comment: string) {
    if (!can("procurement.select_supplier") || !can("approvals.reject")) return false
    const procurementCase = cases.find((item) => item.id === procurementCaseId)
    const normalizedComment = comment.trim()
    if (!procurementCase || !normalizedComment || !reviewProcurementOffers(procurementCase.orderId, false, normalizedComment)) return false
    updateCase(procurementCaseId, {
      stage: "changes_requested",
      reviewComment: normalizedComment,
      updatedAt: new Date().toISOString(),
    })
    return true
  }

  const isDirector = currentUser?.roleIds.includes("role-director") ?? false
  const visibleOrderIds = new Set(
    orders
      .filter((order) => can("procurement.view") || (
        isDirector && [
          "director",
          "procurement_order",
          "warehouse_receipt",
          "complete",
        ].includes(order.currentStep)
      ))
      .map((order) => order.id),
  )
  const visibleCases = cases.filter((item) => visibleOrderIds.has(item.orderId))
  const visibleCaseIds = new Set(visibleCases.map((item) => item.id))
  const visibleQuotations = quotations.filter((item) => visibleCaseIds.has(item.procurementCaseId))

  return (
    <ProcurementContext.Provider value={{
      cases: visibleCases,
      quotations: visibleQuotations,
      suppliers: can("suppliers.view") ? suppliers : [],
      storageReady,
      addSupplier,
      updateSupplier,
      archiveSupplier,
      findSupplierByPhone,
      assignSpecialist,
      addQuotation,
      submitForReview,
      approveQuotation,
      rejectOffers,
    }}>
      {children}
    </ProcurementContext.Provider>
  )
}

export function useProcurement() {
  const context = React.useContext(ProcurementContext)
  if (!context) throw new Error("useProcurement must be used within ProcurementProvider")
  return context
}

function migrateQuotation(legacy: LegacyQuotationRecord): QuotationRecord {
  const legacyNdsIncluded = legacy.ndsIncluded
  const legacyLeadTimeDays = legacy.leadTimeDays
  const quotation = { ...legacy }
  delete quotation.ndsIncluded
  delete quotation.paymentTerms
  delete quotation.leadTimeDays
  const fallbackDate = legacyDeliveryDate(legacy.createdAt, legacyLeadTimeDays)
  return {
    ...quotation,
    lines: legacy.lines.map((line) => ({
      ...line,
      expectedDeliveryDate: line.expectedDeliveryDate || fallbackDate,
      ndsIncluded: line.ndsIncluded ?? legacyNdsIncluded ?? false,
    })),
  }
}

function legacyDeliveryDate(createdAt: string, leadTimeDays?: number) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  date.setUTCDate(date.getUTCDate() + Math.max(0, leadTimeDays ?? 0))
  return date.toISOString().slice(0, 10)
}
