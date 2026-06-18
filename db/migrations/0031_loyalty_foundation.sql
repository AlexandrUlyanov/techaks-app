ALTER TABLE `users`
  ADD COLUMN `moysklad_counterparty_id` varchar(120) NULL AFTER `status`,
  ADD COLUMN `moysklad_counterparty_href` text NULL AFTER `moysklad_counterparty_id`,
  ADD COLUMN `moysklad_counterparty_version` int NULL AFTER `moysklad_counterparty_href`,
  ADD COLUMN `moysklad_counterparty_external_code` varchar(120) NULL AFTER `moysklad_counterparty_version`,
  ADD COLUMN `loyalty_participant_group` varchar(120) NULL AFTER `moysklad_counterparty_external_code`,
  ADD COLUMN `loyalty_participant_tag` varchar(120) NULL AFTER `loyalty_participant_group`,
  ADD COLUMN `loyalty_participant_assigned_at` timestamp NULL AFTER `loyalty_participant_tag`,
  ADD COLUMN `loyalty_status` varchar(30) NOT NULL DEFAULT 'pending' AFTER `loyalty_participant_assigned_at`,
  ADD COLUMN `loyalty_balance` int NOT NULL DEFAULT 0 AFTER `loyalty_status`,
  ADD COLUMN `loyalty_available_to_spend` int NOT NULL DEFAULT 0 AFTER `loyalty_balance`,
  ADD COLUMN `loyalty_pending_accrual` int NOT NULL DEFAULT 0 AFTER `loyalty_available_to_spend`,
  ADD COLUMN `loyalty_program_name` varchar(255) NULL AFTER `loyalty_pending_accrual`,
  ADD COLUMN `loyalty_program_meta_href` text NULL AFTER `loyalty_program_name`,
  ADD COLUMN `loyalty_profile_json` json NULL AFTER `loyalty_program_meta_href`,
  ADD COLUMN `loyalty_rules_json` json NULL AFTER `loyalty_profile_json`,
  ADD COLUMN `loyalty_last_synced_at` timestamp NULL AFTER `loyalty_rules_json`,
  ADD COLUMN `loyalty_last_error` text NULL AFTER `loyalty_last_synced_at`;

CREATE INDEX `users_loyalty_status_idx`
  ON `users` (`loyalty_status`, `loyalty_last_synced_at`);

CREATE INDEX `users_loyalty_counterparty_idx`
  ON `users` (`moysklad_counterparty_id`);

ALTER TABLE `orders`
  ADD COLUMN `loyalty_bonus_spent` int NOT NULL DEFAULT 0 AFTER `paid_amount`,
  ADD COLUMN `loyalty_bonus_accrued` int NOT NULL DEFAULT 0 AFTER `loyalty_bonus_spent`,
  ADD COLUMN `loyalty_writeoff_percent_applied` int NOT NULL DEFAULT 0 AFTER `loyalty_bonus_accrued`,
  ADD COLUMN `loyalty_program_snapshot_json` json NULL AFTER `loyalty_writeoff_percent_applied`;

CREATE TABLE `bonus_transactions` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `order_id` int NULL,
  `direction` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `amount` int NOT NULL DEFAULT 0,
  `balance_after` int NULL,
  `source` varchar(40) NOT NULL DEFAULT 'site',
  `external_id` varchar(160) NULL,
  `external_type` varchar(80) NULL,
  `note` text NULL,
  `payload_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `bonus_transactions_id` PRIMARY KEY(`id`)
);

CREATE INDEX `bonus_transactions_user_idx`
  ON `bonus_transactions` (`user_id`, `created_at`);

CREATE INDEX `bonus_transactions_order_idx`
  ON `bonus_transactions` (`order_id`, `created_at`);

CREATE INDEX `bonus_transactions_status_idx`
  ON `bonus_transactions` (`status`, `updated_at`);

CREATE INDEX `bonus_transactions_external_idx`
  ON `bonus_transactions` (`external_type`, `external_id`);

CREATE TABLE `loyalty_sync_logs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `user_id` int NULL,
  `order_id` int NULL,
  `direction` varchar(30) NOT NULL DEFAULT 'pull',
  `status` varchar(20) NOT NULL DEFAULT 'success',
  `message` text NULL,
  `details_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `loyalty_sync_logs_id` PRIMARY KEY(`id`)
);

CREATE INDEX `loyalty_sync_logs_user_idx`
  ON `loyalty_sync_logs` (`user_id`, `created_at`);

CREATE INDEX `loyalty_sync_logs_order_idx`
  ON `loyalty_sync_logs` (`order_id`, `created_at`);

CREATE INDEX `loyalty_sync_logs_status_idx`
  ON `loyalty_sync_logs` (`status`, `created_at`);
