import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    const connection = mysql.createPool(env.databaseUrl);
    instance = drizzle(connection, {
      schema: fullSchema,
      mode: "default",
    });
  }
  return instance;
}
