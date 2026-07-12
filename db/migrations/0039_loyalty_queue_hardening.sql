ALTER TABLE `loyalty_sync_jobs`
  ADD COLUMN `active_key` varchar(190) NULL AFTER `payload_json`;

UPDATE `loyalty_sync_jobs`
SET `status` = 'error',
    `last_error` = COALESCE(`last_error`, 'Архивировано при исправлении очереди LOY2'),
    `locked_at` = NULL,
    `next_run_at` = DATE_ADD(NOW(), INTERVAL 1 YEAR),
    `updated_at` = NOW()
WHERE `status` IN ('pending', 'processing', 'error');

CREATE UNIQUE INDEX `loyalty_sync_jobs_active_key_unique`
  ON `loyalty_sync_jobs` (`active_key`);
