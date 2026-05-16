ALTER TABLE `products` ADD `is_active` boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE `products` ADD `is_auto_blocked` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `products` ADD `auto_block_reason` varchar(50);
