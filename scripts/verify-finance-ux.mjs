// First run verify-ux-flows.mjs against the same disposable DB and local server.
import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@libsql/client'
import { paymentsForOrder } from '../src/lib/finance-workflow.ts'
import { financeInsights } from '../src/lib/finance-insights.ts'
const path = process.env.UX_TEST_DATABASE
const base = process.env.UX_TEST_URL
if (!path?.startsWith('/tmp/') || !base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use an isolated /tmp database and a local test server')
const db = createClient({url:`file:${path}`})
try {
  const row = (await db.execute("select payload from app_records where namespace='orders' and id like 'ux-browser-%' limit 1")).rows[0]
  assert.ok(row, 'Run verify-ux-flows.mjs first')
  const source = JSON.parse(row.payload)
  for (const [state, stages] of Object.entries({unpaid:['head_review','head_review'],in_progress:['paid','payment'],closed:['paid','paid'],cancelled:['paid','cancelled']})) {
    const id = `finance-ux-${state}`
    const now = new Date().toISOString()
    const order = {...source,id,number:`FIN-${state}`,status:state === 'cancelled' ? 'rejected' : 'in_progress',currentStep:state === 'cancelled' ? 'complete' : 'warehouse_receipt',waitingForUserId:'user-warehouse',procurementSpecialistUserId:'user-procurement-manager',createdAt:'2026-09-01T10:00:00Z',attachments:[],attachmentNames:[],lines:source.lines.map(line => ({...line,fulfillmentStatus:'needs_procurement'})),placement:{createdAt:now,createdByUserId:'user-procurement-manager',lines:[{quotationId:'ux-quote',orderLineId:source.lines[0].id,supplierId:'ux-supplier',supplierName:'Sinov yetkazib beruvchi',supplierInn:'123456789',amount:1000000,prepaidAmount:300000,method:'bank',dueDate:'2026-09-01',contractNumber:'UX-001',quantity:2,unitPrice:500000}]}}
    await db.execute({sql:"insert or replace into app_records(namespace,id,payload,created_by_user_id,updated_at) values('orders',?,?,?,?)",args:[id,JSON.stringify(order),'user-admin',now]})
    await db.execute({sql:"delete from app_records where namespace='finance-payments' and json_extract(payload, '$.orderId')=?",args:[id]})
    const payments = paymentsForOrder(order)
    for (const [index,payment] of payments.entries()) {
      payment.stage = stages[index]
      payment.history = payment.stage === 'paid' ? [{action:'paid',actorUserId:'user-finance',at:now,comment:'Local UX fixture',from:'payment',to:'paid'}] : []
      await db.execute({sql:"insert or replace into app_records(namespace,id,payload,created_by_user_id,updated_at) values('finance-payments',?,?,?,?)",args:[payment.id,JSON.stringify(payment),'user-admin',now]})
    }
  }
  const token=randomBytes(32).toString('base64url')
  await db.execute({sql:'insert into sessions(id,token_hash,user_id,expires_at) values(?,?,?,?)',args:[randomUUID(),createHash('sha256').update(token).digest('hex'),'user-finance',new Date(Date.now()+3600000).toISOString()]})
  const response = await fetch(new URL('/api/finance/payments',base),{headers:{Cookie:`factory-os-session=${token}`}})
  assert.equal(response.status,200)
  const {payments} = await response.json()
  const result = financeInsights(payments.filter(item => item.orderId.startsWith('finance-ux-')),'2026-09-22')
  for (const state of ['unpaid','in_progress','closed','cancelled']) assert.equal(result.orders.get(`finance-ux-${state}`),state)
  assert.equal(result.paid,1600000)
  assert.equal(result.outstanding,1700000)
  assert.equal(result.overdue,1400000)
  console.log('PASS: finance API exposes four lifecycle fixtures; advance/balance, retained cancelled payments, totals and overdue amounts verified.')
} finally { db.close() }
