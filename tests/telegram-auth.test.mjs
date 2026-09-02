import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { normalizePhoneNumber, validateTelegramInitData } from "../src/lib/telegram-auth.ts"

function signedInitData(token, values) {
  const params = new URLSearchParams(values)
  const check = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  const secret = createHmac("sha256", "WebAppData").update(token).digest()
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"))
  return params.toString()
}

test("phone matching ignores display formatting and an international dialing prefix", () => {
  assert.equal(normalizePhoneNumber("+998 (90) 123-45-67"), "998901234567")
  assert.equal(normalizePhoneNumber("0090 544 233 03 03"), "905442330303")
})

test("Telegram Mini App init data is authenticated and decoded", () => {
  const now = 1_800_000_000
  const token = "123456:test-token"
  const initData = signedInitData(token, {
    auth_date: String(now - 10),
    query_id: "query-1",
    user: JSON.stringify({ id: 987654321, first_name: "Aziza", language_code: "uz" }),
  })
  assert.deepEqual(validateTelegramInitData(initData, token, now), {
    ok: true,
    user: { id: 987654321, first_name: "Aziza", language_code: "uz" },
  })
})

test("Telegram Mini App init data rejects tampering and stale authentication", () => {
  const now = 1_800_000_000
  const token = "123456:test-token"
  const current = signedInitData(token, {
    auth_date: String(now - 10),
    user: JSON.stringify({ id: 987654321, first_name: "Aziza" }),
  })
  assert.deepEqual(validateTelegramInitData(current.replace("Aziza", "Malika"), token, now), {
    ok: false,
    error: "invalid-init-data",
  })
  const stale = signedInitData(token, {
    auth_date: String(now - 301),
    user: JSON.stringify({ id: 987654321, first_name: "Aziza" }),
  })
  assert.deepEqual(validateTelegramInitData(stale, token, now), {
    ok: false,
    error: "expired-init-data",
  })
})
