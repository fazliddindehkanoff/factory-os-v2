import { NextResponse } from "next/server"

import { databaseClient } from "@/db/client"
import { userHasPermission } from "@/lib/auth/authorization"
import { getSessionUser } from "@/lib/auth/session"
import { isSettingsSection } from "@/lib/settings"
import { permissionCodes } from "@/lib/rbac"
import {
  classifySettingsDeleteError,
  getSettingsDeletePermission,
  settingsDeleteTable,
  type SettingsDeleteError,
} from "@/lib/settings-delete"
import { parseSettingsRecordUpdate } from "@/lib/settings-record-update"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const permissionCodeSet = new Set<string>(permissionCodes)

function errorResponse(error: SettingsDeleteError, status: number) {
  return NextResponse.json({ error }, { status })
}

async function idsExist(table: "branches" | "warehouses", ids: string[]) {
  if (!ids.length) return true
  const placeholders = ids.map(() => "?").join(", ")
  const result = await databaseClient.execute({
    sql: `SELECT id FROM ${table} WHERE id IN (${placeholders})`,
    args: ids,
  })
  return result.rows.length === ids.length
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/settings/records/[section]/[id]">,
) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { section, id } = await context.params
  if (!isSettingsSection(section) || section === "users" || !id || id.length > 200) {
    return NextResponse.json({ error: "invalid-record" }, { status: 400 })
  }
  if (!await userHasPermission(session.userId, getSettingsDeletePermission(section))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  const parsed = parseSettingsRecordUpdate(section, await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const input = parsed.value
  if (section === "roles" && input.permissions!.some((permission) => !permissionCodeSet.has(permission))) {
    return NextResponse.json({ error: "invalid-record" }, { status: 400 })
  }

  const titleArgs = [input.titleUz, input.titleRu, input.titleTr]
  try {
    if (section === "positions") {
      await databaseClient.execute({
        sql: "INSERT INTO positions (id, code, title_uz, title_ru, title_tr) VALUES (?, ?, ?, ?, ?)",
        args: [id, `custom-${id}`.slice(0, 100), ...titleArgs],
      })
    } else if (["product-categories", "order-purposes", "branches"].includes(section)) {
      await databaseClient.execute({
        sql: `INSERT INTO ${settingsDeleteTable[section]} (id, title_uz, title_ru, title_tr) VALUES (?, ?, ?, ?)`,
        args: [id, ...titleArgs],
      })
    } else if (section === "unit-types") {
      await databaseClient.execute({
        sql: "INSERT INTO unit_types (id, code, sort_order, title_uz, title_ru, title_tr) VALUES (?, ?, ?, ?, ?, ?)",
        args: [id, input.code!, input.order!, ...titleArgs],
      })
    } else if (section === "products") {
      const references = await databaseClient.execute({
        sql: `SELECT
          EXISTS(SELECT 1 FROM product_categories WHERE id = ?) AS category_exists,
          CASE WHEN ? IS NULL THEN 1 ELSE EXISTS(SELECT 1 FROM unit_types WHERE id = ?) END AS unit_exists`,
        args: [input.categoryId!, input.unitTypeId ?? null, input.unitTypeId ?? null],
      })
      if (!references.rows[0]?.category_exists || !references.rows[0]?.unit_exists) {
        return NextResponse.json({ error: "invalid-reference" }, { status: 400 })
      }
      await databaseClient.execute({
        sql: "INSERT INTO products (id, code, category_id, unit_type_id, title_uz, title_ru, title_tr) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [id, input.code!, input.categoryId!, input.unitTypeId ?? null, ...titleArgs],
      })
    } else if (section === "roles") {
      await databaseClient.batch([
        {
          sql: "INSERT INTO roles (id, code, title_uz, title_ru, title_tr, is_system, grants_all) VALUES (?, ?, ?, ?, ?, 0, 0)",
          args: [id, input.code!, ...titleArgs],
        },
        ...input.permissions!.map((permission) => ({
          sql: "INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)",
          args: [id, permission],
        })),
      ], "write")
    } else if (section === "warehouses") {
      if (!await idsExist("branches", input.branchIds!)) {
        return NextResponse.json({ error: "invalid-reference" }, { status: 400 })
      }
      if (input.responsibleUserId) {
        const user = await databaseClient.execute({
          sql: "SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1",
          args: [input.responsibleUserId],
        })
        if (!user.rows.length) return NextResponse.json({ error: "invalid-reference" }, { status: 400 })
      }
      await databaseClient.batch([
        {
          sql: "INSERT INTO warehouses (id, title_uz, title_ru, title_tr, responsible_user_id) VALUES (?, ?, ?, ?, ?)",
          args: [id, ...titleArgs, input.responsibleUserId || null],
        },
        ...input.branchIds!.map((branchId) => ({
          sql: "INSERT INTO warehouse_branches (warehouse_id, branch_id) VALUES (?, ?)",
          args: [id, branchId],
        })),
      ], "write")
    } else if (section === "departments") {
      if (!await idsExist("branches", input.branchIds!) || !await idsExist("warehouses", input.warehouseIds!)) {
        return NextResponse.json({ error: "invalid-reference" }, { status: 400 })
      }
      await databaseClient.batch([
        {
          sql: "INSERT INTO departments (id, title_uz, title_ru, title_tr) VALUES (?, ?, ?, ?)",
          args: [id, ...titleArgs],
        },
        ...input.branchIds!.map((branchId) => ({
          sql: "INSERT INTO department_branches (department_id, branch_id) VALUES (?, ?)",
          args: [id, branchId],
        })),
        ...input.warehouseIds!.map((warehouseId) => ({
          sql: "INSERT INTO department_warehouses (department_id, warehouse_id) VALUES (?, ?)",
          args: [id, warehouseId],
        })),
      ], "write")
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLocaleLowerCase() : ""
    if (message.includes("unique constraint failed")) {
      return NextResponse.json({ error: "code-exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "record-create-failed" }, { status: 500 })
  }

  return NextResponse.json({
    record: {
      id,
      ...input,
      ...(section === "roles" ? { isSystem: false, grantsAll: false } : {}),
    },
  }, { status: 201 })
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/settings/records/[section]/[id]">,
) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { section, id } = await context.params
  if (!isSettingsSection(section) || section === "users" || !id) {
    return NextResponse.json({ error: "invalid-record" }, { status: 400 })
  }
  if (!await userHasPermission(session.userId, getSettingsDeletePermission(section))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid-record" }, { status: 400 })
  }
  const parsed = parseSettingsRecordUpdate(section, body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const input = parsed.value
  if (section === "roles" && input.permissions!.some((permission) => !permissionCodeSet.has(permission))) {
    return NextResponse.json({ error: "invalid-record" }, { status: 400 })
  }
  const table = settingsDeleteTable[section]
  const existing = await databaseClient.execute({
    sql: `SELECT * FROM ${table} WHERE id = ? LIMIT 1`,
    args: [id],
  })
  if (!existing.rows.length) return errorResponse("record-not-found", 404)

  const titleArgs = [input.titleUz, input.titleRu, input.titleTr]
  const updateLocalizedSql = `
    UPDATE ${table}
    SET title_uz = ?, title_ru = ?, title_tr = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `

  try {
    if (["positions", "product-categories", "order-purposes", "branches"].includes(section)) {
      await databaseClient.execute({ sql: updateLocalizedSql, args: [...titleArgs, id] })
    } else if (section === "unit-types") {
      await databaseClient.execute({
        sql: `UPDATE unit_types SET code = ?, sort_order = ?, title_uz = ?, title_ru = ?, title_tr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [input.code!, input.order!, ...titleArgs, id],
      })
    } else if (section === "products") {
      const categoryExists = await databaseClient.execute({
        sql: "SELECT id FROM product_categories WHERE id = ? LIMIT 1",
        args: [input.categoryId!],
      })
      if (!categoryExists.rows.length) return NextResponse.json({ error: "invalid-reference" }, { status: 400 })
      await databaseClient.execute({
        sql: `UPDATE products SET code = ?, category_id = ?, unit_type_id = ?, title_uz = ?, title_ru = ?, title_tr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [input.code!, input.categoryId!, input.unitTypeId ?? null, ...titleArgs, id],
      })
    } else if (section === "roles") {
      const existingRole = existing.rows[0]
      if (existingRole.is_system && input.code !== existingRole.code) {
        return errorResponse("protected-record", 409)
      }
      await databaseClient.batch([
        {
          sql: `UPDATE roles SET code = ?, title_uz = ?, title_ru = ?, title_tr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [input.code!, ...titleArgs, id],
        },
        { sql: "DELETE FROM role_permissions WHERE role_id = ?", args: [id] },
        ...input.permissions!.map((permission) => ({
          sql: "INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)",
          args: [id, permission],
        })),
      ], "write")
    } else if (section === "warehouses") {
      if (!await idsExist("branches", input.branchIds!)) {
        return NextResponse.json({ error: "invalid-reference" }, { status: 400 })
      }
      if (input.responsibleUserId) {
        const user = await databaseClient.execute({
          sql: "SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1",
          args: [input.responsibleUserId],
        })
        if (!user.rows.length) return NextResponse.json({ error: "invalid-reference" }, { status: 400 })
      }
      await databaseClient.batch([
        {
          sql: `UPDATE warehouses SET title_uz = ?, title_ru = ?, title_tr = ?, responsible_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [...titleArgs, input.responsibleUserId || null, id],
        },
        { sql: "DELETE FROM warehouse_branches WHERE warehouse_id = ?", args: [id] },
        ...input.branchIds!.map((branchId) => ({
          sql: "INSERT INTO warehouse_branches (warehouse_id, branch_id) VALUES (?, ?)",
          args: [id, branchId],
        })),
      ], "write")
    } else if (section === "departments") {
      if (!await idsExist("branches", input.branchIds!) || !await idsExist("warehouses", input.warehouseIds!)) {
        return NextResponse.json({ error: "invalid-reference" }, { status: 400 })
      }
      await databaseClient.batch([
        {
          sql: `UPDATE departments SET title_uz = ?, title_ru = ?, title_tr = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [...titleArgs, id],
        },
        { sql: "DELETE FROM department_branches WHERE department_id = ?", args: [id] },
        { sql: "DELETE FROM department_warehouses WHERE department_id = ?", args: [id] },
        ...input.branchIds!.map((branchId) => ({
          sql: "INSERT INTO department_branches (department_id, branch_id) VALUES (?, ?)",
          args: [id, branchId],
        })),
        ...input.warehouseIds!.map((warehouseId) => ({
          sql: "INSERT INTO department_warehouses (department_id, warehouse_id) VALUES (?, ?)",
          args: [id, warehouseId],
        })),
      ], "write")
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLocaleLowerCase() : ""
    if (message.includes("unique constraint failed")) {
      return NextResponse.json({ error: "code-exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "record-update-failed" }, { status: 500 })
  }

  return NextResponse.json({
    record: {
      id,
      ...input,
      ...(section === "roles" ? {
        isSystem: Boolean(existing.rows[0].is_system),
        grantsAll: Boolean(existing.rows[0].grants_all),
      } : {}),
    },
  })
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/settings/records/[section]/[id]">,
) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { section, id } = await context.params
  if (!isSettingsSection(section) || !id) {
    return NextResponse.json({ error: "invalid-record" }, { status: 400 })
  }
  if (!await userHasPermission(session.userId, getSettingsDeletePermission(section))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (section === "users" && id === session.userId) {
    return errorResponse("cannot-delete-current-user", 409)
  }

  const table = settingsDeleteTable[section]
  if (section === "roles") {
    const role = await databaseClient.execute({
      sql: "SELECT is_system FROM roles WHERE id = ? LIMIT 1",
      args: [id],
    })
    if (role.rows[0]?.is_system) return errorResponse("protected-record", 409)
  }

  try {
    const result = await databaseClient.execute({
      sql: `DELETE FROM ${table} WHERE id = ?`,
      args: [id],
    })
    if (result.rowsAffected === 0) return errorResponse("record-not-found", 404)
  } catch (error) {
    const code = classifySettingsDeleteError(error)
    return errorResponse(code, code === "record-in-use" ? 409 : 500)
  }

  return NextResponse.json({ deleted: true, id, section })
}
