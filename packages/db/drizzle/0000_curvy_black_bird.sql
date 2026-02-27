CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`developer_id` text NOT NULL,
	`developer_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`artifact_type` text NOT NULL,
	`url` text,
	`label` text,
	`external_id` text,
	`state` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `artifacts_run_id_idx` ON `artifacts` (`run_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`received_at` text NOT NULL,
	`run_id` text NOT NULL,
	`developer_id` text NOT NULL,
	`machine_id` text NOT NULL,
	`repo_key` text NOT NULL,
	`branch_name` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_run_id_idx` ON `events` (`run_id`);--> statement-breakpoint
CREATE INDEX `events_occurred_at_idx` ON `events` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`developer_id` text NOT NULL,
	`machine_id` text NOT NULL,
	`repo_key` text NOT NULL,
	`branch_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`phase` text DEFAULT 'unknown' NOT NULL,
	`activity_kind` text DEFAULT 'unknown' NOT NULL,
	`title` text,
	`summary` text,
	`current_action` text,
	`last_action_label` text,
	`file_count` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`last_heartbeat_at` text NOT NULL,
	`last_event_at` text NOT NULL,
	`completed_at` text,
	`event_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_status_idx` ON `runs` (`status`);--> statement-breakpoint
CREATE INDEX `runs_last_event_at_idx` ON `runs` (`last_event_at`);--> statement-breakpoint
CREATE INDEX `runs_identity_idx` ON `runs` (`developer_id`,`machine_id`,`repo_key`,`branch_name`);