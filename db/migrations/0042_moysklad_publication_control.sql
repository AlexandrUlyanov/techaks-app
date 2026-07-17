ALTER TABLE `products`
  ADD COLUMN `is_published_from_moysklad` boolean NOT NULL DEFAULT true AFTER `is_active`;

CREATE INDEX `products_moysklad_publication_idx`
  ON `products` (`is_published_from_moysklad`, `is_active`, `is_auto_blocked`);
