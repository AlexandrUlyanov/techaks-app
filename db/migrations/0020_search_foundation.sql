CREATE TABLE `search_documents` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `entity_type` varchar(30) NOT NULL,
  `entity_id` int NOT NULL,
  `title` varchar(512) NOT NULL,
  `subtitle` varchar(512),
  `content_text` text,
  `attributes_text` text,
  `exact_text` text,
  `url` varchar(512) NOT NULL,
  `image_url` varchar(512),
  `price` int,
  `old_price` int,
  `brand_id` int,
  `brand_name` varchar(255),
  `category_id` int,
  `category_name` varchar(255),
  `sku` varchar(120),
  `article` varchar(120),
  `barcode` varchar(120),
  `external_code` varchar(120),
  `moysklad_id` varchar(120),
  `is_active` boolean NOT NULL DEFAULT true,
  `is_visible` boolean NOT NULL DEFAULT true,
  `in_stock` boolean NOT NULL DEFAULT true,
  `stock_count` int NOT NULL DEFAULT 0,
  `sort_weight` int NOT NULL DEFAULT 0,
  `popularity_score` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `indexed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `search_documents_id` PRIMARY KEY(`id`),
  CONSTRAINT `search_documents_entity_unique` UNIQUE(`entity_type`, `entity_id`)
);

CREATE INDEX `search_documents_entity_idx`
  ON `search_documents` (`entity_type`, `entity_id`);
CREATE INDEX `search_documents_active_visible_idx`
  ON `search_documents` (`is_active`, `is_visible`);
CREATE INDEX `search_documents_category_idx`
  ON `search_documents` (`category_id`);
CREATE INDEX `search_documents_brand_idx`
  ON `search_documents` (`brand_id`);
CREATE INDEX `search_documents_price_idx`
  ON `search_documents` (`price`);
CREATE INDEX `search_documents_stock_idx`
  ON `search_documents` (`in_stock`);
CREATE INDEX `search_documents_sku_idx`
  ON `search_documents` (`sku`);
CREATE INDEX `search_documents_article_idx`
  ON `search_documents` (`article`);
CREATE INDEX `search_documents_barcode_idx`
  ON `search_documents` (`barcode`);

ALTER TABLE `search_documents`
  ADD FULLTEXT INDEX `ft_search_title` (`title`);
ALTER TABLE `search_documents`
  ADD FULLTEXT INDEX `ft_search_content` (`content_text`);
ALTER TABLE `search_documents`
  ADD FULLTEXT INDEX `ft_search_attributes` (`attributes_text`);
ALTER TABLE `search_documents`
  ADD FULLTEXT INDEX `ft_search_exact` (`exact_text`);

CREATE TABLE `search_synonyms` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `term` varchar(120) NOT NULL,
  `synonyms_json` json NOT NULL,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `search_synonyms_id` PRIMARY KEY(`id`),
  CONSTRAINT `search_synonyms_term_unique` UNIQUE(`term`)
);

CREATE INDEX `search_synonyms_active_idx`
  ON `search_synonyms` (`is_active`, `term`);

CREATE TABLE `search_terms` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `term` varchar(120) NOT NULL,
  `normalized_term` varchar(120) NOT NULL,
  `source` varchar(30) NOT NULL DEFAULT 'document',
  `weight` int NOT NULL DEFAULT 1,
  `usage_count` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `search_terms_id` PRIMARY KEY(`id`),
  CONSTRAINT `search_terms_normalized_source_unique`
    UNIQUE(`normalized_term`, `source`)
);

CREATE INDEX `search_terms_normalized_idx`
  ON `search_terms` (`normalized_term`);
CREATE INDEX `search_terms_usage_idx`
  ON `search_terms` (`usage_count`, `weight`);

CREATE TABLE `search_logs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `query` varchar(255) NOT NULL,
  `normalized_query` varchar(255) NOT NULL,
  `corrected_query` varchar(255),
  `results_count` int NOT NULL DEFAULT 0,
  `user_id` int,
  `session_id` varchar(120),
  `ip_hash` varchar(128),
  `user_agent_hash` varchar(128),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `search_logs_id` PRIMARY KEY(`id`)
);

CREATE INDEX `search_logs_normalized_created_idx`
  ON `search_logs` (`normalized_query`, `created_at`);
CREATE INDEX `search_logs_user_idx`
  ON `search_logs` (`user_id`, `created_at`);
CREATE INDEX `search_logs_session_idx`
  ON `search_logs` (`session_id`, `created_at`);

CREATE TABLE `search_click_logs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `search_log_id` int NOT NULL,
  `entity_type` varchar(30) NOT NULL,
  `entity_id` int NOT NULL,
  `position` int NOT NULL DEFAULT 0,
  `url` varchar(512) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `search_click_logs_id` PRIMARY KEY(`id`)
);

CREATE INDEX `search_click_logs_search_log_idx`
  ON `search_click_logs` (`search_log_id`, `created_at`);
CREATE INDEX `search_click_logs_entity_idx`
  ON `search_click_logs` (`entity_type`, `entity_id`, `created_at`);

CREATE TABLE `search_reindex_jobs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `entity_type` varchar(30) NOT NULL,
  `entity_id` int,
  `reason` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT 0,
  `last_error` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` timestamp,
  `finished_at` timestamp,
  CONSTRAINT `search_reindex_jobs_id` PRIMARY KEY(`id`)
);

CREATE INDEX `search_reindex_jobs_status_created_idx`
  ON `search_reindex_jobs` (`status`, `created_at`);
CREATE INDEX `search_reindex_jobs_entity_idx`
  ON `search_reindex_jobs` (`entity_type`, `entity_id`, `created_at`);
