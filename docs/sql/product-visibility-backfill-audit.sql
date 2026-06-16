-- TechAks product visibility backfill audit
-- MySQL / MariaDB read-only audit
-- Safe to run separately before any backfill apply.

SELECT DATABASE() AS current_database;

SELECT COUNT(*) AS total_products
FROM products;

SELECT COUNT(*) AS manually_inactive_products
FROM products
WHERE is_active = 0;

SELECT COUNT(*) AS auto_blocked_products
FROM products
WHERE is_auto_blocked = 1;

SELECT COUNT(*) AS zero_price_not_blocked
FROM products
WHERE (price IS NULL OR price <= 0)
  AND COALESCE(is_auto_blocked, 0) = 0;

SELECT COUNT(*) AS zero_price_with_wrong_reason
FROM products
WHERE (price IS NULL OR price <= 0)
  AND COALESCE(is_auto_blocked, 0) = 1
  AND COALESCE(auto_block_reason, '') <> 'zero_price';

SELECT COUNT(*) AS valid_price_still_zero_price_blocked
FROM products
WHERE price > 0
  AND COALESCE(auto_block_reason, '') = 'zero_price';

SELECT COUNT(*) AS visible_now
FROM products
WHERE is_active = 1
  AND COALESCE(is_auto_blocked, 0) = 0
  AND price > 0;

SELECT id, slug, name, price, is_active, is_auto_blocked, auto_block_reason
FROM products
WHERE (price IS NULL OR price <= 0)
  AND COALESCE(is_auto_blocked, 0) = 0
ORDER BY id
LIMIT 100;

SELECT id, slug, name, price, is_active, is_auto_blocked, auto_block_reason
FROM products
WHERE price > 0
  AND COALESCE(auto_block_reason, '') = 'zero_price'
ORDER BY id
LIMIT 100;
