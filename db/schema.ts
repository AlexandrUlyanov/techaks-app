import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/mysql-core";

export const leads = mysqlTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  message: text("message"),
  type: varchar("type", { length: 50 }).notNull().default("callback"),
  source: varchar("source", { length: 100 }).notNull().default("website"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
