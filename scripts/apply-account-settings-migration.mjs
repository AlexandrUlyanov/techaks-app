import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const connection = await mysql.createConnection(databaseUrl);

async function hasColumn(table, column) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function addColumn(table, column, definition) {
  if (await hasColumn(table, column)) return;
  await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`Added ${table}.${column}`);
}

try {
  await addColumn("users", "first_name", "varchar(120) NULL");
  await addColumn("users", "last_name", "varchar(120) NULL");
  await addColumn("users", "display_name", "varchar(160) NULL");
  await addColumn("users", "avatar_url", "text NULL");
  await addColumn("users", "language", "varchar(12) NOT NULL DEFAULT 'ru'");
  await addColumn("users", "timezone", "varchar(64) NOT NULL DEFAULT 'Europe/Moscow'");
  await addColumn("users", "marketing_consent", "boolean NOT NULL DEFAULT false");
  await addColumn("users", "marketing_consent_at", "timestamp NULL");
  await addColumn("users", "deactivated_at", "timestamp NULL");
  await addColumn("users", "updated_at", "timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP");

  await connection.query(`CREATE TABLE IF NOT EXISTS user_addresses (
    id serial PRIMARY KEY, user_id int NOT NULL, label varchar(80) NOT NULL DEFAULT 'Адрес',
    recipient_name varchar(255) NOT NULL, recipient_phone varchar(20) NOT NULL,
    country varchar(100) NOT NULL DEFAULT 'Россия', region varchar(160), city varchar(160) NOT NULL,
    street varchar(255) NOT NULL, house varchar(40) NOT NULL, apartment varchar(40), postcode varchar(20),
    courier_comment text, is_default boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX user_addresses_user_idx (user_id, is_default)
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id serial PRIMARY KEY, user_id int NOT NULL, order_email boolean NOT NULL DEFAULT true,
    order_push boolean NOT NULL DEFAULT true, order_in_app boolean NOT NULL DEFAULT true,
    marketing_email boolean NOT NULL DEFAULT false, marketing_push boolean NOT NULL DEFAULT false,
    price_drop_email boolean NOT NULL DEFAULT false, price_drop_push boolean NOT NULL DEFAULT false,
    consent_updated_at timestamp NULL, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY user_notification_preferences_user_unique (user_id)
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS account_sessions (
    id varchar(36) PRIMARY KEY, user_id int NOT NULL, user_agent varchar(512), device_label varchar(160),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp NOT NULL, revoked_at timestamp NULL,
    INDEX account_sessions_user_idx (user_id, revoked_at, last_seen_at)
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS account_email_change_requests (
    id serial PRIMARY KEY, user_id int NOT NULL, old_email varchar(255) NOT NULL, new_email varchar(255) NOT NULL,
    token_hash varchar(64) NOT NULL, expires_at timestamp NOT NULL, used_at timestamp NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY account_email_change_token_unique (token_hash),
    INDEX account_email_change_user_idx (user_id, created_at)
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS account_security_events (
    id serial PRIMARY KEY, user_id int NOT NULL, action varchar(80) NOT NULL, metadata_json json,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX account_security_events_user_idx (user_id, created_at)
  )`);
  console.log("Account settings schema is ready");
} finally {
  await connection.end();
}
