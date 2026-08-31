export type NewProductInput = {
  code: string
  categoryId: string
  unitTypeId: string
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
    code: readText(record.code).toLocaleUpperCase(),
    categoryId: readText(record.categoryId),
    unitTypeId: readText(record.unitTypeId),
    titleUz: readText(record.titleUz),
    titleRu: readText(record.titleRu),
    titleTr: readText(record.titleTr),
  }
  const hasTitle = Boolean(value.titleUz || value.titleRu || value.titleTr)
  const hasRequiredFields = Boolean(value.code && value.categoryId && value.unitTypeId)
  const hasValidLengths = value.code.length <= 64 &&
    value.categoryId.length <= 128 &&
    value.unitTypeId.length <= 128 &&
    [value.titleUz, value.titleRu, value.titleTr].every((title) => title.length <= 255)

  return hasTitle && hasRequiredFields && hasValidLengths
    ? { ok: true, value }
    : { ok: false, error: "invalid-product" }
}
