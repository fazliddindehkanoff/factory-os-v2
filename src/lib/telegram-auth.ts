import { createHmac, timingSafeEqual } from "node:crypto"

export const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 5 * 60

export type TelegramWebAppUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export type TelegramInitDataResult =
  | { ok: true; user: TelegramWebAppUser }
  | { ok: false; error: "invalid-init-data" | "expired-init-data" }

export function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.startsWith("00") ? digits.slice(2) : digits
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramInitDataResult {
  if (!initData || initData.length > 16_384 || !botToken) {
    return { ok: false, error: "invalid-init-data" }
  }

  const params = new URLSearchParams(initData)
  const receivedHash = params.get("hash")
  const authDate = Number(params.get("auth_date"))
  const serializedUser = params.get("user")
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash) || !Number.isInteger(authDate) || !serializedUser) {
    return { ok: false, error: "invalid-init-data" }
  }

  if (
    authDate > nowSeconds + 30 ||
    nowSeconds - authDate > TELEGRAM_INIT_DATA_MAX_AGE_SECONDS
  ) {
    return { ok: false, error: "expired-init-data" }
  }

  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length) return { ok: false, error: "invalid-init-data" }
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest()
  const receivedHashBuffer = Buffer.from(receivedHash, "hex")
  if (receivedHashBuffer.length !== calculatedHash.length || !timingSafeEqual(receivedHashBuffer, calculatedHash)) {
    return { ok: false, error: "invalid-init-data" }
  }

  try {
    const user = JSON.parse(serializedUser) as Partial<TelegramWebAppUser>
    if (!Number.isSafeInteger(user.id) || typeof user.first_name !== "string" || !user.first_name) {
      return { ok: false, error: "invalid-init-data" }
    }
    return { ok: true, user: user as TelegramWebAppUser }
  } catch {
    return { ok: false, error: "invalid-init-data" }
  }
}
