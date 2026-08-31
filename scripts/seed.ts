import { createClient } from "@libsql/client"
import { inArray, isNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"

import { hashPassword } from "../src/lib/auth/password"
import { permissionCatalog, systemRoleTemplates } from "../src/lib/rbac"
import * as schema from "../src/db/schema"

const databaseUrl = process.env.DATABASE_URL ?? "file:data/factory-os.sqlite"
const client = createClient({
  url: databaseUrl.startsWith("file:") || databaseUrl.startsWith("libsql:") || databaseUrl.startsWith("https:")
    ? databaseUrl
    : `file:${databaseUrl}`,
  authToken: process.env.DATABASE_AUTH_TOKEN,
})
const db = drizzle(client)

async function insertIfMissing<T extends { id?: string }>(
  table: Parameters<typeof db.insert>[0],
  values: T[],
) {
  if (!values.length) return
  await db.insert(table).values(values).onConflictDoNothing()
}

async function seed() {
  await db.insert(schema.permissions).values(permissionCatalog.map((permission) => ({
    code: permission.code,
    module: permission.module,
    labelUz: permission.label.uz,
    labelRu: permission.label.ru,
    labelTr: permission.label.tr,
  }))).onConflictDoNothing()

  await insertIfMissing(schema.positions, [
    { id: "position-manager", code: "manager", titleUz: "Menejer", titleRu: "Менеджер", titleTr: "Yönetici" },
    { id: "position-operator", code: "operator", titleUz: "Operator", titleRu: "Оператор", titleTr: "Operatör" },
    { id: "position-supervisor", code: "department-supervisor", titleUz: "Bo‘lim rahbari", titleRu: "Руководитель отдела", titleTr: "Bölüm yöneticisi" },
    { id: "position-chief-engineer", code: "chief-engineer", titleUz: "Bosh muhandis", titleRu: "Главный инженер", titleTr: "Baş mühendis" },
    { id: "position-director", code: "director", titleUz: "Direktor", titleRu: "Директор", titleTr: "Direktör" },
  ])

  await insertIfMissing(schema.branches, [
    { id: "branch-tashkent", titleUz: "Toshkent filiali", titleRu: "Ташкентский филиал", titleTr: "Taşkent şubesi" },
    { id: "branch-samarkand", titleUz: "Samarqand filiali", titleRu: "Самаркандский филиал", titleTr: "Semerkant şubesi" },
  ])

  await insertIfMissing(schema.roles, systemRoleTemplates.map((role) => ({
    id: `role-${role.code}`,
    code: role.code,
    titleUz: role.title.uz,
    titleRu: role.title.ru,
    titleTr: role.title.tr,
    isSystem: true,
    grantsAll: role.grantsAll ?? false,
  })))

  const systemRoleIds = systemRoleTemplates.map((role) => `role-${role.code}`)
  await db.delete(schema.rolePermissions)
    .where(inArray(schema.rolePermissions.roleId, systemRoleIds))
  await db.insert(schema.rolePermissions).values(systemRoleTemplates.flatMap((role) =>
    role.permissions.map((permissionCode) => ({
      roleId: `role-${role.code}`,
      permissionCode,
    })),
  )).onConflictDoNothing()

  await insertIfMissing(schema.users, [
    { id: "user-admin", fullName: "Factory Owner", positionId: "position-manager", username: "admin", phoneNumber: "+998 90 000 00 00" },
    { id: "user-applicant", fullName: "Aziza Karimova", positionId: "position-operator", username: "aziza.k", phoneNumber: "+998 90 123 45 67" },
    { id: "user-supervisor", fullName: "Javlon Mirzayev", positionId: "position-supervisor", username: "javlon.s", phoneNumber: "+998 90 111 11 11" },
    { id: "user-warehouse", fullName: "Bekzod Rahimov", positionId: "position-operator", username: "bekzod.w", phoneNumber: "+998 90 222 22 22" },
    { id: "user-warehouse-supervisor", fullName: "Kamoliddin Sobirov", positionId: "position-supervisor", username: "kamol.s", phoneNumber: "+998 90 242 42 42" },
    { id: "user-chief-engineer", fullName: "Rustam Yuldashev", positionId: "position-chief-engineer", username: "rustam.e", phoneNumber: "+998 90 232 32 32" },
    { id: "user-procurement", fullName: "Dilshod Usmonov", positionId: "position-manager", username: "dilshod.p", phoneNumber: "+998 90 333 33 33" },
    { id: "user-procurement-manager", fullName: "Nodira Ismoilova", positionId: "position-manager", username: "nodira.pm", phoneNumber: "+998 90 343 43 43" },
    { id: "user-procurement-specialist-2", fullName: "Akmal Raxmonov", positionId: "position-manager", username: "akmal.proc", phoneNumber: "+998 90 353 53 53" },
    { id: "user-finance", fullName: "Malika Tursunova", positionId: "position-manager", username: "malika.f", phoneNumber: "+998 90 444 44 44" },
    { id: "user-director", fullName: "Sardor Ergashev", positionId: "position-director", username: "sardor.d", phoneNumber: "+998 90 454 54 54" },
    { id: "user-observer", fullName: "Timur Saidov", positionId: "position-manager", username: "timur.o", phoneNumber: "+998 90 555 55 55" },
  ])

  await db.insert(schema.userRoles).values([
    { userId: "user-admin", roleId: "role-owner" },
    { userId: "user-applicant", roleId: "role-requester" },
    { userId: "user-supervisor", roleId: "role-dept_head" },
    { userId: "user-warehouse", roleId: "role-warehouse" },
    { userId: "user-warehouse-supervisor", roleId: "role-warehouse_head" },
    { userId: "user-chief-engineer", roleId: "role-deputy_director" },
    { userId: "user-procurement", roleId: "role-procurement_head" },
    { userId: "user-procurement-manager", roleId: "role-procurement_manager" },
    { userId: "user-procurement-specialist-2", roleId: "role-procurement_manager" },
    { userId: "user-finance", roleId: "role-finance_head" },
    { userId: "user-director", roleId: "role-director" },
    { userId: "user-observer", roleId: "role-observer" },
  ]).onConflictDoNothing()

  await insertIfMissing(schema.departments, [
    { id: "department-production", titleUz: "Ishlab chiqarish", titleRu: "Производство", titleTr: "Üretim", supervisorUserId: "user-supervisor" },
    { id: "department-procurement", titleUz: "Ta’minot", titleRu: "Снабжение", titleTr: "Tedarik", supervisorUserId: "user-procurement" },
  ])

  await db.insert(schema.departmentBranches).values([
    { departmentId: "department-production", branchId: "branch-tashkent" },
    { departmentId: "department-procurement", branchId: "branch-tashkent" },
    { departmentId: "department-procurement", branchId: "branch-samarkand" },
  ]).onConflictDoNothing()

  await db.insert(schema.userDepartments).values([
    { userId: "user-admin", departmentId: "department-production" },
    { userId: "user-applicant", departmentId: "department-production" },
    { userId: "user-applicant", departmentId: "department-procurement" },
    { userId: "user-supervisor", departmentId: "department-production" },
    { userId: "user-warehouse", departmentId: "department-production" },
    { userId: "user-warehouse-supervisor", departmentId: "department-production" },
    { userId: "user-chief-engineer", departmentId: "department-production" },
    { userId: "user-procurement", departmentId: "department-procurement" },
    { userId: "user-procurement-manager", departmentId: "department-procurement" },
    { userId: "user-procurement-specialist-2", departmentId: "department-procurement" },
    { userId: "user-finance", departmentId: "department-production" },
    { userId: "user-director", departmentId: "department-production" },
    { userId: "user-observer", departmentId: "department-production" },
  ]).onConflictDoNothing()

  await insertIfMissing(schema.unitTypes, [
    { id: "unit-piece", code: "PCS", sortOrder: 1, titleUz: "Dona", titleRu: "Штука", titleTr: "Adet" },
    { id: "unit-kilogram", code: "KG", sortOrder: 2, titleUz: "Kilogramm", titleRu: "Килограмм", titleTr: "Kilogram" },
    { id: "unit-meter", code: "M", sortOrder: 3, titleUz: "Metr", titleRu: "Метр", titleTr: "Metre" },
  ])

  await insertIfMissing(schema.productCategories, [
    { id: "category-material", titleUz: "Xomashyo", titleRu: "Сырьё", titleTr: "Hammadde" },
    { id: "category-finished", titleUz: "Tayyor mahsulot", titleRu: "Готовая продукция", titleTr: "Bitmiş ürün" },
  ])

  await insertIfMissing(schema.products, [
    { id: "product-steel", code: "MAT-001", categoryId: "category-material", unitTypeId: "unit-kilogram", titleUz: "Po‘lat", titleRu: "Сталь", titleTr: "Çelik" },
    { id: "product-copper-cable", code: "MAT-002", categoryId: "category-material", unitTypeId: "unit-meter", titleUz: "Mis kabel", titleRu: "Медный кабель", titleTr: "Bakır kablo" },
  ])

  await insertIfMissing(schema.orderPurposes, [
    { id: "purpose-production", titleUz: "Ishlab chiqarish ehtiyoji", titleRu: "Производственная потребность", titleTr: "Üretim ihtiyacı" },
    { id: "purpose-maintenance", titleUz: "Ta’mirlash va xizmat ko‘rsatish", titleRu: "Ремонт и обслуживание", titleTr: "Onarım ve bakım" },
  ])

  await insertIfMissing(schema.warehouses, [
    { id: "warehouse-main", titleUz: "Asosiy ombor", titleRu: "Основной склад", titleTr: "Ana depo", responsibleUserId: "user-warehouse" },
    { id: "warehouse-samarkand", titleUz: "Samarqand ombori", titleRu: "Самаркандский склад", titleTr: "Semerkant deposu", responsibleUserId: "user-warehouse" },
  ])

  await db.insert(schema.warehouseBranches).values([
    { warehouseId: "warehouse-main", branchId: "branch-tashkent" },
    { warehouseId: "warehouse-samarkand", branchId: "branch-samarkand" },
  ]).onConflictDoNothing()

  await db.insert(schema.departmentWarehouses).values([
    { departmentId: "department-production", warehouseId: "warehouse-main" },
    { departmentId: "department-procurement", warehouseId: "warehouse-main" },
    { departmentId: "department-procurement", warehouseId: "warehouse-samarkand" },
  ]).onConflictDoNothing()

  await insertIfMissing(schema.orders, [
    {
      id: "order-2026-0012", number: "ORD-2026-0012", type: "material", createdByUserId: "user-admin", requesterUserId: "user-admin",
      primaryDepartmentId: "department-production", warehouseId: "warehouse-main", purposeId: "purpose-production", expectedDate: "2026-08-22",
      urgency: "urgent", status: "in_review", comment: "Ishlab chiqarish liniyasi uchun.", submittedAt: "2026-08-20T09:30:00.000Z",
      createdAt: "2026-08-20T09:30:00.000Z", updatedAt: "2026-08-20T09:30:00.000Z",
    },
    {
      id: "order-2026-0011", number: "ORD-2026-0011", type: "service", createdByUserId: "user-applicant", requesterUserId: "user-applicant",
      primaryDepartmentId: "department-procurement", warehouseId: "warehouse-samarkand", purposeId: "purpose-maintenance", expectedDate: "2026-08-29",
      urgency: "normal", status: "approved", comment: "", submittedAt: "2026-08-19T11:15:00.000Z",
      createdAt: "2026-08-19T11:15:00.000Z", updatedAt: "2026-08-19T11:15:00.000Z",
    },
    {
      id: "order-2026-0010", number: "ORD-2026-0010", type: "material", createdByUserId: "user-applicant", requesterUserId: "user-applicant",
      primaryDepartmentId: "department-production", warehouseId: "warehouse-main", purposeId: "purpose-production", expectedDate: "2026-08-21",
      urgency: "critical", status: "rejected", comment: "", submittedAt: "2026-08-18T08:00:00.000Z",
      createdAt: "2026-08-18T08:00:00.000Z", updatedAt: "2026-08-18T08:00:00.000Z",
    },
  ])

  await db.insert(schema.orderDepartments).values([
    { orderId: "order-2026-0012", departmentId: "department-production" },
    { orderId: "order-2026-0011", departmentId: "department-procurement" },
    { orderId: "order-2026-0010", departmentId: "department-production" },
    { orderId: "order-2026-0010", departmentId: "department-procurement" },
  ]).onConflictDoNothing()

  await db.insert(schema.orderBranches).values([
    { orderId: "order-2026-0012", branchId: "branch-tashkent" },
    { orderId: "order-2026-0011", branchId: "branch-samarkand" },
    { orderId: "order-2026-0010", branchId: "branch-tashkent" },
    { orderId: "order-2026-0010", branchId: "branch-samarkand" },
  ]).onConflictDoNothing()

  await insertIfMissing(schema.orderLines, [
    { id: "line-0012-1", orderId: "order-2026-0012", productId: "product-steel", quantity: 500, note: "", sortOrder: 1 },
    { id: "line-0012-2", orderId: "order-2026-0012", productId: "product-copper-cable", quantity: 120, note: "", sortOrder: 2 },
    { id: "line-0011-1", orderId: "order-2026-0011", productId: "product-copper-cable", quantity: 40, note: "Montaj bilan", sortOrder: 1 },
    { id: "line-0010-1", orderId: "order-2026-0010", productId: "product-steel", quantity: 250, note: "Shoshilinch", sortOrder: 1 },
  ])

  await insertIfMissing(schema.workflowTemplates, [{
    id: "workflow-order-standard",
    code: "order-standard",
    titleUz: "Standart buyurtma marshruti",
    titleRu: "Стандартный маршрут заявки",
    titleTr: "Standart sipariş akışı",
  }])

  await insertIfMissing(schema.workflowTemplateVersions, [{
    id: "workflow-order-standard-v1",
    templateId: "workflow-order-standard",
    version: 1,
    status: "published",
    publishedAt: new Date().toISOString(),
    createdByUserId: "user-admin",
  }])

  await insertIfMissing(schema.workflowStepDefinitions, [
    { id: "workflow-step-department-supervisor", versionId: "workflow-order-standard-v1", stepOrder: 1, titleUz: "Bo‘lim rahbari", titleRu: "Руководитель отдела", titleTr: "Bölüm yöneticisi", kind: "approval", assigneeType: "department_supervisor", skipIfRequesterIsAssignee: true },
    { id: "workflow-step-warehouse", versionId: "workflow-order-standard-v1", stepOrder: 2, titleUz: "Ombor nazorati", titleRu: "Контроль склада", titleTr: "Depo kontrolü", kind: "approval", assigneeType: "warehouse_responsible", skipIfRequesterIsAssignee: true },
    { id: "workflow-step-chief-engineer", versionId: "workflow-order-standard-v1", stepOrder: 3, titleUz: "Bosh muhandis", titleRu: "Главный инженер", titleTr: "Baş mühendis", kind: "approval", assigneeType: "role", assigneeRoleId: "role-deputy_director", skipIfRequesterIsAssignee: true },
    { id: "workflow-step-procurement-accept", versionId: "workflow-order-standard-v1", stepOrder: 4, titleUz: "Ta’minot rahbari — qabul qilish", titleRu: "Руководитель снабжения — принятие заявки", titleTr: "Satın alma yöneticisi — talep kabulü", kind: "approval", assigneeType: "role", assigneeRoleId: "role-procurement_head", skipIfRequesterIsAssignee: true },
    { id: "workflow-step-sourcing", versionId: "workflow-order-standard-v1", stepOrder: 5, titleUz: "Ta’minotchi — qidiruv jarayoni", titleRu: "Снабженец — процесс поиска", titleTr: "Satın alma uzmanı — tedarik süreci", kind: "task", assigneeType: "role", assigneeRoleId: "role-procurement_manager", skipIfRequesterIsAssignee: false },
    { id: "workflow-step-price-check", versionId: "workflow-order-standard-v1", stepOrder: 6, titleUz: "Ta’minot rahbari — narx tekshiruvi", titleRu: "Руководитель снабжения — проверка цены", titleTr: "Satın alma yöneticisi — fiyat kontrolü", kind: "approval", assigneeType: "role", assigneeRoleId: "role-procurement_head", skipIfRequesterIsAssignee: true },
    { id: "workflow-step-director", versionId: "workflow-order-standard-v1", stepOrder: 7, titleUz: "Direktor", titleRu: "Директор", titleTr: "Direktör", kind: "approval", assigneeType: "role", assigneeRoleId: "role-director", skipIfRequesterIsAssignee: true },
    { id: "workflow-step-procurement-order", versionId: "workflow-order-standard-v1", stepOrder: 8, titleUz: "Ta’minotchi — buyurtmani rasmiylashtirish", titleRu: "Снабженец — оформление заказа", titleTr: "Satın alma uzmanı — sipariş oluşturma", kind: "task", assigneeType: "role", assigneeRoleId: "role-procurement_manager", skipIfRequesterIsAssignee: false },
    { id: "workflow-step-procurement-supervisor", versionId: "workflow-order-standard-v1", stepOrder: 9, titleUz: "Ta’minot rahbari — buyurtmani tasdiqlash", titleRu: "Руководитель снабжения — подтверждение заказа", titleTr: "Satın alma yöneticisi — sipariş onayı", kind: "approval", assigneeType: "role", assigneeRoleId: "role-procurement_head", skipIfRequesterIsAssignee: false },
    { id: "workflow-step-warehouse-receipt", versionId: "workflow-order-standard-v1", stepOrder: 10, titleUz: "Ombor — qabul qilish", titleRu: "Склад — приёмка", titleTr: "Depo — mal kabul", kind: "task", assigneeType: "warehouse_responsible", skipIfRequesterIsAssignee: false },
    { id: "workflow-step-warehouse-supervisor", versionId: "workflow-order-standard-v1", stepOrder: 11, titleUz: "Ombor rahbari — qabulni tasdiqlash", titleRu: "Руководитель склада — подтверждение приёмки", titleTr: "Depo yöneticisi — kabul onayı", kind: "approval", assigneeType: "role", assigneeRoleId: "role-warehouse_head", skipIfRequesterIsAssignee: false },
  ])

  await insertIfMissing(schema.workflowAssignmentRules, [{
    id: "workflow-rule-default",
    templateId: "workflow-order-standard",
    priority: 0,
    isActive: true,
  }])

  const configuredPassword = process.env.SEED_DEFAULT_PASSWORD
  if (process.env.NODE_ENV === "production" && !configuredPassword) {
    throw new Error("SEED_DEFAULT_PASSWORD must be set when seeding production")
  }
  const passwordHash = await hashPassword(configuredPassword ?? "FactoryOS123!")
  await db.update(schema.users)
    .set({ passwordHash })
    .where(isNull(schema.users.passwordHash))

  console.log(`Seeded Factory OS data into ${databaseUrl}`)
}

seed()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    client.close()
  })
