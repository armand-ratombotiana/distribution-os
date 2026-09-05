CREATE TABLE `provider_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`action_id` text,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`provider_request_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_hash` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_id`) REFERENCES `action_queue`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_webhook_events_provider_event_unique` ON `provider_webhook_events` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE INDEX `provider_webhook_events_workspace_action_idx` ON `provider_webhook_events` (`workspace_id`,`action_id`);--> statement-breakpoint
CREATE INDEX `provider_webhook_events_request_idx` ON `provider_webhook_events` (`provider`,`provider_request_id`);