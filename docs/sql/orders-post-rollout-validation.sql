-- Orders Phase 3: post-rollout validation queries
-- Target DB: MySQL / MariaDB.
-- Safe usage only: SELECT statements, no DDL/DML.

-- 1. Validate new columns in orders
SELECT
  column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'orders'
  AND column_name IN (
    'order_number',
    'delivery_status',
    'subtotal',
    'discount_total',
    'delivery_price',
    'paid_amount',
    'payment_method',
    'payment_id',
    'source',
    'customer_name',
    'customer_phone',
    'customer_email',
    'customer_first_name',
    'customer_last_name',
    'customer_comment',
    'internal_comment',
    'updated_at'
  )
ORDER BY column_name;

-- 2. Validate new columns in order_items
SELECT
  column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'order_items'
  AND column_name IN (
    'sku',
    'product_name',
    'image',
    'discount',
    'total',
    'stock_status'
  )
ORDER BY column_name;

-- 3. Validate existence of order_history / order_comments
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('order_history', 'order_comments')
ORDER BY table_name;

-- 4. Orders without order_number
SELECT COUNT(*) AS orders_without_order_number
FROM orders
WHERE order_number IS NULL OR order_number = '';

-- 5. Orders without customer_name / customer_email / customer_phone
SELECT
  SUM(CASE WHEN customer_name IS NULL OR customer_name = '' THEN 1 ELSE 0 END) AS missing_customer_name,
  SUM(CASE WHEN customer_email IS NULL OR customer_email = '' THEN 1 ELSE 0 END) AS missing_customer_email,
  SUM(CASE WHEN customer_phone IS NULL OR customer_phone = '' THEN 1 ELSE 0 END) AS missing_customer_phone
FROM orders;

-- 6. order_items without total
SELECT COUNT(*) AS order_items_without_total
FROM order_items
WHERE total IS NULL;

-- 7. order_items without product_name / sku
SELECT
  SUM(CASE WHEN product_name IS NULL OR product_name = '' THEN 1 ELSE 0 END) AS missing_product_name,
  SUM(CASE WHEN sku IS NULL OR sku = '' THEN 1 ELSE 0 END) AS missing_sku
FROM order_items;

-- 8. API-sensitive legacy gaps in orders
SELECT
  SUM(CASE WHEN source IS NULL OR source = '' THEN 1 ELSE 0 END) AS missing_source,
  SUM(CASE WHEN delivery_status IS NULL OR delivery_status = '' THEN 1 ELSE 0 END) AS missing_delivery_status,
  SUM(CASE WHEN subtotal IS NULL THEN 1 ELSE 0 END) AS missing_subtotal,
  SUM(CASE WHEN discount_total IS NULL THEN 1 ELSE 0 END) AS missing_discount_total,
  SUM(CASE WHEN delivery_price IS NULL THEN 1 ELSE 0 END) AS missing_delivery_price,
  SUM(CASE WHEN paid_amount IS NULL THEN 1 ELSE 0 END) AS missing_paid_amount
FROM orders;

-- 9. API-sensitive legacy gaps in order_items
SELECT
  SUM(CASE WHEN total IS NULL THEN 1 ELSE 0 END) AS missing_total,
  SUM(CASE WHEN product_name IS NULL OR product_name = '' THEN 1 ELSE 0 END) AS missing_product_name,
  SUM(CASE WHEN stock_status IS NULL OR stock_status = '' THEN 1 ELSE 0 END) AS missing_stock_status
FROM order_items;

-- 10. Estimate rows that still likely require compatibility fallback
SELECT
  COUNT(*) AS orders_likely_requiring_fallback
FROM orders
WHERE order_number IS NULL
   OR subtotal IS NULL
   OR source IS NULL
   OR customer_name IS NULL
   OR customer_phone IS NULL;

