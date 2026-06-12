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
  const [rows] = await connection.query(`SHOW TABLES FROM \`${schemaName}\``);
  return new Set(
    rows.map((row) => {
      const value = Object.values(row)[0];
      return typeof value === "string" ? value : String(value);
    }),
  );
}

async function readExistingColumns(connection, schemaName, tableNames) {
  const columns = new Set();

  for (const tableName of tableNames) {
    try {
      const [rows] = await connection.query(`SHOW COLUMNS FROM \`${schemaName}\`.\`${tableName}\``);
      for (const row of rows) {
        const columnName = row.Field;
        if (typeof columnName === "string") {
          columns.add(`${tableName}.${columnName}`);
        }
      }
    } catch {
      // Missing table is handled separately via readExistingTables.
    }
  }

  return columns;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to verify production schema.");
  }

  const parsedUrl = new URL(databaseUrl);
  const schemaName = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!schemaName) {
    throw new Error("Could not determine schema name from DATABASE_URL.");
  }

  const connection = await mysql.createConnection({
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: schemaName,
  });

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
