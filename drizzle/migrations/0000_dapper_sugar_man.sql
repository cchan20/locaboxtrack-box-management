CREATE TABLE `boxes` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`customer_id` text,
	`customer_name` text,
	`date_out` integer
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`total_taken` integer DEFAULT 0 NOT NULL,
	`total_returned` integer DEFAULT 0 NOT NULL,
	`late_returns` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `running_no_control` (
	`id` text PRIMARY KEY NOT NULL,
	`current_number` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`box_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`date` integer DEFAULT '"2026-03-12T20:10:03.549Z"' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT '"2026-03-12T20:10:03.549Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2026-03-12T20:10:03.549Z"' NOT NULL
);
