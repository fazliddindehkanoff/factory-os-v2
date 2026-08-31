export type NewProductInput = {
  categoryId: string
  titleUz: string
  titleRu: string
  titleTr: string
}

export type ProductInputResult =
  | { ok: true; value: NewProductInput }
  | { ok: false; error: "invalid-product" }

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function parseNewProductInput(input: unknown): ProductInputResult {
  if (!input || typeof input !== "object") return { ok: false, error: "invalid-product" }

  const record = input as Record<string, unknown>
  const value: NewProductInput = {
    categoryId: readText(record.categoryId),
    titleUz: readText(record.titleUz),
    titleRu: readText(record.titleRu),
    titleTr: readText(record.titleTr),
  }
  const hasTitle = Boolean(value.titleUz || value.titleRu || value.titleTr)
  const hasRequiredFields = Boolean(value.categoryId)
  const hasValidLengths = value.categoryId.length <= 128 &&
    [value.titleUz, value.titleRu, value.titleTr].every((title) => title.length <= 255)

  return hasTitle && hasRequiredFields && hasValidLengths
    ? { ok: true, value }
    : { ok: false, error: "invalid-product" }
}

export function generateProductCode(id: string) {
  const token = id.replace(/[^a-z0-9]/gi, "").slice(0, 12).toLocaleUpperCase()
  if (!token) throw new Error("A product id is required to generate its code")
  return `PRD-${token}`
}
