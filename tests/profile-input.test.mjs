import assert from "node:assert/strict"
import test from "node:test"

import { parseProfileUpdateInput } from "../src/lib/profile-input.ts"

test("profile update normalizes identity fields and the Telegram phone", () => {
  assert.deepEqual(parseProfileUpdateInput({
    fullName: "  Aziza Karimova  ",
    username: "  AZIZA.K  ",
    phoneNumber: " 00998 (90) 123-45-67 ",
  }), {
    ok: true,
    value: {
      fullName: "Aziza Karimova",
      username: "aziza.k",
      phoneNumber: "+998901234567",
    },
  })
})

test("profile update rejects invalid identity and phone values", () => {
  assert.deepEqual(parseProfileUpdateInput({ fullName: "", username: "aziza", phoneNumber: "+998901234567" }), {
    ok: false,
    error: "invalid-profile",
  })
  assert.deepEqual(parseProfileUpdateInput({ fullName: "Aziza", username: "aziza", phoneNumber: "123" }), {
    ok: false,
    error: "invalid-phone",
  })
  assert.deepEqual(parseProfileUpdateInput({ fullName: "Aziza", username: "aziza", phoneNumber: "call 998901234567" }), {
    ok: false,
    error: "invalid-phone",
  })
  assert.deepEqual(parseProfileUpdateInput({ fullName: "Aziza", username: "aziza", phoneNumber: "" }), {
    ok: false,
    error: "invalid-phone",
  })
})
