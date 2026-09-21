import type { OrderAttachment } from "@/lib/orders"

const DATABASE_NAME = "factory-os-order-files"
const STORE_NAME = "attachments"
const DATABASE_VERSION = 1

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("File storage is unavailable in this browser."))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onerror = () => reject(request.error ?? new Error("Unable to open file storage."))
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}

export async function saveOrderAttachments(files: readonly File[]) {
  if (!files.length) return [] satisfies OrderAttachment[]
  if (files.length > 20 || files.some((file) => file.size > 5 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 19 * 1024 * 1024) throw new Error("files-too-large")
  const form = new FormData()
  files.forEach((file) => form.append("files", file))
  const response = await fetch("/api/order-attachments", { method: "POST", body: form })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? "file-upload-failed")
  return result.attachments as OrderAttachment[]
}

async function loadOrderAttachment(id: string) {
  const database = await openDatabase()
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined)
      request.onerror = () => reject(request.error ?? new Error("Unable to read the attached file."))
    })
  } finally {
    database.close()
  }
}

export async function downloadOrderAttachment(attachment: OrderAttachment) {
  const response = await fetch(`/api/order-attachments?id=${encodeURIComponent(attachment.id)}`)
  // Retain access to legacy local-only attachments; new files are server-backed.
  const file = response.ok ? await response.blob() : response.status === 404 ? await loadOrderAttachment(attachment.id) : undefined
  if (!file) return false

  const url = URL.createObjectURL(file)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = attachment.name
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  return true
}

// Store the whole draft, including File blobs, on this device until submission.
export async function orderDraftStore<T>(key: string, action: "read" | "write" | "delete", value?: T): Promise<T | undefined> {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, action === "read" ? "readonly" : "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = action === "read" ? store.get(`draft:${key}`) : action === "write" ? store.put(value, `draft:${key}`) : store.delete(`draft:${key}`)
      transaction.oncomplete = () => resolve(request.result as T | undefined)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error("draft-storage-failed"))
    })
  } finally { database.close() }
}
