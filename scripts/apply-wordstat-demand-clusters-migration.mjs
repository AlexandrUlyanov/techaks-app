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

async function isNullable(tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT IS_NULLABLE AS isNullable FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [tableName, columnName],
  );
  return Array.isArray(rows) && rows[0]?.isNullable === "YES";
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
  if (!(await isNullable("listing_demand_clusters", "listing_page_id"))) {
    await connection.execute(
      "ALTER TABLE `listing_demand_clusters` MODIFY COLUMN `listing_page_id` int NULL",
    );
  }

  await addColumnIfMissing(
    "listing_demand_clusters",
    "target_type",
    "varchar(20) NOT NULL DEFAULT 'listing' AFTER `id`",
  );
  await addColumnIfMissing(
    "listing_demand_clusters",
    "product_id",
    "int NULL AFTER `listing_page_id`",
  );
  await addColumnIfMissing(
    "listing_demand_clusters",
    "last_synced_at",
    "timestamp NULL AFTER `last_imported_at`",
  );

  await connection.execute(
    `UPDATE listing_demand_clusters SET target_type = 'listing'
     WHERE target_type IS NULL OR target_type = ''`,
  );

  if (!(await hasIndex("listing_demand_clusters", "listing_demand_clusters_product_unique"))) {
    await connection.execute(
      "CREATE UNIQUE INDEX `listing_demand_clusters_product_unique` ON `listing_demand_clusters` (`product_id`)",
    );
  }
  if (!(await hasIndex("listing_demand_clusters", "listing_demand_clusters_target_idx"))) {
    await connection.execute(
      "CREATE INDEX `listing_demand_clusters_target_idx` ON `listing_demand_clusters` (`target_type`, `last_synced_at`)",
    );
  }

  await connection.execute(`CREATE TABLE IF NOT EXISTS demand_cluster_queries (
    id serial AUTO_INCREMENT NOT NULL,
    cluster_id int NOT NULL,
    query varchar(512) NOT NULL,
    normalized_query varchar(512) NOT NULL,
    kind varchar(30) NOT NULL DEFAULT 'result',
    count_30d int NOT NULL DEFAULT 0,
    decision varchar(30) NOT NULL DEFAULT 'suggested',
    source varchar(40) NOT NULL DEFAULT 'yandex_wordstat',
    rank int NOT NULL DEFAULT 0,
    region_ids_json json NULL,
    fetched_at timestamp NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY demand_cluster_queries_cluster_query_unique (cluster_id, normalized_query),
    KEY demand_cluster_queries_cluster_decision_idx (cluster_id, decision, rank)
  )`);

  await connection.execute(`CREATE TABLE IF NOT EXISTS wordstat_sync_runs (
    id serial AUTO_INCREMENT NOT NULL,
    cluster_id int NOT NULL,
    seed_query varchar(512) NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'running',
    result_count int NOT NULL DEFAULT 0,
    association_count int NOT NULL DEFAULT 0,
    error_message text NULL,
    started_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at timestamp NULL,
    PRIMARY KEY (id),
    KEY wordstat_sync_runs_cluster_started_idx (cluster_id, started_at)
  )`);

  console.log("Wordstat demand cluster schema is ready.");
} finally {
  await connection.end();
}
