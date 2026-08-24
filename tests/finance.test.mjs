import assert from "node:assert/strict"
import test from "node:test"

import { financePaymentBalance } from "../src/lib/finance.ts"

test("finance payment balance never becomes negative", () => {
  assert.equal(financePaymentBalance({ amount: 10_000_000, paidAmount: 4_000_000 }), 6_000_000)
  assert.equal(financePaymentBalance({ amount: 10_000_000, paidAmount: 12_000_000 }), 0)
})
