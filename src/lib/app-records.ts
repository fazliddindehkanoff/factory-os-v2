import type { PermissionCode } from "@/lib/rbac"

export const appRecordNamespaces = [
  "orders",
  "suppliers",
  "quotations",
  "procurement-cases",
  "finance-transactions",
] as const

export type AppRecordNamespace = (typeof appRecordNamespaces)[number]

type AppRecordPolicy = {
  read: readonly PermissionCode[]
  write: readonly PermissionCode[]
}

export const appRecordPolicies: Record<AppRecordNamespace, AppRecordPolicy> = {
  orders: { read: ["requests.view", "requests.view_own"], write: ["requests.create"] },
  suppliers: { read: ["suppliers.view"], write: ["suppliers.manage"] },
  quotations: { read: ["procurement.view"], write: ["procurement.quote"] },
  "procurement-cases": {
    read: ["procurement.view"],
    write: ["procurement.quote", "procurement.select_supplier"],
  },
  "finance-transactions": { read: ["finance.view"], write: ["finance.mark_paid"] },
}

export function isAppRecordNamespace(value: string): value is AppRecordNamespace {
  return appRecordNamespaces.includes(value as AppRecordNamespace)
}

export function parseAppRecord(value: unknown) {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const id = typeof source.id === "string" ? source.id.trim() : ""
  const payload = source.payload
  if (!id || id.length > 200 || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null
  }
  if ("id" in payload && payload.id !== id) return null
  const serialized = JSON.stringify(payload)
  if (serialized.length > 2_000_000) return null
  return { id, payload: payload as Record<string, unknown> }
}
