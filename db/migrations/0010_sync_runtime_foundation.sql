ALTER TABLE `sync_runs` ADD `phase` varchar(80);
--> statement-breakpoint
ALTER TABLE `sync_runs` ADD `progress_json` json;
--> statement-breakpoint
ALTER TABLE `sync_runs` ADD `heartbeat_at` timestamp;
--> statement-breakpoint
ALTER TABLE `sync_runs` ADD `lock_owner` varchar(64);
--> statement-breakpoint
ALTER TABLE `sync_runs` ADD `worker_id` varchar(64);
--> statement-breakpoint
ALTER TABLE `sync_runs` ADD `cancel_requested` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `sync_runs` ADD `abort_reason` text;
--> statement-breakpoint
CREATE INDEX `sync_runs_run_type_status_idx` ON `sync_runs` (`run_type`,`status`,`started_at`);
--> statement-breakpoint
CREATE INDEX `sync_runs_heartbeat_idx` ON `sync_runs` (`status`,`heartbeat_at`);
