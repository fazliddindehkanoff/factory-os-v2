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

  const attachments = files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: file.size,
  }))
  const database = await openDatabase()

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      files.forEach((file, index) => store.put(file, attachments[index].id))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save the attached files."))
      transaction.onabort = () => reject(transaction.error ?? new Error("Saving the attached files was cancelled."))
    })
  } finally {
    database.close()
  }

  return attachments
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
  const file = await loadOrderAttachment(attachment.id)
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
