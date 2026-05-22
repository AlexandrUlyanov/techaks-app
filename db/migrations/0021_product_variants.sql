CREATE TABLE `product_variants` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `product_id` int NOT NULL,
  `ms_id` varchar(100),
  `external_code` varchar(120),
  `name` varchar(512) NOT NULL,
  `article` varchar(120),
  `price` int NOT NULL DEFAULT 0,
  `stock` int NOT NULL DEFAULT 0,
  `attributes_json` json,
  `is_active` boolean NOT NULL DEFAULT true,
  `last_synced_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `product_variants_id` PRIMARY KEY(`id`),
  CONSTRAINT `product_variants_ms_id_unique` UNIQUE(`ms_id`)
);

CREATE INDEX `product_variants_product_active_idx`
  ON `product_variants` (`product_id`,`is_active`,`price`);
CREATE INDEX `product_variants_external_code_idx`
  ON `product_variants` (`external_code`);
CREATE INDEX `product_variants_article_idx`
  ON `product_variants` (`article`);

CREATE TABLE `product_variant_stocks` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `variant_id` int NOT NULL,
  `store_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT 0,
  CONSTRAINT `product_variant_stocks_id` PRIMARY KEY(`id`)
);

CREATE INDEX `product_variant_stocks_variant_store_idx`
  ON `product_variant_stocks` (`variant_id`,`store_id`);
CREATE INDEX `product_variant_stocks_store_variant_idx`
  ON `product_variant_stocks` (`store_id`,`variant_id`);

ALTER TABLE `product_reservations`
  ADD COLUMN `variant_id` int NULL AFTER `product_id`;
CREATE INDEX `product_reservations_product_variant_store_status_idx`
  ON `product_reservations` (`product_id`,`variant_id`,`store_id`,`status`,`reserved_until`);

ALTER TABLE `order_items`
  ADD COLUMN `variant_id` int NULL AFTER `product_id`,
  ADD COLUMN `variant_name` varchar(512) NULL AFTER `variant_id`,
  ADD COLUMN `article` varchar(120) NULL AFTER `variant_name`;
CREATE INDEX `order_items_variant_id_idx`
  ON `order_items` (`variant_id`);
