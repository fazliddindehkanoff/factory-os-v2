import assert from 'node:assert/strict'
import test from 'node:test'
import { canReadOrder, formatWorkflowNotification, isOperationalOrder } from '../src/lib/orders.ts'
import { parseOrderChanges } from '../src/lib/order-input.ts'
import { matchesTelegramOrderFilters } from '../src/lib/telegram-order-filters.ts'

const order = { id: 'o', createdByUserId: 'assistant', applicantId: 'head', departmentIds: ['d'], warehouseId: 'w', status: 'supervisor_review', currentStep: 'department_supervisor', waitingForUserId: 'head', lines: [], lastActorUserId: 'assistant' }
const actor = { userId: 'head', canViewAll: false, canViewOwn: true, departmentIds: ['d'], roleCodes: ['dept_head'], supervisorUserId: 'head' }
test('shared order access includes applicant and creator, scopes departments and rejects archived orders', () => {
  assert.equal(canReadOrder(order, actor), true)
  assert.equal(canReadOrder(order, {...actor, userId: 'assistant', roleCodes: []}), true)
  assert.equal(canReadOrder(order, {...actor, userId: 'other'}), false)
  assert.equal(canReadOrder(order, {...actor, canViewAll: true, departmentIds: ['other']}), false)
  assert.equal(canReadOrder({...order, archivedAt: '2026-01-01'}, {...actor, canViewAll: true}), false)
  assert.equal(isOperationalOrder({...order, archivedAt: '2026-01-01'}), false)
})
test('procurement specialists see assigned orders; a combined head role retains head visibility', () => {
  const procurement = {...actor, userId: 'specialist', canViewAll: true, roleCodes: ['procurement_manager']}
  assert.equal(canReadOrder(order, procurement), false)
  assert.equal(canReadOrder({...order, lines: [{id:'l',quantity:1,fulfillmentStatus:'needs_procurement'}], procurementSpecialistUserId: 'specialist'}, procurement), true)
  assert.equal(canReadOrder(order, {...procurement, roleCodes: ['procurement_manager', 'procurement_head']}), true)
})
test('persisted Uzbek notifications retain all three locale meanings after reload', () => {
  const events = [{kind:'action_required'}, {kind:'step_approved'}, {kind:'rejected'}, {kind:'warehouse_fulfilled'}, {kind:'warehouse_report_ready'}, {kind:'procurement_offer_approved'}, {kind:'approved_by',actorName:'Test User'}, {kind:'procurement_assigned',actorName:'Test User'}, {kind:'procurement_offers_submitted',actorName:'Test User'}, {kind:'warehouse_partial', fulfilledCount:2,totalCount:3}, {kind:'procurement_offer_rejected',comment:'Check this'}]
  for (const event of events) for (const locale of ['uz','ru','tr']) assert.equal(formatWorkflowNotification({message:formatWorkflowNotification({event},'uz')},locale),formatWorkflowNotification({event},locale))
  assert.equal(formatWorkflowNotification({message:'Ali sizni izohda belgiladi: @head'},'ru'),'Ali упомянул(а) вас: @head')
})
const data = { departments:[{id:'d',branchIds:['b'],warehouseIds:['w']}], warehouses:[{id:'w',branchIds:['b']}], products:[{id:'p'}], 'unit-types':[{id:'u'}], 'order-purposes':[{id:'purpose'}] }
const changes = {...order,type:'material',branchIds:['b'],purposeId:'purpose',expectedDate:'2026-10-01',urgency:'normal',comment:'Test',lines:[{id:'l',productId:'p',unitTypeId:'u',quantity:2,note:''}],attachments:[]}
test('resubmission validation rejects malformed positions, invalid calendar dates and mismatched assignments', () => {
  assert.ok(parseOrderChanges(changes,data))
  for (const patch of [{expectedDate:'2026-02-30'},{departmentIds:['missing']},{branchIds:['other']},{warehouseId:'other'},{lines:[]},{lines:[{...changes.lines[0],quantity:NaN}]},{lines:[{...changes.lines[0],quantity:0}]},{lines:[changes.lines[0],changes.lines[0]]}]) assert.equal(parseOrderChanges({...changes,...patch},data),null)
  assert.equal(parseOrderChanges({...changes,waitingForUserId:'forged'},data).waitingForUserId,undefined)
})
test('Telegram filters match stable IDs after changing translated labels', () => {
  const filters={q:'',type:'',status:'',urgency:'',department:'d',warehouse:'w'}
  const rows=[{...order,department:'Производство',warehouse:'Склад',departmentIds:['d'],type:'material',urgency:'critical',purpose:'Тест',number:'ORD-1',applicant:'Head'}]
  assert.equal(matchesTelegramOrderFilters(rows[0],filters,false,"ru"),true)
  assert.equal(matchesTelegramOrderFilters({...rows[0],department:'Üretim',warehouse:'Depo'},filters,false,"tr"),true)
})
