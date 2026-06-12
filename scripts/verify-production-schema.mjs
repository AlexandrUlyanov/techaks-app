import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "db", "migrations");

function parseCreateTables(sql) {
  const matches = [...sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`([^`]+)`/gi)];
  return matches.map((match) => match[1]);
}

function parseAddedColumns(sql) {
  const results = [];
  const alterTablePattern = /ALTER\s+TABLE\s+`([^`]+)`([\s\S]*?);/gi;

  for (const match of sql.matchAll(alterTablePattern)) {
    const tableName = match[1];
    const alterBody = match[2] ?? "";
    const addColumnPattern = /ADD(?:\s+COLUMN)?\s+`([^`]+)`/gi;

    for (const columnMatch of alterBody.matchAll(addColumnPattern)) {
      results.push({
        tableName,
        columnName: columnMatch[1],
      });
    }
  }

  return results;
}

async function getMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

async function collectSchemaRequirements() {
  const migrationFiles = await getMigrationFiles();
  const requiredTables = new Map();
  const requiredColumns = new Map();

  for (const fileName of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, fileName);
    const sql = await fs.readFile(filePath, "utf8");

    for (const tableName of parseCreateTables(sql)) {
      requiredTables.set(tableName, fileName);
    }

    for (const { tableName, columnName } of parseAddedColumns(sql)) {
      requiredColumns.set(`${tableName}.${columnName}`, fileName);
    }
  }

  return {
    migrationFiles,
    requiredTables,
    requiredColumns,
  };
}

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

  const requirements = await collectSchemaRequirements();

  if (requirements.migrationFiles.length === 0) {
    console.log("No SQL migrations found. Schema verification skipped.");
    return;
  }

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const schemaName = new URL(databaseUrl).pathname.replace(/^\/+/, "");
    if (!schemaName) {
      throw new Error("Could not determine schema name from DATABASE_URL.");
    }

    const existingTables = await readExistingTables(connection, schemaName);
    const tableNames = [...requirements.requiredTables.keys()];
    const existingColumns = await readExistingColumns(connection, schemaName, tableNames);

    const missingTables = tableNames
      .filter((tableName) => !existingTables.has(tableName))
      .map((tableName) => ({
        tableName,
        migration: requirements.requiredTables.get(tableName),
      }));

    const missingColumns = [...requirements.requiredColumns.entries()]
      .filter(([qualifiedName]) => !existingColumns.has(qualifiedName))
      .map(([qualifiedName, migration]) => {
        const [tableName, columnName] = qualifiedName.split(".");
        return {
          tableName,
          columnName,
          migration,
        };
      });

    if (missingTables.length === 0 && missingColumns.length === 0) {
      console.log(
        `Schema verification passed: ${existingTables.size} tables checked against ${requirements.migrationFiles.length} migration files.`,
      );
      return;
    }

    console.error("Production schema drift detected. Deploy must stop before restart.");

    if (missingTables.length > 0) {
      console.error("Missing tables:");
      for (const item of missingTables) {
        console.error(`  - ${item.tableName} (required by ${item.migration})`);
      }
    }

    if (missingColumns.length > 0) {
      console.error("Missing columns:");
      for (const item of missingColumns) {
        console.error(`  - ${item.tableName}.${item.columnName} (required by ${item.migration})`);
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
