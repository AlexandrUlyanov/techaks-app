ALTER TABLE `orders`
  ADD COLUMN `store_id` int NULL,
  ADD COLUMN `reservation_id` int NULL;
--> statement-breakpoint
CREATE INDEX `orders_store_idx` ON `orders` (`store_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `orders_reservation_idx` ON `orders` (`reservation_id`);
--> statement-breakpoint
CREATE TABLE `product_reservations` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `product_id` int NOT NULL,
  `store_id` int NOT NULL,
  `user_id` int,
  `phone` varchar(40) NOT NULL,
  `customer_name` varchar(255),
  `quantity` int NOT NULL DEFAULT 1,
  `status` varchar(30) NOT NULL DEFAULT 'active',
  `reserved_until` timestamp NOT NULL,
  `source` varchar(40) NOT NULL DEFAULT 'product_page',
  `comment` text,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `product_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `product_reservations_product_store_status_idx`
  ON `product_reservations` (`product_id`,`store_id`,`status`,`reserved_until`);
--> statement-breakpoint
CREATE INDEX `product_reservations_user_status_idx`
  ON `product_reservations` (`user_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `product_reservations_phone_status_idx`
  ON `product_reservations` (`phone`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `product_reservations_store_status_idx`
  ON `product_reservations` (`store_id`,`status`,`reserved_until`);
