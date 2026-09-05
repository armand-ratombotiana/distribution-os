CREATE TABLE `action_execution_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`action_id` text NOT NULL,
	`provider` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text DEFAULT 'claimed' NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`provider_request_id` text,
	`receipt_json` text,
	`error_code` text,
	`error_message` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_id`) REFERENCES `action_queue`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `action_execution_attempts_idempotency_unique` ON `action_execution_attempts` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `action_execution_attempts_workspace_action_idx` ON `action_execution_attempts` (`workspace_id`,`action_id`);--> statement-breakpoint
CREATE INDEX `action_execution_attempts_status_idx` ON `action_execution_attempts` (`status`,`updated_at`);