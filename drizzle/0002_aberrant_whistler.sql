PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`category_id` text NOT NULL,
	`unit_type_id` text,
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
INSERT INTO `__new_products`("id", "code", "category_id", "unit_type_id", "title_uz", "title_ru", "title_tr", "is_active", "created_at", "updated_at") SELECT "id", "code", "category_id", "unit_type_id", "title_uz", "title_ru", "title_tr", "is_active", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
ALTER TABLE `order_lines` ADD `unit_type_id` text REFERENCES unit_types(id);--> statement-breakpoint
UPDATE `order_lines`
SET `unit_type_id` = (
	SELECT `products`.`unit_type_id`
	FROM `products`
	WHERE `products`.`id` = `order_lines`.`product_id`
);
