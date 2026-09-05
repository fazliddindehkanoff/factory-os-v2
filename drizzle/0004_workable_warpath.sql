CREATE TABLE `order_comment_mentions` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`comment_id`, `user_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `order_comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_comment_mentions_user_idx` ON `order_comment_mentions` (`user_id`);--> statement-breakpoint
CREATE TABLE `order_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`order_number` text NOT NULL,
	`author_user_id` text,
	`author_name` text NOT NULL,
	`author_username` text NOT NULL,
	`body` text NOT NULL,
	`reply_to_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_comments_order_idx` ON `order_comments` (`order_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `notifications` ADD `comment_id` text REFERENCES order_comments(id);