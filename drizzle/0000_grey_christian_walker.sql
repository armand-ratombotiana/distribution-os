CREATE TABLE `mission_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mission_id` text NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mission_events_mission_created_idx` ON `mission_events` (`mission_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`website_url` text NOT NULL,
	`product_name` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'learning' NOT NULL,
	`current_stage` text DEFAULT 'observe' NOT NULL,
	`cycle_number` integer DEFAULT 1 NOT NULL,
	`payment_count` integer DEFAULT 0 NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`mission_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `missions_updated_at_idx` ON `missions` (`updated_at`);