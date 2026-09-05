import assert from "node:assert/strict"
import test from "node:test"

import {
  classifySettingsDeleteError,
  getSettingsDeletePermission,
  settingsDeleteTable,
} from "../src/lib/settings-delete.ts"

test("each settings section has an explicit database table", () => {
  assert.deepEqual(Object.keys(settingsDeleteTable).sort(), [
    "branches",
    "departments",
    "order-purposes",
    "positions",
    "product-categories",
    "products",
    "roles",
    "unit-types",
    "users",
    "warehouses",
  ])
})

test("delete permissions follow section ownership", () => {
  assert.equal(getSettingsDeletePermission("users"), "users.manage")
  assert.equal(getSettingsDeletePermission("roles"), "roles.manage")
  assert.equal(getSettingsDeletePermission("positions"), "settings.manage")
})

test("foreign-key failures are presented as records in use", () => {
  assert.equal(
    classifySettingsDeleteError(new Error("SQLITE_CONSTRAINT: FOREIGN KEY constraint failed")),
    "record-in-use",
  )
  assert.equal(classifySettingsDeleteError(new Error("disk error")), "delete-failed")
})
