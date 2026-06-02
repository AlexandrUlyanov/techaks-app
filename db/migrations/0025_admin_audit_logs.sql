CREATE TABLE `admin_audit_logs` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `actor_user_id` int NULL,
  `actor_email` varchar(255) NULL,
  `actor_role` varchar(80) NULL,
  `action` varchar(120) NOT NULL,
  `entity_type` varchar(80) NOT NULL,
  `entity_id` int NULL,
  `entity_label` varchar(255) NULL,
  `before_json` json NULL,
  `after_json` json NULL,
  `meta_json` json NULL,
  `ip` varchar(128) NULL,
  `user_agent` varchar(512) NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);

CREATE INDEX `admin_audit_logs_entity_idx` ON `admin_audit_logs` (`entity_type`,`entity_id`,`created_at`);
CREATE INDEX `admin_audit_logs_actor_idx` ON `admin_audit_logs` (`actor_user_id`,`created_at`);
CREATE INDEX `admin_audit_logs_action_idx` ON `admin_audit_logs` (`action`,`created_at`);
CREATE INDEX `admin_audit_logs_created_idx` ON `admin_audit_logs` (`created_at`);
