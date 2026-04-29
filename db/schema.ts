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
  status: varchar("status", { length: 20 }).notNull().default("new"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = mysqlTable("categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  sortOrder: int("sort_order").notNull().default(0),
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

export const stores = mysqlTable("stores", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  hours: varchar("hours", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  rating: decimal("rating", { precision: 2, scale: 1 }).notNull().default("0.0"),
  reviewCount: int("review_count").notNull().default(0),
  image: varchar("image", { length: 255 }).notNull(),
  mapUrl: text("map_url"),
  sortOrder: int("sort_order").notNull().default(0),
});

export const reviews = mysqlTable("reviews", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  author: varchar("author", { length: 255 }).notNull(),
  rating: int("rating").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const banners = mysqlTable("banners", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().default("").unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }),
  content: text("content"),
  image: varchar("image", { length: 255 }).notNull(),
  link: varchar("link", { length: 255 }),
  active: boolean("active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const posts = mysqlTable("posts", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).notNull().default("Новости"),
  image: varchar("image", { length: 255 }).notNull(),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
