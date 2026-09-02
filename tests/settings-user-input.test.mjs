import assert from "node:assert/strict"
import test from "node:test"

import { parseSettingsUserUpdateInput } from "../src/lib/settings-user-input.ts"

const validUser = {
  fullName: " User Name ",
  positionId: " position-manager ",
  username: " user.name ",
  password: "new-password",
  telegramChatId: " 12345 ",
  phoneNumber: " +998901234567 ",
  departmentIds: ["department-one", "department-one"],
  roleIds: ["role-one"],
}

test("user update input trims values and removes duplicate assignments", () => {
  assert.deepEqual(parseSettingsUserUpdateInput(validUser), {
    ok: true,
    value: {
      fullName: "User Name",
      positionId: "position-manager",
      username: "user.name",
      password: "new-password",
      telegramChatId: "12345",
      phoneNumber: "+998901234567",
      departmentIds: ["department-one"],
      roleIds: ["role-one"],
    },
  })
})

test("an empty password preserves the current password", () => {
  const result = parseSettingsUserUpdateInput({ ...validUser, password: "" })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal("password" in result.value, false)
})

test("a supplied password must be at least eight characters", () => {
  assert.deepEqual(parseSettingsUserUpdateInput({ ...validUser, password: "short" }), {
    ok: false,
    error: "invalid-password",
  })
})

test("required user fields and assignment lists are validated", () => {
  assert.deepEqual(parseSettingsUserUpdateInput({ ...validUser, username: "" }), {
    ok: false,
    error: "invalid-user",
  })
  assert.deepEqual(parseSettingsUserUpdateInput({ ...validUser, roleIds: "role-one" }), {
    ok: false,
    error: "invalid-user",
  })
})
