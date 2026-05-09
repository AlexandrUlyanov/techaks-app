CREATE TABLE `product_normalization_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`product_name` varchar(512) NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'manual',
	`status` varchar(20) NOT NULL,
	`moved_spec_count` int NOT NULL DEFAULT 0,
	`conflict_count` int NOT NULL DEFAULT 0,
	`old_description` text,
	`new_description` text,
	`old_specs` json,
	`new_specs` json,
	`conflicts` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_normalization_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_spec_values` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`category_id` int NOT NULL,
	`spec_key` varchar(120) NOT NULL,
	`normalized_key` varchar(120) NOT NULL,
	`spec_value` varchar(512) NOT NULL,
	`normalized_value` varchar(512) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_spec_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `product_normalization_logs_product_idx` ON `product_normalization_logs` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_normalization_logs_created_at_idx` ON `product_normalization_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `product_spec_values_product_idx` ON `product_spec_values` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_spec_values_category_key_idx` ON `product_spec_values` (`category_id`,`normalized_key`);--> statement-breakpoint
CREATE INDEX `product_spec_values_lookup_idx` ON `product_spec_values` (`normalized_key`,`normalized_value`);
