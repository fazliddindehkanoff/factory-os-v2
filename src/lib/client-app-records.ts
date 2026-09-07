export async function createAppRecord<T extends { id: string }>(
  namespace: string,
  record: T,
): Promise<T> {
  const response = await fetch(`/api/app-records/${encodeURIComponent(namespace)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: record.id, payload: record }),
  })
  const result = await response.json().catch(() => ({})) as { record?: T; error?: string }
  if (!response.ok || !result.record) throw new Error(result.error ?? "create-failed")
  return result.record
}

export async function loadAppRecords<T extends { id: string }>(namespace: string): Promise<T[]> {
  const response = await fetch(`/api/app-records/${encodeURIComponent(namespace)}`, {
    cache: "no-store",
  })
  const result = await response.json().catch(() => ({})) as { records?: T[] }
  if (!response.ok || !result.records) throw new Error("load-failed")
  return result.records
}

export async function approveOrderRecord<T extends { id: string }>(orderId: string): Promise<T> {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  const result = await response.json().catch(() => ({})) as { order?: T; error?: string }
  if (!response.ok || !result.order) throw new Error(result.error ?? "approval-failed")
  return result.order
}

export async function runOrderWorkflowAction<T extends { id: string }>(
  orderId: string,
  action: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/workflow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...input }),
  })
  const result = await response.json().catch(() => ({})) as { order?: T; error?: string }
  if (!response.ok || !result.order) throw new Error(result.error ?? "workflow-action-failed")
  return result.order
}
