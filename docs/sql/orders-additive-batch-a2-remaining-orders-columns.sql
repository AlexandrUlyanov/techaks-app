-- Orders Phase 3.1 - Batch A2
-- Additive-only follow-up migration draft for remaining orders columns
-- required by the current code paths.
-- Target DB: MySQL / MariaDB-compatible.
-- Safety rules:
-- 1. Guard every ADD COLUMN through information_schema + PREPARE.
-- 2. Do not change existing types.
-- 3. Do not add NOT NULL, UNIQUE, FOREIGN KEY, indexes, or backfill.
-- 4. Do not update existing rows.

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_service'
  ),
  'SELECT ''SKIP orders.delivery_service''',
  'ALTER TABLE orders ADD COLUMN delivery_service VARCHAR(80) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_city'
  ),
  'SELECT ''SKIP orders.delivery_city''',
  'ALTER TABLE orders ADD COLUMN delivery_city VARCHAR(120) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_region'
  ),
  'SELECT ''SKIP orders.delivery_region''',
  'ALTER TABLE orders ADD COLUMN delivery_region VARCHAR(120) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_postal_code'
  ),
  'SELECT ''SKIP orders.delivery_postal_code''',
  'ALTER TABLE orders ADD COLUMN delivery_postal_code VARCHAR(20) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_track_number'
  ),
  'SELECT ''SKIP orders.delivery_track_number''',
  'ALTER TABLE orders ADD COLUMN delivery_track_number VARCHAR(128) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_comment'
  ),
  'SELECT ''SKIP orders.delivery_comment''',
  'ALTER TABLE orders ADD COLUMN delivery_comment TEXT NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipped_at'
  ),
  'SELECT ''SKIP orders.shipped_at''',
  'ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivered_at'
  ),
  'SELECT ''SKIP orders.delivered_at''',
  'ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMP NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'paid_at'
  ),
  'SELECT ''SKIP orders.paid_at''',
  'ALTER TABLE orders ADD COLUMN paid_at TIMESTAMP NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_error'
  ),
  'SELECT ''SKIP orders.payment_error''',
  'ALTER TABLE orders ADD COLUMN payment_error TEXT NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'manager_id'
  ),
  'SELECT ''SKIP orders.manager_id''',
  'ALTER TABLE orders ADD COLUMN manager_id INT NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'is_problem'
  ),
  'SELECT ''SKIP orders.is_problem''',
  'ALTER TABLE orders ADD COLUMN is_problem TINYINT(1) NULL DEFAULT 0'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cancelled_at'
  ),
  'SELECT ''SKIP orders.cancelled_at''',
  'ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cancelled_reason'
  ),
  'SELECT ''SKIP orders.cancelled_reason''',
  'ALTER TABLE orders ADD COLUMN cancelled_reason TEXT NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'completed_at'
  ),
  'SELECT ''SKIP orders.completed_at''',
  'ALTER TABLE orders ADD COLUMN completed_at TIMESTAMP NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
