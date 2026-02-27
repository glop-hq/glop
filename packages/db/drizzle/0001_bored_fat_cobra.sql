ALTER TABLE `runs` ADD `session_id` text;--> statement-breakpoint
CREATE INDEX `runs_session_id_idx` ON `runs` (`session_id`);