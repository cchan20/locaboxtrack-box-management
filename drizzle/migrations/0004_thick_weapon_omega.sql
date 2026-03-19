PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`box_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`date` integer DEFAULT '"2026-03-18T10:12:48.387Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "box_id", "customer_id", "user_id", "type", "date") SELECT "id", "box_id", "customer_id", "user_id", "type", "date" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT '"2026-03-18T10:12:48.386Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2026-03-18T10:12:48.386Z"' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "password", "name", "status", "created_at", "updated_at") SELECT "id", "username", "password", "name", "status", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
ALTER TABLE `customers` ADD `credit_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `current_taken` integer DEFAULT 0 NOT NULL;