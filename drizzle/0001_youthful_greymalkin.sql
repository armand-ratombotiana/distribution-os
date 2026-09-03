CREATE TABLE `workspace_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'setup_required' NOT NULL,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`last_sync_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_connections_workspace_status_idx` ON `workspace_connections` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`display_name` text NOT NULL,
	`plan` text DEFAULT 'founder' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_owner_user_id_unique` ON `workspaces` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `workspaces_owner_idx` ON `workspaces` (`owner_user_id`);--> statement-breakpoint
ALTER TABLE `missions` ADD `workspace_id` text REFERENCES workspaces(id);