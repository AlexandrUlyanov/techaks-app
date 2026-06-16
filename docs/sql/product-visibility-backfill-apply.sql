-- TechAks product visibility controlled backfill
-- MySQL / MariaDB
--
-- Preconditions:
-- 1. Backup already created
-- 2. 0009_product_visibility_controls.sql already applied
-- 3. This script is run manually and separately from deploy
--
-- Safety rules:
-- - No schema changes
-- - No destructive operations
-- - No changes to is_active
-- - No indexes
-- - No backfill of unrelated product fields

START TRANSACTION;

-- 1. Block products with missing / zero / negative price.
UPDATE products
SET
  is_auto_blocked = 1,
  auto_block_reason = 'zero_price'
WHERE (price IS NULL OR price <= 0)
  AND (
    COALESCE(is_auto_blocked, 0) <> 1
    OR COALESCE(auto_block_reason, '') <> 'zero_price'
  );

-- 2. Remove only zero_price auto-block when the price is valid again.
-- Important: do not touch is_active.
UPDATE products
SET
  is_auto_blocked = 0,
  auto_block_reason = NULL
WHERE price > 0
  AND COALESCE(auto_block_reason, '') = 'zero_price';

COMMIT;

-- Post-check hints (run separately if desired):
-- SELECT COUNT(*) FROM products WHERE (price IS NULL OR price <= 0) AND COALESCE(is_auto_blocked, 0) = 0;
-- SELECT COUNT(*) FROM products WHERE price > 0 AND COALESCE(auto_block_reason, '') = 'zero_price';
