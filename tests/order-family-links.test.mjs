import assert from "node:assert/strict"
import test from "node:test"
import { canViewParentOrderLink } from "../src/lib/orders.ts"

test("parent order navigation is visible only to procurement specialists", () => {
  assert.equal(canViewParentOrderLink(["procurement_manager"]), true)
  assert.equal(canViewParentOrderLink(["warehouse", "procurement_manager"]), true)
  for (const roles of [[], ["procurement_head"], ["director"], ["warehouse"], ["administrator"], ["owner"], ["department_supervisor"], ["assistant"]]) {
    assert.equal(canViewParentOrderLink(roles), false, roles.join(","))
  }
})
