import assert from "node:assert/strict"
import test from "node:test"

import { hashPassword, verifyPassword } from "../src/lib/auth/password.ts"

test("password hashes are salted and verify without exposing the password", async () => {
  const password = "FactoryOS123!"
  const firstHash = await hashPassword(password)
  const secondHash = await hashPassword(password)

  assert.notEqual(firstHash, password)
  assert.notEqual(firstHash, secondHash)
  assert.equal(await verifyPassword(password, firstHash), true)
  assert.equal(await verifyPassword("incorrect-password", firstHash), false)
})

test("malformed password hashes fail closed", async () => {
  assert.equal(await verifyPassword("anything", "not-a-valid-hash"), false)
})
