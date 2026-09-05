import assert from "node:assert/strict"
import test from "node:test"

import {
  appRecordPolicies,
  isAppRecordNamespace,
  parseAppRecord,
} from "../src/lib/app-records.ts"

test("only supported operational namespaces can be persisted", () => {
  assert.equal(isAppRecordNamespace("orders"), true)
  assert.equal(isAppRecordNamespace("finance-transactions"), true)
  assert.equal(isAppRecordNamespace("sessions"), false)
})

test("app records require a bounded id and object payload", () => {
  assert.deepEqual(parseAppRecord({ id: " order-1 ", payload: { number: "ORD-1" } }), {
    id: "order-1",
    payload: { number: "ORD-1" },
  })
  assert.equal(parseAppRecord({ id: "", payload: {} }), null)
  assert.equal(parseAppRecord({ id: "order-1", payload: [] }), null)
  assert.equal(parseAppRecord({ id: "order-1", payload: { id: "order-2" } }), null)
})

test("every operational create namespace has explicit read and write permissions", () => {
  for (const policy of Object.values(appRecordPolicies)) {
    assert.ok(policy.read.length > 0)
    assert.ok(policy.write.length > 0)
  }
})
