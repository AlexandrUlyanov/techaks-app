CREATE TABLE `user_favorites` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `user_favorites_id` PRIMARY KEY(`id`),
  CONSTRAINT `user_favorites_user_product_unique` UNIQUE(`user_id`,`product_id`)
);

CREATE INDEX `user_favorites_user_idx` ON `user_favorites` (`user_id`,`created_at`);
CREATE INDEX `user_favorites_product_idx` ON `user_favorites` (`product_id`);
