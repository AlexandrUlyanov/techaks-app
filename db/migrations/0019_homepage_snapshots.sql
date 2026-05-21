CREATE TABLE `homepage_snapshots` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `snapshot_key` varchar(120) NOT NULL DEFAULT 'default',
  `payload` json NOT NULL,
  `build_ms` int NOT NULL DEFAULT 0,
  `source_version` varchar(40),
  `last_error` text,
  `generated_at` timestamp NOT NULL DEFAULT (now()),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `homepage_snapshots_id` PRIMARY KEY(`id`),
  CONSTRAINT `homepage_snapshots_snapshot_key_unique` UNIQUE(`snapshot_key`)
);
