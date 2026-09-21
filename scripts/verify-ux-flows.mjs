// Run against a separate seeded SQLite COPY and a local Next server using that copy.
// UX_TEST_DATABASE=/tmp/factory-ux-test.sqlite UX_TEST_URL=http://localhost:3217 node scripts/verify-ux-flows.mjs
import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@libsql/client'
const path = process.env.UX_TEST_DATABASE
const base = process.env.UX_TEST_URL
if (!path?.startsWith('/tmp/') || !base || !['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use an isolated /tmp database and a local test server')
const db = createClient({url:`file:${path}`})
const sessions = new Map()
let checks = 0
async function check(actor, path, method = 'GET', body, expected = 200) {
  const response = await fetch(new URL(path,base), {method, headers:{Cookie:`factory-os-session=${sessions.get(actor)}`, ...(body && !(body instanceof FormData) ? {'Content-Type':'application/json'} : {})}, body:body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, redirect:'manual'})
  assert.equal(response.status,expected,`${actor} ${method} ${path}: ${await response.clone().text()}`)
  checks++
  return response
}
try {
  for (const actor of ['user-admin','user-applicant','user-supervisor','user-procurement','user-procurement-manager']) {
    const token=randomBytes(32).toString('base64url');sessions.set(actor,token)
    await db.execute({sql:'insert into sessions(id,token_hash,user_id,expires_at) values(?,?,?,?)',args:[randomUUID(),createHash('sha256').update(token).digest('hex'),actor,new Date(Date.now()+3600000).toISOString()]})
  }
  const suffix=randomUUID().slice(0,8)
  const product=(await db.execute('select id,unit_type_id from products limit 1')).rows[0]
  const purpose=(await db.execute('select id from order_purposes limit 1')).rows[0]
  const order={id:`ux-order-${suffix}`,number:`UX-${suffix}`,createdByUserId:'user-applicant',applicantId:'user-supervisor',type:'material',departmentIds:['department-production'],branchIds:['branch-tashkent'],warehouseId:'warehouse-main',purposeId:purpose.id,expectedDate:'2026-12-01',urgency:'normal',lines:[{id:'line-1',productId:product.id,unitTypeId:product.unit_type_id,quantity:2,note:'UX flow verification'}],comment:'Test request',attachmentNames:[],attachments:[],createdAt:new Date().toISOString(),status:'supervisor_review',currentStep:'department_supervisor',waitingForUserId:'user-supervisor',lastActorUserId:'user-applicant'}
  await check('user-applicant','/api/app-records/orders','POST',{id:order.id,payload:order},201)
  const visible=await (await check('user-supervisor','/api/app-records/orders')).json()
  assert.ok(visible.records.some(row=>row.id===order.id))
  const scoped=await (await check('user-procurement-manager','/api/app-records/orders')).json()
  assert.ok(!scoped.records.some(row=>row.id===order.id))
  await check('user-procurement-manager',`/api/orders/${order.id}/workflow`,'POST',{action:'reject'},403)
  const rejected=await (await check('user-supervisor',`/api/orders/${order.id}/workflow`,'POST',{action:'reject'})).json()
  assert.equal(rejected.order.status,'rejected')
  const reread=await (await check('user-applicant','/api/app-records/orders')).json()
  assert.equal(reread.records.find(row=>row.id===order.id).status,'rejected')
  const files=new FormData();files.append('files',new Blob(['cross-device attachment'],{type:'text/plain'}),'ux-check.txt')
  const uploaded=await (await check('user-applicant','/api/order-attachments','POST',files,201)).json()
  const changes={...order,comment:'Revised on server',attachments:uploaded.attachments}
  await check('user-applicant',`/api/orders/${order.id}`,'PATCH',{revision:99,changes},409)
  await check('user-applicant',`/api/orders/${order.id}`,'PATCH',{revision:rejected.order.revision,changes:{...changes,lines:[]}},400)
  const revised=await (await check('user-applicant',`/api/orders/${order.id}`,'PATCH',{revision:rejected.order.revision,changes})).json()
  assert.equal(revised.order.status,'supervisor_review')
  const attachment=await check('user-supervisor',`/api/order-attachments?id=${uploaded.attachments[0].id}`)
  assert.equal(await attachment.text(),'cross-device attachment')
  await check('user-procurement-manager',`/api/order-attachments?id=${uploaded.attachments[0].id}`,'GET',undefined,403)
  const persisted=await (await check('user-supervisor','/api/app-records/orders')).json()
  assert.equal(persisted.records.find(row=>row.id===order.id).comment,'Revised on server')
  const comment=await (await check('user-supervisor','/api/order-comments','POST',{orderId:order.id,orderNumber:order.number,body:'@nodira.pm please review',mentionedUserIds:['user-procurement-manager']},201)).json()
  await check('user-procurement-manager',`/api/order-comments?orderId=${order.id}`)
  await check('user-procurement-manager','/api/order-comments','POST',{orderId:order.id,orderNumber:order.number,body:'Reply from mentioned user',replyToId:comment.comment.id},201)
  const supplier={id:`ux-supplier-${suffix}`,name:'UX supplier',inn:'123456789',phone:'+998901234567',email:'',contactPerson:'',category:'Material',status:'active'}
  await check('user-admin','/api/app-records/suppliers','POST',{id:supplier.id,payload:supplier},201)
  const edited=await (await check('user-admin',`/api/suppliers/${supplier.id}`,'PATCH',{...supplier,name:'Updated supplier'})).json()
  assert.equal(edited.record.revision,1)
  await check('user-admin',`/api/suppliers/${supplier.id}`,'PATCH',{...supplier,name:'Stale version'},409)
  const archived=await (await check('user-admin',`/api/suppliers/${supplier.id}`,'PATCH',{...edited.record,status:'archived'})).json()
  assert.equal(archived.record.status,'archived')
  const suppliers=await (await check('user-procurement','/api/app-records/suppliers')).json()
  assert.equal(suppliers.records.find(row=>row.id===supplier.id).status,'archived')
  await check('user-applicant',`/api/suppliers/${supplier.id}`,'PATCH',supplier,403)
  for (const n of ['one','two']) await check('user-supervisor','/api/notifications','POST',{id:`ux-${n}-${suffix}`,userId:'user-applicant',orderId:order.id,orderNumber:order.number,event:{kind:'action_required'}},201)
  await check('user-applicant','/api/notifications','PATCH',{ids:[`ux-one-${suffix}`]})
  const notifications=await (await check('user-applicant','/api/notifications')).json()
  assert.equal(notifications.notifications.find(row=>row.id===`ux-one-${suffix}`).read,true)
  assert.equal(notifications.notifications.find(row=>row.id===`ux-two-${suffix}`).read,false)
  assert.equal(notifications.notifications.find(row=>row.id===`ux-two-${suffix}`).event.kind,'action_required')
  await check('user-supervisor','/api/notifications','PATCH',{ids:[`ux-two-${suffix}`]})
  const protectedRead=await (await check('user-applicant','/api/notifications')).json()
  assert.equal(protectedRead.notifications.find(row=>row.id===`ux-two-${suffix}`).read,false)
  await check('user-applicant','/api/notifications','PATCH',{all:true})
  await check('user-applicant','/api/preferences','PATCH',{locale:'ru'})
  const pref=(await db.execute({sql:'select payload from app_records where namespace=? and id=?',args:['user-preferences','user-applicant']})).rows[0]
  assert.equal(JSON.parse(pref.payload).locale,'ru')
  const tg=await check('user-supervisor',`/ru/telegram/orders/${order.id}`)
  assert.match(await tg.text(),/Руководитель отдела/)
  await check('user-admin','/api/orders/archive','POST',{items:[{id:order.id,revision:99}]},409)
  await check('user-admin','/api/orders/archive','POST',{items:[{id:order.id,revision:revised.order.revision},{id:'missing-order',revision:0}]},409)
  const rolledBack=await (await check('user-admin','/api/app-records/orders')).json()
  assert.ok(rolledBack.records.some(row=>row.id===order.id))
  await check('user-admin','/api/orders/archive','POST',{items:[{id:order.id,revision:revised.order.revision}]})
  const afterArchive=await (await check('user-admin','/api/app-records/orders')).json()
  assert.ok(!afterArchive.records.some(row=>row.id===order.id))
  await check('user-supervisor',`/api/orders/${order.id}/approve`,'POST',{},404)
  // Leave a second pending fixture for a bounded, populated browser pass.
  const browserOrder={...order,id:`ux-browser-${suffix}`,number:`UI-${suffix}`,createdByUserId:'user-admin',applicantId:'user-admin',waitingForUserId:'user-admin',attachments:uploaded.attachments,attachmentNames:['ux-check.txt']}
  await check('user-admin','/api/app-records/orders','POST',{id:browserOrder.id,payload:browserOrder},201)
  const browserComment=await (await check('user-admin','/api/order-comments','POST',{orderId:browserOrder.id,orderNumber:browserOrder.number,body:'Test discussion message'},201)).json()
  await check('user-supervisor','/api/order-comments','POST',{orderId:browserOrder.id,orderNumber:browserOrder.number,body:'Test reply',replyToId:browserComment.comment.id},201)
  const recovery=await fetch(new URL('/ru/telegram/orders?department=department-production',base),{redirect:'manual'})
  assert.equal(recovery.status,307)
  assert.equal(new URL(recovery.headers.get('location'),base).pathname,'/ru/telegram')
  assert.equal(new URL(recovery.headers.get('location'),base).searchParams.get('next'),'/ru/telegram/orders?department=department-production')
  checks++
  console.log(`PASS: ${checks} API/SSR checks; persistence, authorization, conflict handling, files, supplier archive, chat, notifications, locale, Telegram detail, order archive. Browser fixture: ${browserOrder.id}`)
} finally { db.close() }
