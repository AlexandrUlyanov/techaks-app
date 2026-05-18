CREATE TABLE `badge_catalog` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `code` varchar(120) NOT NULL,
  `label` varchar(120) NOT NULL,
  `description` text,
  `badge_type` varchar(30) NOT NULL DEFAULT 'manual',
  `audience` varchar(20) NOT NULL DEFAULT 'customer',
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `source` varchar(20) NOT NULL DEFAULT 'manual',
  `icon` varchar(80),
  `color_token` varchar(80),
  `sort_order` int NOT NULL DEFAULT 0,
  `max_products_per_item` int NOT NULL DEFAULT 1,
  `is_visible_on_site` boolean NOT NULL DEFAULT true,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `badge_catalog_id` PRIMARY KEY(`id`),
  CONSTRAINT `badge_catalog_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `badge_category_scope` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `badge_id` int NOT NULL,
  `scope_type` varchar(20) NOT NULL DEFAULT 'category',
  `scope_id` int,
  `is_enabled` boolean NOT NULL DEFAULT true,
  `priority` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `badge_category_scope_id` PRIMARY KEY(`id`),
  CONSTRAINT `badge_category_scope_unique` UNIQUE(`badge_id`,`scope_type`,`scope_id`)
);
--> statement-breakpoint
CREATE TABLE `badge_assignment_rules` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `badge_id` int NOT NULL,
  `category_id` int NOT NULL,
  `rule_type` varchar(30) NOT NULL DEFAULT 'ai_generated',
  `rule_json` json NOT NULL,
  `confidence_threshold` int NOT NULL DEFAULT 60,
  `is_enabled` boolean NOT NULL DEFAULT true,
  `source` varchar(20) NOT NULL DEFAULT 'manual',
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `badge_assignment_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_badge_assignments` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `product_id` int NOT NULL,
  `badge_id` int NOT NULL,
  `assignment_source` varchar(20) NOT NULL DEFAULT 'manual',
  `confidence` int,
  `explanation` text,
  `status` varchar(20) NOT NULL DEFAULT 'suggested',
  `is_visible_on_site` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `updated_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `product_badge_assignments_id` PRIMARY KEY(`id`),
  CONSTRAINT `product_badge_assignments_unique` UNIQUE(`product_id`,`badge_id`)
);
--> statement-breakpoint
CREATE TABLE `badge_ai_runs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `run_type` varchar(40) NOT NULL,
  `category_id` int,
  `model` varchar(120) NOT NULL,
  `prompt_version` varchar(40) NOT NULL DEFAULT 'v1',
  `status` varchar(20) NOT NULL DEFAULT 'running',
  `input_snapshot` json,
  `result_json` json,
  `error_text` text,
  `started_at` timestamp NOT NULL DEFAULT now(),
  `finished_at` timestamp,
  CONSTRAINT `badge_ai_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `badge_history` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `entity_type` varchar(30) NOT NULL,
  `entity_id` int NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `old_value` json,
  `new_value` json,
  `comment` text,
  `user_id` varchar(255) NOT NULL DEFAULT 'admin',
  `created_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `badge_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `badge_catalog_type_status_idx` ON `badge_catalog` (`badge_type`,`status`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `badge_catalog_source_status_idx` ON `badge_catalog` (`source`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `badge_category_scope_badge_idx` ON `badge_category_scope` (`badge_id`);
--> statement-breakpoint
CREATE INDEX `badge_category_scope_scope_idx` ON `badge_category_scope` (`scope_type`,`scope_id`,`is_enabled`);
--> statement-breakpoint
CREATE INDEX `badge_assignment_rules_badge_idx` ON `badge_assignment_rules` (`badge_id`,`is_enabled`);
--> statement-breakpoint
CREATE INDEX `badge_assignment_rules_category_idx` ON `badge_assignment_rules` (`category_id`,`is_enabled`);
--> statement-breakpoint
CREATE INDEX `product_badge_assignments_product_idx` ON `product_badge_assignments` (`product_id`,`status`);
--> statement-breakpoint
CREATE INDEX `product_badge_assignments_badge_idx` ON `product_badge_assignments` (`badge_id`,`status`);
--> statement-breakpoint
CREATE INDEX `badge_ai_runs_category_run_idx` ON `badge_ai_runs` (`category_id`,`run_type`,`started_at`);
--> statement-breakpoint
CREATE INDEX `badge_ai_runs_status_idx` ON `badge_ai_runs` (`status`,`started_at`);
--> statement-breakpoint
CREATE INDEX `badge_history_entity_idx` ON `badge_history` (`entity_type`,`entity_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `badge_history_action_idx` ON `badge_history` (`action_type`,`created_at`);
