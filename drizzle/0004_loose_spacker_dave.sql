CREATE TABLE `action_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`action_type` text NOT NULL,
	`channel` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`risk` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`blocker` text,
	`decided_by` text,
	`decided_at` integer,
	`expires_at` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`provider_request_json` text,
	`provider_result_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `action_queue_workspace_status_idx` ON `action_queue` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `action_queue_mission_created_idx` ON `action_queue` (`mission_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `action_queue_idempotency_idx` ON `action_queue` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`agent_name` text NOT NULL,
	`prompt_version` text DEFAULT '1.0' NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`input_refs_json` text DEFAULT '[]' NOT NULL,
	`output_refs_json` text DEFAULT '[]' NOT NULL,
	`tokens_input` integer DEFAULT 0 NOT NULL,
	`tokens_output` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_runs_workspace_mission_idx` ON `agent_runs` (`workspace_id`,`mission_id`);--> statement-breakpoint
CREATE INDEX `agent_runs_status_idx` ON `agent_runs` (`status`);--> statement-breakpoint
CREATE TABLE `agent_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_index` integer NOT NULL,
	`tool_name` text,
	`tool_input_json` text,
	`tool_output_json` text,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_steps_run_idx` ON `agent_steps` (`run_id`,`step_index`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_user_id` text,
	`event_category` text NOT NULL,
	`event_type` text NOT NULL,
	`action_id` text,
	`resource_type` text,
	`resource_id` text,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`ip_hash` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_events_workspace_created_idx` ON `audit_events` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_category_idx` ON `audit_events` (`event_category`,`created_at`);--> statement-breakpoint
CREATE TABLE `connector_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'setup_required' NOT NULL,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`capabilities_json` text DEFAULT '[]' NOT NULL,
	`token_reference` text,
	`token_expires_at` integer,
	`last_sync_at` integer,
	`last_error` text,
	`health_checked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `connector_installations_workspace_status_idx` ON `connector_installations` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `connector_installations_provider_idx` ON `connector_installations` (`provider`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text,
	`email` text,
	`name` text,
	`company` text,
	`role` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`consent_given` integer DEFAULT false NOT NULL,
	`qualification_signals_json` text DEFAULT '{}' NOT NULL,
	`last_contacted_at` integer,
	`converted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contacts_workspace_status_idx` ON `contacts` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `contacts_email_idx` ON `contacts` (`email`);--> statement-breakpoint
CREATE TABLE `content_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`action_id` text,
	`platform` text NOT NULL,
	`format` text NOT NULL,
	`hook` text NOT NULL,
	`body` text NOT NULL,
	`cta` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`variant_of_id` text,
	`approved_by` text,
	`approved_at` integer,
	`scheduled_at` integer,
	`published_at` integer,
	`provider_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_id`) REFERENCES `action_queue`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `content_assets_workspace_status_idx` ON `content_assets` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `content_assets_mission_created_idx` ON `content_assets` (`mission_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`source_url` text,
	`source_type` text NOT NULL,
	`content_hash` text NOT NULL,
	`parser_version` text DEFAULT '1.0' NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`extracted_facts_json` text DEFAULT '{}' NOT NULL,
	`provenance_json` text DEFAULT '{}' NOT NULL,
	`state` text DEFAULT 'observed' NOT NULL,
	`contradiction_of_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `evidence_workspace_state_idx` ON `evidence` (`workspace_id`,`state`);--> statement-breakpoint
CREATE INDEX `evidence_mission_created_idx` ON `evidence` (`mission_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `evidence_content_hash_idx` ON `evidence` (`content_hash`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`title` text NOT NULL,
	`hypothesis` text NOT NULL,
	`baseline` text,
	`variant` text,
	`metric` text NOT NULL,
	`denominator` text,
	`sample_expectation` text,
	`deadline` integer,
	`kill_rule` text NOT NULL,
	`result` text,
	`result_data_json` text,
	`decision` text DEFAULT 'pending' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`strategy_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `experiments_workspace_status_idx` ON `experiments` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `experiments_mission_created_idx` ON `experiments` (`mission_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `mission_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`mission_json` text NOT NULL,
	`change_reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mission_versions_mission_idx` ON `mission_versions` (`mission_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `organization_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `org_invitations_org_idx` ON `organization_invitations` (`organization_id`);--> statement-breakpoint
CREATE INDEX `org_invitations_email_idx` ON `organization_invitations` (`email`);--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `org_memberships_org_idx` ON `organization_memberships` (`organization_id`);--> statement-breakpoint
CREATE INDEX `org_memberships_user_idx` ON `organization_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text,
	`action_id` text,
	`experiment_id` text,
	`provider` text DEFAULT 'stripe' NOT NULL,
	`provider_payment_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attribution_confidence` integer DEFAULT 0 NOT NULL,
	`attributed_at` integer,
	`received_at` integer NOT NULL,
	`raw_event_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_id`) REFERENCES `action_queue`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `payments_workspace_status_idx` ON `payments` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `payments_mission_created_idx` ON `payments` (`mission_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_provider_payment_idx` ON `payments` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE TABLE `strategy_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`strategy_json` text NOT NULL,
	`hypothesis` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`change_reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `strategy_versions_mission_idx` ON `strategy_versions` (`mission_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `touchpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`action_id` text,
	`experiment_id` text,
	`channel` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`provider_event_id` text,
	`raw_event_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_id`) REFERENCES `action_queue`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `touchpoints_workspace_mission_idx` ON `touchpoints` (`workspace_id`,`mission_id`);--> statement-breakpoint
CREATE INDEX `touchpoints_action_idx` ON `touchpoints` (`action_id`);--> statement-breakpoint
CREATE INDEX `touchpoints_provider_event_idx` ON `touchpoints` (`provider_event_id`);--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`monthly_budget_cents` integer DEFAULT 10000 NOT NULL,
	`monthly_spent_cents` integer DEFAULT 0 NOT NULL,
	`daily_budget_cents` integer DEFAULT 2000 NOT NULL,
	`daily_spent_cents` integer DEFAULT 0 NOT NULL,
	`per_action_budget_cents` integer DEFAULT 1000 NOT NULL,
	`quiet_hours_start` integer DEFAULT 22 NOT NULL,
	`quiet_hours_end` integer DEFAULT 8 NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`forbidden_claims_json` text DEFAULT '[]' NOT NULL,
	`brand_voice_json` text DEFAULT '{}' NOT NULL,
	`retention_days` integer DEFAULT 365 NOT NULL,
	`auto_approve_low_risk` integer DEFAULT false NOT NULL,
	`max_daily_actions` integer DEFAULT 50 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_settings_workspace_id_unique` ON `workspace_settings` (`workspace_id`);