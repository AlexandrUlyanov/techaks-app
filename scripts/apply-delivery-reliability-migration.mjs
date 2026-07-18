import "dotenv/config";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const connection = await mysql.createConnection(databaseUrl);

async function hasColumn(tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [tableName, columnName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function hasIndex(tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [tableName, indexName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (await hasColumn(tableName, columnName)) return;
  await connection.execute(
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`,
  );
  console.log(`${tableName}.${columnName} added`);
}

try {
  if (!(await hasColumn("orders", "delivery_quote_id"))) {
    await connection.execute(
      "ALTER TABLE `orders` ADD COLUMN `delivery_quote_id` varchar(36) NULL AFTER `delivery_price`",
    );
  }
  if (!(await hasIndex("orders", "orders_delivery_quote_idx"))) {
    await connection.execute(
      "CREATE INDEX `orders_delivery_quote_idx` ON `orders` (`delivery_quote_id`)",
    );
  }

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS delivery_quotes (
      id serial NOT NULL,
      public_id varchar(36) NOT NULL,
      order_id int NULL,
      user_id int NULL,
      status varchar(20) NOT NULL DEFAULT 'active',
      provider varchar(40) NOT NULL DEFAULT 'yandex_delivery',
      cart_fingerprint varchar(64) NOT NULL,
      source_store_id int NOT NULL,
      source_store_name varchar(255) NULL,
      source_address text NOT NULL,
      destination_address text NOT NULL,
      destination_coordinates json NULL,
      provider_offer_id varchar(128) NULL,
      price int NOT NULL,
      currency varchar(8) NOT NULL DEFAULT 'RUB',
      eta_minutes int NULL,
      raw_json json NULL,
      expires_at timestamp NOT NULL,
      consumed_at timestamp NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY delivery_quotes_public_id_unique (public_id),
      KEY delivery_quotes_status_expiry_idx (status, expires_at),
      KEY delivery_quotes_cart_idx (cart_fingerprint),
      KEY delivery_quotes_order_idx (order_id)
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS delivery_jobs (
      id serial NOT NULL,
      order_id int NOT NULL,
      type varchar(24) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'pending',
      idempotency_key varchar(160) NOT NULL,
      attempts int NOT NULL DEFAULT 0,
      max_attempts int NOT NULL DEFAULT 8,
      run_after timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_at timestamp NULL,
      locked_by varchar(64) NULL,
      last_error text NULL,
      payload_json json NULL,
      completed_at timestamp NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY delivery_jobs_idempotency_key_unique (idempotency_key),
      KEY delivery_jobs_queue_idx (status, run_after, id),
      KEY delivery_jobs_order_idx (order_id, created_at)
    )
  `);

  await addColumnIfMissing(
    "orders",
    "delivery_provider_price",
    "int NULL AFTER `delivery_price`",
  );
  await addColumnIfMissing(
    "orders",
    "delivery_pricing_policy_json",
    "json NULL AFTER `delivery_provider_price`",
  );
  await addColumnIfMissing(
    "orders",
    "delivery_package_snapshot_json",
    "json NULL AFTER `delivery_pricing_policy_json`",
  );
  await addColumnIfMissing(
    "orders",
    "delivery_eta_from",
    "timestamp NULL AFTER `delivery_provider_raw_json`",
  );
  await addColumnIfMissing(
    "orders",
    "delivery_eta_to",
    "timestamp NULL AFTER `delivery_eta_from`",
  );
  await addColumnIfMissing(
    "orders",
    "delivery_courier_json",
    "json NULL AFTER `delivery_eta_to`",
  );

  await addColumnIfMissing(
    "delivery_quotes",
    "provider_price",
    "int NULL AFTER `price`",
  );
  await addColumnIfMissing(
    "delivery_quotes",
    "pricing_policy_json",
    "json NULL AFTER `provider_price`",
  );
  await addColumnIfMissing(
    "delivery_quotes",
    "package_snapshot_json",
    "json NULL AFTER `pricing_policy_json`",
  );

  await addColumnIfMissing(
    "products",
    "delivery_allowed",
    "boolean NOT NULL DEFAULT true AFTER `auto_block_reason`",
  );
  await addColumnIfMissing(
    "products",
    "delivery_restriction_reason",
    "varchar(255) NULL AFTER `delivery_allowed`",
  );

  console.log("Delivery reliability and commercial schema is ready.");
} finally {
  await connection.end();
}
