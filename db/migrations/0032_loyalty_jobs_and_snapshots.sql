ALTER TABLE `orders`
  ADD COLUMN `loyalty_balance_before` int NOT NULL DEFAULT 0 AFTER `paid_amount`,
  ADD COLUMN `loyalty_bonus_requested` int NOT NULL DEFAULT 0 AFTER `loyalty_balance_before`,
  ADD COLUMN `loyalty_bonus_expected_accrued` int NOT NULL DEFAULT 0 AFTER `loyalty_bonus_accrued`,
  ADD COLUMN `loyalty_preview_payload_json` json NULL AFTER `loyalty_writeoff_percent_applied`,
  ADD COLUMN `loyalty_rules_snapshot_json` json NULL AFTER `loyalty_preview_payload_json`,
  ADD COLUMN `loyalty_actual_spent` int NOT NULL DEFAULT 0 AFTER `loyalty_program_snapshot_json`,
  ADD COLUMN `loyalty_actual_accrued` int NOT NULL DEFAULT 0 AFTER `loyalty_actual_spent`,
  ADD COLUMN `loyalty_sync_status` varchar(20) NOT NULL DEFAULT 'pending' AFTER `loyalty_actual_accrued`,
  ADD COLUMN `loyalty_last_sync_error` text NULL AFTER `loyalty_sync_status`,
  ADD COLUMN `loyalty_last_synced_at` timestamp NULL AFTER `loyalty_last_sync_error`,
  ADD COLUMN `loyalty_raw_result_json` json NULL AFTER `loyalty_last_synced_at`;

CREATE TABLE `loyalty_sync_jobs` (
  `id` serial NOT NULL,
  `job_type` varchar(40) NOT NULL,
  `user_id` int NULL,
  `order_id` int NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT 0,
  `next_run_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `locked_at` timestamp NULL,
  `last_error` text NULL,
  `payload_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `loyalty_sync_jobs_id` PRIMARY KEY(`id`)
);

CREATE INDEX `loyalty_sync_jobs_status_idx`
  ON `loyalty_sync_jobs` (`status`, `next_run_at`, `created_at`);

CREATE INDEX `loyalty_sync_jobs_user_idx`
  ON `loyalty_sync_jobs` (`user_id`, `created_at`);

CREATE INDEX `loyalty_sync_jobs_order_idx`
  ON `loyalty_sync_jobs` (`order_id`, `created_at`);

CREATE INDEX `loyalty_sync_jobs_type_idx`
  ON `loyalty_sync_jobs` (`job_type`, `status`, `created_at`);
