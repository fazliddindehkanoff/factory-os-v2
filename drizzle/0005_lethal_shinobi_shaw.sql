CREATE TABLE `app_records` (
	`namespace` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`namespace`, `id`),
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_records_namespace_created_idx` ON `app_records` (`namespace`,`created_at`);--> statement-breakpoint
CREATE INDEX `app_records_creator_idx` ON `app_records` (`created_by_user_id`);