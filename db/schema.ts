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
  unique,
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
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  imageUrl: varchar("image_url", { length: 512 }),
  previewImages: json("preview_images"),
  previewImageExclusions: json("preview_image_exclusions"),
  icon: varchar("icon", { length: 50 }),
  sortOrder: int("sort_order").notNull().default(0),
});

export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  msId: varchar("ms_id", { length: 100 }), // MoySklad ID for syncing
  externalCode: varchar("external_code", { length: 120 }),
  article: varchar("article", { length: 120 }),
  barcode: varchar("barcode", { length: 120 }),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 512 }).notNull(),
  categoryId: int("category_id").notNull(),
  price: int("price").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isPublishedFromMoySklad: boolean("is_published_from_moysklad").notNull().default(true),
  isAutoBlocked: boolean("is_auto_blocked").notNull().default(false),
  autoBlockReason: varchar("auto_block_reason", { length: 50 }),
  deliveryAllowed: boolean("delivery_allowed").notNull().default(true),
  deliveryRestrictionReason: varchar("delivery_restriction_reason", { length: 255 }),
  oldPrice: int("old_price"),
  badge: varchar("badge", { length: 50 }),
  image: varchar("image", { length: 255 }).notNull(),
  imageVariants: json("image_variants"),
  images: json("images"),
  description: text("description").notNull(),
  specs: json("specs").notNull(),
  inStock: boolean("in_stock").notNull().default(true),
  rating: decimal("rating", { precision: 2, scale: 1 })
    .notNull()
    .default("0.0"),
  reviewCount: int("review_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productVariants = mysqlTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  msId: varchar("ms_id", { length: 100 }),
  externalCode: varchar("external_code", { length: 120 }),
  name: varchar("name", { length: 512 }).notNull(),
  article: varchar("article", { length: 120 }),
  image: varchar("image", { length: 255 }),
  imageVariants: json("image_variants"),
  images: json("images"),
  price: int("price").notNull().default(0),
  oldPrice: int("old_price"),
  stock: int("stock").notNull().default(0),
  attributesJson: json("attributes_json"),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  productActiveIdx: index("product_variants_product_active_idx").on(
    table.productId,
    table.isActive,
    table.price
  ),
  msIdIdx: unique("product_variants_ms_id_unique").on(table.msId),
  externalCodeIdx: index("product_variants_external_code_idx").on(table.externalCode),
  articleIdx: index("product_variants_article_idx").on(table.article),
}));

export const stores = mysqlTable("stores", {
  id: serial("id").primaryKey(),
  msId: varchar("ms_id", { length: 100 }),
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
  isPublic: boolean("is_public").notNull().default(true),
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

export const productReviews = mysqlTable("product_reviews", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  userId: int("user_id").notNull(),
  orderId: int("order_id"),
  status: varchar("status", { length: 30 }).notNull().default("pending_moderation"),
  rating: int("rating").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  text: text("text").notNull(),
  pros: text("pros"),
  cons: text("cons"),
  usageContext: varchar("usage_context", { length: 120 }),
  usageDuration: varchar("usage_duration", { length: 120 }),
  isRecommended: boolean("is_recommended"),
  isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
  moderationNote: text("moderation_note"),
  publishedAt: timestamp("published_at"),
  rejectedAt: timestamp("rejected_at"),
  hiddenAt: timestamp("hidden_at"),
  storeReply: text("store_reply"),
  storeReplyAuthorId: int("store_reply_author_id"),
  storeReplyCreatedAt: timestamp("store_reply_created_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  productStatusIdx: index("product_reviews_product_status_idx").on(
    table.productId,
    table.status,
    table.publishedAt
  ),
  userProductIdx: unique("product_reviews_user_product_unique").on(
    table.userId,
    table.productId
  ),
  userStatusIdx: index("product_reviews_user_status_idx").on(
    table.userId,
    table.status,
    table.updatedAt
  ),
  orderIdx: index("product_reviews_order_idx").on(table.orderId),
}));

export const productReviewHistory = mysqlTable("product_review_history", {
  id: serial("id").primaryKey(),
  reviewId: int("review_id").notNull(),
  actorUserId: int("actor_user_id"),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  oldStatus: varchar("old_status", { length: 30 }),
  newStatus: varchar("new_status", { length: 30 }),
  note: text("note"),
  payloadJson: json("payload_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  reviewIdx: index("product_review_history_review_idx").on(
    table.reviewId,
    table.createdAt
  ),
  actionIdx: index("product_review_history_action_idx").on(
    table.actionType,
    table.createdAt
  ),
}));

export const productReviewRequests = mysqlTable("product_review_requests", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  userId: int("user_id").notNull(),
  orderId: int("order_id").notNull(),
  requestStatus: varchar("request_status", { length: 30 }).notNull().default("pending"),
  initialSentAt: timestamp("initial_sent_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  orderProductUnique: unique("product_review_requests_order_product_unique").on(
    table.orderId,
    table.productId
  ),
  userStatusIdx: index("product_review_requests_user_status_idx").on(
    table.userId,
    table.requestStatus,
    table.updatedAt
  ),
  productIdx: index("product_review_requests_product_idx").on(table.productId),
}));

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
  contentFormat: varchar("content_format", { length: 20 })
    .notNull()
    .default("html"),
  category: varchar("category", { length: 50 }).notNull().default("Новости"),
  image: varchar("image", { length: 255 }).notNull(),
  ogImage: varchar("og_image", { length: 255 }),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  authorName: varchar("author_name", { length: 120 }).notNull().default("Techaks Editorial"),
  status: varchar("status", { length: 30 }).notNull().default("published"),
  featured: boolean("featured").notNull().default(false),
  readingTimeMinutes: int("reading_time_minutes").notNull().default(1),
  published: boolean("published").notNull().default(true),
  publishedAt: timestamp("published_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  statusIdx: index("posts_status_idx").on(table.status, table.publishedAt, table.createdAt),
  categoryIdx: index("posts_category_idx").on(table.category, table.publishedAt),
  featuredIdx: index("posts_featured_idx").on(table.featured, table.publishedAt),
}));

export const blogAiRuns = mysqlTable("blog_ai_runs", {
  id: serial("id").primaryKey(),
  postId: int("post_id"),
  mode: varchar("mode", { length: 40 }).notNull(),
  promptVersion: varchar("prompt_version", { length: 40 }).notNull().default("v1"),
  model: varchar("model", { length: 120 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  inputSnapshot: json("input_snapshot"),
  resultJson: json("result_json"),
  errorText: text("error_text"),
  createdByUserId: int("created_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, table => ({
  postModeIdx: index("blog_ai_runs_post_mode_idx").on(table.postId, table.mode, table.createdAt),
  statusIdx: index("blog_ai_runs_status_idx").on(table.status, table.createdAt),
}));

export const blogAiSuggestions = mysqlTable("blog_ai_suggestions", {
  id: serial("id").primaryKey(),
  runId: int("run_id").notNull(),
  postId: int("post_id"),
  suggestionType: varchar("suggestion_type", { length: 40 }).notNull(),
  content: text("content").notNull(),
  metadataJson: json("metadata_json"),
  status: varchar("status", { length: 20 }).notNull().default("suggested"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  runIdx: index("blog_ai_suggestions_run_idx").on(table.runId, table.createdAt),
  postTypeIdx: index("blog_ai_suggestions_post_type_idx").on(
    table.postId,
    table.suggestionType,
    table.createdAt
  ),
}));

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).unique(),
  fullName: varchar("full_name", { length: 255 }),
  firstName: varchar("first_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }),
  displayName: varchar("display_name", { length: 160 }),
  avatarUrl: text("avatar_url"),
  language: varchar("language", { length: 12 }).notNull().default("ru"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Europe/Moscow"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: varchar("role", { length: 40 }).notNull().default("customer"),
  status: varchar("status", { length: 40 }).notNull().default("active"),
  moyskladCounterpartyId: varchar("moysklad_counterparty_id", { length: 120 }),
  moyskladCounterpartyHref: text("moysklad_counterparty_href"),
  moyskladCounterpartyVersion: int("moysklad_counterparty_version"),
  moyskladCounterpartyExternalCode: varchar("moysklad_counterparty_external_code", {
    length: 120,
  }),
  loyaltyParticipantGroup: varchar("loyalty_participant_group", { length: 120 }),
  loyaltyParticipantTag: varchar("loyalty_participant_tag", { length: 120 }),
  loyaltyParticipantAssignedAt: timestamp("loyalty_participant_assigned_at"),
  loyaltyStatus: varchar("loyalty_status", { length: 30 }).notNull().default("pending"),
  loyaltyBalance: int("loyalty_balance").notNull().default(0),
  loyaltyAvailableToSpend: int("loyalty_available_to_spend").notNull().default(0),
  loyaltyPendingAccrual: int("loyalty_pending_accrual").notNull().default(0),
  loyaltyProgramName: varchar("loyalty_program_name", { length: 255 }),
  loyaltyProgramMetaHref: text("loyalty_program_meta_href"),
  loyaltyProfileJson: json("loyalty_profile_json"),
  loyaltyRulesJson: json("loyalty_rules_json"),
  loyaltyLastSyncedAt: timestamp("loyalty_last_synced_at"),
  loyaltyLastError: text("loyalty_last_error"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  marketingConsentAt: timestamp("marketing_consent_at"),
  deactivatedAt: timestamp("deactivated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  roleIdx: index("users_role_idx").on(table.role),
  statusIdx: index("users_status_idx").on(table.status),
  emailIdx: index("users_email_idx").on(table.email),
  loyaltyStatusIdx: index("users_loyalty_status_idx").on(
    table.loyaltyStatus,
    table.loyaltyLastSyncedAt
  ),
  loyalyCounterpartyIdx: index("users_loyalty_counterparty_idx").on(
    table.moyskladCounterpartyId
  ),
}));

export const userAddresses = mysqlTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: int("user_id").notNull(),
  label: varchar("label", { length: 80 }).notNull().default("Адрес"),
  recipientName: varchar("recipient_name", { length: 255 }).notNull(),
  recipientPhone: varchar("recipient_phone", { length: 20 }).notNull(),
  country: varchar("country", { length: 100 }).notNull().default("Россия"),
  region: varchar("region", { length: 160 }),
  city: varchar("city", { length: 160 }).notNull(),
  street: varchar("street", { length: 255 }).notNull(),
  house: varchar("house", { length: 40 }).notNull(),
  apartment: varchar("apartment", { length: 40 }),
  postcode: varchar("postcode", { length: 20 }),
  courierComment: text("courier_comment"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  userIdx: index("user_addresses_user_idx").on(table.userId, table.isDefault),
}));

export const userNotificationPreferences = mysqlTable("user_notification_preferences", {
  id: serial("id").primaryKey(),
  userId: int("user_id").notNull().unique(),
  orderEmail: boolean("order_email").notNull().default(true),
  orderPush: boolean("order_push").notNull().default(true),
  orderInApp: boolean("order_in_app").notNull().default(true),
  marketingEmail: boolean("marketing_email").notNull().default(false),
  marketingPush: boolean("marketing_push").notNull().default(false),
  priceDropEmail: boolean("price_drop_email").notNull().default(false),
  priceDropPush: boolean("price_drop_push").notNull().default(false),
  consentUpdatedAt: timestamp("consent_updated_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  userIdx: unique("user_notification_preferences_user_unique").on(table.userId),
}));

export const accountSessions = mysqlTable("account_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("user_id").notNull(),
  userAgent: varchar("user_agent", { length: 512 }),
  deviceLabel: varchar("device_label", { length: 160 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
}, table => ({
  userIdx: index("account_sessions_user_idx").on(table.userId, table.revokedAt, table.lastSeenAt),
}));

export const accountEmailChangeRequests = mysqlTable("account_email_change_requests", {
  id: serial("id").primaryKey(),
  userId: int("user_id").notNull(),
  oldEmail: varchar("old_email", { length: 255 }).notNull(),
  newEmail: varchar("new_email", { length: 255 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  userIdx: index("account_email_change_user_idx").on(table.userId, table.createdAt),
}));

export const accountSecurityEvents = mysqlTable("account_security_events", {
  id: serial("id").primaryKey(),
  userId: int("user_id").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  metadataJson: json("metadata_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  userIdx: index("account_security_events_user_idx").on(table.userId, table.createdAt),
}));

export const userFavorites = mysqlTable("user_favorites", {
  id: serial("id").primaryKey(),
  userId: int("user_id").notNull(),
  productId: int("product_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("user_favorites_user_idx").on(table.userId, table.createdAt),
  productIdx: index("user_favorites_product_idx").on(table.productId),
  userProductUnique: unique("user_favorites_user_product_unique").on(
    table.userId,
    table.productId
  ),
}));

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: int("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  userAgent: varchar("user_agent", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("push_sub_user_id_idx").on(table.userId),
}));

export const authSessions = mysqlTable("auth_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(), // uuid
  userId: int("user_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, confirmed, expired
  token: text("token"), // resulting JWT
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: int("user_id").notNull(),
    token: varchar("token", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  table => ({
    userIdx: index("password_reset_tokens_user_idx").on(table.userId),
    tokenIdx: index("password_reset_tokens_token_idx").on(table.token),
  })
);

export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  userId: int("user_id"),
  storeId: int("store_id"),
  reservationId: int("reservation_id"),
  moyskladOrderId: text("moysklad_order_id"),
  moyskladOrderHref: text("moysklad_order_href"),
  moyskladExternalCode: text("moysklad_external_code"),
  moyskladPaymentInId: text("moysklad_payment_in_id"),
  moyskladPaymentInHref: text("moysklad_payment_in_href"),
  moyskladPaymentExternalCode: text("moysklad_payment_external_code"),
  moyskladSyncStatus: varchar("moysklad_sync_status", { length: 20 })
    .notNull()
    .default("pending"),
  moyskladSyncedAt: timestamp("moysklad_synced_at"),
  moyskladLastError: text("moysklad_last_error"),
  orderNumber: varchar("order_number", { length: 64 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, confirmed, shipped, delivered, cancelled
  deliveryStatus: varchar("delivery_status", { length: 30 })
    .notNull()
    .default("not_required"),
  totalPrice: int("total_price").notNull(),
  subtotal: int("subtotal").notNull().default(0),
  discountTotal: int("discount_total").notNull().default(0),
  deliveryPrice: int("delivery_price").notNull().default(0),
  deliveryProviderPrice: int("delivery_provider_price"),
  deliveryPricingPolicyJson: json("delivery_pricing_policy_json"),
  deliveryPackageSnapshotJson: json("delivery_package_snapshot_json"),
  deliveryQuoteId: varchar("delivery_quote_id", { length: 36 }),
  paidAmount: int("paid_amount").notNull().default(0),
  loyaltyBalanceBefore: int("loyalty_balance_before").notNull().default(0),
  loyaltyBonusRequested: int("loyalty_bonus_requested").notNull().default(0),
  loyaltyBonusSpent: int("loyalty_bonus_spent").notNull().default(0),
  loyaltyBonusAccrued: int("loyalty_bonus_accrued").notNull().default(0),
  loyaltyBonusExpectedAccrued: int("loyalty_bonus_expected_accrued")
    .notNull()
    .default(0),
  loyaltyWriteoffPercentApplied: int("loyalty_writeoff_percent_applied")
    .notNull()
    .default(0),
  loyaltyPreviewPayloadJson: json("loyalty_preview_payload_json"),
  loyaltyRulesSnapshotJson: json("loyalty_rules_snapshot_json"),
  loyaltyProgramSnapshotJson: json("loyalty_program_snapshot_json"),
  loyaltyActualSpent: int("loyalty_actual_spent").notNull().default(0),
  loyaltyActualAccrued: int("loyalty_actual_accrued").notNull().default(0),
  loyaltySyncStatus: varchar("loyalty_sync_status", { length: 20 })
    .notNull()
    .default("pending"),
  loyaltyLastSyncError: text("loyalty_last_sync_error"),
  loyaltyLastSyncedAt: timestamp("loyalty_last_synced_at"),
  loyaltyRawResultJson: json("loyalty_raw_result_json"),
  deliveryType: varchar("delivery_type", { length: 20 })
    .notNull()
    .default("pickup"), // pickup, delivery
  deliveryService: varchar("delivery_service", { length: 80 }),
  deliveryProvider: varchar("delivery_provider", { length: 40 }),
  deliveryProviderOrderId: varchar("delivery_provider_order_id", { length: 128 }),
  deliveryProviderOfferId: varchar("delivery_provider_offer_id", { length: 128 }),
  deliveryProviderStatus: varchar("delivery_provider_status", { length: 80 }),
  deliveryProviderLastSyncAt: timestamp("delivery_provider_last_sync_at"),
  deliveryProviderError: text("delivery_provider_error"),
  deliveryProviderRawJson: json("delivery_provider_raw_json"),
  deliveryEtaFrom: timestamp("delivery_eta_from"),
  deliveryEtaTo: timestamp("delivery_eta_to"),
  deliveryCourierJson: json("delivery_courier_json"),
  deliveryCity: varchar("delivery_city", { length: 120 }),
  deliveryRegion: varchar("delivery_region", { length: 120 }),
  deliveryPostalCode: varchar("delivery_postal_code", { length: 20 }),
  deliveryTrackNumber: varchar("delivery_track_number", { length: 128 }),
  deliveryComment: text("delivery_comment"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  address: text("address"),
  paymentType: varchar("payment_type", { length: 20 })
    .notNull()
    .default("cash"), // cash, card, sbp
  paymentStatus: varchar("payment_status", { length: 20 })
    .notNull()
    .default("unpaid"), // unpaid, paid
  paymentMethod: varchar("payment_method", { length: 40 }),
  paymentId: varchar("payment_id", { length: 128 }),
  paymentProviderStatus: varchar("payment_provider_status", { length: 40 }),
  paymentTest: boolean("payment_test"),
  paymentCancellationParty: varchar("payment_cancellation_party", { length: 80 }),
  paymentCancellationReason: varchar("payment_cancellation_reason", { length: 120 }),
  paymentRawResponseJson: json("payment_raw_response_json"),
  paidAt: timestamp("paid_at"),
  paymentError: text("payment_error"),
  source: varchar("source", { length: 20 }).notNull().default("site"),
  managerId: int("manager_id"),
  customerName: varchar("customer_name", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 30 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  customerFirstName: varchar("customer_first_name", { length: 120 }),
  customerLastName: varchar("customer_last_name", { length: 120 }),
  customerComment: text("customer_comment"),
  internalComment: text("internal_comment"),
  isProblem: boolean("is_problem").notNull().default(false),
  cancelledAt: timestamp("cancelled_at"),
  cancelledReason: text("cancelled_reason"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  orderNumberIdx: index("orders_order_number_idx").on(table.orderNumber),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
  statusCreatedIdx: index("orders_status_created_idx").on(table.status, table.createdAt),
  paymentStatusIdx: index("orders_payment_status_idx").on(table.paymentStatus, table.createdAt),
  deliveryStatusIdx: index("orders_delivery_status_idx").on(table.deliveryStatus, table.createdAt),
  deliveryProviderIdx: index("orders_delivery_provider_idx").on(
    table.deliveryProvider,
    table.createdAt
  ),
  deliveryProviderOrderIdx: index("orders_delivery_provider_order_idx").on(
    table.deliveryProviderOrderId
  ),
  managerIdx: index("orders_manager_idx").on(table.managerId, table.createdAt),
  sourceIdx: index("orders_source_idx").on(table.source, table.createdAt),
  customerPhoneIdx: index("orders_customer_phone_idx").on(table.customerPhone),
  customerEmailIdx: index("orders_customer_email_idx").on(table.customerEmail),
  deliveryTrackIdx: index("orders_delivery_track_idx").on(table.deliveryTrackNumber),
  storeIdx: index("orders_store_idx").on(table.storeId, table.createdAt),
  reservationIdx: index("orders_reservation_idx").on(table.reservationId),
  moyskladSyncIdx: index("orders_moysklad_sync_idx").on(
    table.moyskladSyncStatus,
    table.createdAt
  ),
}));

export const deliveryQuotes = mysqlTable("delivery_quotes", {
  id: serial("id").primaryKey(),
  publicId: varchar("public_id", { length: 36 }).notNull().unique(),
  orderId: int("order_id"),
  userId: int("user_id"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  provider: varchar("provider", { length: 40 }).notNull().default("yandex_delivery"),
  cartFingerprint: varchar("cart_fingerprint", { length: 64 }).notNull(),
  sourceStoreId: int("source_store_id").notNull(),
  sourceStoreName: varchar("source_store_name", { length: 255 }),
  sourceAddress: text("source_address").notNull(),
  destinationAddress: text("destination_address").notNull(),
  destinationCoordinates: json("destination_coordinates"),
  providerOfferId: varchar("provider_offer_id", { length: 128 }),
  price: int("price").notNull(),
  providerPrice: int("provider_price"),
  pricingPolicyJson: json("pricing_policy_json"),
  packageSnapshotJson: json("package_snapshot_json"),
  currency: varchar("currency", { length: 8 }).notNull().default("RUB"),
  etaMinutes: int("eta_minutes"),
  rawJson: json("raw_json"),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  statusExpiryIdx: index("delivery_quotes_status_expiry_idx").on(
    table.status,
    table.expiresAt,
  ),
  cartIdx: index("delivery_quotes_cart_idx").on(table.cartFingerprint),
  orderIdx: index("delivery_quotes_order_idx").on(table.orderId),
}));

export const deliveryJobs = mysqlTable("delivery_jobs", {
  id: serial("id").primaryKey(),
  orderId: int("order_id").notNull(),
  type: varchar("type", { length: 24 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull().unique(),
  attempts: int("attempts").notNull().default(0),
  maxAttempts: int("max_attempts").notNull().default(8),
  runAfter: timestamp("run_after").notNull().defaultNow(),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by", { length: 64 }),
  lastError: text("last_error"),
  payloadJson: json("payload_json"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  queueIdx: index("delivery_jobs_queue_idx").on(
    table.status,
    table.runAfter,
    table.id,
  ),
  orderIdx: index("delivery_jobs_order_idx").on(table.orderId, table.createdAt),
}));

export const orderItems = mysqlTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: int("order_id").notNull(),
  productId: int("product_id").notNull(),
  variantId: int("variant_id"),
  variantName: varchar("variant_name", { length: 512 }),
  article: varchar("article", { length: 120 }),
  sku: varchar("sku", { length: 120 }),
  productName: varchar("product_name", { length: 512 }),
  image: varchar("image", { length: 255 }),
  quantity: int("quantity").notNull().default(1),
  price: int("price").notNull(), // capture price at time of order
  discount: int("discount").notNull().default(0),
  total: int("total").notNull().default(0),
  stockStatus: varchar("stock_status", { length: 20 }).notNull().default("in_stock"),
}, table => ({
  orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
  productIdIdx: index("order_items_product_id_idx").on(table.productId),
  variantIdIdx: index("order_items_variant_id_idx").on(table.variantId),
  skuIdx: index("order_items_sku_idx").on(table.sku),
}));

export const orderComments = mysqlTable("order_comments", {
  id: serial("id").primaryKey(),
  orderId: int("order_id").notNull(),
  userId: int("user_id"),
  commentType: varchar("comment_type", { length: 20 }).notNull().default("internal"),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  orderIdx: index("order_comments_order_idx").on(table.orderId, table.createdAt),
  userIdx: index("order_comments_user_idx").on(table.userId),
}));

export const orderHistory = mysqlTable("order_history", {
  id: serial("id").primaryKey(),
  orderId: int("order_id").notNull(),
  userId: int("user_id"),
  actionType: varchar("action_type", { length: 80 }).notNull(),
  oldValue: json("old_value"),
  newValue: json("new_value"),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  orderIdx: index("order_history_order_idx").on(table.orderId, table.createdAt),
  actionIdx: index("order_history_action_idx").on(table.actionType, table.createdAt),
  userIdx: index("order_history_user_idx").on(table.userId),
}));

export const bonusTransactions = mysqlTable("bonus_transactions", {
  id: serial("id").primaryKey(),
  userId: int("user_id").notNull(),
  orderId: int("order_id"),
  direction: varchar("direction", { length: 20 }).notNull(), // debit | credit | rollback | sync
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | applied | cancelled | error
  amount: int("amount").notNull().default(0),
  balanceAfter: int("balance_after"),
  source: varchar("source", { length: 40 }).notNull().default("site"),
  externalId: varchar("external_id", { length: 160 }),
  externalType: varchar("external_type", { length: 80 }),
  note: text("note"),
  payloadJson: json("payload_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  userIdx: index("bonus_transactions_user_idx").on(table.userId, table.createdAt),
  orderIdx: index("bonus_transactions_order_idx").on(table.orderId, table.createdAt),
  statusIdx: index("bonus_transactions_status_idx").on(table.status, table.updatedAt),
  externalIdx: index("bonus_transactions_external_idx").on(
    table.externalType,
    table.externalId
  ),
}));

export const loyaltySyncLogs = mysqlTable("loyalty_sync_logs", {
  id: serial("id").primaryKey(),
  userId: int("user_id"),
  orderId: int("order_id"),
  direction: varchar("direction", { length: 30 }).notNull().default("pull"), // pull | push
  status: varchar("status", { length: 20 }).notNull().default("success"), // success | error | skipped
  message: text("message"),
  detailsJson: json("details_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  userIdx: index("loyalty_sync_logs_user_idx").on(table.userId, table.createdAt),
  orderIdx: index("loyalty_sync_logs_order_idx").on(table.orderId, table.createdAt),
  statusIdx: index("loyalty_sync_logs_status_idx").on(table.status, table.createdAt),
}));

export const loyaltySyncJobs = mysqlTable("loyalty_sync_jobs", {
  id: serial("id").primaryKey(),
  jobType: varchar("job_type", { length: 40 }).notNull(),
  userId: int("user_id"),
  orderId: int("order_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  attempts: int("attempts").notNull().default(0),
  nextRunAt: timestamp("next_run_at").notNull().defaultNow(),
  lockedAt: timestamp("locked_at"),
  lastError: text("last_error"),
  payloadJson: json("payload_json"),
  activeKey: varchar("active_key", { length: 190 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  statusIdx: index("loyalty_sync_jobs_status_idx").on(
    table.status,
    table.nextRunAt,
    table.createdAt
  ),
  userIdx: index("loyalty_sync_jobs_user_idx").on(table.userId, table.createdAt),
  orderIdx: index("loyalty_sync_jobs_order_idx").on(table.orderId, table.createdAt),
  typeIdx: index("loyalty_sync_jobs_type_idx").on(table.jobType, table.status, table.createdAt),
  activeKeyUnique: unique("loyalty_sync_jobs_active_key_unique").on(table.activeKey),
}));

export const loyaltyBonusHolds = mysqlTable("loyalty_bonus_holds", {
  id: serial("id").primaryKey(),
  userId: int("user_id").notNull(),
  orderId: int("order_id").notNull(),
  amount: int("amount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  orderUnique: unique("loyalty_bonus_holds_order_unique").on(table.orderId),
  userStatusIdx: index("loyalty_bonus_holds_user_status_idx").on(
    table.userId,
    table.status,
    table.expiresAt
  ),
}));

export const productStocks = mysqlTable("product_stocks", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  storeId: int("store_id").notNull(),
  quantity: int("quantity").notNull().default(0),
});

export const productVariantStocks = mysqlTable("product_variant_stocks", {
  id: serial("id").primaryKey(),
  variantId: int("variant_id").notNull(),
  storeId: int("store_id").notNull(),
  quantity: int("quantity").notNull().default(0),
}, table => ({
  variantStoreIdx: index("product_variant_stocks_variant_store_idx").on(
    table.variantId,
    table.storeId
  ),
  storeVariantIdx: index("product_variant_stocks_store_variant_idx").on(
    table.storeId,
    table.variantId
  ),
}));

export const productReservations = mysqlTable("product_reservations", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  variantId: int("variant_id"),
  storeId: int("store_id").notNull(),
  userId: int("user_id"),
  phone: varchar("phone", { length: 40 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  quantity: int("quantity").notNull().default(1),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  reservedUntil: timestamp("reserved_until").notNull(),
  source: varchar("source", { length: 40 }).notNull().default("product_page"),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  productStoreStatusIdx: index("product_reservations_product_store_status_idx").on(
    table.productId,
    table.storeId,
    table.status,
    table.reservedUntil
  ),
  productVariantStoreStatusIdx: index("product_reservations_product_variant_store_status_idx").on(
    table.productId,
    table.variantId,
    table.storeId,
    table.status,
    table.reservedUntil
  ),
  userStatusIdx: index("product_reservations_user_status_idx").on(
    table.userId,
    table.status,
    table.updatedAt
  ),
  phoneStatusIdx: index("product_reservations_phone_status_idx").on(
    table.phone,
    table.status,
    table.updatedAt
  ),
  storeStatusIdx: index("product_reservations_store_status_idx").on(
    table.storeId,
    table.status,
    table.reservedUntil
  ),
}));

export const syncLogs = mysqlTable("sync_logs", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // 'moysklad', etc.
  status: varchar("status", { length: 20 }).notNull(), // 'success', 'error', 'running'
  message: text("message"),
  details: json("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: int("actor_user_id"),
  actorEmail: varchar("actor_email", { length: 255 }),
  actorRole: varchar("actor_role", { length: 80 }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: int("entity_id"),
  entityLabel: varchar("entity_label", { length: 255 }),
  beforeJson: json("before_json"),
  afterJson: json("after_json"),
  metaJson: json("meta_json"),
  ip: varchar("ip", { length: 128 }),
  userAgent: varchar("user_agent", { length: 512 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  entityIdx: index("admin_audit_logs_entity_idx").on(
    table.entityType,
    table.entityId,
    table.createdAt
  ),
  actorIdx: index("admin_audit_logs_actor_idx").on(
    table.actorUserId,
    table.createdAt
  ),
  actionIdx: index("admin_audit_logs_action_idx").on(
    table.action,
    table.createdAt
  ),
  createdIdx: index("admin_audit_logs_created_idx").on(table.createdAt),
}));

export const syncProfiles = mysqlTable("sync_profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  provider: varchar("provider", { length: 40 }).notNull().default("moysklad"),
  configJson: json("config_json").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdBy: int("created_by"),
  updatedBy: int("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  providerDefaultIdx: index("sync_profiles_provider_default_idx").on(
    table.provider,
    table.isDefault
  ),
}));

export const syncRuns = mysqlTable("sync_runs", {
  id: serial("id").primaryKey(),
  profileId: int("profile_id"),
  runType: varchar("run_type", { length: 40 }).notNull().default("full"),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  message: text("message"),
  phase: varchar("phase", { length: 80 }),
  configSnapshot: json("config_snapshot"),
  statsJson: json("stats_json"),
  progressJson: json("progress_json"),
  heartbeatAt: timestamp("heartbeat_at"),
  lockOwner: varchar("lock_owner", { length: 64 }),
  workerId: varchar("worker_id", { length: 64 }),
  cancelRequested: boolean("cancel_requested").notNull().default(false),
  abortReason: text("abort_reason"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, table => ({
  profileIdx: index("sync_runs_profile_idx").on(table.profileId),
  statusIdx: index("sync_runs_status_idx").on(table.status, table.startedAt),
  runTypeStatusIdx: index("sync_runs_run_type_status_idx").on(
    table.runType,
    table.status,
    table.startedAt
  ),
  heartbeatIdx: index("sync_runs_heartbeat_idx").on(table.status, table.heartbeatAt),
}));

export const webhookEvents = mysqlTable("webhook_events", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 40 }).notNull().default("moysklad"),
  eventType: varchar("event_type", { length: 80 }).notNull().default("unknown"),
  eventKey: varchar("event_key", { length: 255 }).notNull(),
  payloadJson: json("payload_json").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  attempts: int("attempts").notNull().default(0),
  lastError: text("last_error"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  providerEventKeyUnique: unique("webhook_events_provider_event_key_unique").on(
    table.provider,
    table.eventKey
  ),
  statusCreatedIdx: index("webhook_events_status_created_idx").on(
    table.status,
    table.createdAt
  ),
  providerTypeIdx: index("webhook_events_provider_type_idx").on(
    table.provider,
    table.eventType,
    table.createdAt
  ),
}));

export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const homepageSnapshots = mysqlTable("homepage_snapshots", {
  id: serial("id").primaryKey(),
  snapshotKey: varchar("snapshot_key", { length: 120 }).notNull().default("default"),
  payload: json("payload").notNull(),
  buildMs: int("build_ms").notNull().default(0),
  sourceVersion: varchar("source_version", { length: 40 }),
  lastError: text("last_error"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  snapshotKeyUnique: unique("homepage_snapshots_snapshot_key_unique").on(
    table.snapshotKey
  ),
}));

export const searchDocuments = mysqlTable("search_documents", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 30 }).notNull(),
  entityId: int("entity_id").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  subtitle: varchar("subtitle", { length: 512 }),
  contentText: text("content_text"),
  attributesText: text("attributes_text"),
  exactText: text("exact_text"),
  url: varchar("url", { length: 512 }).notNull(),
  imageUrl: varchar("image_url", { length: 512 }),
  price: int("price"),
  oldPrice: int("old_price"),
  brandId: int("brand_id"),
  brandName: varchar("brand_name", { length: 255 }),
  categoryId: int("category_id"),
  categoryName: varchar("category_name", { length: 255 }),
  sku: varchar("sku", { length: 120 }),
  article: varchar("article", { length: 120 }),
  barcode: varchar("barcode", { length: 120 }),
  externalCode: varchar("external_code", { length: 120 }),
  moyskladId: varchar("moysklad_id", { length: 120 }),
  isActive: boolean("is_active").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  inStock: boolean("in_stock").notNull().default(true),
  stockCount: int("stock_count").notNull().default(0),
  sortWeight: int("sort_weight").notNull().default(0),
  popularityScore: int("popularity_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  indexedAt: timestamp("indexed_at").notNull().defaultNow(),
}, table => ({
  entityUnique: unique("search_documents_entity_unique").on(
    table.entityType,
    table.entityId
  ),
  entityIdx: index("search_documents_entity_idx").on(
    table.entityType,
    table.entityId
  ),
  activeVisibleIdx: index("search_documents_active_visible_idx").on(
    table.isActive,
    table.isVisible
  ),
  categoryIdx: index("search_documents_category_idx").on(table.categoryId),
  brandIdx: index("search_documents_brand_idx").on(table.brandId),
  priceIdx: index("search_documents_price_idx").on(table.price),
  stockIdx: index("search_documents_stock_idx").on(table.inStock),
  skuIdx: index("search_documents_sku_idx").on(table.sku),
  articleIdx: index("search_documents_article_idx").on(table.article),
  barcodeIdx: index("search_documents_barcode_idx").on(table.barcode),
}));

export const searchSynonyms = mysqlTable("search_synonyms", {
  id: serial("id").primaryKey(),
  term: varchar("term", { length: 120 }).notNull(),
  synonymsJson: json("synonyms_json").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  termIdx: unique("search_synonyms_term_unique").on(table.term),
  activeIdx: index("search_synonyms_active_idx").on(table.isActive, table.term),
}));

export const searchTerms = mysqlTable("search_terms", {
  id: serial("id").primaryKey(),
  term: varchar("term", { length: 120 }).notNull(),
  normalizedTerm: varchar("normalized_term", { length: 120 }).notNull(),
  source: varchar("source", { length: 30 }).notNull().default("document"),
  weight: int("weight").notNull().default(1),
  usageCount: int("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  normalizedSourceUnique: unique("search_terms_normalized_source_unique").on(
    table.normalizedTerm,
    table.source
  ),
  normalizedIdx: index("search_terms_normalized_idx").on(table.normalizedTerm),
  usageIdx: index("search_terms_usage_idx").on(table.usageCount, table.weight),
}));

export const searchLogs = mysqlTable("search_logs", {
  id: serial("id").primaryKey(),
  query: varchar("query", { length: 255 }).notNull(),
  normalizedQuery: varchar("normalized_query", { length: 255 }).notNull(),
  correctedQuery: varchar("corrected_query", { length: 255 }),
  resultsCount: int("results_count").notNull().default(0),
  userId: int("user_id"),
  sessionId: varchar("session_id", { length: 120 }),
  ipHash: varchar("ip_hash", { length: 128 }),
  userAgentHash: varchar("user_agent_hash", { length: 128 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  normalizedCreatedIdx: index("search_logs_normalized_created_idx").on(
    table.normalizedQuery,
    table.createdAt
  ),
  userIdx: index("search_logs_user_idx").on(table.userId, table.createdAt),
  sessionIdx: index("search_logs_session_idx").on(table.sessionId, table.createdAt),
}));

export const searchClickLogs = mysqlTable("search_click_logs", {
  id: serial("id").primaryKey(),
  searchLogId: int("search_log_id").notNull(),
  entityType: varchar("entity_type", { length: 30 }).notNull(),
  entityId: int("entity_id").notNull(),
  position: int("position").notNull().default(0),
  url: varchar("url", { length: 512 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  searchLogIdx: index("search_click_logs_search_log_idx").on(
    table.searchLogId,
    table.createdAt
  ),
  entityIdx: index("search_click_logs_entity_idx").on(
    table.entityType,
    table.entityId,
    table.createdAt
  ),
}));

export const searchReindexJobs = mysqlTable("search_reindex_jobs", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 30 }).notNull(),
  entityId: int("entity_id"),
  reason: varchar("reason", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  attempts: int("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
}, table => ({
  statusCreatedIdx: index("search_reindex_jobs_status_created_idx").on(
    table.status,
    table.createdAt
  ),
  entityIdx: index("search_reindex_jobs_entity_idx").on(
    table.entityType,
    table.entityId,
    table.createdAt
  ),
}));

export const designThemeVersions = mysqlTable("design_theme_versions", {
  id: serial("id").primaryKey(),
  versionNumber: int("version_number").notNull(),
  themeName: varchar("theme_name", { length: 120 }).notNull(),
  actionType: varchar("action_type", { length: 30 }).notNull().default("publish"),
  themeJson: json("theme_json").notNull(),
  changeSummary: text("change_summary"),
  changeDetailsJson: json("change_details_json"),
  changedByUserId: int("changed_by_user_id"),
  changedByDisplayName: varchar("changed_by_display_name", { length: 255 }),
  changedByRole: varchar("changed_by_role", { length: 40 }),
  sourceVersionId: int("source_version_id"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  versionUnique: unique("design_theme_versions_version_unique").on(table.versionNumber),
  actionCreatedIdx: index("design_theme_versions_action_created_idx").on(
    table.actionType,
    table.createdAt
  ),
  publishedAtIdx: index("design_theme_versions_published_at_idx").on(
    table.publishedAt,
    table.createdAt
  ),
}));

export const moyskladSyncJobs = mysqlTable("moysklad_sync_jobs", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 30 }).notNull(),
  entityId: int("entity_id").notNull(),
  action: varchar("action", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  attempts: int("attempts").notNull().default(0),
  nextRunAt: timestamp("next_run_at").notNull().defaultNow(),
  lockedAt: timestamp("locked_at"),
  lastError: text("last_error"),
  payloadSnapshot: json("payload_snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  statusNextRunIdx: index("moysklad_sync_jobs_status_next_run_idx").on(
    table.status,
    table.nextRunAt,
    table.createdAt
  ),
  entityIdx: index("moysklad_sync_jobs_entity_idx").on(
    table.entityType,
    table.entityId,
    table.createdAt
  ),
  actionIdx: index("moysklad_sync_jobs_action_idx").on(
    table.action,
    table.status,
    table.createdAt
  ),
}));

export const moyskladWebhookEvents = mysqlTable("moysklad_webhook_events", {
  id: serial("id").primaryKey(),
  requestId: varchar("request_id", { length: 191 }).notNull(),
  payload: json("payload").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  lastError: text("last_error"),
}, table => ({
  requestIdUnique: unique("moysklad_webhook_events_request_id_unique").on(
    table.requestId
  ),
  statusCreatedIdx: index("moysklad_webhook_events_status_created_idx").on(
    table.status,
    table.createdAt
  ),
}));

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

export const productSpecValueRules = mysqlTable("product_spec_value_rules", {
  id: serial("id").primaryKey(),
  categoryId: int("category_id").notNull(),
  specNormalizedKey: varchar("spec_normalized_key", { length: 120 }).notNull(),
  sourceValue: varchar("source_value", { length: 512 }).notNull(),
  sourceNormalizedValue: varchar("source_normalized_value", { length: 512 })
    .notNull(),
  targetValue: varchar("target_value", { length: 512 }).notNull(),
  targetNormalizedValue: varchar("target_normalized_value", { length: 512 })
    .notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  categorySpecValueIdx: index("product_spec_value_rules_category_spec_value_idx").on(
    table.categoryId,
    table.specNormalizedKey,
    table.sourceNormalizedValue
  ),
  categorySpecTargetIdx: index("product_spec_value_rules_category_spec_target_idx").on(
    table.categoryId,
    table.specNormalizedKey,
    table.targetNormalizedValue
  ),
}));

export const manufacturers = mysqlTable("manufacturers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  normalizedName: varchar("normalized_name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  logoUrl: varchar("logo_url", { length: 512 }),
  website: varchar("website", { length: 255 }),
  description: text("description"),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  productCount: int("product_count").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  normalizedNameIdx: index("manufacturers_normalized_name_idx").on(
    table.normalizedName
  ),
  visibleIdx: index("manufacturers_visible_idx").on(table.isVisible, table.sortOrder),
}));

export const manufacturerCategoryIndex = mysqlTable("manufacturer_category_index", {
  id: serial("id").primaryKey(),
  manufacturerId: int("manufacturer_id").notNull(),
  categoryId: int("category_id").notNull(),
  productCount: int("product_count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  manufacturerCategoryIdx: index("manufacturer_category_index_mfr_cat_idx").on(
    table.manufacturerId,
    table.categoryId
  ),
  categoryIdx: index("manufacturer_category_index_cat_idx").on(table.categoryId),
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

export const badgeCatalog = mysqlTable("badge_catalog", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 120 }).notNull().unique(),
  label: varchar("label", { length: 120 }).notNull(),
  description: text("description"),
  badgeType: varchar("badge_type", { length: 30 }).notNull().default("manual"),
  audience: varchar("audience", { length: 20 }).notNull().default("customer"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  source: varchar("source", { length: 20 }).notNull().default("manual"),
  icon: varchar("icon", { length: 80 }),
  colorToken: varchar("color_token", { length: 80 }),
  sortOrder: int("sort_order").notNull().default(0),
  maxProductsPerItem: int("max_products_per_item").notNull().default(1),
  isVisibleOnSite: boolean("is_visible_on_site").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  typeStatusIdx: index("badge_catalog_type_status_idx").on(table.badgeType, table.status, table.sortOrder),
  sourceStatusIdx: index("badge_catalog_source_status_idx").on(table.source, table.status, table.updatedAt),
}));

export const badgeCategoryScopes = mysqlTable("badge_category_scope", {
  id: serial("id").primaryKey(),
  badgeId: int("badge_id").notNull(),
  scopeType: varchar("scope_type", { length: 20 }).notNull().default("category"),
  scopeId: int("scope_id"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  priority: int("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  badgeIdx: index("badge_category_scope_badge_idx").on(table.badgeId),
  scopeIdx: index("badge_category_scope_scope_idx").on(table.scopeType, table.scopeId, table.isEnabled),
  badgeScopeUnique: unique("badge_category_scope_unique").on(table.badgeId, table.scopeType, table.scopeId),
}));

export const badgeAssignmentRules = mysqlTable("badge_assignment_rules", {
  id: serial("id").primaryKey(),
  badgeId: int("badge_id").notNull(),
  categoryId: int("category_id").notNull(),
  ruleType: varchar("rule_type", { length: 30 }).notNull().default("ai_generated"),
  ruleJson: json("rule_json").notNull(),
  confidenceThreshold: int("confidence_threshold").notNull().default(60),
  isEnabled: boolean("is_enabled").notNull().default(true),
  source: varchar("source", { length: 20 }).notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  badgeIdx: index("badge_assignment_rules_badge_idx").on(table.badgeId, table.isEnabled),
  categoryIdx: index("badge_assignment_rules_category_idx").on(table.categoryId, table.isEnabled),
}));

export const productBadgeAssignments = mysqlTable("product_badge_assignments", {
  id: serial("id").primaryKey(),
  productId: int("product_id").notNull(),
  badgeId: int("badge_id").notNull(),
  assignmentSource: varchar("assignment_source", { length: 20 }).notNull().default("manual"),
  confidence: int("confidence"),
  explanation: text("explanation"),
  status: varchar("status", { length: 20 }).notNull().default("suggested"),
  isVisibleOnSite: boolean("is_visible_on_site").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  productIdx: index("product_badge_assignments_product_idx").on(table.productId, table.status),
  badgeIdx: index("product_badge_assignments_badge_idx").on(table.badgeId, table.status),
  productBadgeUnique: unique("product_badge_assignments_unique").on(table.productId, table.badgeId),
}));

export const badgeAiRuns = mysqlTable("badge_ai_runs", {
  id: serial("id").primaryKey(),
  runType: varchar("run_type", { length: 40 }).notNull(),
  categoryId: int("category_id"),
  model: varchar("model", { length: 120 }).notNull(),
  promptVersion: varchar("prompt_version", { length: 40 }).notNull().default("v1"),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  inputSnapshot: json("input_snapshot"),
  resultJson: json("result_json"),
  errorText: text("error_text"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, table => ({
  categoryRunIdx: index("badge_ai_runs_category_run_idx").on(table.categoryId, table.runType, table.startedAt),
  statusIdx: index("badge_ai_runs_status_idx").on(table.status, table.startedAt),
}));

export const badgeHistory = mysqlTable("badge_history", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 30 }).notNull(),
  entityId: int("entity_id").notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  oldValue: json("old_value"),
  newValue: json("new_value"),
  comment: text("comment"),
  userId: varchar("user_id", { length: 255 }).notNull().default("admin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  entityIdx: index("badge_history_entity_idx").on(table.entityType, table.entityId, table.createdAt),
  actionIdx: index("badge_history_action_idx").on(table.actionType, table.createdAt),
}));

export const listingPages = mysqlTable("listing_pages", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 30 }).notNull().default("category"),
  categoryId: int("category_id").notNull(),
  filterKey: varchar("filter_key", { length: 120 }),
  filterValue: varchar("filter_value", { length: 255 }),
  slug: varchar("slug", { length: 255 }),
  url: varchar("url", { length: 512 }).notNull(),
  title: varchar("title", { length: 255 }),
  metaDescription: text("meta_description"),
  h1: varchar("h1", { length: 255 }),
  introText: text("intro_text"),
  bottomText: text("bottom_text"),
  faqJson: json("faq_json"),
  seoTextStatus: varchar("seo_text_status", { length: 20 }).notNull().default("empty"),
  indexationMode: varchar("indexation_mode", { length: 40 }).notNull().default("index"),
  canonicalUrl: varchar("canonical_url", { length: 512 }),
  isAutoGenerated: boolean("is_auto_generated").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  demandScore: int("demand_score").notNull().default(0),
  contentScore: int("content_score").notNull().default(0),
  duplicateRisk: varchar("duplicate_risk", { length: 20 }).notNull().default("low"),
  createdBy: int("created_by"),
  updatedBy: int("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  categoryTypeIdx: index("listing_pages_category_type_idx").on(
    table.categoryId,
    table.type
  ),
  typePublishedIdx: index("listing_pages_type_published_idx").on(
    table.type,
    table.isPublished,
    table.updatedAt
  ),
  categoryFilterUnique: unique("listing_pages_category_filter_unique").on(
    table.type,
    table.categoryId,
    table.filterKey,
    table.filterValue
  ),
  urlUnique: unique("listing_pages_url_unique").on(table.url),
}));

export const listingDemandClusters = mysqlTable("listing_demand_clusters", {
  id: serial("id").primaryKey(),
  listingPageId: int("listing_page_id").notNull(),
  primaryQuery: varchar("primary_query", { length: 255 }).notNull(),
  supportingQueriesJson: json("supporting_queries_json"),
  synonymsJson: json("synonyms_json"),
  negativesJson: json("negatives_json"),
  intent: varchar("intent", { length: 30 }).notNull().default("commercial"),
  source: varchar("source", { length: 40 }).notNull().default("manual"),
  sourceLabel: varchar("source_label", { length: 120 }),
  impressions: int("impressions").notNull().default(0),
  clicks: int("clicks").notNull().default(0),
  ctr: decimal("ctr", { precision: 7, scale: 2 }),
  avgPosition: decimal("avg_position", { precision: 7, scale: 2 }),
  notes: text("notes"),
  lastImportedAt: timestamp("last_imported_at"),
  createdBy: int("created_by"),
  updatedBy: int("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  listingUnique: unique("listing_demand_clusters_listing_unique").on(table.listingPageId),
  sourceIdx: index("listing_demand_clusters_source_idx").on(table.source, table.updatedAt),
  intentIdx: index("listing_demand_clusters_intent_idx").on(table.intent, table.updatedAt),
}));

export const listingTemplates = mysqlTable("listing_templates", {
  id: serial("id").primaryKey(),
  scope: varchar("scope", { length: 30 }).notNull().default("category"),
  name: varchar("name", { length: 120 }).notNull(),
  titleTemplate: text("title_template"),
  descriptionTemplate: text("description_template"),
  h1Template: text("h1_template"),
  introTemplate: text("intro_template"),
  bottomTemplate: text("bottom_template"),
  faqTemplate: text("faq_template"),
  isDefault: boolean("is_default").notNull().default(false),
  createdBy: int("created_by"),
  updatedBy: int("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => ({
  scopeDefaultIdx: index("listing_templates_scope_default_idx").on(
    table.scope,
    table.isDefault
  ),
}));

export const listingGenerationRuns = mysqlTable("listing_generation_runs", {
  id: serial("id").primaryKey(),
  listingPageId: int("listing_page_id").notNull(),
  templateId: int("template_id"),
  runType: varchar("run_type", { length: 40 }).notNull().default("draft"),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  source: varchar("source", { length: 30 }).notNull().default("manual"),
  inputSnapshot: json("input_snapshot"),
  resultSnapshot: json("result_snapshot"),
  errorText: text("error_text"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  listingStatusIdx: index("listing_generation_runs_listing_status_idx").on(
    table.listingPageId,
    table.status,
    table.createdAt
  ),
}));

export const listingAuditLogs = mysqlTable("listing_audit_logs", {
  id: serial("id").primaryKey(),
  listingPageId: int("listing_page_id"),
  actorUserId: int("actor_user_id"),
  action: varchar("action", { length: 120 }).notNull(),
  beforeJson: json("before_json"),
  afterJson: json("after_json"),
  metaJson: json("meta_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => ({
  listingCreatedIdx: index("listing_audit_logs_listing_created_idx").on(
    table.listingPageId,
    table.createdAt
  ),
  actionCreatedIdx: index("listing_audit_logs_action_created_idx").on(
    table.action,
    table.createdAt
  ),
}));
