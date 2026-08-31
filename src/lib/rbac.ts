import type { Locale } from "@/lib/i18n"

export const permissionModules = [
  "requests",
  "approvals",
  "warehouse",
  "procurement",
  "suppliers",
  "finance",
  "admin",
  "audit",
  "reports",
] as const

export type PermissionModule = (typeof permissionModules)[number]

type LocalizedLabel = Record<Locale, string>

export const permissionCatalog = [
  { code: "requests.view", module: "requests", label: { uz: "Barcha buyurtmalarni ko‘rish", ru: "Просмотр всех заявок", tr: "Tüm siparişleri görüntüleme" } },
  { code: "requests.view_own", module: "requests", label: { uz: "Faqat o‘z buyurtmalarini ko‘rish", ru: "Просмотр только своих заявок", tr: "Yalnızca kendi siparişlerini görüntüleme" } },
  { code: "requests.create", module: "requests", label: { uz: "Buyurtma yaratish", ru: "Создание заявок", tr: "Sipariş oluşturma" } },
  { code: "requests.edit", module: "requests", label: { uz: "Buyurtmalarni tahrirlash", ru: "Редактирование заявок", tr: "Siparişleri düzenleme" } },
  { code: "requests.upload_attachment", module: "requests", label: { uz: "Fayllarni yuklash", ru: "Загрузка вложений", tr: "Dosya yükleme" } },
  { code: "approvals.approve", module: "approvals", label: { uz: "Tasdiqlash", ru: "Согласование", tr: "Onaylama" } },
  { code: "approvals.reject", module: "approvals", label: { uz: "Rad etish", ru: "Отклонение", tr: "Reddetme" } },
  { code: "approvals.override", module: "approvals", label: { uz: "Jarayonni bekor qilish", ru: "Override (учредитель)", tr: "Süreci geçersiz kılma" } },
  { code: "warehouse.view", module: "warehouse", label: { uz: "Omborni ko‘rish", ru: "Просмотр склада", tr: "Depoyu görüntüleme" } },
  { code: "warehouse.check_stock", module: "warehouse", label: { uz: "Mavjudlikni tekshirish", ru: "Проверка наличия", tr: "Stok kontrolü" } },
  { code: "warehouse.receive", module: "warehouse", label: { uz: "Qabul qilish", ru: "Приёмка", tr: "Mal kabul" } },
  { code: "warehouse.issue", module: "warehouse", label: { uz: "Ombordan berish", ru: "Выдача со склада", tr: "Depodan çıkış" } },
  { code: "materials.manage", module: "warehouse", label: { uz: "Nomenklaturani boshqarish", ru: "Управление номенклатурой", tr: "Malzeme kataloğunu yönetme" } },
  { code: "procurement.view", module: "procurement", label: { uz: "Xaridlarni ko‘rish", ru: "Просмотр закупок", tr: "Satın almayı görüntüleme" } },
  { code: "procurement.quote", module: "procurement", label: { uz: "Tijorat taklifini kiritish", ru: "Ввод КП", tr: "Teklif girişi" } },
  { code: "procurement.select_supplier", module: "procurement", label: { uz: "Yetkazib beruvchini tanlash", ru: "Выбор поставщика", tr: "Tedarikçi seçimi" } },
  { code: "suppliers.view", module: "suppliers", label: { uz: "Yetkazib beruvchilarni ko‘rish", ru: "Просмотр поставщиков", tr: "Tedarikçileri görüntüleme" } },
  { code: "suppliers.manage", module: "suppliers", label: { uz: "Yetkazib beruvchilarni boshqarish", ru: "Управление поставщиками", tr: "Tedarikçileri yönetme" } },
  { code: "finance.view", module: "finance", label: { uz: "Moliyani ko‘rish", ru: "Просмотр финансов", tr: "Finansı görüntüleme" } },
  { code: "finance.mark_paid", module: "finance", label: { uz: "To‘langan deb belgilash", ru: "Отметка об оплате", tr: "Ödendi olarak işaretleme" } },
  { code: "users.view", module: "admin", label: { uz: "Foydalanuvchilarni ko‘rish", ru: "Просмотр пользователей", tr: "Kullanıcıları görüntüleme" } },
  { code: "users.manage", module: "admin", label: { uz: "Foydalanuvchilarni boshqarish", ru: "Управление пользователями", tr: "Kullanıcıları yönetme" } },
  { code: "roles.manage", module: "admin", label: { uz: "Rollar va ruxsatlarni boshqarish", ru: "Управление ролями и правами", tr: "Rolleri ve izinleri yönetme" } },
  { code: "workflows.manage", module: "admin", label: { uz: "Jarayonlarni boshqarish", ru: "Управление workflow", tr: "İş akışlarını yönetme" } },
  { code: "settings.manage", module: "admin", label: { uz: "Sozlamalarni boshqarish", ru: "Управление настройками", tr: "Ayarları yönetme" } },
  { code: "audit.view", module: "audit", label: { uz: "Auditni ko‘rish", ru: "Просмотр аудита", tr: "Denetimi görüntüleme" } },
  { code: "reports.view", module: "reports", label: { uz: "Hisobotlarni ko‘rish", ru: "Просмотр отчётов", tr: "Raporları görüntüleme" } },
  { code: "reports.status_summary", module: "reports", label: { uz: "Holatlar bo‘yicha xulosa", ru: "Сводка по статусам заявок", tr: "Sipariş durum özeti" } },
] as const satisfies readonly {
  code: string
  module: PermissionModule
  label: LocalizedLabel
}[]

export type PermissionCode = (typeof permissionCatalog)[number]["code"]

export const permissionCodes = permissionCatalog.map((permission) => permission.code) as PermissionCode[]

export const permissionModuleLabels: Record<PermissionModule, LocalizedLabel> = {
  requests: { uz: "Buyurtmalar", ru: "Заявки", tr: "Siparişler" },
  approvals: { uz: "Tasdiqlash", ru: "Согласования", tr: "Onaylar" },
  warehouse: { uz: "Ombor", ru: "Склад", tr: "Depo" },
  procurement: { uz: "Xaridlar", ru: "Закупки", tr: "Satın alma" },
  suppliers: { uz: "Yetkazib beruvchilar", ru: "Поставщики", tr: "Tedarikçiler" },
  finance: { uz: "Moliya", ru: "Финансы", tr: "Finans" },
  admin: { uz: "Ma’muriyat", ru: "Администрирование", tr: "Yönetim" },
  audit: { uz: "Audit", ru: "Аудит", tr: "Denetim" },
  reports: { uz: "Hisobotlar", ru: "Отчёты", tr: "Raporlar" },
}

export type SystemRoleTemplate = {
  code: string
  title: LocalizedLabel
  permissions: readonly PermissionCode[]
  grantsAll?: boolean
}

export const systemRoleTemplates: readonly SystemRoleTemplate[] = [
  { code: "owner", title: { uz: "Ta’sischi", ru: "Учредитель", tr: "Kurucu" }, permissions: permissionCodes, grantsAll: true },
  { code: "admin", title: { uz: "Administrator", ru: "Администратор", tr: "Yönetici" }, permissions: ["reports.status_summary", "users.view", "users.manage", "roles.manage", "workflows.manage", "settings.manage", "audit.view", "requests.view", "requests.view_own", "reports.view", "suppliers.view", "suppliers.manage"] },
  { code: "director", title: { uz: "Direktor", ru: "Директор", tr: "Direktör" }, permissions: ["reports.status_summary", "requests.view", "approvals.approve", "approvals.reject", "approvals.override", "finance.view", "reports.view", "users.view"] },
  { code: "finance", title: { uz: "Moliyachi", ru: "Финансист", tr: "Finans uzmanı" }, permissions: ["reports.status_summary", "requests.view", "approvals.approve", "approvals.reject", "finance.view", "finance.mark_paid"] },
  { code: "procurement", title: { uz: "Ta’minot", ru: "Снабжение", tr: "Satın alma" }, permissions: ["reports.status_summary", "requests.view", "procurement.view", "procurement.quote", "requests.upload_attachment", "suppliers.view", "suppliers.manage"] },
  { code: "warehouse", title: { uz: "Ombor", ru: "Склад", tr: "Depo" }, permissions: ["reports.status_summary", "requests.view", "approvals.approve", "approvals.reject", "warehouse.view", "warehouse.check_stock", "warehouse.receive", "warehouse.issue"] },
  { code: "warehouse_head", title: { uz: "Ombor rahbari", ru: "Руководитель склада", tr: "Depo yöneticisi" }, permissions: ["reports.status_summary", "requests.view", "approvals.approve", "approvals.reject", "warehouse.view", "warehouse.check_stock", "warehouse.receive", "warehouse.issue", "reports.view"] },
  { code: "dept_head", title: { uz: "Bo‘lim rahbari", ru: "Руководитель отдела", tr: "Bölüm yöneticisi" }, permissions: ["reports.status_summary", "requests.view", "requests.create", "approvals.approve", "approvals.reject"] },
  { code: "requester", title: { uz: "Assistant", ru: "Assistant", tr: "Assistant" }, permissions: ["requests.view_own", "requests.create", "requests.upload_attachment"] },
  { code: "warehouse_worker", title: { uz: "Ombor xodimi", ru: "Работник склада", tr: "Depo çalışanı" }, permissions: ["reports.status_summary", "requests.view", "warehouse.view", "warehouse.check_stock", "warehouse.receive", "warehouse.issue"] },
  { code: "procurement_head", title: { uz: "Ta’minot rahbari", ru: "Руководитель снабжения", tr: "Satın alma yöneticisi" }, permissions: ["reports.status_summary", "requests.view", "reports.view", "procurement.view", "procurement.quote", "procurement.select_supplier", "requests.upload_attachment", "suppliers.view", "suppliers.manage", "approvals.approve", "approvals.reject"] },
  { code: "finance_head", title: { uz: "Moliya rahbari", ru: "Руководитель финансов", tr: "Finans yöneticisi" }, permissions: ["reports.status_summary", "requests.view", "reports.view", "finance.view", "finance.mark_paid", "approvals.approve", "approvals.reject"] },
  { code: "deputy_director", title: { uz: "Bosh muhandis", ru: "Главный инженер", tr: "Baş mühendis" }, permissions: ["reports.status_summary", "requests.view", "reports.view", "finance.view", "approvals.approve", "approvals.reject"] },
  { code: "executive_director", title: { uz: "Ijrochi direktor", ru: "Исполнительный директор", tr: "İcra direktörü" }, permissions: ["reports.status_summary", "requests.view", "reports.view", "finance.view", "approvals.approve", "approvals.reject"] },
  { code: "operations_lead", title: { uz: "Joriy etish rahbari", ru: "Руководитель внедрения", tr: "Uygulama yöneticisi" }, permissions: ["reports.status_summary", "requests.view", "requests.create", "reports.view", "audit.view", "warehouse.view", "procurement.view", "finance.view", "workflows.manage", "settings.manage"] },
  { code: "procurement_manager", title: { uz: "Ta’minot menejeri", ru: "Менеджер по снабжению", tr: "Satın alma uzmanı" }, permissions: ["reports.status_summary", "requests.view", "procurement.view", "procurement.quote", "requests.upload_attachment", "suppliers.view", "suppliers.manage"] },
  { code: "finance_manager", title: { uz: "Moliya menejeri", ru: "Финансовый менеджер", tr: "Finans yöneticisi" }, permissions: ["reports.status_summary", "requests.view", "finance.view", "finance.mark_paid"] },
  { code: "accountant", title: { uz: "Buxgalter", ru: "Бухгалтер", tr: "Muhasebeci" }, permissions: ["reports.status_summary", "requests.view", "finance.view"] },
  { code: "auditor", title: { uz: "Auditor", ru: "Аудитор", tr: "Denetçi" }, permissions: ["reports.status_summary", "requests.view", "reports.view", "audit.view", "suppliers.view"] },
  { code: "observer", title: { uz: "Kuzatuvchi", ru: "Наблюдатель", tr: "Gözlemci" }, permissions: ["reports.status_summary", "requests.view", "reports.view"] },
]

export type PermissionGrant = {
  permissions: readonly PermissionCode[]
  grantsAll?: boolean
}

export function hasPermission(grants: readonly PermissionGrant[], permission: PermissionCode) {
  return grants.some((grant) => grant.grantsAll || grant.permissions.includes(permission))
}

export function hasAnyPermission(
  grants: readonly PermissionGrant[],
  permissions: readonly PermissionCode[],
) {
  return permissions.some((permission) => hasPermission(grants, permission))
}

export function getPermissionLabel(code: PermissionCode, locale: Locale) {
  return permissionCatalog.find((permission) => permission.code === code)?.label[locale] ?? code
}
