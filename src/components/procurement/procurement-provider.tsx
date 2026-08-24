"use client"

import * as React from "react"

import type {
  ProcurementCase,
  QuotationRecord,
  SupplierRecord,
} from "@/lib/procurement"

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
  {
    id: "supplier-old-industrial",
    name: "Industrial Reserve",
    inn: "302 090 554",
    phone: "+998 71 255 09 09",
    email: "archive@reserve.uz",
    contactPerson: "",
    category: "Xomashyo",
    status: "archived",
  },
]

const initialCases: ProcurementCase[] = [
  {
    id: "procurement-0012",
    orderId: "order-2026-0012",
    assigneeId: "user-procurement",
    stage: "comparing",
    updatedAt: "2026-08-22T09:45:00.000Z",
  },
  {
    id: "procurement-0011",
    orderId: "order-2026-0011",
    assigneeId: "user-procurement",
    stage: "supplier_selected",
    updatedAt: "2026-08-21T14:20:00.000Z",
  },
  {
    id: "procurement-0010",
    orderId: "order-2026-0010",
    assigneeId: "user-procurement",
    stage: "needs_quote",
    updatedAt: "2026-08-20T08:10:00.000Z",
  },
]

const initialQuotations: QuotationRecord[] = [
  {
    id: "quote-0012-metall",
    procurementCaseId: "procurement-0012",
    supplierId: "supplier-tashkent-metall",
    amount: 148_750_000,
    ndsIncluded: true,
    paymentTerms: "50% oldindan, 50% yetkazilganda",
    leadTimeDays: 6,
    selected: false,
    createdAt: "2026-08-21T10:10:00.000Z",
  },
  {
    id: "quote-0012-cable",
    procurementCaseId: "procurement-0012",
    supplierId: "supplier-asia-cable",
    amount: 151_200_000,
    ndsIncluded: true,
    paymentTerms: "Yetkazilgandan keyin 10 kun",
    leadTimeDays: 4,
    selected: false,
    createdAt: "2026-08-22T09:45:00.000Z",
  },
  {
    id: "quote-0011-service",
    procurementCaseId: "procurement-0011",
    supplierId: "supplier-samtex-service",
    amount: 28_400_000,
    ndsIncluded: false,
    paymentTerms: "30% oldindan",
    leadTimeDays: 8,
    selected: true,
    createdAt: "2026-08-20T13:40:00.000Z",
  },
]

type SupplierInput = Omit<SupplierRecord, "id" | "status">
type QuotationInput = Omit<QuotationRecord, "id" | "selected" | "createdAt">

type ProcurementContextValue = {
  cases: ProcurementCase[]
  quotations: QuotationRecord[]
  suppliers: SupplierRecord[]
  addSupplier: (supplier: SupplierInput) => void
  updateSupplier: (supplier: SupplierRecord) => void
  archiveSupplier: (id: string) => void
  addQuotation: (quotation: QuotationInput) => void
  selectQuotation: (procurementCaseId: string, quotationId: string) => void
}

const ProcurementContext = React.createContext<ProcurementContextValue | null>(null)

export function ProcurementProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = React.useState(initialCases)
  const [quotations, setQuotations] = React.useState(initialQuotations)
  const [suppliers, setSuppliers] = React.useState(initialSuppliers)

  function addSupplier(supplier: SupplierInput) {
    setSuppliers((current) => [
      { ...supplier, id: `supplier-${crypto.randomUUID()}`, status: "active" },
      ...current,
    ])
  }

  function updateSupplier(supplier: SupplierRecord) {
    setSuppliers((current) => current.map((item) => item.id === supplier.id ? supplier : item))
  }

  function archiveSupplier(id: string) {
    setSuppliers((current) => current.map((item) => item.id === id ? { ...item, status: "archived" } : item))
  }

  function addQuotation(quotation: QuotationInput) {
    const now = new Date().toISOString()
    setQuotations((current) => [
      ...current,
      { ...quotation, id: `quote-${crypto.randomUUID()}`, selected: false, createdAt: now },
    ])
    setCases((current) => current.map((item) => item.id === quotation.procurementCaseId
      ? { ...item, stage: "comparing", updatedAt: now }
      : item))
  }

  function selectQuotation(procurementCaseId: string, quotationId: string) {
    const now = new Date().toISOString()
    setQuotations((current) => current.map((item) => item.procurementCaseId === procurementCaseId
      ? { ...item, selected: item.id === quotationId }
      : item))
    setCases((current) => current.map((item) => item.id === procurementCaseId
      ? { ...item, stage: "supplier_selected", updatedAt: now }
      : item))
  }

  return (
    <ProcurementContext.Provider value={{
      cases,
      quotations,
      suppliers,
      addSupplier,
      updateSupplier,
      archiveSupplier,
      addQuotation,
      selectQuotation,
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
