CREATE TABLE `product_reviews` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `product_id` int NOT NULL,
  `user_id` int NOT NULL,
  `order_id` int,
  `status` varchar(30) NOT NULL DEFAULT 'pending_moderation',
  `rating` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `text` text NOT NULL,
  `pros` text,
  `cons` text,
  `usage_context` varchar(120),
  `usage_duration` varchar(120),
  `is_recommended` boolean,
  `is_verified_purchase` boolean NOT NULL DEFAULT false,
  `moderation_note` text,
  `published_at` timestamp,
  `rejected_at` timestamp,
  `hidden_at` timestamp,
  `store_reply` text,
  `store_reply_author_id` int,
  `store_reply_created_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `product_reviews_id` PRIMARY KEY(`id`),
  CONSTRAINT `product_reviews_user_product_unique` UNIQUE(`user_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `product_review_history` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `review_id` int NOT NULL,
  `actor_user_id` int,
  `action_type` varchar(50) NOT NULL,
  `old_status` varchar(30),
  `new_status` varchar(30),
  `note` text,
  `payload_json` json,
  `created_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `product_review_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_review_requests` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `product_id` int NOT NULL,
  `user_id` int NOT NULL,
  `order_id` int NOT NULL,
  `request_status` varchar(30) NOT NULL DEFAULT 'pending',
  `initial_sent_at` timestamp,
  `reminder_sent_at` timestamp,
  `completed_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `product_review_requests_id` PRIMARY KEY(`id`),
  CONSTRAINT `product_review_requests_order_product_unique` UNIQUE(`order_id`,`product_id`)
);
--> statement-breakpoint
CREATE INDEX `product_reviews_product_status_idx` ON `product_reviews` (`product_id`,`status`,`published_at`);
--> statement-breakpoint
CREATE INDEX `product_reviews_user_status_idx` ON `product_reviews` (`user_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `product_reviews_order_idx` ON `product_reviews` (`order_id`);
--> statement-breakpoint
CREATE INDEX `product_review_history_review_idx` ON `product_review_history` (`review_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `product_review_history_action_idx` ON `product_review_history` (`action_type`,`created_at`);
--> statement-breakpoint
CREATE INDEX `product_review_requests_user_status_idx` ON `product_review_requests` (`user_id`,`request_status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `product_review_requests_product_idx` ON `product_review_requests` (`product_id`);
