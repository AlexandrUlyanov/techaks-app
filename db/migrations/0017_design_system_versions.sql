CREATE TABLE `design_theme_versions` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `version_number` int NOT NULL,
  `theme_name` varchar(120) NOT NULL,
  `action_type` varchar(30) NOT NULL DEFAULT 'publish',
  `theme_json` json NOT NULL,
  `change_summary` text,
  `change_details_json` json,
  `changed_by_user_id` int,
  `changed_by_display_name` varchar(255),
  `changed_by_role` varchar(40),
  `source_version_id` int,
  `published_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `design_theme_versions_id` PRIMARY KEY(`id`),
  CONSTRAINT `design_theme_versions_version_unique` UNIQUE(`version_number`)
);

CREATE INDEX `design_theme_versions_action_created_idx`
  ON `design_theme_versions` (`action_type`, `created_at`);

CREATE INDEX `design_theme_versions_published_at_idx`
  ON `design_theme_versions` (`published_at`, `created_at`);
