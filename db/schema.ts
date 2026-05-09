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
  index,
} from "drizzle-orm/mysql-core";

export const leads = mysqlTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
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
  name: varchar("name", { length: 512 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  sortOrder: int("sort_order").notNull().default(0),
});

export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  msId: varchar("ms_id", { length: 100 }), // MoySklad ID for syncing
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 512 }).notNull(),
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
  name: varchar("name", { length: 512 }).notNull(),
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

export const productNormalizationLogs = mysqlTable("product_normalization_logs", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  productName: varchar("product_name", { length: 512 }).notNull(),
  source: varchar("source", { length: 50 }).notNull().default("manual"),
  status: varchar("status", { length: 20 }).notNull(),
  movedSpecCount: int("moved_spec_count").notNull().default(0),
  conflictCount: int("conflict_count").notNull().default(0),
  oldDescription: text("old_description"),
  newDescription: text("new_description"),
  oldSpecs: json("old_specs"),
  newSpecs: json("new_specs"),
  conflicts: json("conflicts"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  productIdx: index("product_normalization_logs_product_idx").on(table.productId),
  createdAtIdx: index("product_normalization_logs_created_at_idx").on(table.createdAt),
}));

export const productSpecValues = mysqlTable("product_spec_values", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  categoryId: int("category_id").notNull(),
  specKey: varchar("spec_key", { length: 120 }).notNull(),
  normalizedKey: varchar("normalized_key", { length: 120 }).notNull(),
  specValue: varchar("spec_value", { length: 512 }).notNull(),
  normalizedValue: varchar("normalized_value", { length: 512 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  productIdx: index("product_spec_values_product_idx").on(table.productId),
  categoryKeyIdx: index("product_spec_values_category_key_idx").on(table.categoryId, table.normalizedKey),
  lookupIdx: index("product_spec_values_lookup_idx").on(table.normalizedKey, table.normalizedValue),
}));

export const productSpecRules = mysqlTable("product_spec_rules", {
  id: serial("id").primaryKey(),
  categoryId: int("category_id").notNull(),
  sourceKey: varchar("source_key", { length: 120 }).notNull(),
  sourceNormalizedKey: varchar("source_normalized_key", { length: 120 }).notNull(),
  targetKey: varchar("target_key", { length: 120 }).notNull(),
  targetNormalizedKey: varchar("target_normalized_key", { length: 120 }).notNull(),
  isVisible: boolean("is_visible").notNull().default(true),
  isFilterable: boolean("is_filterable").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  categorySourceIdx: index("product_spec_rules_category_source_idx").on(
    table.categoryId,
    table.sourceNormalizedKey
  ),
  categoryTargetIdx: index("product_spec_rules_category_target_idx").on(
    table.categoryId,
    table.targetNormalizedKey
  ),
}));

export const productMerchandising = mysqlTable("product_merchandising", {
  productId: int("product_id").primaryKey(),
  totalScore: int("total_score").notNull().default(0),
  priceScore: int("price_score").notNull().default(0),
  stockScore: int("stock_score").notNull().default(0),
  marginScore: int("margin_score").notNull().default(50),
  contentScore: int("content_score").notNull().default(0),
  newnessScore: int("newness_score").notNull().default(0),
  categoryPriorityScore: int("category_priority_score").notNull().default(50),
  manualPriority: int("manual_priority").notNull().default(0),
  penaltyScore: int("penalty_score").notNull().default(0),
  badges: json("badges").notNull(),
  status: varchar("status", { length: 40 }).notNull().default("manual_review"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isHiddenFromPromo: boolean("is_hidden_from_promo").notNull().default(false),
  comment: text("comment"),
  updatedBy: varchar("updated_by", { length: 255 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  totalScoreIdx: index("product_merchandising_score_idx").on(table.totalScore),
  statusIdx: index("product_merchandising_status_idx").on(table.status),
}));

export const merchandisingRules = mysqlTable("merchandising_rules", {
  id: serial("id").primaryKey(),
  scopeType: varchar("scope_type", { length: 20 }).notNull().default("global"),
  scopeId: int("scope_id"),
  priceWeight: int("price_weight").notNull().default(25),
  stockWeight: int("stock_weight").notNull().default(20),
  marginWeight: int("margin_weight").notNull().default(15),
  contentWeight: int("content_weight").notNull().default(15),
  newnessWeight: int("newness_weight").notNull().default(10),
  categoryWeight: int("category_weight").notNull().default(10),
  manualWeight: int("manual_weight").notNull().default(5),
  minScoreForTop: int("min_score_for_top").notNull().default(75),
  minScoreForRecommend: int("min_score_for_recommend").notNull().default(70),
  excellentPriceThreshold: int("excellent_price_threshold").notNull().default(90),
  newProductDays: int("new_product_days").notNull().default(30),
  minPromoStock: int("min_promo_stock").notNull().default(1),
  minMarginPercent: int("min_margin_percent").notNull().default(20),
  maxTopPercent: int("max_top_percent").notNull().default(15),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  scopeIdx: index("merchandising_rules_scope_idx").on(table.scopeType, table.scopeId),
}));

export const merchandisingHistory = mysqlTable("merchandising_history", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull().default("admin"),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  oldValue: json("old_value"),
  newValue: json("new_value"),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  productIdx: index("merchandising_history_product_idx").on(table.productId),
  createdAtIdx: index("merchandising_history_created_at_idx").on(table.createdAt),
}));
