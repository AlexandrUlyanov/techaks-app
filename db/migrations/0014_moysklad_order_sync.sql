ALTER TABLE `orders`
  ADD COLUMN `moysklad_order_id` text,
  ADD COLUMN `moysklad_order_href` text,
  ADD COLUMN `moysklad_external_code` text,
  ADD COLUMN `moysklad_sync_status` varchar(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN `moysklad_synced_at` timestamp NULL,
  ADD COLUMN `moysklad_last_error` text;
--> statement-breakpoint
CREATE INDEX `orders_moysklad_sync_idx`
  ON `orders` (`moysklad_sync_status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `moysklad_sync_jobs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `entity_type` varchar(30) NOT NULL,
  `entity_id` int NOT NULL,
  `action` varchar(30) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT 0,
  `next_run_at` timestamp NOT NULL DEFAULT now(),
  `locked_at` timestamp NULL,
  `last_error` text,
  `payload_snapshot` json,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `moysklad_sync_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `moysklad_sync_jobs_status_next_run_idx`
  ON `moysklad_sync_jobs` (`status`,`next_run_at`,`created_at`);
--> statement-breakpoint
CREATE INDEX `moysklad_sync_jobs_entity_idx`
  ON `moysklad_sync_jobs` (`entity_type`,`entity_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `moysklad_sync_jobs_action_idx`
  ON `moysklad_sync_jobs` (`action`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `moysklad_webhook_events` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `request_id` varchar(191) NOT NULL,
  `payload` json NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT now(),
  `processed_at` timestamp NULL,
  `last_error` text,
  CONSTRAINT `moysklad_webhook_events_id` PRIMARY KEY(`id`),
  CONSTRAINT `moysklad_webhook_events_request_id_unique` UNIQUE(`request_id`)
);
--> statement-breakpoint
CREATE INDEX `moysklad_webhook_events_status_created_idx`
  ON `moysklad_webhook_events` (`status`,`created_at`);
