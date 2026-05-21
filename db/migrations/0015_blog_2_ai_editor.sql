ALTER TABLE `posts`
  ADD COLUMN `content_format` varchar(20) NOT NULL DEFAULT 'html',
  ADD COLUMN `og_image` varchar(255),
  ADD COLUMN `meta_title` varchar(255),
  ADD COLUMN `meta_description` text,
  ADD COLUMN `author_name` varchar(120) NOT NULL DEFAULT 'Techaks Editorial',
  ADD COLUMN `status` varchar(30) NOT NULL DEFAULT 'published',
  ADD COLUMN `featured` boolean NOT NULL DEFAULT false,
  ADD COLUMN `reading_time_minutes` int NOT NULL DEFAULT 1,
  ADD COLUMN `published_at` timestamp NULL,
  ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT now();
--> statement-breakpoint
UPDATE `posts`
SET
  `status` = CASE WHEN `published` = true THEN 'published' ELSE 'draft' END,
  `published_at` = CASE WHEN `published` = true THEN `created_at` ELSE NULL END,
  `updated_at` = `created_at`,
  `meta_title` = `title`,
  `meta_description` = `excerpt`,
  `og_image` = `image`,
  `author_name` = COALESCE(NULLIF(`author_name`, ''), 'Techaks Editorial'),
  `reading_time_minutes` = GREATEST(1, CEIL(CHAR_LENGTH(`content`) / 900));
--> statement-breakpoint
CREATE INDEX `posts_status_idx`
  ON `posts` (`status`,`published_at`,`created_at`);
--> statement-breakpoint
CREATE INDEX `posts_category_idx`
  ON `posts` (`category`,`published_at`);
--> statement-breakpoint
CREATE INDEX `posts_featured_idx`
  ON `posts` (`featured`,`published_at`);
--> statement-breakpoint
CREATE TABLE `blog_ai_runs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `post_id` int,
  `mode` varchar(40) NOT NULL,
  `prompt_version` varchar(40) NOT NULL DEFAULT 'v1',
  `model` varchar(120) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'running',
  `input_snapshot` json,
  `result_json` json,
  `error_text` text,
  `created_by_user_id` int,
  `created_at` timestamp NOT NULL DEFAULT now(),
  `finished_at` timestamp NULL,
  CONSTRAINT `blog_ai_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `blog_ai_runs_post_mode_idx`
  ON `blog_ai_runs` (`post_id`,`mode`,`created_at`);
--> statement-breakpoint
CREATE INDEX `blog_ai_runs_status_idx`
  ON `blog_ai_runs` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `blog_ai_suggestions` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `run_id` int NOT NULL,
  `post_id` int,
  `suggestion_type` varchar(40) NOT NULL,
  `content` text NOT NULL,
  `metadata_json` json,
  `status` varchar(20) NOT NULL DEFAULT 'suggested',
  `applied_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT now(),
  CONSTRAINT `blog_ai_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `blog_ai_suggestions_run_idx`
  ON `blog_ai_suggestions` (`run_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `blog_ai_suggestions_post_type_idx`
  ON `blog_ai_suggestions` (`post_id`,`suggestion_type`,`created_at`);
