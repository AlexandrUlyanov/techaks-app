CREATE TABLE `loyalty_bonus_holds` (
  `id` serial NOT NULL,
  `user_id` int NOT NULL,
  `order_id` int NOT NULL,
  `amount` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `loyalty_bonus_holds_id` PRIMARY KEY (`id`),
  CONSTRAINT `loyalty_bonus_holds_order_unique` UNIQUE (`order_id`)
);

CREATE INDEX `loyalty_bonus_holds_user_status_idx`
  ON `loyalty_bonus_holds` (`user_id`, `status`, `expires_at`);
