import assert from 'node:assert/strict'
import test from 'node:test'
import { financeInsights } from '../src/lib/finance-insights.ts'
import { orderAging } from '../src/lib/order-aging.ts'
const payment = (id, orderId, stage, amount, dueDate = '') => ({ id, orderId, stage, amount, dueDate })
test('an advance does not close an order with an unpaid balance, including other suppliers', () => {
  const items = [payment('a', 'one', 'paid', 30), payment('b', 'one', 'payment', 70), payment('c', 'two', 'paid', 100), payment('d', 'one', 'head_review', 20)]
  const result = financeInsights(items, '2026-09-22')
  assert.equal(result.orders.get('one'), 'in_progress')
  assert.equal(result.orders.get('two'), 'closed')
  assert.equal(result.outstanding, 90)
  assert.equal(result.paid, 130)
  assert.equal(financeInsights(items.map(item => ({...item, stage:'paid'})), '2026-09-22').orders.get('one'), 'closed')
})
test('cancelled orders retain paid history without creating debt or a false fully-paid state', () => {
  const result = financeInsights([payment('a', 'one', 'paid', 30), payment('b', 'one', 'cancelled', 70, '2026-09-01')], '2026-09-22')
  assert.equal(result.orders.get('one'), 'cancelled')
  assert.equal(result.paid, 30)
  assert.equal(result.outstanding, 0)
  assert.equal(result.overdue, 0)
})
test('due today is not overdue; unpaid and returned payments still count, no floating point artifacts', () => {
  const result = financeInsights([payment('a', 'one', 'returned', 0.1, '2026-09-21'), payment('b', 'two', 'head_review', 0.2, '2026-09-21'), payment('c', 'three', 'payment', 1, '2026-09-22'), payment('d', 'four', 'paid', 5, '2026-09-01')], '2026-09-22')
  assert.equal(result.overdue, 0.3)
  assert.equal(result.outstanding, 1.3)
  assert.deepEqual([...result.overdueIds], ['a', 'b'])
  assert.equal(result.orders.get('one'), 'unpaid')
  assert.equal(financeInsights([], '2026-09-22').orders.size, 0)
})
test('aging excludes completed, rejected and drafts and has non-overlapping boundaries', () => {
  const now = Date.parse('2026-09-22T12:00:00Z')
  const items = [0,3,4,7,8,14,15].map((days, i) => ({id:String(i),status:'in_progress',currentStep:'warehouse_receipt',createdAt:new Date(now-days*86400000).toISOString()}))
  const result = orderAging([...items, {...items[0],currentStep:'complete'}, {...items[0],status:'rejected'}, {...items[0],status:'draft'}], now)
  assert.deepEqual(result.buckets,[2,2,2,1])
  assert.deepEqual(result.oldest.map(item => item.id),['6','5','4'])
})
