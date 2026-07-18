ALTER TABLE `products`
  ADD COLUMN `delivery_allowed` boolean NOT NULL DEFAULT true AFTER `auto_block_reason`,
  ADD COLUMN `delivery_restriction_reason` varchar(255) NULL AFTER `delivery_allowed`;
