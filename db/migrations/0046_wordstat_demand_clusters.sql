ALTER TABLE `listing_demand_clusters`
  MODIFY COLUMN `listing_page_id` int NULL,
  ADD COLUMN `target_type` varchar(20) NOT NULL DEFAULT 'listing' AFTER `id`,
  ADD COLUMN `product_id` int NULL AFTER `listing_page_id`,
  ADD COLUMN `last_synced_at` timestamp NULL AFTER `last_imported_at`;
--> statement-breakpoint
UPDATE `listing_demand_clusters`
SET `target_type` = 'listing'
WHERE `target_type` IS NULL OR `target_type` = '';
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_demand_clusters_product_unique`
  ON `listing_demand_clusters` (`product_id`);
--> statement-breakpoint
CREATE INDEX `listing_demand_clusters_target_idx`
  ON `listing_demand_clusters` (`target_type`, `last_synced_at`);
--> statement-breakpoint
CREATE TABLE `demand_cluster_queries` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `cluster_id` int NOT NULL,
  `query` varchar(512) NOT NULL,
  `normalized_query` varchar(512) NOT NULL,
  `kind` varchar(30) NOT NULL DEFAULT 'result',
  `count_30d` int NOT NULL DEFAULT 0,
  `decision` varchar(30) NOT NULL DEFAULT 'suggested',
  `source` varchar(40) NOT NULL DEFAULT 'yandex_wordstat',
  `rank` int NOT NULL DEFAULT 0,
  `region_ids_json` json,
  `fetched_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `demand_cluster_queries_id` PRIMARY KEY (`id`),
  CONSTRAINT `demand_cluster_queries_cluster_query_unique`
    UNIQUE (`cluster_id`, `normalized_query`)
);
--> statement-breakpoint
CREATE INDEX `demand_cluster_queries_cluster_decision_idx`
  ON `demand_cluster_queries` (`cluster_id`, `decision`, `rank`);
--> statement-breakpoint
CREATE TABLE `wordstat_sync_runs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `cluster_id` int NOT NULL,
  `seed_query` varchar(512) NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'running',
  `result_count` int NOT NULL DEFAULT 0,
  `association_count` int NOT NULL DEFAULT 0,
  `error_message` text,
  `started_at` timestamp NOT NULL DEFAULT (now()),
  `finished_at` timestamp NULL,
  CONSTRAINT `wordstat_sync_runs_id` PRIMARY KEY (`id`)
);
--> statement-breakpoint
CREATE INDEX `wordstat_sync_runs_cluster_started_idx`
  ON `wordstat_sync_runs` (`cluster_id`, `started_at`);
