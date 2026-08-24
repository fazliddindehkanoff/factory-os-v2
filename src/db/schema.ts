import { sql } from "drizzle-orm"
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}

const localizedTitle = {
  titleUz: text("title_uz").notNull(),
  titleRu: text("title_ru").notNull(),
  titleTr: text("title_tr").notNull(),
}

export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  ...localizedTitle,
  ...timestamps,
})

export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  ...localizedTitle,
  ...timestamps,
})

export const permissions = sqliteTable("permissions", {
  code: text("code").primaryKey(),
  module: text("module").notNull(),
  labelUz: text("label_uz").notNull(),
  labelRu: text("label_ru").notNull(),
  labelTr: text("label_tr").notNull(),
})

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  ...localizedTitle,
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  grantsAll: integer("grants_all", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
})

export const rolePermissions = sqliteTable("role_permissions", {
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionCode: text("permission_code").notNull().references(() => permissions.code, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionCode] }),
])

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  positionId: text("position_id").references(() => positions.id, { onDelete: "set null" }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  telegramChatId: text("telegram_chat_id"),
  phoneNumber: text("phone_number"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
})

export const userRoles = sqliteTable("user_roles", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
])

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
  index("sessions_user_idx").on(table.userId),
  index("sessions_expiry_idx").on(table.expiresAt),
])

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  ...localizedTitle,
  supervisorUserId: text("supervisor_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
})

export const departmentBranches = sqliteTable("department_branches", {
  departmentId: text("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.departmentId, table.branchId] }),
])

export const userDepartments = sqliteTable("user_departments", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  departmentId: text("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.departmentId] }),
])

export const unitTypes = sqliteTable("unit_types", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
  ...localizedTitle,
  ...timestamps,
})

export const productCategories = sqliteTable("product_categories", {
  id: text("id").primaryKey(),
  ...localizedTitle,
  ...timestamps,
})

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  categoryId: text("category_id").notNull().references(() => productCategories.id),
  unitTypeId: text("unit_type_id").notNull().references(() => unitTypes.id),
  ...localizedTitle,
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
})

export const orderPurposes = sqliteTable("order_purposes", {
  id: text("id").primaryKey(),
  ...localizedTitle,
  ...timestamps,
})

export const warehouses = sqliteTable("warehouses", {
  id: text("id").primaryKey(),
  ...localizedTitle,
  responsibleUserId: text("responsible_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
})

export const warehouseBranches = sqliteTable("warehouse_branches", {
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
  branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.warehouseId, table.branchId] }),
])

export const departmentWarehouses = sqliteTable("department_warehouses", {
  departmentId: text("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.departmentId, table.warehouseId] }),
])

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  type: text("type", { enum: ["material", "service"] }).notNull(),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  requesterUserId: text("requester_user_id").notNull().references(() => users.id),
  primaryDepartmentId: text("primary_department_id").notNull().references(() => departments.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehouses.id),
  purposeId: text("purpose_id").notNull().references(() => orderPurposes.id),
  expectedDate: text("expected_date").notNull(),
  urgency: text("urgency", { enum: ["normal", "high", "urgent", "critical"] }).notNull(),
  status: text("status", { enum: ["draft", "in_review", "revision_requested", "approved", "rejected", "cancelled"] }).notNull().default("draft"),
  comment: text("comment").notNull().default(""),
  revisionNumber: integer("revision_number").notNull().default(0),
  submittedAt: text("submitted_at"),
  ...timestamps,
}, (table) => [
  index("orders_requester_idx").on(table.requesterUserId),
  index("orders_created_by_idx").on(table.createdByUserId),
  index("orders_status_idx").on(table.status),
  index("orders_department_idx").on(table.primaryDepartmentId),
])

export const orderDepartments = sqliteTable("order_departments", {
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  departmentId: text("department_id").notNull().references(() => departments.id),
}, (table) => [
  primaryKey({ columns: [table.orderId, table.departmentId] }),
])

export const orderBranches = sqliteTable("order_branches", {
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  branchId: text("branch_id").notNull().references(() => branches.id),
}, (table) => [
  primaryKey({ columns: [table.orderId, table.branchId] }),
])

export const orderLines = sqliteTable("order_lines", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  quantity: real("quantity").notNull(),
  note: text("note").notNull().default(""),
  sortOrder: integer("sort_order").notNull(),
}, (table) => [index("order_lines_order_idx").on(table.orderId)])

export const orderAttachments = sqliteTable("order_attachments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  storageKey: text("storage_key").notNull(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  uploadedByUserId: text("uploaded_by_user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

export const workflowTemplates = sqliteTable("workflow_templates", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  ...localizedTitle,
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
})

export const workflowTemplateVersions = sqliteTable("workflow_template_versions", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => workflowTemplates.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  publishedAt: text("published_at"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [
  uniqueIndex("workflow_version_unique").on(table.templateId, table.version),
])

export const workflowStepDefinitions = sqliteTable("workflow_step_definitions", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => workflowTemplateVersions.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  ...localizedTitle,
  kind: text("kind", { enum: ["approval", "task"] }).notNull().default("approval"),
  assigneeType: text("assignee_type", { enum: ["creator", "department_supervisor", "warehouse_responsible", "role", "position", "fixed_user"] }).notNull(),
  assigneeRoleId: text("assignee_role_id").references(() => roles.id),
  assigneePositionId: text("assignee_position_id").references(() => positions.id),
  assigneeUserId: text("assignee_user_id").references(() => users.id),
  approvalMode: text("approval_mode", { enum: ["any", "all"] }).notNull().default("any"),
  skipIfRequesterIsAssignee: integer("skip_if_requester_is_assignee", { mode: "boolean" }).notNull().default(true),
  canReturnForRevision: integer("can_return_for_revision", { mode: "boolean" }).notNull().default(true),
  dueAfterHours: integer("due_after_hours"),
}, (table) => [
  uniqueIndex("workflow_step_order_unique").on(table.versionId, table.stepOrder),
])

export const workflowAssignmentRules = sqliteTable("workflow_assignment_rules", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull().references(() => workflowTemplates.id, { onDelete: "cascade" }),
  departmentId: text("department_id").references(() => departments.id, { onDelete: "cascade" }),
  branchId: text("branch_id").references(() => branches.id, { onDelete: "cascade" }),
  orderType: text("order_type", { enum: ["material", "service"] }),
  urgency: text("urgency", { enum: ["normal", "high", "urgent", "critical"] }),
  minAmount: real("min_amount"),
  maxAmount: real("max_amount"),
  priority: integer("priority").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [index("workflow_rule_priority_idx").on(table.priority)])

export const workflowInstances = sqliteTable("workflow_instances", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  templateVersionId: text("template_version_id").notNull().references(() => workflowTemplateVersions.id),
  status: text("status", { enum: ["active", "revision_requested", "approved", "rejected", "cancelled"] }).notNull().default("active"),
  currentStepOrder: integer("current_step_order"),
  startedAt: text("started_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

export const workflowStepInstances = sqliteTable("workflow_step_instances", {
  id: text("id").primaryKey(),
  workflowInstanceId: text("workflow_instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
  stepDefinitionId: text("step_definition_id").notNull().references(() => workflowStepDefinitions.id),
  stepOrder: integer("step_order").notNull(),
  attempt: integer("attempt").notNull().default(1),
  assignedUserId: text("assigned_user_id").references(() => users.id),
  status: text("status", { enum: ["pending", "active", "approved", "completed", "returned", "skipped", "cancelled"] }).notNull().default("pending"),
  activatedAt: text("activated_at"),
  completedAt: text("completed_at"),
  dueAt: text("due_at"),
  resolutionNote: text("resolution_note"),
}, (table) => [
  uniqueIndex("workflow_step_attempt_unique").on(table.workflowInstanceId, table.stepOrder, table.attempt),
  index("workflow_step_assignee_status_idx").on(table.assignedUserId, table.status),
])

export const workflowActions = sqliteTable("workflow_actions", {
  id: text("id").primaryKey(),
  workflowInstanceId: text("workflow_instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
  fromStepInstanceId: text("from_step_instance_id").references(() => workflowStepInstances.id),
  toStepInstanceId: text("to_step_instance_id").references(() => workflowStepInstances.id),
  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action", { enum: ["submitted", "approved", "completed", "returned", "revised", "skipped", "reassigned", "cancelled", "rejected"] }).notNull(),
  comment: text("comment"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [index("workflow_actions_instance_idx").on(table.workflowInstanceId, table.createdAt)])

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [index("notifications_user_unread_idx").on(table.userId, table.readAt)])

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [index("audit_entity_idx").on(table.entityType, table.entityId, table.createdAt)])
