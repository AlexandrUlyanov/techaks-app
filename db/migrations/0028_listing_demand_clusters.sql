CREATE TABLE `listing_demand_clusters` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `listing_page_id` int NOT NULL,
  `primary_query` varchar(255) NOT NULL,
  `supporting_queries_json` json,
  `synonyms_json` json,
  `negatives_json` json,
  `intent` varchar(30) NOT NULL DEFAULT 'commercial',
  `source` varchar(40) NOT NULL DEFAULT 'manual',
  `source_label` varchar(120),
  `impressions` int NOT NULL DEFAULT 0,
  `clicks` int NOT NULL DEFAULT 0,
  `ctr` decimal(7,2),
  `avg_position` decimal(7,2),
  `notes` text,
  `last_imported_at` timestamp NULL,
  `created_by` int,
  `updated_by` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `listing_demand_clusters_id` PRIMARY KEY(`id`),
  CONSTRAINT `listing_demand_clusters_listing_unique` UNIQUE(`listing_page_id`)
);
--> statement-breakpoint
CREATE INDEX `listing_demand_clusters_source_idx` ON `listing_demand_clusters` (`source`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `listing_demand_clusters_intent_idx` ON `listing_demand_clusters` (`intent`,`updated_at`);
