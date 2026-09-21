import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn, spawnSync } from "node:child_process"
import type { OrderRecord } from "../src/lib/orders"
import { getOrderActionView, isOrderWaitingForUser } from "../src/lib/orders"
import type { PaymentRequest } from "../src/lib/finance-workflow"

// Real HTTP requests and real SQLite transactions, isolated from project/prod DBs.
async function main() {
  const directory = mkdtempSync(join(tmpdir(), "factory-split-test-"))
  process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`
  process.env.TELEGRAM_BOT_TOKEN = ""
  const migrated = spawnSync("npm", ["run", "db:migrate"], { env: process.env, encoding: "utf8" })
  assert.equal(migrated.status, 0, migrated.stderr)
  const { db, databaseClient } = await import("../src/db/client")
  const s = await import("../src/db/schema")
  const names = { titleUz: "Test", titleRu: "Тест", titleTr: "Test" }
  const grants: Record<string, string[]> = {
    procurement_head: ["requests.view", "requests.create", "procurement.view", "procurement.select_supplier", "approvals.approve", "approvals.reject"],
    procurement_manager: ["requests.view", "procurement.view", "procurement.quote", "suppliers.manage", "suppliers.view"],
    director: ["requests.view", "approvals.approve", "approvals.reject"],
    warehouse: ["requests.view", "warehouse.receive"],
    finance: ["requests.view", "finance.view", "finance.mark_paid", "approvals.approve", "approvals.reject"],
  }
  for (const code of new Set(Object.values(grants).flat())) {
    await db.insert(s.permissions).values({ code, module: code.split(".")[0], labelUz: code, labelRu: code, labelTr: code })
  }
  for (const [code, permissions] of Object.entries(grants)) {
    await db.insert(s.roles).values({ id: `role-${code}`, code, ...names })
    await db.insert(s.rolePermissions).values(permissions.map((permissionCode) => ({ roleId: `role-${code}`, permissionCode })))
  }
  await db.insert(s.departments).values({ id: "department", ...names })
  const people = { head: "procurement_head", a: "procurement_manager", b: "procurement_manager", director: "director", warehouse: "warehouse", financier: "finance" }
  for (const [id, role] of Object.entries(people)) {
    await db.insert(s.users).values({ id, fullName: `Split test ${id}`, username: `split-${id}` })
    await db.insert(s.userRoles).values({ userId: id, roleId: `role-${role}` })
    await db.insert(s.userDepartments).values({ userId: id, departmentId: "department" })
    await db.insert(s.sessions).values({ id: `session-${id}`, userId: id,
      tokenHash: createHash("sha256").update(`split-test-${id}`).digest("hex"), expiresAt: new Date(Date.now() + 86_400_000).toISOString() })
  }
  await db.insert(s.warehouses).values({ id: "warehouse", responsibleUserId: "warehouse", ...names })
  const port = "3106"
  const server = spawn("node", ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port], { env: process.env, stdio: ["ignore", "pipe", "pipe"] })
  let logs = ""
  server.stdout.on("data", (data) => { logs += data })
  server.stderr.on("data", (data) => { logs += data })
  const base = `http://127.0.0.1:${port}`
  async function request(user: string, path: string, body?: unknown, expected = 200) {
    const response = await fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST",
      headers: { cookie: `factory-os-session=split-test-${user}`, ...(body instanceof FormData ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) })
    const result = await response.json()
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`)
    return result
  }
  async function workflow(user: string, id: string, action: string, input: Record<string, unknown> = {}, expected = 200) {
    return request(user, `/api/orders/${id}/workflow`, { action, ...input }, expected)
  }
  async function read(id: string) {
    return (await request("head", "/api/app-records/orders")).records.find((item: OrderRecord) => item.id === id) as OrderRecord
  }
  try {
    for (let attempt = 0; attempt < 80; attempt++) {
      try { const response = await fetch(`${base}/api/app-records/orders`); if (response.status === 401) break } catch { /* booting */ }
      if (server.exitCode !== null) throw new Error(logs)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    const root: OrderRecord = { id: "split-root", number: "ORD-2026-0100", createdByUserId: "head", applicantId: "head", type: "material",
      departmentIds: ["department"], branchIds: [], warehouseId: "warehouse", purposeId: "test", expectedDate: "2026-12-20", urgency: "normal",
      comment: "Independent procurement API test", attachmentNames: [], status: "in_progress", currentStep: "procurement_accept", waitingForUserId: "head",
      lastActorUserId: "head", createdAt: new Date().toISOString(), workflowHistory: [],
      lines: [1,2,3,4,5].map((n) => ({ id: `line-${n}`, productId: `product-${n}`, quantity: 10, availableQuantity: 2, note: "", fulfillmentStatus: "needs_procurement" })) }
    await request("head", "/api/app-records/orders", { id: root.id, payload: root }, 201)
    const assign = (user: string, ids: string[], expected = 200) => workflow("head", root.id, "assign-procurement-specialist", { specialistUserId: user, orderLineIds: ids }, expected)
    const a = (await assign("a", ["line-1"])).relatedOrders[0] as OrderRecord
    const b = (await assign("b", ["line-2", "line-3"])).relatedOrders[0] as OrderRecord
    const a2 = (await assign("a", ["line-4", "line-5"])).relatedOrders[0] as OrderRecord
    assert.equal(a2.id, a.id)
    assert.equal(a2.number, "ORD-2026-0100/1")
    assert.equal(a2.lines.length, 3)
    assert.equal((await read(b.id)).lines.length, 2)
    await assign("b", ["line-1"], 409)
    await workflow("b", a.id, "submit-procurement-offers", {}, 403)
    await workflow("a", a.id, "submit-procurement-offers", {}, 409)
    await workflow("a", root.id, "submit-procurement-offers", {}, 409)
    async function quote(user: string, order: OrderRecord, quoteId: string, ids: string[], expected = 201) {
      await request(user, "/api/app-records/suppliers", { id: quoteId, payload: { id: quoteId, name: quoteId, phone: "+998900000000", inn: "", status: "active" } }, 201)
      return request(user, "/api/app-records/quotations", { id: quoteId, payload: { id: quoteId, procurementCaseId: `procurement-${order.id}`, supplierId: quoteId,
        supplierName: quoteId, supplierPhone: "+998900000000", selected: false, amount: ids.length * 800, createdByUserId: user, createdAt: new Date().toISOString(),
        lines: ids.map((id) => ({ orderLineId: id, quantity: 8, unitPrice: 100, expectedDeliveryDate: "2026-12-20", ndsIncluded: true, paymentMethod: "cash" })) } }, expected)
    }
    await quote("b", a, "wrong-owner", ["line-1"], 403)
    await quote("a", a, "supplier-one", ["line-1"])
    await quote("a", a, "supplier-two", ["line-4", "line-5"])
    await workflow("a", a.id, "submit-procurement-offers")
    assert.equal((await read(a.id)).currentStep, "price_check")
    assert.equal((await read(b.id)).currentStep, "sourcing")
    await quote("a", a, "late-offer", ["line-1"], 403)
    await workflow("head", a.id, "review-procurement-offers", { approved: false, comment: "Test revision" })
    assert.equal((await read(a.id)).waitingForUserId, "a")
    assert.equal((await read(b.id)).currentStep, "sourcing")
    await workflow("a", a.id, "submit-procurement-offers")
    await workflow("head", a.id, "review-procurement-offers", { approved: true, quotationIds: ["supplier-one"] }, 409)
    await workflow("head", a.id, "review-procurement-offers", { approved: true, quotationIds: ["supplier-one", "supplier-two"] })
    await request("director", `/api/orders/${a.id}/approve`, {})
    assert.equal((await read(a.id)).waitingForUserId, "a")
    await request("b", `/api/orders/${a.id}/approve`, {}, 403)
    const placementOrder = await read(a.id)
    await request("a", `/api/orders/${a.id}/approve`, {}, 400)
    const paymentInputs = [
      { quotationId: "supplier-one", orderLineId: "line-1", method: "bank", prepaidAmount: 200, dueDate: "2026-12-20", contractNumber: "C-001", supplierInn: "987654321" },
      ...["line-4", "line-5"].map((orderLineId) => ({ quotationId: "supplier-two", orderLineId, method: "cash", prepaidAmount: 800, dueDate: "", contractNumber: "", supplierInn: "123456789" })),
    ]
    function paymentForm(input: unknown = paymentInputs) {
      const form = new FormData()
      form.set("payments", JSON.stringify(input))
      form.set("contract-0", new Blob(["test contract content"], { type: "text/plain" }), "Shartnoma.txt")
      return form
    }
    await request("a", `/api/orders/${a.id}/approve`, paymentForm([paymentInputs[0], paymentInputs[0]]), 400)
    await request("a", `/api/orders/${a.id}/approve`, paymentForm(paymentInputs.map((line) => ({ ...line, prepaidAmount: 900 }))), 400)
    assert.equal((await read(a.id)).currentStep, "procurement_order")
    assert.equal((await databaseClient.execute("SELECT id FROM app_records WHERE namespace='order-contracts'")).rows.length, 0)
    const conflictingContracts = paymentForm()
    conflictingContracts.set("supplier-contract-1", new Blob(["supplier contract"], { type: "text/plain" }), "Supplier.txt")
    conflictingContracts.set("contract-2", new Blob(["conflicting contract"], { type: "text/plain" }), "Conflict.txt")
    await request("a", `/api/orders/${a.id}/approve`, conflictingContracts, 400)
    assert.equal((await databaseClient.execute("SELECT id FROM app_records WHERE namespace='order-contracts'")).rows.length, 0, "conflicting group contracts roll back atomically")
    const groupedContracts = paymentForm()
    groupedContracts.set("supplier-contract-1", new Blob(["supplier contract"], { type: "text/plain" }), "Supplier.txt")
    await request("a", `/api/orders/${a.id}/approve`, groupedContracts)
    const placed = await read(a.id)
    assert.equal(placed.placement?.lines.length, 3)
    assert.equal(placed.placement?.lines[0].amount, 800)
    assert.equal(placed.placement?.lines[0].prepaidPercent, 25)
    assert.equal(placed.placement?.lines[1].contract?.id, placed.placement?.lines[2].contract?.id)
    assert.notEqual(placed.placement?.lines[0].contract?.id, placed.placement?.lines[1].contract?.id)
    assert.equal((await databaseClient.execute("SELECT id FROM app_records WHERE namespace='order-contracts'")).rows.length, 2, "one uploaded file per supplier, not per product")
    const downloadPath = `/api/orders/${a.id}/contracts/${placed.placement?.lines[0].contract?.id}`
    for (const person of ["a", "head", "warehouse"]) {
      const file = await fetch(`${base}${downloadPath}`, { headers: { cookie: `factory-os-session=split-test-${person}` } })
      assert.equal(file.status, 200)
      assert.equal(await file.text(), "test contract content")
      assert.match(file.headers.get("content-disposition") ?? "", /attachment/)
    }
    assert.equal((await fetch(`${base}${downloadPath}`, { headers: { cookie: "factory-os-session=split-test-b" } })).status, 403)
    assert.equal((await fetch(`${base}${downloadPath}`)).status, 401)
    await request("a", `/api/orders/${a.id}/approve`, paymentForm(), 403)
    assert.equal((await read(a.id)).waitingForUserId, "warehouse")
    await request("warehouse", `/api/orders/${a.id}/approve`, {})
    assert.equal((await read(a.id)).currentStep, "complete")
    assert.equal((await read(b.id)).currentStep, "sourcing")
    const aVisible = (await request("a", "/api/app-records/orders")).records
    assert.equal(aVisible.some((item: OrderRecord) => item.id === b.id), false)
    // One child, five positions, several independent review / placement rounds.
    const partialRoot = { ...root, id: "partial-root", number: "ORD-2026-0102" }
    await request("head", "/api/app-records/orders", { id: partialRoot.id, payload: partialRoot }, 201)
    const partial = (await workflow("head", partialRoot.id, "assign-procurement-specialist", { specialistUserId: "a", orderLineIds: root.lines.map((line) => line.id) })).relatedOrders[0] as OrderRecord
    await quote("a", partial, "partial-ready", ["line-1", "line-2"])
    assert.equal(isOrderWaitingForUser(await read(partial.id), "a"), true, "draft offers must still wait for sender")
    await workflow("a", partial.id, "submit-procurement-offers")
    let progress = await read(partial.id)
    assert.equal(progress.lines.length, 5)
    assert.equal(isOrderWaitingForUser(progress, "a"), true)
    assert.equal(isOrderWaitingForUser(progress, "head"), true)
    await quote("a", partial, "partial-third", ["line-3"])
    assert.equal((await read(partial.id)).procurementProgress?.["line-3"].step, "sourcing")
    await workflow("head", partial.id, "review-procurement-offers", { approved: true, quotationIds: ["partial-ready"] })
    await request("director", `/api/orders/${partial.id}/approve`, {})
    assert.equal(getOrderActionView(await read(partial.id), "a").currentStep, "procurement_order")
    const partialPayment = (quotationId: string, orderLineId: string, supplierInn: string) => ({ quotationId, orderLineId, supplierInn, method: "cash", prepaidAmount: 800, dueDate: "", contractNumber: "Partial" })
    await request("a", `/api/orders/${partial.id}/approve`, paymentForm([partialPayment("partial-ready", "line-1", "")]), 400)
    const firstPayment = [partialPayment("partial-ready", "line-1", "111111111")]
    await request("a", `/api/orders/${partial.id}/approve`, paymentForm(firstPayment))
    await request("a", `/api/orders/${partial.id}/approve`, paymentForm(firstPayment), 400)
    progress = await read(partial.id)
    assert.equal(progress.placement?.lines.length, 1)
    assert.equal(progress.procurementProgress?.["line-2"].step, "procurement_order")
    assert.equal(isOrderWaitingForUser(progress, "a"), true)
    assert.equal(isOrderWaitingForUser(progress, "warehouse"), true)
    await request("warehouse", `/api/orders/${partial.id}/approve`, {})
    assert.equal((await read(partial.id)).procurementProgress?.["line-1"].step, "complete")
    await workflow("a", partial.id, "submit-procurement-offers")
    await workflow("head", partial.id, "review-procurement-offers", { approved: false, comment: "Only third position needs revision" })
    progress = await read(partial.id)
    assert.equal(progress.procurementProgress?.["line-2"].step, "procurement_order")
    assert.equal(progress.procurementProgress?.["line-3"].step, "sourcing")
    await workflow("a", partial.id, "submit-procurement-offers")
    await workflow("head", partial.id, "review-procurement-offers", { approved: true, quotationIds: ["partial-third"] })
    await request("director", `/api/orders/${partial.id}/approve`, {})
    const partialUiOrder = await read(partial.id)
    await request("a", `/api/orders/${partial.id}/approve`, paymentForm([partialPayment("partial-ready", "line-2", "222222222")]), 400)
    await request("a", `/api/orders/${partial.id}/approve`, paymentForm([partialPayment("partial-ready", "line-2", "111111111"), partialPayment("partial-third", "line-3", "333333333")]))
    await request("warehouse", `/api/orders/${partial.id}/approve`, {})
    assert.equal((await read(partial.id)).currentStep, "sourcing")
    await quote("a", partial, "partial-last", ["line-4", "line-5"])
    await workflow("a", partial.id, "submit-procurement-offers")
    await workflow("head", partial.id, "review-procurement-offers", { approved: true, quotationIds: ["partial-last"] })
    await request("director", `/api/orders/${partial.id}/approve`, {})
    await request("a", `/api/orders/${partial.id}/approve`, paymentForm([partialPayment("partial-last", "line-4", "444444444"), partialPayment("partial-last", "line-5", "444444444")]))
    await request("warehouse", `/api/orders/${partial.id}/approve`, {})
    progress = await read(partial.id)
    assert.equal(progress.currentStep, "complete")
    assert.equal(progress.placement?.lines.length, 5)
    assert.equal(isOrderWaitingForUser(progress, "a"), false)
    assert.equal(isOrderWaitingForUser(progress, "warehouse"), false)
    const savedSuppliers = (await request("a", "/api/app-records/suppliers")).records
    assert.equal(savedSuppliers.find((supplier: { id: string }) => supplier.id === "partial-ready").inn, "111111111")
    // Finance is persisted atomically with placement and independently approved per advance/balance.
    const finance = async (user = "head") => (await request(user, "/api/finance/payments")).payments as PaymentRequest[]
    const financeAction = (user: string, action: string, payments: PaymentRequest[], comment = "", expected = 200, correction?: object) =>
      request(user, "/api/finance/payments", { action, items: payments.map(({ id, revision }) => ({ id, revision })), comment, correction }, expected)
    const aPayments = (await finance()).filter((payment) => payment.orderId === a.id)
    assert.equal(aPayments.length, 3, "one split payment and one full advance")
    assert.equal(aPayments.reduce((sum, payment) => sum + payment.amount, 0), 2400)
    assert.equal((await finance("a")).length, (await finance()).length)
    assert.equal((await finance("b")).length, 0)
    await request("warehouse", "/api/finance/payments", undefined, 403)
    await request("nobody", "/api/finance/payments", undefined, 401)
    await financeAction("b", "approve", aPayments, "", 403)
    await financeAction("financier", "paid", aPayments, "", 403)
    await financeAction("director", "approve", aPayments, "", 403)
    await financeAction("head", "return", [aPayments[0]], "", 400)
    await financeAction("head", "approve", aPayments)
    await financeAction("head", "approve", aPayments, "", 409)
    let headApproved = (await finance()).filter((payment) => payment.orderId === a.id)
    await financeAction("director", "return", [headApproved[0]], "Please correct payment terms")
    let returned = (await finance("a")).find((payment) => payment.id === aPayments[0].id)!
    assert.equal(returned.stage, "returned")
    await financeAction("b", "resubmit", [returned], "not mine", 403)
    await financeAction("a", "resubmit", [returned], "Date corrected", 200, { method: "cash", dueDate: "2026-12-30", contractNumber: "Corrected", amount: 1 })
    returned = (await finance()).find((payment) => payment.id === returned.id)!
    assert.equal(returned.amount, aPayments[0].amount)
    assert.equal(returned.stage, "head_review")
    await financeAction("head", "approve", [returned])
    headApproved = (await finance()).filter((payment) => payment.orderId === a.id)
    await financeAction("director", "approve", headApproved)
    const ready = (await finance("financier")).filter((payment) => payment.orderId === a.id)
    for (const action of ["approve", "return", "cancel"]) await financeAction("financier", action, ready, "not permitted", 403)
    const doublePaid = await Promise.all([1, 2].map(() => fetch(`${base}/api/finance/payments`, {
      method: "POST", headers: { cookie: "factory-os-session=split-test-financier", "content-type": "application/json" },
      body: JSON.stringify({ action: "paid", items: ready.map(({ id, revision }) => ({ id, revision })), comment: "Bank transaction 123" }),
    })))
    assert.deepEqual(doublePaid.map((response) => response.status).sort(), [200, 409], "concurrent bulk payments have only one winner")
    await financeAction("financier", "paid", ready, "Duplicate", 409)
    assert.equal((await finance()).filter((payment) => payment.orderId === a.id).every((payment) => payment.stage === "paid"), true)
    assert.equal((await finance()).filter((payment) => payment.orderId === a.id).every((payment) => payment.history.filter((entry) => entry.action === "paid").length === 1), true)
    // Historical placements materialize once, without writing on read, and cannot be forged through generic APIs.
    const historic = { ...placed, id: "historic-finance", number: "ORD-HIST/1" }
    await request("head", "/api/app-records/orders", { id: historic.id, payload: historic }, 403)
    await request("financier", "/api/app-records/finance-transactions", { id: "fake-payment", payload: { amount: 1 } }, 403)
    await db.insert(s.appRecords).values({ namespace: "orders", id: historic.id, payload: historic as unknown as Record<string, unknown>, createdByUserId: "a" })
    const historicCount = (await databaseClient.execute("SELECT id FROM app_records WHERE namespace='finance-payments'")).rows.length
    let historyPayments = (await finance()).filter((payment) => payment.orderId === historic.id)
    assert.equal(historyPayments.length, 3)
    assert.equal((await databaseClient.execute("SELECT id FROM app_records WHERE namespace='finance-payments'")).rows.length, historicCount)
    // One stale or unauthorized item rejects the entire bulk action.
    await financeAction("head", "approve", [historyPayments[0], aPayments[0]], "", 409)
    assert.equal((await finance()).find((payment) => payment.id === historyPayments[0].id)!.stage, "head_review")
    await financeAction("head", "approve", [historyPayments[0]])
    historyPayments = (await finance()).filter((payment) => payment.orderId === historic.id)
    const paidFirst = historyPayments.find((payment) => payment.stage === "director_review")!
    await financeAction("director", "approve", [paidFirst])
    await financeAction("financier", "paid", [(await finance()).find((payment) => payment.id === paidFirst.id)!])
    await financeAction("head", "cancel", [historyPayments.find((payment) => payment.stage === "head_review")!], "Order no longer needed")
    const cancelledPayments = (await finance()).filter((payment) => payment.orderId === historic.id)
    assert.equal(cancelledPayments.filter((payment) => payment.stage === "paid").length, 1)
    assert.equal(cancelledPayments.filter((payment) => payment.stage === "cancelled").length, 2)
    const cancelledOrder = await read(historic.id)
    assert.equal(cancelledOrder.status, "rejected")
    assert.equal(cancelledOrder.financeCancellation?.comment, "Order no longer needed")
    assert.equal(isOrderWaitingForUser(cancelledOrder, "warehouse"), false)
    assert.equal((await read(b.id)).currentStep, "sourcing")
    await request("warehouse", `/api/orders/${historic.id}/approve`, {}, 404)
    console.log("PASS: finance visibility, separate advance/balance, strict role chain, bulk atomicity, return/correction, immutable totals, historical placements, paid-once, cancellation cascade without undoing paid history or touching siblings.")
    console.log("PASS: partial submission, unsent offers waiting, simultaneous user queues, partial placement, immutable supplier INN, retries, isolated returns and completion only after all positions.")
    // Two simultaneous allocations of the same line must have one winner.
    const concurrent = { ...root, id: "concurrent-root", number: "ORD-2026-0101" }
    await request("head", "/api/app-records/orders", { id: concurrent.id, payload: concurrent }, 201)
    const responses = await Promise.all(["a", "b"].map((user) => fetch(`${base}/api/orders/${concurrent.id}/workflow`, {
      method: "POST", headers: { cookie: "factory-os-session=split-test-head", "content-type": "application/json" },
      body: JSON.stringify({ action: "assign-procurement-specialist", specialistUserId: user, orderLineIds: ["line-1"] }),
    })))
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409])
    // Reproduce the production legacy state: A submitted, B still sourcing.
    const { buildProcurementSuborders } = await import("../src/lib/orders")
    const legacy: OrderRecord = { ...root, id: "legacy-root", number: "ORD-2026-0102", currentStep: "sourcing", waitingForUserId: "a",
      procurementLineAssignments: { "line-1": "a", "line-2": "a", "line-3": "a", "line-4": "b", "line-5": "b" } }
    legacy.procurementSuborders = buildProcurementSuborders(legacy)
    await request("head", "/api/app-records/orders", { id: legacy.id, payload: legacy }, 201)
    await quote("a", legacy, "legacy-quote-a", ["line-1", "line-2", "line-3"])
    await quote("b", legacy, "legacy-quote-b", ["line-4", "line-5"])
    legacy.procurementSuborders[0].status = "submitted"
    legacy.procurementSuborders[0].submittedAt = new Date().toISOString()
    await databaseClient.execute({ sql: "UPDATE app_records SET payload=? WHERE namespace=? AND id=?", args: [JSON.stringify(legacy), "orders", legacy.id] })
    await db.insert(s.orderComments).values({ id: "legacy-comment", orderId: legacy.id, orderNumber: legacy.number, authorUserId: "a", authorName: "A", authorUsername: "split-a", body: "Preserve original discussion" })
    const migration = (apply: boolean) => spawnSync("node", ["--import", "tsx", "scripts/migrate-procurement-splits.ts", ...(apply ? ["--apply"] : [])], { env: process.env, encoding: "utf8" })
    const dryRun = migration(false)
    assert.equal(dryRun.status, 0, dryRun.stderr)
    assert.equal((await read(legacy.id)).procurementSplit, undefined)
    const applied = migration(true)
    assert.equal(applied.status, 0, applied.stderr)
    assert.equal((await read("legacy-root-procurement-1")).currentStep, "price_check")
    assert.equal((await read("legacy-root-procurement-2")).currentStep, "sourcing")
    const migratedQuotes = (await request("a", "/api/app-records/quotations")).records
    assert.equal(migratedQuotes.find((q: { id: string }) => q.id === "legacy-quote-a").procurementCaseId, "procurement-legacy-root-procurement-1")
    assert.equal(migratedQuotes.find((q: { id: string }) => q.id === "legacy-quote-a").amount, 2400)
    assert.equal((await databaseClient.execute("SELECT * FROM order_comments WHERE id='legacy-comment'")).rows.length, 1)
    const repeated = migration(true)
    assert.equal(repeated.status, 0, repeated.stderr)
    assert.match(repeated.stdout, /No legacy/)
    assert.equal((await databaseClient.execute("SELECT * FROM app_records WHERE namespace='orders' AND id LIKE 'legacy-root-procurement-%'")).rows.length, 2)
    console.log("PASS: A/B/A identity, duplicate/concurrent allocation, multiple suppliers, independent head review, rejection/resubmission, director, own purchaser, warehouse completion, and access isolation.")
    console.log("PASS: dry-run, atomic migration, quote IDs/amounts and comments preserved, already-submitted child advanced, idempotent re-run.")
    console.log(`Isolated test DB: ${directory}`)
    if (process.argv.includes("--keep-running")) {
      await databaseClient.execute({ sql: "UPDATE app_records SET payload=? WHERE namespace='orders' AND id=?", args: [JSON.stringify(partialUiOrder), partial.id] })
      // A reproducible mixed-lane UI fixture: two ready to place, one ready offer,
      // one still without an offer, and one position already received.
      await databaseClient.execute("UPDATE app_records SET payload=json_set(payload, '$.selected', json('false'), '$.selectedLineIds', json('[]'), '$.lines', json_array(json_extract(payload, '$.lines[0]')), '$.amount', 800) WHERE namespace='quotations' AND id='partial-last'")
      await databaseClient.execute("UPDATE app_records SET payload=json_set(payload, '$.inn', '') WHERE namespace='suppliers' AND id='partial-third'")
      console.log(`Partial UI ready: ${base}/uz/orders?order=${partial.id}`)
      await databaseClient.execute({ sql: "UPDATE app_records SET payload=? WHERE namespace='orders' AND id=?", args: [JSON.stringify(placementOrder), a.id] })
      console.log(`Payment UI ready: ${base}/uz/orders?order=${a.id}`)
      console.log(`Test UI ready: ${base}/uz/orders?order=${root.id}`)
      await new Promise(() => {})
    }
  } catch (error) {
    console.error(logs.slice(-10000))
    throw error
  } finally { server.kill("SIGTERM"); databaseClient.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
