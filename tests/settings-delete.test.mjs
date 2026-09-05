import assert from "node:assert/strict"
import test from "node:test"

import {
  classifySettingsDeleteError,
  getSettingsDeletePermission,
  settingsDeleteTable,
} from "../src/lib/settings-delete.ts"
import { parseSettingsRecordUpdate } from "../src/lib/settings-record-update.ts"
import { parseSettingsRecordOrder } from "../src/lib/settings-record-update.ts"

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

test("settings edits are normalized by section", () => {
  assert.deepEqual(parseSettingsRecordUpdate("warehouses", {
    titleUz: " Ombor ",
    titleRu: " Склад ",
    titleTr: " Depo ",
    branchIds: ["branch-one", "branch-one"],
    responsibleUserId: " user-one ",
  }), {
    ok: true,
    value: {
      titleUz: "Ombor",
      titleRu: "Склад",
      titleTr: "Depo",
      branchIds: ["branch-one"],
      responsibleUserId: "user-one",
    },
  })
})

test("settings edits reject invalid references and permission lists", () => {
  assert.deepEqual(parseSettingsRecordUpdate("products", {
    titleUz: "Product",
    titleRu: "",
    titleTr: "",
    code: "PRD-1",
    categoryId: "",
  }), { ok: false, error: "invalid-record" })
  assert.deepEqual(parseSettingsRecordUpdate("roles", {
    titleUz: "Role",
    titleRu: "",
    titleTr: "",
    code: "role",
    permissions: [123],
  }), { ok: false, error: "invalid-record" })
})

test("settings ordering requires a non-empty unique id list", () => {
  assert.deepEqual(parseSettingsRecordOrder({ ids: ["unit-two", "unit-one"] }), ["unit-two", "unit-one"])
  assert.deepEqual(parseSettingsRecordOrder({ ids: ["unit-one", "unit-one"] }), ["unit-one"])
  assert.equal(parseSettingsRecordOrder({ ids: [] }), null)
})
