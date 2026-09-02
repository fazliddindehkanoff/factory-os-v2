import "server-only"

import { asc, eq } from "drizzle-orm"

import { db } from "@/db/client"
import {
  branches,
  departmentBranches,
  departments,
  departmentWarehouses,
  orderPurposes,
  positions,
  productCategories,
  products,
  rolePermissions,
  roles,
  unitTypes,
  userDepartments,
  userRoles,
  users,
  warehouseBranches,
  warehouses,
} from "@/db/schema"
import { permissionCodes, type PermissionCode } from "@/lib/rbac"
import type { SettingsData } from "@/lib/settings"

const permissionCodeSet = new Set<string>(permissionCodes)

function groupedIds(
  rows: readonly Record<string, string>[],
  ownerKey: string,
  valueKey: string,
) {
  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const values = grouped.get(row[ownerKey]) ?? []
    values.push(row[valueKey])
    grouped.set(row[ownerKey], values)
  }
  return grouped
}

export async function getSettingsData(): Promise<SettingsData> {
  const [
    positionRows,
    branchRows,
    roleRows,
    rolePermissionRows,
    userRows,
    userRoleRows,
    userDepartmentRows,
    departmentRows,
    departmentBranchRows,
    departmentWarehouseRows,
    unitTypeRows,
    categoryRows,
    productRows,
    purposeRows,
    warehouseRows,
    warehouseBranchRows,
  ] = await Promise.all([
    db.select().from(positions).orderBy(asc(positions.titleRu)),
    db.select().from(branches).orderBy(asc(branches.titleRu)),
    db.select().from(roles).orderBy(asc(roles.titleRu)),
    db.select().from(rolePermissions),
    db.select().from(users).where(eq(users.isActive, true)).orderBy(asc(users.fullName)),
    db.select().from(userRoles),
    db.select().from(userDepartments),
    db.select().from(departments).orderBy(asc(departments.titleRu)),
    db.select().from(departmentBranches),
    db.select().from(departmentWarehouses),
    db.select().from(unitTypes).orderBy(asc(unitTypes.sortOrder)),
    db.select().from(productCategories).orderBy(asc(productCategories.titleRu)),
    db.select().from(products).where(eq(products.isActive, true)).orderBy(asc(products.code)),
    db.select().from(orderPurposes).orderBy(asc(orderPurposes.titleRu)),
    db.select().from(warehouses).orderBy(asc(warehouses.titleRu)),
    db.select().from(warehouseBranches),
  ])

  const permissionsByRole = groupedIds(
    rolePermissionRows as unknown as Record<string, string>[],
    "roleId",
    "permissionCode",
  )
  const rolesByUser = groupedIds(
    userRoleRows as unknown as Record<string, string>[],
    "userId",
    "roleId",
  )
  const departmentsByUser = groupedIds(
    userDepartmentRows as unknown as Record<string, string>[],
    "userId",
    "departmentId",
  )
  const branchesByDepartment = groupedIds(
    departmentBranchRows as unknown as Record<string, string>[],
    "departmentId",
    "branchId",
  )
  const warehousesByDepartment = groupedIds(
    departmentWarehouseRows as unknown as Record<string, string>[],
    "departmentId",
    "warehouseId",
  )
  const branchesByWarehouse = groupedIds(
    warehouseBranchRows as unknown as Record<string, string>[],
    "warehouseId",
    "branchId",
  )

  return {
    positions: positionRows.map(({ id, titleUz, titleRu, titleTr }) => ({ id, titleUz, titleRu, titleTr })),
    branches: branchRows.map(({ id, titleUz, titleRu, titleTr }) => ({ id, titleUz, titleRu, titleTr })),
    roles: roleRows.map(({ id, code, titleUz, titleRu, titleTr, isSystem, grantsAll }) => ({
      id,
      code,
      titleUz,
      titleRu,
      titleTr,
      permissions: (permissionsByRole.get(id) ?? [])
        .filter((permission): permission is PermissionCode => permissionCodeSet.has(permission)),
      isSystem,
      grantsAll,
    })),
    users: userRows.map(({ id, fullName, positionId, username, passwordHash, telegramChatId, phoneNumber }) => ({
      id,
      fullName,
      positionId: positionId ?? "",
      username,
      password: passwordHash ? "••••••••" : "",
      telegramChatId: telegramChatId ?? "",
      phoneNumber: phoneNumber ?? "",
      departmentIds: departmentsByUser.get(id) ?? [],
      roleIds: rolesByUser.get(id) ?? [],
    })),
    departments: departmentRows.map(({ id, titleUz, titleRu, titleTr }) => ({
      id,
      titleUz,
      titleRu,
      titleTr,
      branchIds: branchesByDepartment.get(id) ?? [],
      warehouseIds: warehousesByDepartment.get(id) ?? [],
    })),
    "unit-types": unitTypeRows.map(({ id, code, sortOrder, titleUz, titleRu, titleTr }) => ({
      id,
      code,
      order: sortOrder,
      titleUz,
      titleRu,
      titleTr,
    })),
    "product-categories": categoryRows.map(({ id, titleUz, titleRu, titleTr }) => ({ id, titleUz, titleRu, titleTr })),
    products: productRows.map(({ id, code, categoryId, unitTypeId, titleUz, titleRu, titleTr }) => ({
      id,
      code,
      categoryId,
      unitTypeId: unitTypeId ?? undefined,
      titleUz,
      titleRu,
      titleTr,
    })),
    "order-purposes": purposeRows.map(({ id, titleUz, titleRu, titleTr }) => ({ id, titleUz, titleRu, titleTr })),
    warehouses: warehouseRows.map(({ id, titleUz, titleRu, titleTr, responsibleUserId }) => ({
      id,
      titleUz,
      titleRu,
      titleTr,
      branchIds: branchesByWarehouse.get(id) ?? [],
      responsibleUserId: responsibleUserId ?? "",
    })),
  }
}
