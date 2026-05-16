-- Orders Phase 3 - Batch C
-- Additive-only migration draft for order_history and order_comments.
-- Do not run automatically. Review and execute only after approval.
-- Target DB: MySQL / MariaDB.

CREATE TABLE IF NOT EXISTS order_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  user_id INT NULL,
  action_type VARCHAR(80) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS order_comments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  user_id INT NULL,
  comment_type VARCHAR(20) NOT NULL DEFAULT 'internal',
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Optional indexes are intentionally not created in this batch.
-- They are prepared separately in Batch D.
-- No FOREIGN KEY constraints are added in Batch C.
