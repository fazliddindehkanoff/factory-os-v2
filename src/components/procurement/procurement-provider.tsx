"use client"

import * as React from "react"

import { useOrders } from "@/components/orders/orders-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { createAppRecord, loadAppRecords } from "@/lib/client-app-records"
import {
  getAssignedProcurementLineIds,
  getProcurementLinesAtStep,
  getOrderActionView,
  getProcurementSuborderForSpecialist,
  getProcurementSpecialistIds,
  isOrderAssignedToProcurementSpecialist,
} from "@/lib/orders"
import {
  calculateQuotationTotal,
  getRequiredProcurementQuantity,
  isExpectedDeliveryDateAllowed,
  normalizeSupplierPhone,
  quotationLinesCoverRequirements,
  supplierPhoneMatches,
  type ProcurementCase,
  type QuotationRecord,
  type SupplierRecord,
} from "@/lib/procurement"
import { hasPermission, type PermissionCode } from "@/lib/rbac"

const initialSuppliers: SupplierRecord[] = []


type SupplierInput = Omit<SupplierRecord, "id" | "status">
type QuotationInput = Pick<
  QuotationRecord,
  "procurementCaseId" | "lines"
> & {
  supplierPhone: string
  supplierName: string
}

type ProcurementContextValue = {
  cases: ProcurementCase[]
  quotations: QuotationRecord[]
  suppliers: SupplierRecord[]
  storageReady: boolean
  syncError: boolean
  addSupplier: (supplier: SupplierInput) => Promise<boolean>
  updateSupplier: (supplier: SupplierRecord) => Promise<void>
  archiveSupplier: (id: string) => Promise<void>
  findSupplierByPhone: (phone: string) => SupplierRecord | undefined
  assignSpecialist: (procurementCaseId: string, specialistUserId: string, orderLineIds: string[]) => Promise<boolean>
  addQuotation: (quotation: QuotationInput) => Promise<boolean>
  submitForReview: (procurementCaseId: string) => Promise<boolean>
  approveQuotations: (procurementCaseId: string, quotationIds: string[]) => Promise<boolean>
  rejectOffers: (procurementCaseId: string, comment: string) => Promise<boolean>
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
  const [quotations, updateQuotations] = React.useState<QuotationRecord[]>([])
  const quotationRevision = React.useRef(0)
  const setQuotations = React.useCallback((value: React.SetStateAction<QuotationRecord[]>) => {
    quotationRevision.current += 1
    updateQuotations(value)
  }, [])
  const [suppliers, setSuppliers] = React.useState(initialSuppliers)
  const [syncError, setSyncError] = React.useState(false)
  const [storageReady, setStorageReady] = React.useState(false)
  const currentUser = data.users.find((user) => user.id === currentUserId)
  const currentRoles = data.roles.filter((role) => currentUser?.roleIds.includes(role.id))
  const can = (permission: PermissionCode) => hasPermission(currentRoles, permission)
  const canViewSuppliers = can("suppliers.view")
  const canViewQuotations = can("procurement.view") || can("finance.view")
  const canViewProcurementCases = can("procurement.view")

  React.useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    let loading = false
    async function refresh() {
      if (loading || document.visibilityState === "hidden") return
      loading = true
      const revision = quotationRevision.current
      try {
      const [serverSuppliers, serverQuotations, serverCases] = await Promise.all([
      canViewSuppliers ? loadAppRecords<SupplierRecord>("suppliers") : Promise.resolve([]),
      canViewQuotations ? loadAppRecords<QuotationRecord>("quotations") : Promise.resolve([]),
      canViewProcurementCases ? loadAppRecords<ProcurementCase>("procurement-cases") : Promise.resolve([]),
      ])
      if (cancelled) return
      setSyncError(false)
      setSuppliers(serverSuppliers)
      if (revision === quotationRevision.current) updateQuotations(serverQuotations)
      setStoredCases((current) => mergeRecords(current, serverCases))
      } finally { loading = false; if (!cancelled) setStorageReady(true) }
    }
    const refreshSafely = () => { void refresh().catch(() => { if (!cancelled) setSyncError(true) }) }
    refreshSafely()
    const interval = window.setInterval(refreshSafely, 30_000)
    window.addEventListener("focus", refreshSafely)
    window.addEventListener("factory-os:orders-changed", refreshSafely)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshSafely)
      window.removeEventListener("factory-os:orders-changed", refreshSafely)
    }
  }, [canViewProcurementCases, canViewQuotations, canViewSuppliers, currentUserId])

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
    const next = storedCases.filter((item) => procurementOrders.some((order) => order.id === item.orderId))
    for (const storedOrder of procurementOrders) {
      const order = getOrderActionView(storedOrder, currentUserId)
      const index = next.findIndex((item) => item.orderId === order.id)
      const existing = index >= 0 ? next[index] : undefined
      const stage = order.currentStep === "procurement_accept"
        ? "awaiting_assignment" as const
        : order.currentStep === "sourcing"
          ? order.procurementReviewComment ? "changes_requested" as const : "collecting_offers" as const
          : order.currentStep === "price_check"
            ? "head_review" as const
            : "approved" as const
      const normalized: ProcurementCase = {
        id: existing?.id ?? `procurement-${order.id}`,
        orderId: order.id,
        assigneeId: getProcurementSpecialistIds(order).length === 1
          ? getProcurementSpecialistIds(order)[0]
          : undefined,
        assigneeIds: getProcurementSpecialistIds(order),
        stage,
        reviewComment: stage === "changes_requested"
          ? order.procurementReviewComment ?? existing?.reviewComment
          : undefined,
        updatedAt: existing?.updatedAt ?? order.createdAt,
      }
      if (!existing) next.push(normalized)
      else next[index] = normalized
    }
    return next
  }, [orders, ordersReady, storageReady, storedCases, currentUserId])

  async function addSupplier(supplier: SupplierInput) {
    if (!can("suppliers.manage")) return false
    const record: SupplierRecord = {
      ...supplier,
      id: `supplier-${crypto.randomUUID()}`,
      status: "active",
    }
    try {
      const persisted = await createAppRecord("suppliers", record)
      setSuppliers((current) => [persisted, ...current.filter((item) => item.id !== persisted.id)])
      return true
    } catch {
      return false
    }
  }

  async function updateSupplier(supplier: SupplierRecord) {
    const response = await fetch(`/api/suppliers/${encodeURIComponent(supplier.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(supplier) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? "supplier-update-failed")
    setSuppliers((current) => current.map((item) => item.id === supplier.id ? result.record : item))
  }

  async function archiveSupplier(id: string) {
    const supplier = suppliers.find((item) => item.id === id)
    if (supplier) await updateSupplier({ ...supplier, status: "archived" })
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

  async function assignSpecialist(
    procurementCaseId: string,
    specialistUserId: string,
    orderLineIds: string[],
  ) {
    if (!can("procurement.select_supplier")) return false
    const procurementCase = cases.find((item) => item.id === procurementCaseId)
    if (
      !procurementCase ||
      !await assignProcurementSpecialist(procurementCase.orderId, specialistUserId, orderLineIds)
    ) return false
    updateCase(procurementCaseId, {
      reviewComment: procurementCase.reviewComment,
      updatedAt: new Date().toISOString(),
    })
    return true
  }

  async function addQuotation(quotation: QuotationInput) {
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
    const requiredLines = order ? getProcurementLinesAtStep(order, "sourcing", currentUserId) : []
    const requiredLinesById = new Map(requiredLines.map((line) => [line.id, line]))
    const assignedLineIds = new Set(order
      ? getAssignedProcurementLineIds(order, currentUserId)
      : [])
    const submittedLineIds = quotation.lines.map((line) => line.orderLineId)
    if (
      !procurementCase ||
      !supplier ||
      !order ||
      !isOrderAssignedToProcurementSpecialist(order, currentUserId) ||
      !requiredLines.length ||
      !quotation.lines.length ||
      new Set(submittedLineIds).size !== submittedLineIds.length ||
      quotation.lines.some(
        (line) => {
          const requiredLine = requiredLinesById.get(line.orderLineId)
          return !requiredLine ||
            !assignedLineIds.has(line.orderLineId) ||
            line.quantity <= 0 ||
            line.quantity > getRequiredProcurementQuantity(requiredLine) ||
            line.unitPrice <= 0 ||
            !isExpectedDeliveryDateAllowed(line.expectedDeliveryDate)
        },
      )
    ) return false
    const normalizedLines = quotation.lines.map((line) => ({ ...line }))
    const procurementSuborder = getProcurementSuborderForSpecialist(order, currentUserId)
    const record: QuotationRecord = {
      procurementCaseId: quotation.procurementCaseId,
      procurementSuborderId: procurementSuborder?.id,
      procurementSuborderNumber: procurementSuborder?.number,
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
    try {
      if (!matchedSupplier) {
        const persistedSupplier = await createAppRecord("suppliers", supplier)
        setSuppliers((current) => [persistedSupplier, ...current.filter((item) => item.id !== persistedSupplier.id)])
      }
      const persisted = await createAppRecord("quotations", record)
      setQuotations((current) => [...current.filter((item) => item.id !== persisted.id), persisted])
    } catch {
      return false
    }
    updateCase(quotation.procurementCaseId, { updatedAt: record.createdAt })
    return true
  }

  async function submitForReview(procurementCaseId: string) {
    if (!can("procurement.quote")) return false
    const procurementCase = cases.find((item) => item.id === procurementCaseId)
    const order = orders.find((item) => item.id === procurementCase?.orderId)
    const requiredLines = order ? getProcurementLinesAtStep(order, "sourcing", currentUserId) : []
    const currentLineIds = new Set(requiredLines.map((line) => line.id))
    const quotationLines = quotations
      .filter((item) => item.procurementCaseId === procurementCaseId)
      .flatMap((item) => item.lines)
      .filter((line) => currentLineIds.has(line.orderLineId))
    const updatedOrder = procurementCase && order &&
      requiredLines.some((line) => quotationLinesCoverRequirements([line], quotationLines.filter((item) => item.orderLineId === line.id)))
      ? await submitProcurementOffers(procurementCase.orderId)
      : undefined
    if (
      !procurementCase ||
      !order ||
      !updatedOrder
    ) return false
    updateCase(procurementCaseId, {
      stage: updatedOrder.currentStep === "price_check" ? "head_review" : "collecting_offers",
      reviewComment: undefined,
      updatedAt: new Date().toISOString(),
    })
    return true
  }

  async function approveQuotations(procurementCaseId: string, quotationIds: string[]) {
    if (!can("procurement.select_supplier") || !can("approvals.approve")) return false
    const procurementCase = cases.find((item) => item.id === procurementCaseId)
    const order = orders.find((item) => item.id === procurementCase?.orderId)
    const selectedIds = [...new Set(quotationIds)]
    const selectedQuotations = quotations.filter(
      (item) => item.procurementCaseId === procurementCaseId && selectedIds.includes(item.id),
    )
    const requiredLines = order ? getProcurementLinesAtStep(order, "price_check", currentUserId) : []
    const reviewIds = new Set(requiredLines.map((line) => line.id))
    if (
      !procurementCase ||
      !order ||
      !selectedIds.length ||
      selectedQuotations.length !== selectedIds.length ||
      !quotationLinesCoverRequirements(requiredLines, selectedQuotations.flatMap((item) => item.lines).filter((line) => reviewIds.has(line.orderLineId)), "exact") ||
      !await reviewProcurementOffers(procurementCase.orderId, true, "", selectedIds)
    ) return false
    const selectedIdSet = new Set(selectedIds)
    setQuotations((current) => current.map((item) => {
      if (item.procurementCaseId !== procurementCaseId) return item
      const selectedLineIds = [...(item.selectedLineIds ?? (item.selected ? item.lines.map((line) => line.orderLineId) : [])).filter((id) => !reviewIds.has(id)),
        ...item.lines.filter((line) => reviewIds.has(line.orderLineId) && selectedIdSet.has(item.id)).map((line) => line.orderLineId)]
      return { ...item, selected: selectedLineIds.length > 0, selectedLineIds }
    }))
    updateCase(procurementCaseId, {
      stage: "approved",
      reviewComment: undefined,
      updatedAt: new Date().toISOString(),
    })
    return true
  }

  async function rejectOffers(procurementCaseId: string, comment: string) {
    if (!can("procurement.select_supplier") || !can("approvals.reject")) return false
    const procurementCase = cases.find((item) => item.id === procurementCaseId)
    const normalizedComment = comment.trim()
    if (!procurementCase || !normalizedComment || !await reviewProcurementOffers(procurementCase.orderId, false, normalizedComment)) return false
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
      syncError,
      addSupplier,
      updateSupplier,
      archiveSupplier,
      findSupplierByPhone,
      assignSpecialist,
      addQuotation,
      submitForReview,
      approveQuotations,
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


function mergeRecords<T extends { id: string }>(local: T[], server: T[]) {
  const merged = new Map(local.map((record) => [record.id, record]))
  for (const record of server) merged.set(record.id, record)
  return [...merged.values()]
}
