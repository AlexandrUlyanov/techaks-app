ALTER TABLE `products`
  ADD COLUMN `external_code` varchar(120) NULL AFTER `ms_id`,
  ADD COLUMN `article` varchar(120) NULL AFTER `external_code`,
  ADD COLUMN `barcode` varchar(120) NULL AFTER `article`;

CREATE INDEX `products_external_code_idx`
  ON `products` (`external_code`);
CREATE INDEX `products_article_idx`
  ON `products` (`article`);
CREATE INDEX `products_barcode_idx`
  ON `products` (`barcode`);

ALTER TABLE `product_variants`
  ADD COLUMN `image` varchar(255) NULL AFTER `article`,
  ADD COLUMN `image_variants` json NULL AFTER `image`;
