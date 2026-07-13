ALTER TABLE `orders`
  ADD COLUMN `delivery_quote_id` varchar(36) NULL AFTER `delivery_price`;

CREATE INDEX `orders_delivery_quote_idx`
  ON `orders` (`delivery_quote_id`);

CREATE TABLE `delivery_quotes` (
  `id` serial NOT NULL,
  `public_id` varchar(36) NOT NULL,
  `order_id` int NULL,
  `user_id` int NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `provider` varchar(40) NOT NULL DEFAULT 'yandex_delivery',
  `cart_fingerprint` varchar(64) NOT NULL,
  `source_store_id` int NOT NULL,
  `source_store_name` varchar(255) NULL,
  `source_address` text NOT NULL,
  `destination_address` text NOT NULL,
  `destination_coordinates` json NULL,
  `provider_offer_id` varchar(128) NULL,
  `price` int NOT NULL,
  `currency` varchar(8) NOT NULL DEFAULT 'RUB',
  `eta_minutes` int NULL,
  `raw_json` json NULL,
  `expires_at` timestamp NOT NULL,
  `consumed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `delivery_quotes_id` PRIMARY KEY (`id`),
  CONSTRAINT `delivery_quotes_public_id_unique` UNIQUE (`public_id`)
);

CREATE INDEX `delivery_quotes_status_expiry_idx`
  ON `delivery_quotes` (`status`, `expires_at`);
CREATE INDEX `delivery_quotes_cart_idx`
  ON `delivery_quotes` (`cart_fingerprint`);
CREATE INDEX `delivery_quotes_order_idx`
  ON `delivery_quotes` (`order_id`);

CREATE TABLE `delivery_jobs` (
  `id` serial NOT NULL,
  `order_id` int NOT NULL,
  `type` varchar(24) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `idempotency_key` varchar(160) NOT NULL,
  `attempts` int NOT NULL DEFAULT 0,
  `max_attempts` int NOT NULL DEFAULT 8,
  `run_after` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `locked_at` timestamp NULL,
  `locked_by` varchar(64) NULL,
  `last_error` text NULL,
  `payload_json` json NULL,
  `completed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `delivery_jobs_id` PRIMARY KEY (`id`),
  CONSTRAINT `delivery_jobs_idempotency_key_unique` UNIQUE (`idempotency_key`)
);

CREATE INDEX `delivery_jobs_queue_idx`
  ON `delivery_jobs` (`status`, `run_after`, `id`);
CREATE INDEX `delivery_jobs_order_idx`
  ON `delivery_jobs` (`order_id`, `created_at`);
