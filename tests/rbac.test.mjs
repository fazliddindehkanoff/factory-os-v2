import assert from "node:assert/strict"
import test from "node:test"

import {
  hasPermission,
  permissionCatalog,
  permissionCodes,
  systemRoleTemplates,
} from "../src/lib/rbac.ts"

function role(code) {
  const match = systemRoleTemplates.find((candidate) => candidate.code === code)
  assert.ok(match, `Missing system role: ${code}`)
  return match
}

test("the permission catalog is closed and contains no duplicate codes", () => {
  assert.equal(permissionCatalog.length, 28)
  assert.equal(new Set(permissionCodes).size, permissionCodes.length)

  for (const template of systemRoleTemplates) {
    for (const permission of template.permissions) {
      assert.ok(permissionCodes.includes(permission), `${template.code} has unknown permission ${permission}`)
    }
  }
})

test("owner grants every current and future permission", () => {
  const owner = role("owner")
  assert.equal(owner.grantsAll, true)
  for (const permission of permissionCodes) {
    assert.equal(hasPermission([owner], permission), true)
  }
})

test("administrator manages access without becoming a business approver", () => {
  const admin = role("admin")
  assert.equal(hasPermission([admin], "users.manage"), true)
  assert.equal(hasPermission([admin], "roles.manage"), true)
  assert.equal(hasPermission([admin], "settings.manage"), true)
  assert.equal(hasPermission([admin], "approvals.approve"), false)
  assert.equal(hasPermission([admin], "warehouse.issue"), false)
  assert.equal(hasPermission([admin], "finance.mark_paid"), false)
  assert.equal(hasPermission([admin], "suppliers.view"), true)
  assert.equal(hasPermission([admin], "suppliers.manage"), true)
  assert.equal(hasPermission([admin], "procurement.view"), false)
})

test("operational duties remain separated", () => {
  assert.equal(hasPermission([role("requester")], "requests.create"), true)
  assert.equal(hasPermission([role("requester")], "requests.view_own"), true)
  assert.equal(hasPermission([role("requester")], "requests.view"), false)
  assert.equal(hasPermission([role("requester")], "procurement.view"), false)
  assert.equal(hasPermission([role("requester")], "suppliers.view"), false)
  assert.equal(hasPermission([role("requester")], "settings.manage"), false)
  assert.equal(hasPermission([role("requester")], "finance.view"), false)
  assert.equal(hasPermission([role("requester")], "approvals.approve"), false)
  assert.equal(hasPermission([role("warehouse")], "warehouse.issue"), true)
  assert.equal(hasPermission([role("warehouse")], "finance.mark_paid"), false)
  assert.equal(hasPermission([role("finance_head")], "finance.mark_paid"), true)
  assert.equal(hasPermission([role("finance_head")], "warehouse.issue"), false)
  assert.equal(hasPermission([role("procurement_head")], "procurement.select_supplier"), true)
  assert.equal(hasPermission([role("procurement_head")], "finance.mark_paid"), false)
  assert.equal(hasPermission([role("procurement_manager")], "procurement.quote"), true)
  assert.equal(hasPermission([role("procurement_manager")], "suppliers.manage"), true)
  assert.equal(hasPermission([role("procurement_manager")], "procurement.select_supplier"), false)
})

test("multiple role assignments combine their grants", () => {
  const grants = [role("requester"), role("warehouse_worker")]
  assert.equal(hasPermission(grants, "requests.create"), true)
  assert.equal(hasPermission(grants, "warehouse.issue"), true)
  assert.equal(hasPermission(grants, "finance.mark_paid"), false)
})
