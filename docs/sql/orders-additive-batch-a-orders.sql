-- Orders Phase 3 - Batch A
-- Additive-only migration draft for orders table.
-- Do not run automatically. Review and execute only after approval.
-- Target DB: MySQL / MariaDB.
-- NOTE:
-- Not every MySQL / MariaDB version supports `ADD COLUMN IF NOT EXISTS`,
-- so this batch uses guarded ALTER statements via information_schema + PREPARE.

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'order_number'
  ),
  'SELECT ''SKIP orders.order_number''',
  'ALTER TABLE orders ADD COLUMN order_number VARCHAR(191) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_status'
  ),
  'SELECT ''SKIP orders.delivery_status''',
  'ALTER TABLE orders ADD COLUMN delivery_status VARCHAR(64) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'subtotal'
  ),
  'SELECT ''SKIP orders.subtotal''',
  'ALTER TABLE orders ADD COLUMN subtotal INT NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'discount_total'
  ),
  'SELECT ''SKIP orders.discount_total''',
  'ALTER TABLE orders ADD COLUMN discount_total INT NULL DEFAULT 0'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_price'
  ),
  'SELECT ''SKIP orders.delivery_price''',
  'ALTER TABLE orders ADD COLUMN delivery_price INT NULL DEFAULT 0'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'paid_amount'
  ),
  'SELECT ''SKIP orders.paid_amount''',
  'ALTER TABLE orders ADD COLUMN paid_amount INT NULL DEFAULT 0'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_method'
  ),
  'SELECT ''SKIP orders.payment_method''',
  'ALTER TABLE orders ADD COLUMN payment_method VARCHAR(128) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_id'
  ),
  'SELECT ''SKIP orders.payment_id''',
  'ALTER TABLE orders ADD COLUMN payment_id VARCHAR(191) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'source'
  ),
  'SELECT ''SKIP orders.source''',
  'ALTER TABLE orders ADD COLUMN source VARCHAR(64) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'customer_name'
  ),
  'SELECT ''SKIP orders.customer_name''',
  'ALTER TABLE orders ADD COLUMN customer_name VARCHAR(191) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'customer_phone'
  ),
  'SELECT ''SKIP orders.customer_phone''',
  'ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(64) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'customer_email'
  ),
  'SELECT ''SKIP orders.customer_email''',
  'ALTER TABLE orders ADD COLUMN customer_email VARCHAR(191) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'customer_first_name'
  ),
  'SELECT ''SKIP orders.customer_first_name''',
  'ALTER TABLE orders ADD COLUMN customer_first_name VARCHAR(191) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'customer_last_name'
  ),
  'SELECT ''SKIP orders.customer_last_name''',
  'ALTER TABLE orders ADD COLUMN customer_last_name VARCHAR(191) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'customer_comment'
  ),
  'SELECT ''SKIP orders.customer_comment''',
  'ALTER TABLE orders ADD COLUMN customer_comment TEXT NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'internal_comment'
  ),
  'SELECT ''SKIP orders.internal_comment''',
  'ALTER TABLE orders ADD COLUMN internal_comment TEXT NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'updated_at'
  ),
  'SELECT ''SKIP orders.updated_at''',
  'ALTER TABLE orders ADD COLUMN updated_at DATETIME NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Notes:
-- 1. No UNIQUE constraints are added in Batch A.
-- 2. No FOREIGN KEY constraints are added in Batch A.
-- 3. No backfill is performed in Batch A.
-- 4. No existing column types are changed in Batch A.
-- 5. No new column is declared NOT NULL in Batch A.
