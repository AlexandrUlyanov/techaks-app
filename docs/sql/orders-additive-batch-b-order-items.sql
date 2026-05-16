-- Orders Phase 3 - Batch B
-- Additive-only migration draft for order_items table.
-- Do not run automatically. Review and execute only after approval.
-- Target DB: MySQL / MariaDB.
-- NOTE:
-- Not every MySQL / MariaDB version supports `ADD COLUMN IF NOT EXISTS`,
-- so this batch uses guarded ALTER statements via information_schema + PREPARE.

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'sku'
  ),
  'SELECT ''SKIP order_items.sku''',
  'ALTER TABLE order_items ADD COLUMN sku VARCHAR(191) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'product_name'
  ),
  'SELECT ''SKIP order_items.product_name''',
  'ALTER TABLE order_items ADD COLUMN product_name VARCHAR(255) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'image'
  ),
  'SELECT ''SKIP order_items.image''',
  'ALTER TABLE order_items ADD COLUMN image VARCHAR(255) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'discount'
  ),
  'SELECT ''SKIP order_items.discount''',
  'ALTER TABLE order_items ADD COLUMN discount INT NULL DEFAULT 0'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'total'
  ),
  'SELECT ''SKIP order_items.total''',
  'ALTER TABLE order_items ADD COLUMN total INT NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'stock_status'
  ),
  'SELECT ''SKIP order_items.stock_status''',
  'ALTER TABLE order_items ADD COLUMN stock_status VARCHAR(64) NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Notes:
-- 1. Snapshot fields remain nullable for legacy rows.
-- 2. No recalculation/backfill is performed in Batch B.
-- 3. No existing data is touched.
-- 4. No FOREIGN KEY constraints are added.
-- 5. No new column is declared NOT NULL in Batch B.
