/** Drops redundant leading zeros while typing: "0123" → "123", "00.5" → "0.5". Empty stays empty. */
export function normalizeNumberDraft(value: string) {
  return value.replace(/^(-?)0+(?=\d)/, "$1")
}

/** Numeric value of a draft; an empty field counts as 0. */
export function numberDraftValue(value: string) {
  const parsed = Number(value)
  return value.trim() === "" || !Number.isFinite(parsed) ? 0 : parsed
}
