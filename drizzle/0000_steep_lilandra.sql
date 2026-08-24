CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_events` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `department_branches` (
	`department_id` text NOT NULL,
	`branch_id` text NOT NULL,
	PRIMARY KEY(`department_id`, `branch_id`),
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `department_warehouses` (
	`department_id` text NOT NULL,
	`warehouse_id` text NOT NULL,
	PRIMARY KEY(`department_id`, `warehouse_id`),
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`supervisor_user_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`supervisor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`read_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_unread_idx` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `order_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text,
	`size_bytes` integer,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_branches` (
	`order_id` text NOT NULL,
	`branch_id` text NOT NULL,
	PRIMARY KEY(`order_id`, `branch_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_departments` (
	`order_id` text NOT NULL,
	`department_id` text NOT NULL,
	PRIMARY KEY(`order_id`, `department_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_lines_order_idx` ON `order_lines` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_purposes` (
	`id` text PRIMARY KEY NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`type` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`requester_user_id` text NOT NULL,
	`primary_department_id` text NOT NULL,
	`warehouse_id` text NOT NULL,
	`purpose_id` text NOT NULL,
	`expected_date` text NOT NULL,
	`urgency` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`revision_number` integer DEFAULT 0 NOT NULL,
	`submitted_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requester_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`primary_department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purpose_id`) REFERENCES `order_purposes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE INDEX `orders_requester_idx` ON `orders` (`requester_user_id`);--> statement-breakpoint
CREATE INDEX `orders_created_by_idx` ON `orders` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_department_idx` ON `orders` (`primary_department_id`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`code` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`label_uz` text NOT NULL,
	`label_ru` text NOT NULL,
	`label_tr` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_code_unique` ON `positions` (`code`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`category_id` text NOT NULL,
	`unit_type_id` text NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_type_id`) REFERENCES `unit_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission_code` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission_code`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`grants_all` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_code_unique` ON `roles` (`code`);--> statement-breakpoint
CREATE TABLE `unit_types` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unit_types_code_unique` ON `unit_types` (`code`);--> statement-breakpoint
CREATE TABLE `user_departments` (
	`user_id` text NOT NULL,
	`department_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `department_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `role_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`position_id` text,
	`username` text NOT NULL,
	`password_hash` text,
	`telegram_chat_id` text,
	`phone_number` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `warehouse_branches` (
	`warehouse_id` text NOT NULL,
	`branch_id` text NOT NULL,
	PRIMARY KEY(`warehouse_id`, `branch_id`),
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` text PRIMARY KEY NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`responsible_user_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`responsible_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `workflow_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_instance_id` text NOT NULL,
	`from_step_instance_id` text,
	`to_step_instance_id` text,
	`actor_user_id` text,
	`action` text NOT NULL,
	`comment` text,
	`metadata` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workflow_instance_id`) REFERENCES `workflow_instances`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_step_instance_id`) REFERENCES `workflow_step_instances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_step_instance_id`) REFERENCES `workflow_step_instances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workflow_actions_instance_idx` ON `workflow_actions` (`workflow_instance_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `workflow_assignment_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`department_id` text,
	`branch_id` text,
	`order_type` text,
	`urgency` text,
	`min_amount` real,
	`max_amount` real,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `workflow_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workflow_rule_priority_idx` ON `workflow_assignment_rules` (`priority`);--> statement-breakpoint
CREATE TABLE `workflow_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`template_version_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`current_step_order` integer,
	`started_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`completed_at` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_version_id`) REFERENCES `workflow_template_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_instances_order_id_unique` ON `workflow_instances` (`order_id`);--> statement-breakpoint
CREATE TABLE `workflow_step_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`step_order` integer NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`kind` text DEFAULT 'approval' NOT NULL,
	`assignee_type` text NOT NULL,
	`assignee_role_id` text,
	`assignee_position_id` text,
	`assignee_user_id` text,
	`approval_mode` text DEFAULT 'any' NOT NULL,
	`skip_if_requester_is_assignee` integer DEFAULT true NOT NULL,
	`can_return_for_revision` integer DEFAULT true NOT NULL,
	`due_after_hours` integer,
	FOREIGN KEY (`version_id`) REFERENCES `workflow_template_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_step_order_unique` ON `workflow_step_definitions` (`version_id`,`step_order`);--> statement-breakpoint
CREATE TABLE `workflow_step_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_instance_id` text NOT NULL,
	`step_definition_id` text NOT NULL,
	`step_order` integer NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`assigned_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`activated_at` text,
	`completed_at` text,
	`due_at` text,
	`resolution_note` text,
	FOREIGN KEY (`workflow_instance_id`) REFERENCES `workflow_instances`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_definition_id`) REFERENCES `workflow_step_definitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_step_attempt_unique` ON `workflow_step_instances` (`workflow_instance_id`,`step_order`,`attempt`);--> statement-breakpoint
CREATE INDEX `workflow_step_assignee_status_idx` ON `workflow_step_instances` (`assigned_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `workflow_template_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `workflow_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_version_unique` ON `workflow_template_versions` (`template_id`,`version`);--> statement-breakpoint
CREATE TABLE `workflow_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title_uz` text NOT NULL,
	`title_ru` text NOT NULL,
	`title_tr` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_templates_code_unique` ON `workflow_templates` (`code`);