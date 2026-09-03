DROP INDEX `missions_updated_at_idx`;--> statement-breakpoint
CREATE INDEX `missions_workspace_updated_idx` ON `missions` (`workspace_id`,`updated_at`);--> statement-breakpoint
DROP INDEX `workspace_connections_workspace_status_idx`;--> statement-breakpoint
CREATE INDEX `workspace_connections_workspace_updated_idx` ON `workspace_connections` (`workspace_id`,`updated_at`);