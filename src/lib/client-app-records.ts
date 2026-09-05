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
