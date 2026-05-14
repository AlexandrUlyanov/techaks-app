CREATE TABLE `password_reset_tokens` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `sync_profiles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`provider` varchar(40) NOT NULL DEFAULT 'moysklad',
	`config_json` json NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`profile_id` int,
	`run_type` varchar(40) NOT NULL DEFAULT 'full',
	`status` varchar(20) NOT NULL DEFAULT 'running',
	`message` text,
	`config_snapshot` json,
	`stats_json` json,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`finished_at` timestamp,
	CONSTRAINT `sync_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`provider` varchar(40) NOT NULL DEFAULT 'moysklad',
	`event_type` varchar(80) NOT NULL DEFAULT 'unknown',
	`event_key` varchar(255) NOT NULL,
	`payload_json` json NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'new',
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` text,
	`processed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_events_provider_event_key_unique` UNIQUE(`provider`,`event_key`)
);
--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_token_idx` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `sync_profiles_provider_default_idx` ON `sync_profiles` (`provider`,`is_default`);--> statement-breakpoint
CREATE INDEX `sync_runs_profile_idx` ON `sync_runs` (`profile_id`);--> statement-breakpoint
CREATE INDEX `sync_runs_status_idx` ON `sync_runs` (`status`,`started_at`);--> statement-breakpoint
CREATE INDEX `webhook_events_status_created_idx` ON `webhook_events` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `webhook_events_provider_type_idx` ON `webhook_events` (`provider`,`event_type`,`created_at`);