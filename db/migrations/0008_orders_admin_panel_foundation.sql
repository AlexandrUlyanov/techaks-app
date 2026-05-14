ALTER TABLE `orders`
  ADD `order_number` varchar(64),
  ADD `delivery_status` varchar(30) NOT NULL DEFAULT 'not_required',
  ADD `subtotal` int NOT NULL DEFAULT 0,
  ADD `discount_total` int NOT NULL DEFAULT 0,
  ADD `delivery_price` int NOT NULL DEFAULT 0,
  ADD `paid_amount` int NOT NULL DEFAULT 0,
  ADD `delivery_service` varchar(80),
  ADD `delivery_city` varchar(120),
  ADD `delivery_region` varchar(120),
  ADD `delivery_postal_code` varchar(20),
  ADD `delivery_track_number` varchar(128),
  ADD `delivery_comment` text,
  ADD `shipped_at` timestamp NULL,
  ADD `delivered_at` timestamp NULL,
  ADD `payment_method` varchar(40),
  ADD `payment_id` varchar(128),
  ADD `paid_at` timestamp NULL,
  ADD `payment_error` text,
  ADD `source` varchar(20) NOT NULL DEFAULT 'site',
  ADD `manager_id` int,
  ADD `customer_name` varchar(255),
  ADD `customer_phone` varchar(30),
  ADD `customer_email` varchar(255),
  ADD `customer_first_name` varchar(120),
  ADD `customer_last_name` varchar(120),
  ADD `customer_comment` text,
  ADD `internal_comment` text,
  ADD `is_problem` boolean NOT NULL DEFAULT false,
  ADD `cancelled_at` timestamp NULL,
  ADD `cancelled_reason` text,
  ADD `completed_at` timestamp NULL,
  ADD `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;
--> statement-breakpoint
ALTER TABLE `order_items`
  ADD `sku` varchar(120),
  ADD `product_name` varchar(512),
  ADD `image` varchar(255),
  ADD `discount` int NOT NULL DEFAULT 0,
  ADD `total` int NOT NULL DEFAULT 0,
  ADD `stock_status` varchar(20) NOT NULL DEFAULT 'in_stock';
--> statement-breakpoint
CREATE TABLE `order_comments` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `order_id` int NOT NULL,
  `user_id` int,
  `comment_type` varchar(20) NOT NULL DEFAULT 'internal',
  `comment` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `order_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_history` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `order_id` int NOT NULL,
  `user_id` int,
  `action_type` varchar(80) NOT NULL,
  `old_value` json,
  `new_value` json,
  `comment` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `order_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `orders_order_number_idx` ON `orders` (`order_number`);
--> statement-breakpoint
CREATE INDEX `orders_created_at_idx` ON `orders` (`created_at`);
--> statement-breakpoint
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `orders_payment_status_idx` ON `orders` (`payment_status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `orders_delivery_status_idx` ON `orders` (`delivery_status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `orders_manager_idx` ON `orders` (`manager_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `orders_source_idx` ON `orders` (`source`,`created_at`);
--> statement-breakpoint
CREATE INDEX `orders_customer_phone_idx` ON `orders` (`customer_phone`);
--> statement-breakpoint
CREATE INDEX `orders_customer_email_idx` ON `orders` (`customer_email`);
--> statement-breakpoint
CREATE INDEX `orders_delivery_track_idx` ON `orders` (`delivery_track_number`);
--> statement-breakpoint
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);
--> statement-breakpoint
CREATE INDEX `order_items_product_id_idx` ON `order_items` (`product_id`);
--> statement-breakpoint
CREATE INDEX `order_items_sku_idx` ON `order_items` (`sku`);
--> statement-breakpoint
CREATE INDEX `order_comments_order_idx` ON `order_comments` (`order_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `order_comments_user_idx` ON `order_comments` (`user_id`);
--> statement-breakpoint
CREATE INDEX `order_history_order_idx` ON `order_history` (`order_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `order_history_action_idx` ON `order_history` (`action_type`,`created_at`);
--> statement-breakpoint
CREATE INDEX `order_history_user_idx` ON `order_history` (`user_id`);
