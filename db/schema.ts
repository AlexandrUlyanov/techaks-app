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
  parentId: int("parent_id"), // Added for subcategories
  msId: varchar("ms_id", { length: 100 }), // MoySklad ID for syncing
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  sortOrder: int("sort_order").notNull().default(0),
});

export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  msId: varchar("ms_id", { length: 100 }), // MoySklad ID for syncing
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  categoryId: int("category_id").notNull(),
  price: int("price").notNull(),
  oldPrice: int("old_price"),
  badge: varchar("badge", { length: 50 }),
  image: varchar("image", { length: 255 }).notNull(),
  description: text("description").notNull(),
  specs: json("specs").notNull(),
  inStock: boolean("in_stock").notNull().default(true),
  rating: decimal("rating", { precision: 2, scale: 1 })
    .notNull()
    .default("0.0"),
  reviewCount: int("review_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stores = mysqlTable("stores", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  hours: varchar("hours", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  rating: decimal("rating", { precision: 2, scale: 1 })
    .notNull()
    .default("0.0"),
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
  slug: varchar("slug", { length: 255 }).notNull().default("").unique(),
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
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).notNull().default("Новости"),
  image: varchar("image", { length: 255 }).notNull(),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  userId: int("user_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, confirmed, shipped, delivered, cancelled
  totalPrice: int("total_price").notNull(),
  deliveryType: varchar("delivery_type", { length: 20 })
    .notNull()
    .default("pickup"), // pickup, delivery
  address: text("address"),
  paymentType: varchar("payment_type", { length: 20 })
    .notNull()
    .default("cash"), // cash, card, sbp
  paymentStatus: varchar("payment_status", { length: 20 })
    .notNull()
    .default("unpaid"), // unpaid, paid
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderItems = mysqlTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: int("order_id").notNull(),
  productId: int("product_id").notNull(),
  quantity: int("quantity").notNull().default(1),
  price: int("price").notNull(), // capture price at time of order
});

export const productStocks = mysqlTable("product_stocks", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  storeId: int("store_id").notNull(),
  quantity: int("quantity").notNull().default(0),
});

export const syncLogs = mysqlTable("sync_logs", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // 'moysklad', etc.
  status: varchar("status", { length: 20 }).notNull(), // 'success', 'error', 'running'
  message: text("message"),
  details: json("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
