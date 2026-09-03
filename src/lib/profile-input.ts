import { normalizePhoneNumber } from "./phone-number.js"

export type ProfileUpdateInput = {
  fullName: string
  username: string
  phoneNumber: string
}

export type ProfileUpdateInputResult =
  | { ok: true; value: ProfileUpdateInput }
  | { ok: false; error: "invalid-profile" | "invalid-phone" }

export function parseProfileUpdateInput(value: unknown): ProfileUpdateInputResult {
  if (!value || typeof value !== "object") return { ok: false, error: "invalid-profile" }
  const source = value as Record<string, unknown>
  const fullName = typeof source.fullName === "string" ? source.fullName.trim() : ""
  const username = typeof source.username === "string" ? source.username.trim().toLocaleLowerCase() : ""
  const rawPhoneNumber = typeof source.phoneNumber === "string" ? source.phoneNumber.trim() : ""

  if (!fullName || fullName.length > 160 || !username || username.length > 100 || rawPhoneNumber.length > 100) {
    return { ok: false, error: "invalid-profile" }
  }

  const normalizedPhone = normalizePhoneNumber(rawPhoneNumber)
  if (
    !/^[+\d\s().-]+$/.test(rawPhoneNumber) ||
    normalizedPhone.length < 7 ||
    normalizedPhone.length > 15
  ) {
    return { ok: false, error: "invalid-phone" }
  }

  return {
    ok: true,
    value: {
      fullName,
      username,
      phoneNumber: `+${normalizedPhone}`,
    },
  }
}
