import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  int,
  boolean,
  decimal,
  json,
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

export const categories = mysqlTable("categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
});

export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  categoryId: int("category_id").notNull(),
  price: int("price").notNull(),
  oldPrice: int("old_price"),
  badge: varchar("badge", { length: 50 }),
  image: varchar("image", { length: 255 }).notNull(),
  description: text("description").notNull(),
  specs: json("specs").notNull(),
  inStock: boolean("in_stock").notNull().default(true),
  rating: decimal("rating", { precision: 2, scale: 1 }).notNull().default("0.0"),
  reviewCount: int("review_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
