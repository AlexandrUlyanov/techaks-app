import "dotenv/config";
import process from "node:process";
import mysql from "mysql2/promise";

const CRITICAL_TABLES = [
  {
    tableName: "categories",
    columns: ["image_url"],
    reason: "category preview images are required for catalog navigation",
  },
  {
    tableName: "products",
    columns: ["images", "image_variants", "is_active"],
    reason: "core storefront product cards and product pages rely on these fields",
  },
  {
    tableName: "orders",
    columns: ["payment_raw_response_json", "payment_provider_status"],
    reason: "payment flow and order diagnostics rely on these fields",
  },
];

async function readExistingTables(connection, schemaName) {
  const [rows] = await connection.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ?
    `,
    [schemaName],
  );

  return new Set(rows.map((row) => row.table_name));
}

async function readExistingColumns(connection, schemaName, tableNames) {
  if (tableNames.length === 0) {
    return new Set();
  }

  const placeholders = tableNames.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name IN (${placeholders})
    `,
    [schemaName, ...tableNames],
  );

  return new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to verify production schema.");
  }

  const schemaName = new URL(databaseUrl).pathname.replace(/^\/+/, "");
  if (!schemaName) {
    throw new Error("Could not determine schema name from DATABASE_URL.");
  }

  const connection = await mysql.createConnection(databaseUrl);

  try {
    const requiredTableNames = CRITICAL_TABLES.map((entry) => entry.tableName);
    const existingTables = await readExistingTables(connection, schemaName);
    const existingColumns = await readExistingColumns(connection, schemaName, requiredTableNames);

    const missingTables = CRITICAL_TABLES.filter((entry) => !existingTables.has(entry.tableName));
    const missingColumns = CRITICAL_TABLES.flatMap((entry) =>
      entry.columns
        .filter((columnName) => !existingColumns.has(`${entry.tableName}.${columnName}`))
        .map((columnName) => ({
          tableName: entry.tableName,
          columnName,
          reason: entry.reason,
        })),
    );

    if (missingTables.length === 0 && missingColumns.length === 0) {
      console.log(
        `Schema verification passed: checked ${CRITICAL_TABLES.length} critical schema contracts for production deploy.`,
      );
      return;
    }

    console.error("Production schema drift detected in critical storefront/payment contract.");

    if (missingTables.length > 0) {
      console.error("Missing critical tables:");
      for (const table of missingTables) {
        console.error(`  - ${table.tableName} (${table.reason})`);
      }
    }

    if (missingColumns.length > 0) {
      console.error("Missing critical columns:");
      for (const column of missingColumns) {
        console.error(`  - ${column.tableName}.${column.columnName} (${column.reason})`);
      }
    }

    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.stack || error.message || error.name
      : typeof error === "string"
        ? error
        : JSON.stringify(error, null, 2);
  console.error(`Schema verification failed: ${message}`);
  process.exitCode = 1;
});
