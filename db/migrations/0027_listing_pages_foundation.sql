CREATE TABLE `listing_pages` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'category',
  `category_id` int NOT NULL,
  `filter_key` varchar(120),
  `filter_value` varchar(255),
  `slug` varchar(255),
  `url` varchar(512) NOT NULL,
  `title` varchar(255),
  `meta_description` text,
  `h1` varchar(255),
  `intro_text` text,
  `bottom_text` text,
  `faq_json` json,
  `seo_text_status` varchar(20) NOT NULL DEFAULT 'empty',
  `indexation_mode` varchar(40) NOT NULL DEFAULT 'index',
  `canonical_url` varchar(512),
  `is_auto_generated` boolean NOT NULL DEFAULT false,
  `is_published` boolean NOT NULL DEFAULT true,
  `demand_score` int NOT NULL DEFAULT 0,
  `content_score` int NOT NULL DEFAULT 0,
  `duplicate_risk` varchar(20) NOT NULL DEFAULT 'low',
  `created_by` int,
  `updated_by` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `listing_pages_id` PRIMARY KEY(`id`),
  CONSTRAINT `listing_pages_url_unique` UNIQUE(`url`),
  CONSTRAINT `listing_pages_category_filter_unique` UNIQUE(`type`,`category_id`,`filter_key`,`filter_value`)
);
--> statement-breakpoint
CREATE INDEX `listing_pages_category_type_idx` ON `listing_pages` (`category_id`,`type`);
--> statement-breakpoint
CREATE INDEX `listing_pages_type_published_idx` ON `listing_pages` (`type`,`is_published`,`updated_at`);
--> statement-breakpoint

CREATE TABLE `listing_templates` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `scope` varchar(30) NOT NULL DEFAULT 'category',
  `name` varchar(120) NOT NULL,
  `title_template` text,
  `description_template` text,
  `h1_template` text,
  `intro_template` text,
  `bottom_template` text,
  `faq_template` text,
  `is_default` boolean NOT NULL DEFAULT false,
  `created_by` int,
  `updated_by` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `listing_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `listing_templates_scope_default_idx` ON `listing_templates` (`scope`,`is_default`);
--> statement-breakpoint

CREATE TABLE `listing_generation_runs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `listing_page_id` int NOT NULL,
  `template_id` int,
  `run_type` varchar(40) NOT NULL DEFAULT 'draft',
  `status` varchar(20) NOT NULL DEFAULT 'queued',
  `source` varchar(30) NOT NULL DEFAULT 'manual',
  `input_snapshot` json,
  `result_snapshot` json,
  `error_text` text,
  `started_at` timestamp NULL,
  `finished_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `listing_generation_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `listing_generation_runs_listing_status_idx` ON `listing_generation_runs` (`listing_page_id`,`status`,`created_at`);
--> statement-breakpoint

CREATE TABLE `listing_audit_logs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `listing_page_id` int,
  `actor_user_id` int,
  `action` varchar(120) NOT NULL,
  `before_json` json,
  `after_json` json,
  `meta_json` json,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `listing_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `listing_audit_logs_listing_created_idx` ON `listing_audit_logs` (`listing_page_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `listing_audit_logs_action_created_idx` ON `listing_audit_logs` (`action`,`created_at`);
