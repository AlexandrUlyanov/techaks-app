-- Orders Phase 3: read-only audit queries
-- Target DB: MySQL / MariaDB (project production currently uses MySQL-compatible schema).
-- Safe usage only: SELECT statements, no DDL/DML.

-- 1. Columns: orders
SELECT
  table_name,
  column_name,
  column_type,
  is_nullable,
  column_default,
  extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'orders'
ORDER BY ordinal_position;

-- 2. Columns: order_items
SELECT
  table_name,
  column_name,
  column_type,
  is_nullable,
  column_default,
  extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'order_items'
ORDER BY ordinal_position;

-- 3. Columns: users
SELECT
  table_name,
  column_name,
  column_type,
  is_nullable,
  column_default,
  extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 4. Presence of order_history / order_comments
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('order_history', 'order_comments')
ORDER BY table_name;

-- 5. Indexes: orders
SELECT
  table_name,
  index_name,
  non_unique,
  seq_in_index,
  column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'orders'
ORDER BY index_name, seq_in_index;

-- 6. Indexes: order_items
SELECT
  table_name,
  index_name,
  non_unique,
  seq_in_index,
  column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'order_items'
ORDER BY index_name, seq_in_index;

-- 7. COUNT(*) orders
SELECT COUNT(*) AS orders_count
FROM orders;

-- 8. COUNT(*) order_items
SELECT COUNT(*) AS order_items_count
FROM order_items;

-- 9. Orders without user_id
SELECT COUNT(*) AS orders_without_user_id
FROM orders
WHERE user_id IS NULL;

-- 10. Distribution: orders.status
SELECT
  status,
  COUNT(*) AS total
FROM orders
GROUP BY status
ORDER BY total DESC, status;

-- 11. Distribution: orders.payment_status
SELECT
  payment_status,
  COUNT(*) AS total
FROM orders
GROUP BY payment_status
ORDER BY total DESC, payment_status;

-- 12. Distribution: orders.delivery_type
SELECT
  delivery_type,
  COUNT(*) AS total
FROM orders
GROUP BY delivery_type
ORDER BY total DESC, delivery_type;

-- 13. Check whether order_number column exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'orders'
        AND column_name = 'order_number'
    ) THEN 'present'
    ELSE 'missing'
  END AS order_number_column_status;

-- 14. order_number null / blank stats (guarded, safe for legacy schema)
SET @has_order_number := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'order_number'
);
SET @sql_order_number_null_blank := IF(
  @has_order_number > 0,
  'SELECT
      ''EXECUTED'' AS audit_status,
      SUM(CASE WHEN order_number IS NULL THEN 1 ELSE 0 END) AS null_count,
      SUM(CASE WHEN order_number = '''''' THEN 1 ELSE 0 END) AS blank_count,
      SUM(CASE WHEN order_number IS NULL OR order_number = '''''' THEN 1 ELSE 0 END) AS null_or_blank_count
    FROM orders',
  'SELECT ''SKIPPED: order_number column is missing'' AS audit_status, NULL AS null_count, NULL AS blank_count, NULL AS null_or_blank_count'
);
PREPARE stmt_order_number_null_blank FROM @sql_order_number_null_blank;
EXECUTE stmt_order_number_null_blank;
DEALLOCATE PREPARE stmt_order_number_null_blank;

-- 15. Potential duplicates of order_number (guarded, safe for legacy schema)
SET @sql_order_number_duplicates := IF(
  @has_order_number > 0,
  'SELECT
      order_number,
      COUNT(*) AS total
    FROM orders
    WHERE order_number IS NOT NULL
      AND order_number <> ''''''
    GROUP BY order_number
    HAVING COUNT(*) > 1
    ORDER BY total DESC, order_number',
  'SELECT ''SKIPPED: order_number column is missing'' AS order_number, NULL AS total'
);
PREPARE stmt_order_number_duplicates FROM @sql_order_number_duplicates;
EXECUTE stmt_order_number_duplicates;
DEALLOCATE PREPARE stmt_order_number_duplicates;

-- 16. Partially created order_history / order_comments tables
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('order_history', 'order_comments')
GROUP BY table_name
ORDER BY table_name;
