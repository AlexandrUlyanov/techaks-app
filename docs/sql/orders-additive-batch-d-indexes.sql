-- Orders Phase 3 - Batch D
-- Index draft only. Apply only after explicit approval and backup/snapshot.
-- Target DB: MySQL / MariaDB.
-- No FOREIGN KEY or UNIQUE indexes are added here.
-- NOTE:
-- `CREATE INDEX IF NOT EXISTS` is not consistently supported across MySQL / MariaDB versions,
-- so this batch uses guarded CREATE INDEX statements via information_schema + PREPARE.
-- Apply Batch D only after structural batches A/B/C and only with separate approval.

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_created_at'
  ),
  'SELECT ''SKIP idx_orders_created_at''',
  'CREATE INDEX idx_orders_created_at ON orders (created_at)'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_status'
  ),
  'SELECT ''SKIP idx_orders_status''',
  'CREATE INDEX idx_orders_status ON orders (status)'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_payment_status'
  ),
  'SELECT ''SKIP idx_orders_payment_status''',
  'CREATE INDEX idx_orders_payment_status ON orders (payment_status)'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_user_id'
  ),
  'SELECT ''SKIP idx_orders_user_id''',
  'CREATE INDEX idx_orders_user_id ON orders (user_id)'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND index_name = 'idx_order_items_order_id'
  ),
  'SELECT ''SKIP idx_order_items_order_id''',
  'CREATE INDEX idx_order_items_order_id ON order_items (order_id)'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'order_history'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'order_history' AND index_name = 'idx_order_history_order_id'
  ),
  'CREATE INDEX idx_order_history_order_id ON order_history (order_id)',
  'SELECT ''SKIP idx_order_history_order_id'''
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'order_comments'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'order_comments' AND index_name = 'idx_order_comments_order_id'
  ),
  'CREATE INDEX idx_order_comments_order_id ON order_comments (order_id)',
  'SELECT ''SKIP idx_order_comments_order_id'''
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Notes:
-- 1. Indexes are intentionally separated from structural batches.
-- 2. Apply only after read-only audit and explicit confirmation.
-- 3. Validate existing indexes before execution in environments with partial drift.
-- 4. Do not apply Batch D together with structural rollout by default.
