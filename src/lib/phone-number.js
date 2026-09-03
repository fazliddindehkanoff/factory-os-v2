export function normalizePhoneNumber(value) {
  const digits = value.replace(/\D/g, "")
  return digits.startsWith("00") ? digits.slice(2) : digits
}
