/**
 * Builds a disposable demo database for previewing the dashboard locally.
 *
 *   npx tsx scripts/seed-dashboard-demo.ts [source.sqlite] [target.sqlite]
 *   npx tsx scripts/seed-dashboard-demo.ts --extras-only [target.sqlite]
 *
 * --extras-only adds demo suppliers and quotations to an existing demo database
 * (e.g. while the dev server is running) without recreating it.
 * Copies the source (default data/factory-os.sqlite) to the target (default
 * data/demo-dashboard.sqlite), then adds demo products, orders across every
 * workflow step and a login session per user (cookie `factory-os-session=demo-<userId>`).
 * The source database is never modified.
 */
import { copyFileSync, existsSync, rmSync } from "node:fs"
import { createHash } from "node:crypto"
import { createClient } from "@libsql/client"

import { workflowSteps, type OrderRecord, type ProcurementLineProgress, type WorkflowHistoryEntry } from "../src/lib/orders"

const extrasOnly = process.argv.includes("--extras-only")
const args = process.argv.slice(2).filter((arg) => arg !== "--extras-only")
const source = extrasOnly ? "" : args[0] ?? "data/factory-os.sqlite"
const target = (extrasOnly ? args[0] : args[1]) ?? "data/demo-dashboard.sqlite"
if (source === target) throw new Error("Refusing to overwrite the source database")
if (!extrasOnly) {
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(target + suffix)) rmSync(target + suffix)
  copyFileSync(source, target)
}
const db = createClient({ url: `file:${target}` })

const DAY = 86_400_000
const now = Date.now()
const at = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString()
const dateIn = (days: number) => new Date(now + days * DAY).toISOString().slice(0, 10)

const people = {
  applicant: "user-applicant", supervisor: "user-supervisor", chief: "user-chief-engineer", head: "user-procurement",
  specialistA: "user-procurement-manager", specialistB: "user-procurement-specialist-2", director: "user-director", warehouse: "user-warehouse",
}
const actorFor: Record<(typeof workflowSteps)[number], string> = {
  department_supervisor: people.supervisor, warehouse: people.warehouse, chief_engineer: people.chief, procurement_accept: people.head,
  sourcing: people.specialistA, price_check: people.head, director: people.director, procurement_order: people.specialistA, warehouse_receipt: people.warehouse,
}

const products = [
  ["demo-bearing", "MEX-014", "Podshipnik 6205-2RS", "Подшипник 6205-2RS", "unit-piece"],
  ["demo-contactor", "ELK-051", "Kontaktor 15 kW 380V", "Контактор 15 кВт 380В", "unit-piece"],
  ["demo-cable", "ELK-010", "Kabel VVG 3×1,5", "Кабель ВВГ 3×1,5", "unit-meter"],
  ["demo-paint", "LAK-003", "Epoksid bo‘yoq, kulrang", "Эпоксидная краска, серая", "unit-kilogram"],
  ["demo-gloves", "XAV-021", "Himoya qo‘lqoplari", "Защитные перчатки", "unit-piece"],
  ["demo-belt", "MEX-032", "Tasmali uzatma B-1250", "Ремень приводной B-1250", "unit-piece"],
  ["demo-filter", "GID-008", "Gidravlik filtr HF-35", "Гидравлический фильтр HF-35", "unit-piece"],
  ["demo-sensor", "ELK-077", "Induktiv sensor M18", "Индуктивный датчик M18", "unit-piece"],
] as const

type Spec = {
  step: (typeof workflowSteps)[number] | "complete"
  created: number
  entered?: number
  urgency?: OrderRecord["urgency"]
  expectedIn?: number
  lines?: number
  specialist?: string
  progress?: ProcurementLineProgress["step"][]
  placement?: { dueIn: number; amount: number; prepaid: number; supplier: string }
  closed?: number
}

const specs: Spec[] = [
  { step: "department_supervisor", created: 0.2, urgency: "high", lines: 2 },
  { step: "department_supervisor", created: 1.4, lines: 1 },
  { step: "warehouse", created: 2.1, entered: 1.1, lines: 3 },
  { step: "chief_engineer", created: 3.5, entered: 0.6, urgency: "urgent", lines: 2 },
  { step: "procurement_accept", created: 4, entered: 1.5, lines: 4 },
  { step: "sourcing", created: 9, entered: 6.5, urgency: "critical", expectedIn: -2, lines: 3 },
  { step: "sourcing", created: 7, entered: 4, lines: 2, specialist: people.specialistB },
  { step: "sourcing", created: 5, entered: 2, lines: 4, specialist: people.specialistB, progress: ["director", "director", "sourcing", "sourcing"] },
  { step: "sourcing", created: 12, entered: 8, expectedIn: -4, lines: 2 },
  { step: "price_check", created: 6, entered: 1.2, lines: 3 },
  { step: "director", created: 8, entered: 3.4, urgency: "urgent", lines: 2 },
  { step: "director", created: 6, entered: 2.2, lines: 5 },
  { step: "director", created: 11, entered: 5.8, urgency: "critical", expectedIn: -1, lines: 1 },
  { step: "procurement_order", created: 10, entered: 1, lines: 3 },
  { step: "warehouse_receipt", created: 15, entered: 4, lines: 2, placement: { dueIn: 5, amount: 18_400_000, prepaid: 9_200_000, supplier: "Texno Servis MChJ" } },
  { step: "warehouse_receipt", created: 13, entered: 2, lines: 3, placement: { dueIn: 11, amount: 42_750_000, prepaid: 12_825_000, supplier: "Elektro Market" } },
  ...[1, 2, 3, 5, 6, 8, 9, 11, 12].map((closed, index) => ({ step: "complete" as const, created: closed + 6 + (index % 3), closed, lines: 1 + (index % 3) })),
]

const suppliers = [
  ["demo-supplier-texno", "Texno Servis MChJ", "305112874", "+998 90 311 22 44", "Jahongir Aliyev", "Mexanika"],
  ["demo-supplier-elektro", "Elektro Market", "302998410", "+998 93 540 11 20", "Sherzod Qodirov", "Elektrika"],
  ["demo-supplier-gidro", "GidroTexnika Savdo", "307441265", "+998 97 700 45 12", "Olga Kim", "Gidravlika"],
  ["demo-supplier-kimyo", "Kimyo Lak Bo‘yoq", "", "+998 99 812 60 03", "Rustam Nazarov", "Lak-bo‘yoq"],
  ["demo-supplier-himoya", "Himoya Plus", "309115730", "+998 90 155 70 70", "Dilnoza Saidova", "Xavfsizlik"],
] as const

/** Suppliers plus one offer per procurement position; approved stages get a selected offer. */
async function seedExtras() {
  for (const [id, name, inn, phone, contactPerson, category] of suppliers) {
    await db.execute({
      sql: "INSERT OR REPLACE INTO app_records(namespace,id,payload,created_by_user_id) VALUES ('suppliers',?,?,?)",
      args: [id, JSON.stringify({ id, name, inn, phone, email: "", contactPerson, category, status: "active" }), people.specialistA],
    })
  }
  const rows = await db.execute("SELECT id, payload FROM app_records WHERE namespace='orders' AND id LIKE 'demo-order-%'")
  let supplierIndex = 0
  for (const row of rows.rows) {
    const order = JSON.parse(String(row.payload)) as OrderRecord
    const procurementLines = order.lines.filter((line) => line.fulfillmentStatus === "needs_procurement")
    if (!procurementLines.length || ["procurement_accept", "complete"].includes(order.currentStep)) continue
    const approved = (lineId: string) => {
      const step = order.procurementProgress?.[lineId]?.step ?? order.currentStep
      return ["director", "procurement_order", "warehouse_receipt"].includes(step)
    }
    for (const offer of [0, 1]) {
      const [supplierId, supplierName, , supplierPhone] = suppliers[(supplierIndex + offer) % suppliers.length]
      const lines = procurementLines.map((line, index) => ({
        orderLineId: line.id, quantity: line.quantity, unitPrice: (index + 2) * 85_000 * (offer ? 1.12 : 1),
        expectedDeliveryDate: dateIn(7 + index), ndsIncluded: true, paymentMethod: "bank" as const,
      }))
      const selectedLineIds = offer === 0 ? procurementLines.filter((line) => approved(line.id)).map((line) => line.id) : []
      const id = `demo-quote-${order.id}-${offer}`
      await db.execute({
        sql: "INSERT OR REPLACE INTO app_records(namespace,id,payload,created_by_user_id,created_at) VALUES ('quotations',?,?,?,?)",
        args: [id, JSON.stringify({
          id, procurementCaseId: `procurement-${order.id}`, supplierId, supplierName, supplierPhone, lines,
          amount: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
          selected: selectedLineIds.length > 0, selectedLineIds, createdByUserId: order.procurementSpecialistUserId ?? people.specialistA,
          createdAt: order.workflowHistory?.at(-1)?.createdAt ?? order.createdAt,
        }), order.procurementSpecialistUserId ?? people.specialistA, order.createdAt],
      })
    }
    supplierIndex += 1
  }
}

async function main() {
  if (extrasOnly) {
    await seedExtras()
    console.log(`Demo suppliers and quotations added to ${target}`)
    db.close()
    return
  }
  for (const [id, code, uz, ru, unit] of products) {
    await db.execute({ sql: "INSERT OR IGNORE INTO products(id,code,category_id,unit_type_id,title_uz,title_ru,title_tr) VALUES (?,?,?,?,?,?,?)", args: [id, code, "category-material", unit, uz, ru, uz] })
  }
  const productIds = products.map(([id]) => id)
  let sequence = 140
  for (const [index, spec] of specs.entries()) {
    const id = `demo-order-${index + 1}`
    const number = `ORD-2026-0${sequence++}`
    const createdAt = at(spec.created)
    const specialist = spec.specialist ?? people.specialistA
    const stepIndex = spec.step === "complete" ? workflowSteps.length : workflowSteps.indexOf(spec.step)
    const procurementStarted = stepIndex >= workflowSteps.indexOf("procurement_accept")
    const lines = Array.from({ length: spec.lines ?? 1 }, (_, lineIndex) => ({
      id: `${id}-line-${lineIndex + 1}`,
      productId: productIds[(index + lineIndex) % productIds.length],
      quantity: [4, 12, 50, 120, 8][(index + lineIndex) % 5],
      note: "",
      availableQuantity: 0,
      ...(procurementStarted ? { fulfillmentStatus: "needs_procurement" as const } : {}),
    }))
    const entered = spec.step === "complete" ? spec.closed! : spec.entered ?? spec.created
    const history: WorkflowHistoryEntry[] = workflowSteps.slice(0, stepIndex).map((step, historyIndex) => ({
      step,
      action: ["warehouse", "procurement_accept", "sourcing", "procurement_order", "warehouse_receipt"].includes(step) ? "completed" : "approved",
      actorUserId: ["sourcing", "procurement_order"].includes(step) ? specialist : actorFor[step],
      createdAt: at(spec.created - ((spec.created - entered) * (historyIndex + 1)) / Math.max(1, stepIndex)),
    }))
    const currentStep = spec.step
    const waitingForUserId = currentStep === "complete" ? undefined
      : ["sourcing", "procurement_order"].includes(currentStep) ? specialist : actorFor[currentStep]
    const order: OrderRecord = {
      id, number, createdByUserId: people.applicant, type: "material", applicantId: people.applicant,
      departmentIds: ["department-production"], branchIds: ["branch-tashkent"], warehouseId: "warehouse-main",
      purposeId: index % 3 ? "purpose-production" : "purpose-maintenance",
      expectedDate: dateIn(spec.expectedIn ?? 3 + (index % 9)), urgency: spec.urgency ?? "normal", lines,
      comment: "", attachmentNames: [], comments: [],
      status: currentStep === "complete" ? "approved" : currentStep === "warehouse" ? "warehouse_check" : currentStep === "department_supervisor" ? "supervisor_review" : "in_progress",
      currentStep, waitingForUserId, lastActorUserId: history.at(-1)?.actorUserId ?? people.applicant, createdAt, workflowHistory: history,
      ...(procurementStarted ? {
        procurementSpecialistUserId: specialist,
        procurementHeadUserId: people.head,
        procurementLineAssignments: Object.fromEntries(lines.map((line) => [line.id, specialist])),
      } : {}),
    }
    if (spec.progress) {
      order.procurementProgress = Object.fromEntries(lines.map((line, lineIndex) => {
        const step = spec.progress![lineIndex]
        return [line.id, { step, waitingForUserId: step === "director" ? people.director : specialist }]
      }))
      const submitted = lines.filter((_, lineIndex) => spec.progress![lineIndex] === "director").map((line) => line.id)
      order.workflowHistory = [...history,
        { step: "sourcing", action: "completed", actorUserId: specialist, createdAt: at(1.6), orderLineIds: submitted },
        { step: "price_check", action: "approved", actorUserId: people.head, createdAt: at(0.9), orderLineIds: submitted }]
    }
    if (spec.placement) {
      const placedAt = at(entered)
      order.placement = { createdAt: placedAt, createdByUserId: specialist, lines: [{
        quotationId: `demo-quote-${index}`, orderLineId: lines[0].id, method: "bank", prepaidAmount: spec.placement.prepaid,
        dueDate: dateIn(spec.placement.dueIn), contractNumber: `SH-${index}/2026`, supplierId: `demo-supplier-${index}`,
        supplierName: spec.placement.supplier, quantity: lines[0].quantity, unitPrice: spec.placement.amount / lines[0].quantity,
        amount: spec.placement.amount, prepaidPercent: Math.round((spec.placement.prepaid / spec.placement.amount) * 100), placedAt, placedByUserId: specialist,
      }] }
    }
    await db.execute({
      sql: "INSERT OR REPLACE INTO app_records(namespace,id,payload,created_by_user_id,created_at,updated_at) VALUES ('orders',?,?,?,?,?)",
      args: [id, JSON.stringify(order), people.applicant, createdAt, createdAt],
    })
  }
  const users = await db.execute("SELECT id FROM users")
  for (const row of users.rows) {
    const userId = String(row.id)
    await db.execute({
      sql: "INSERT OR REPLACE INTO sessions(id,token_hash,user_id,expires_at) VALUES (?,?,?,?)",
      args: [`demo-session-${userId}`, createHash("sha256").update(`demo-${userId}`).digest("hex"), userId, new Date(now + 7 * DAY).toISOString()],
    })
  }
  await seedExtras()
  console.log(`Demo database ready: ${target} (${specs.length} orders). Session cookie: factory-os-session=demo-<userId>`)
  db.close()
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
