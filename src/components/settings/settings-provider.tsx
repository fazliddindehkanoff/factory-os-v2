"use client"

import * as React from "react"

import { hasPermission, systemRoleTemplates, type PermissionCode } from "@/lib/rbac"
import type { LocalizedTitle, SettingsData, SettingsSection } from "@/lib/settings"

const systemRoles: SettingsData["roles"] = systemRoleTemplates.map((role) => ({
  id: `role-${role.code}`,
  code: role.code,
  titleUz: role.title.uz,
  titleRu: role.title.ru,
  titleTr: role.title.tr,
  permissions: [...role.permissions],
  isSystem: true,
  grantsAll: role.grantsAll,
}))

const initialSettingsData: SettingsData = {
  positions: [
    {
      id: "position-manager",
      titleUz: "Menejer",
      titleRu: "Менеджер",
      titleTr: "Yönetici",
    },
    {
      id: "position-operator",
      titleUz: "Operator",
      titleRu: "Оператор",
      titleTr: "Operatör",
    },
    {
      id: "position-supervisor",
      titleUz: "Bo‘lim rahbari",
      titleRu: "Руководитель отдела",
      titleTr: "Bölüm yöneticisi",
    },
    {
      id: "position-chief-engineer",
      titleUz: "Bosh muhandis",
      titleRu: "Главный инженер",
      titleTr: "Baş mühendis",
    },
    {
      id: "position-director",
      titleUz: "Direktor",
      titleRu: "Директор",
      titleTr: "Direktör",
    },
  ],
  branches: [
    {
      id: "branch-tashkent",
      titleUz: "Toshkent filiali",
      titleRu: "Ташкентский филиал",
      titleTr: "Taşkent şubesi",
    },
    {
      id: "branch-samarkand",
      titleUz: "Samarqand filiali",
      titleRu: "Самаркандский филиал",
      titleTr: "Semerkant şubesi",
    },
  ],
  "unit-types": [
    {
      id: "unit-piece",
      code: "PCS",
      order: 1,
      titleUz: "Dona",
      titleRu: "Штука",
      titleTr: "Adet",
    },
    {
      id: "unit-kilogram",
      code: "KG",
      order: 2,
      titleUz: "Kilogramm",
      titleRu: "Килограмм",
      titleTr: "Kilogram",
    },
    {
      id: "unit-meter",
      code: "M",
      order: 3,
      titleUz: "Metr",
      titleRu: "Метр",
      titleTr: "Metre",
    },
  ],
  "product-categories": [
    {
      id: "category-material",
      titleUz: "Xomashyo",
      titleRu: "Сырьё",
      titleTr: "Hammadde",
    },
    {
      id: "category-finished",
      titleUz: "Tayyor mahsulot",
      titleRu: "Готовая продукция",
      titleTr: "Bitmiş ürün",
    },
  ],
  "order-purposes": [
    {
      id: "purpose-production",
      titleUz: "Ishlab chiqarish ehtiyoji",
      titleRu: "Производственная потребность",
      titleTr: "Üretim ihtiyacı",
    },
    {
      id: "purpose-maintenance",
      titleUz: "Ta’mirlash va xizmat ko‘rsatish",
      titleRu: "Ремонт и обслуживание",
      titleTr: "Onarım ve bakım",
    },
  ],
  products: [
    {
      id: "product-steel",
      code: "MAT-001",
      categoryId: "category-material",
      unitTypeId: "unit-kilogram",
      titleUz: "Po‘lat",
      titleRu: "Сталь",
      titleTr: "Çelik",
    },
    {
      id: "product-copper-cable",
      code: "MAT-002",
      categoryId: "category-material",
      unitTypeId: "unit-meter",
      titleUz: "Mis kabel",
      titleRu: "Медный кабель",
      titleTr: "Bakır kablo",
    },
  ],
  roles: systemRoles,
  warehouses: [
    {
      id: "warehouse-main",
      titleUz: "Asosiy ombor",
      titleRu: "Основной склад",
      titleTr: "Ana depo",
      branchIds: ["branch-tashkent"],
      responsibleUserId: "user-warehouse",
    },
    {
      id: "warehouse-samarkand",
      titleUz: "Samarqand ombori",
      titleRu: "Самаркандский склад",
      titleTr: "Semerkant deposu",
      branchIds: ["branch-samarkand"],
      responsibleUserId: "user-warehouse",
    },
  ],
  departments: [
    {
      id: "department-production",
      titleUz: "Ishlab chiqarish",
      titleRu: "Производство",
      titleTr: "Üretim",
      branchIds: ["branch-tashkent"],
      warehouseIds: ["warehouse-main"],
    },
    {
      id: "department-procurement",
      titleUz: "Ta’minot",
      titleRu: "Снабжение",
      titleTr: "Tedarik",
      branchIds: ["branch-tashkent", "branch-samarkand"],
      warehouseIds: ["warehouse-main", "warehouse-samarkand"],
    },
  ],
  users: [
    {
      id: "user-admin",
      fullName: "Factory Owner",
      positionId: "position-manager",
      username: "admin",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 000 00 00",
      departmentIds: ["department-production"],
      roleIds: ["role-owner"],
    },
    {
      id: "user-applicant",
      fullName: "Aziza Karimova",
      positionId: "position-operator",
      username: "aziza.k",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 123 45 67",
      departmentIds: ["department-production", "department-procurement"],
      roleIds: ["role-requester"],
    },
    {
      id: "user-supervisor",
      fullName: "Javlon Mirzayev",
      positionId: "position-supervisor",
      username: "javlon.s",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 111 11 11",
      departmentIds: ["department-production"],
      roleIds: ["role-dept_head"],
    },
    {
      id: "user-warehouse",
      fullName: "Bekzod Rahimov",
      positionId: "position-operator",
      username: "bekzod.w",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 222 22 22",
      departmentIds: ["department-production"],
      roleIds: ["role-warehouse"],
    },
    {
      id: "user-procurement",
      fullName: "Dilshod Usmonov",
      positionId: "position-manager",
      username: "dilshod.p",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 333 33 33",
      departmentIds: ["department-procurement"],
      roleIds: ["role-procurement_head"],
    },
    {
      id: "user-chief-engineer",
      fullName: "Rustam Yuldashev",
      positionId: "position-chief-engineer",
      username: "rustam.e",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 232 32 32",
      departmentIds: ["department-production"],
      roleIds: ["role-deputy_director"],
    },
    {
      id: "user-procurement-manager",
      fullName: "Nodira Ismoilova",
      positionId: "position-manager",
      username: "nodira.pm",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 343 43 43",
      departmentIds: ["department-procurement"],
      roleIds: ["role-procurement_manager"],
    },
    {
      id: "user-procurement-specialist-2",
      fullName: "Akmal Raxmonov",
      positionId: "position-manager",
      username: "akmal.proc",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 353 53 53",
      departmentIds: ["department-procurement"],
      roleIds: ["role-procurement_manager"],
    },
    {
      id: "user-finance",
      fullName: "Malika Tursunova",
      positionId: "position-manager",
      username: "malika.f",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 444 44 44",
      departmentIds: ["department-production"],
      roleIds: ["role-finance_head"],
    },
    {
      id: "user-observer",
      fullName: "Timur Saidov",
      positionId: "position-manager",
      username: "timur.o",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 555 55 55",
      departmentIds: ["department-production"],
      roleIds: ["role-observer"],
    },
    {
      id: "user-director",
      fullName: "Sardor Ergashev",
      positionId: "position-director",
      username: "sardor.d",
      password: "••••••••",
      telegramChatId: "",
      phoneNumber: "+998 90 454 54 54",
      departmentIds: ["department-production"],
      roleIds: ["role-director"],
    },
  ],
}

type SettingsContextValue = {
  data: SettingsData
  currentUserId: string
  addRecord: <K extends SettingsSection>(
    section: K,
    record: SettingsData[K][number],
  ) => void
  updateRecord: <K extends SettingsSection>(
    section: K,
    record: SettingsData[K][number],
  ) => void
  deleteRecord: (section: SettingsSection, id: string) => void
  updateLocalizedTitles: (
    section: Exclude<SettingsSection, "users">,
    id: string,
    titles: LocalizedTitle,
  ) => void
  reorderUnitType: (activeId: string, overId: string) => void
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null)

export function SettingsProvider({
  children,
  initialCurrentUserId = "user-admin",
}: {
  children: React.ReactNode
  initialCurrentUserId?: string
}) {
  const [data, setData] = React.useState(initialSettingsData)
  const [currentUserId] = React.useState(initialCurrentUserId)
  const currentUser = data.users.find((user) => user.id === currentUserId)
  const currentRoles = data.roles.filter((role) => currentUser?.roleIds.includes(role.id))

  function can(permission: PermissionCode) {
    return hasPermission(currentRoles, permission)
  }

  function canManageSection(section: SettingsSection) {
    if (section === "roles") return can("roles.manage")
    if (section === "users") return can("users.manage")
    return can("settings.manage")
  }

  function addRecord<K extends SettingsSection>(
    section: K,
    record: SettingsData[K][number],
  ) {
    if (!canManageSection(section)) return
    setData((current) => ({
      ...current,
      [section]: [...current[section], record],
    }))
  }

  function updateRecord<K extends SettingsSection>(
    section: K,
    record: SettingsData[K][number],
  ) {
    if (!canManageSection(section)) return
    setData((current) => ({
      ...current,
      [section]: current[section].map((item) =>
        item.id === record.id ? record : item,
      ),
    }))
  }

  function deleteRecord(section: SettingsSection, id: string) {
    if (!canManageSection(section)) return
    setData((current) => {
      const nextSection = current[section].filter((item) => item.id !== id)

      if (section === "unit-types") {
        return {
          ...current,
          "unit-types": current["unit-types"]
            .filter((item) => item.id !== id)
            .sort((a, b) => a.order - b.order)
            .map((item, index) => ({ ...item, order: index + 1 })),
        }
      }

      return { ...current, [section]: nextSection }
    })
  }

  function updateLocalizedTitles(
    section: Exclude<SettingsSection, "users">,
    id: string,
    titles: LocalizedTitle,
  ) {
    if (!canManageSection(section)) return
    setData((current) => ({
      ...current,
      [section]: current[section].map((item) =>
        item.id === id ? { ...item, ...titles } : item,
      ),
    }))
  }

  function reorderUnitType(activeId: string, overId: string) {
    if (!can("settings.manage")) return
    setData((current) => {
      const units = [...current["unit-types"]].sort((a, b) => a.order - b.order)
      const currentIndex = units.findIndex((item) => item.id === activeId)
      const nextIndex = units.findIndex((item) => item.id === overId)

      if (currentIndex < 0 || nextIndex < 0 || currentIndex === nextIndex) {
        return current
      }

      const [movedUnit] = units.splice(currentIndex, 1)
      units.splice(nextIndex, 0, movedUnit)

      return {
        ...current,
        "unit-types": units.map((unit, index) => ({ ...unit, order: index + 1 })),
      }
    })
  }

  return (
    <SettingsContext.Provider
      value={{ data, currentUserId, addRecord, updateRecord, deleteRecord, updateLocalizedTitles, reorderUnitType }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = React.useContext(SettingsContext)
  if (!context) throw new Error("useSettings must be used within SettingsProvider")
  return context
}
