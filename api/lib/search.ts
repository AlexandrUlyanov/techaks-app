import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  categories,
  posts,
  productMerchandising,
  products,
  searchClickLogs,
  searchDocuments,
  searchLogs,
  searchReindexJobs,
  searchSynonyms,
  searchTerms,
} from "@db/schema";
import { normalizeProductImageVariantSet } from "@contracts/product-images";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import {
  defaultSiteProfileSettings,
  getSiteProfileSettings,
} from "./site-profile-settings";
import { getManufacturerNameFromProductSpecs } from "./manufacturers";
import { publicAvailableStockQtySql } from "./public-products";
import { buildPublicVisibleCategoryIdSet } from "./category-visibility";

const SEARCH_SETTINGS_KEYS = [
  "search_include_description",
  "search_include_attributes",
  "search_include_articles",
  "search_include_sku",
  "search_include_barcodes",
  "search_include_pages",
  "search_show_out_of_stock",
  "search_show_zero_price",
  "search_show_inactive",
  "search_full_reindex_batch_size",
] as const;

const defaultSearchSettings = {
  includeDescription: true,
  includeAttributes: true,
  includeArticles: true,
  includeSku: true,
  includeBarcodes: true,
  includePages: true,
  showOutOfStock: true,
  showZeroPrice: false,
  showInactive: false,
  fullReindexBatchSize: 250,
};

type SearchSettings = typeof defaultSearchSettings;

type SearchEntityType = "product" | "category" | "page";
type SearchReindexStatus = "pending" | "running" | "done" | "error";

type SearchDocumentRow = typeof searchDocuments.$inferSelect;

type SearchCandidate = SearchDocumentRow & {
  titleScore: number;
  contentScore: number;
  attributesScore: number;
  exactScore: number;
  exactMatchScore: number;
  fallbackScore: number;
};

type SearchFacetCount = { id: number; name: string; count: number };

type SearchProductCard = {
  id: number;
  slug: string;
  name: string;
  price: number;
  oldPrice: number | null;
  badge: string | null;
  badges?: unknown;
  merchandisingBadges?: unknown;
  image: string;
  imageVariants?: unknown;
  categoryId: number;
  categoryName?: string;
  rating?: string | number | null;
  reviewCount?: number | null;
  inStock?: boolean | null;
  specs?: Record<string, unknown> | null;
};

const SEARCH_CACHE_TTL_MS = 60_000;
const POPULAR_CACHE_TTL_MS = 120_000;
const SYNONYM_CACHE_TTL_MS = 120_000;

const internalCache = {
  synonyms: { expiresAt: 0, value: new Map<string, string[]>() },
  settings: { expiresAt: 0, value: defaultSearchSettings },
  popular: { expiresAt: 0, value: [] as string[] },
};

function isMissingSearchInfrastructureError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (!message) return false;

  return (
    message.includes("search_documents") ||
    message.includes("search_synonyms") ||
    message.includes("search_terms") ||
    message.includes("search_logs") ||
    message.includes("search_click_logs") ||
    message.includes("search_reindex_jobs")
  );
}

export const searchSettingsInputSchema = z.object({
  includeDescription: z.boolean(),
  includeAttributes: z.boolean(),
  includeArticles: z.boolean(),
  includeSku: z.boolean(),
  includeBarcodes: z.boolean(),
  includePages: z.boolean(),
  showOutOfStock: z.boolean(),
  showZeroPrice: z.boolean(),
  showInactive: z.boolean(),
  fullReindexBatchSize: z.number().min(50).max(1000).default(250),
});

export const searchQueryInputSchema = z.object({
  query: z.string().trim().min(1).max(100),
  page: z.number().min(1).max(1000).default(1).optional(),
  limit: z.number().min(1).max(50).default(24).optional(),
  entityTypes: z.array(z.enum(["product", "category", "page"])).optional(),
  categoryId: z.number().optional(),
  brandId: z.number().optional(),
  priceFrom: z.number().optional(),
  priceTo: z.number().optional(),
  inStockOnly: z.boolean().optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "newest", "popular"]).default("relevance").optional(),
  sessionId: z.string().trim().max(120).optional(),
});

export const searchSuggestionsInputSchema = z.object({
  query: z.string().trim().min(1).max(100),
  limit: z.number().min(1).max(10).default(8).optional(),
});

export const searchLogClickInputSchema = z.object({
  searchLogId: z.number().optional(),
  entityType: z.enum(["product", "category", "page"]),
  entityId: z.number(),
  position: z.number().min(0).max(999).default(0).optional(),
  url: z.string().trim().min(1).max(512),
});

export const searchReindexInputSchema = z.object({
  entityTypes: z.array(z.enum(["product", "category", "page"])).default(["product", "category", "page"]).optional(),
});

export const searchReindexEntityInputSchema = z.object({
  entityType: z.enum(["product", "category", "page"]),
  entityId: z.number().optional(),
  reason: z.string().trim().min(1).max(50).default("manual_reindex").optional(),
});

export const searchSynonymInputSchema = z.object({
  term: z.string().trim().min(1).max(120),
  synonyms: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  isActive: z.boolean().default(true).optional(),
});

export function clearSearchCaches() {
  internalCache.popular.expiresAt = 0;
  internalCache.settings.expiresAt = 0;
  internalCache.synonyms.expiresAt = 0;
}

function parseBooleanSetting(value: string | null | undefined, fallback: boolean) {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export async function getSearchSettings(): Promise<SearchSettings> {
  if (internalCache.settings.expiresAt > Date.now()) {
    return internalCache.settings.value;
  }

  const values = await getAppSettings([...SEARCH_SETTINGS_KEYS]);
  const settings: SearchSettings = {
    includeDescription: parseBooleanSetting(
      values.search_include_description,
      defaultSearchSettings.includeDescription
    ),
    includeAttributes: parseBooleanSetting(
      values.search_include_attributes,
      defaultSearchSettings.includeAttributes
    ),
    includeArticles: parseBooleanSetting(
      values.search_include_articles,
      defaultSearchSettings.includeArticles
    ),
    includeSku: parseBooleanSetting(values.search_include_sku, defaultSearchSettings.includeSku),
    includeBarcodes: parseBooleanSetting(
      values.search_include_barcodes,
      defaultSearchSettings.includeBarcodes
    ),
    includePages: parseBooleanSetting(
      values.search_include_pages,
      defaultSearchSettings.includePages
    ),
    showOutOfStock: parseBooleanSetting(
      values.search_show_out_of_stock,
      defaultSearchSettings.showOutOfStock
    ),
    showZeroPrice: parseBooleanSetting(
      values.search_show_zero_price,
      defaultSearchSettings.showZeroPrice
    ),
    showInactive: parseBooleanSetting(
      values.search_show_inactive,
      defaultSearchSettings.showInactive
    ),
    fullReindexBatchSize: Number(values.search_full_reindex_batch_size || defaultSearchSettings.fullReindexBatchSize),
  };

  internalCache.settings = {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    value: settings,
  };
  return settings;
}

export async function saveSearchSettings(input: SearchSettings) {
  await Promise.all([
    setAppSetting("search_include_description", input.includeDescription ? "true" : "false"),
    setAppSetting("search_include_attributes", input.includeAttributes ? "true" : "false"),
    setAppSetting("search_include_articles", input.includeArticles ? "true" : "false"),
    setAppSetting("search_include_sku", input.includeSku ? "true" : "false"),
    setAppSetting("search_include_barcodes", input.includeBarcodes ? "true" : "false"),
    setAppSetting("search_include_pages", input.includePages ? "true" : "false"),
    setAppSetting("search_show_out_of_stock", input.showOutOfStock ? "true" : "false"),
    setAppSetting("search_show_zero_price", input.showZeroPrice ? "true" : "false"),
    setAppSetting("search_show_inactive", input.showInactive ? "true" : "false"),
    setAppSetting("search_full_reindex_batch_size", String(input.fullReindexBatchSize)),
  ]);
  clearSearchCaches();
  return getSearchSettings();
}

export function normalizeSearchQuery(query: string) {
  return query
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchQuery(query: string) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const compact = normalized.replace(/[\s\-_.]+/g, " ");
  return Array.from(
    new Set(
      compact
        .split(" ")
        .map(token => token.trim())
        .filter(token => token.length > 0)
    )
  );
}

function normalizeSynonymTerm(term: string) {
  return normalizeSearchQuery(term).slice(0, 120);
}

async function getSynonymMap() {
  if (internalCache.synonyms.expiresAt > Date.now()) {
    return internalCache.synonyms.value;
  }

  let rows: Array<typeof searchSynonyms.$inferSelect> = [];
  try {
    const db = getDb();
    rows = await db
      .select()
      .from(searchSynonyms)
      .where(eq(searchSynonyms.isActive, true));
  } catch (error) {
    if (!isMissingSearchInfrastructureError(error)) {
      throw error;
    }
  }

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const term = normalizeSynonymTerm(row.term);
    if (!term) continue;
    const rawSynonyms = Array.isArray(row.synonymsJson) ? row.synonymsJson : [];
    const values = Array.from(
      new Set(
        [term, ...rawSynonyms.map(value => normalizeSynonymTerm(String(value || "")))]
          .filter(Boolean)
      )
    );
    map.set(term, values);
    for (const value of values) {
      const existing = map.get(value) ?? [];
      const merged = Array.from(new Set([...existing, ...values]));
      map.set(value, merged);
    }
  }

  internalCache.synonyms = {
    expiresAt: Date.now() + SYNONYM_CACHE_TTL_MS,
    value: map,
  };
  return map;
}

export async function expandQueryWithSynonyms(query: string) {
  const tokens = tokenizeSearchQuery(query);
  const synonymMap = await getSynonymMap();
  return expandTokensWithSynonymMap(tokens, synonymMap);
}

export function expandTokensWithSynonymMap(
  tokens: string[],
  synonymMap: Map<string, string[]>
) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const synonyms = synonymMap.get(token) ?? [];
    for (const value of synonyms) {
      if (value) expanded.add(value);
    }
  }
  return Array.from(expanded);
}

function buildBooleanSearchQuery(tokens: string[]) {
  return tokens
    .filter(token => token.length >= 2)
    .map(token => `+${token.replace(/["*+<>~()-]/g, "")}*`)
    .join(" ");
}

function buildLikePattern(token: string) {
  return `%${token.replace(/[%_]/g, "")}%`;
}

function sanitizeTextValue(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSpecsRecord(specs: unknown): specs is Record<string, unknown> {
  return Boolean(specs) && typeof specs === "object" && !Array.isArray(specs);
}

function extractIdentityValue(specs: unknown, keys: string[]) {
  if (!isSpecsRecord(specs)) return null;
  const normalizedKeys = new Set(keys.map(item => normalizeSearchQuery(item)));
  for (const [key, value] of Object.entries(specs)) {
    if (normalizedKeys.has(normalizeSearchQuery(key))) {
      const normalizedValue = sanitizeTextValue(value);
      if (normalizedValue) return normalizedValue.slice(0, 120);
    }
  }
  return null;
}

function extractProductIdentity(specs: unknown) {
  return {
    sku:
      extractIdentityValue(specs, ["sku", "скю", "код sku", "sku код"]) ?? null,
    article:
      extractIdentityValue(specs, [
        "артикул",
        "артикул товара",
        "модель",
        "код товара",
      ]) ?? null,
    barcode:
      extractIdentityValue(specs, ["штрихкод", "barcode", "ean", "gtin"]) ?? null,
    externalCode:
      extractIdentityValue(specs, ["external_code", "внешний код"]) ?? null,
  };
}

function buildAttributesText(specs: unknown) {
  if (!isSpecsRecord(specs)) return "";
  return Object.entries(specs)
    .map(([key, value]) => `${sanitizeTextValue(key)} ${sanitizeTextValue(value)}`.trim())
    .filter(Boolean)
    .join(" ");
}

function getProductImageThumb(image: string | null, imageVariants: unknown) {
  const variants = normalizeProductImageVariantSet(imageVariants, image);
  return (
    variants?.thumb ||
    variants?.card ||
    variants?.medium ||
    variants?.original ||
    image ||
    "/images/nofoto.jpg"
  );
}

function toSearchSubtitle(parts: Array<string | null | undefined>) {
  return parts
    .map(item => sanitizeTextValue(item))
    .filter(Boolean)
    .join(" · ")
    .slice(0, 512);
}

export function buildProductSearchDocument(row: {
  id: number;
  msId: string | null;
  slug: string;
  name: string;
  description: string;
  specs: unknown;
  price: number;
  oldPrice: number | null;
  isActive: boolean;
  isAutoBlocked: boolean;
  categoryId: number;
  categoryName: string | null;
  image: string;
  imageVariants: unknown;
  stockCount: number;
  brandName: string | null;
  reviewCount: number;
  totalScore: number | null;
}) {
  const identity = extractProductIdentity(row.specs);
  const attributesText = buildAttributesText(row.specs);
  const exactParts = [
    row.slug,
    identity.sku,
    identity.article,
    identity.barcode,
    identity.externalCode,
    row.msId,
    row.name,
  ]
    .filter(Boolean)
    .map(item => sanitizeTextValue(item))
    .join(" ");

  return {
    entityType: "product" as const,
    entityId: row.id,
    title: row.name,
    subtitle: toSearchSubtitle([
      row.categoryName,
      row.brandName,
      row.stockCount > 0 ? "В наличии" : "Нет в наличии",
    ]),
    contentText: sanitizeTextValue(row.description),
    attributesText,
    exactText: exactParts,
    url: `/product/${row.slug}`,
    imageUrl: getProductImageThumb(row.image, row.imageVariants),
    price: row.price,
    oldPrice: row.oldPrice,
    brandId: null,
    brandName: row.brandName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    sku: identity.sku,
    article: identity.article,
    barcode: identity.barcode,
    externalCode: identity.externalCode,
    moyskladId: row.msId,
    isActive: row.isActive,
    isVisible: !row.isAutoBlocked,
    inStock: row.stockCount > 0,
    stockCount: row.stockCount,
    sortWeight: row.totalScore ?? 0,
    popularityScore: row.reviewCount ?? 0,
  };
}

type PageDocSeed = {
  entityId: number;
  title: string;
  subtitle?: string;
  contentText: string;
  url: string;
  categoryName?: string;
};

async function buildPageSeeds(): Promise<PageDocSeed[]> {
  const profile = await getSiteProfileSettings();
  const db = getDb();
  const publishedPosts = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      content: posts.content,
      category: posts.category,
      published: posts.published,
      status: posts.status,
    })
    .from(posts)
    .where(and(eq(posts.published, true), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
    .limit(500);

  const staticPages: PageDocSeed[] = [
    {
      entityId: 1,
      title: "Контакты",
      subtitle: "Контакты · ТЕХАКС",
      contentText: [
        profile.contacts.fullAddress,
        profile.contacts.primaryPhoneDisplay,
        profile.contacts.email,
        profile.contacts.workingHours,
      ].join(" "),
      url: "/contacts",
      categoryName: "Информация",
    },
    {
      entityId: 2,
      title: "Магазины",
      subtitle: "Магазины · ТЕХАКС",
      contentText: "Магазины, адреса, телефоны, часы работы, наличие товаров по точкам.",
      url: "/stores",
      categoryName: "Информация",
    },
    {
      entityId: 3,
      title: profile.legalTexts.offerTitle || defaultSiteProfileSettings.legalTexts.offerTitle,
      subtitle: "Оферта · ТЕХАКС",
      contentText: profile.legalTexts.offerContent,
      url: "/offer",
      categoryName: "Правовая информация",
    },
    {
      entityId: 4,
      title:
        profile.legalTexts.privacyPolicyTitle ||
        defaultSiteProfileSettings.legalTexts.privacyPolicyTitle,
      subtitle: "Политика обработки данных · ТЕХАКС",
      contentText: profile.legalTexts.privacyPolicyContent,
      url: "/privacy-policy",
      categoryName: "Правовая информация",
    },
    {
      entityId: 5,
      title:
        profile.legalTexts.paymentDeliveryTitle ||
        defaultSiteProfileSettings.legalTexts.paymentDeliveryTitle,
      subtitle: "Оплата и доставка · ТЕХАКС",
      contentText: profile.legalTexts.paymentDeliveryContent,
      url: "/payment-delivery",
      categoryName: "Правовая информация",
    },
    {
      entityId: 6,
      title:
        profile.legalTexts.returnsPolicyTitle ||
        defaultSiteProfileSettings.legalTexts.returnsPolicyTitle,
      subtitle: "Возврат и обмен · ТЕХАКС",
      contentText: profile.legalTexts.returnsPolicyContent,
      url: "/returns",
      categoryName: "Правовая информация",
    },
    {
      entityId: 7,
      title: "Блог",
      subtitle: "Блог · ТЕХАКС",
      contentText: "Статьи, обзоры, советы по выбору аксессуаров и техники.",
      url: "/blog",
      categoryName: "Контент",
    },
  ];

  const postPages = publishedPosts.map(post => ({
    entityId: 100000 + post.id,
    title: post.title,
    subtitle: `${post.category} · Блог`,
    contentText: `${post.excerpt} ${sanitizeTextValue(post.content)}`,
    url: `/blog/${post.slug}`,
    categoryName: post.category,
  }));

  return [...staticPages, ...postPages];
}

async function upsertSearchDocuments(
  docs: Array<
    Omit<typeof searchDocuments.$inferInsert, "createdAt" | "updatedAt" | "indexedAt"> &
      Partial<Pick<typeof searchDocuments.$inferInsert, "createdAt" | "updatedAt" | "indexedAt">>
  >
) {
  if (docs.length === 0) return;
  const db = getDb();
  for (const doc of docs) {
    await db
      .insert(searchDocuments)
      .values({
        ...doc,
        updatedAt: new Date(),
        indexedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          title: doc.title,
          subtitle: doc.subtitle ?? null,
          contentText: doc.contentText ?? null,
          attributesText: doc.attributesText ?? null,
          exactText: doc.exactText ?? null,
          url: doc.url,
          imageUrl: doc.imageUrl ?? null,
          price: doc.price ?? null,
          oldPrice: doc.oldPrice ?? null,
          brandId: doc.brandId ?? null,
          brandName: doc.brandName ?? null,
          categoryId: doc.categoryId ?? null,
          categoryName: doc.categoryName ?? null,
          sku: doc.sku ?? null,
          article: doc.article ?? null,
          barcode: doc.barcode ?? null,
          externalCode: doc.externalCode ?? null,
          moyskladId: doc.moyskladId ?? null,
          isActive: doc.isActive ?? true,
          isVisible: doc.isVisible ?? true,
          inStock: doc.inStock ?? true,
          stockCount: doc.stockCount ?? 0,
          sortWeight: doc.sortWeight ?? 0,
          popularityScore: doc.popularityScore ?? 0,
          updatedAt: sql`now()`,
          indexedAt: sql`now()`,
        },
      });
  }
}

function buildTermsFromText(text: string) {
  return tokenizeSearchQuery(text)
    .filter(token => token.length >= 2)
    .slice(0, 60);
}

async function upsertSearchTerms(
  terms: Array<{ term: string; normalizedTerm: string; source: string; weight: number }>
) {
  if (terms.length === 0) return;
  const db = getDb();
  for (const term of terms) {
    await db
      .insert(searchTerms)
      .values({
        term: term.term,
        normalizedTerm: term.normalizedTerm,
        source: term.source,
        weight: term.weight,
        usageCount: 0,
      })
      .onDuplicateKeyUpdate({
        set: {
          term: term.term,
          weight: sql`greatest(${searchTerms.weight}, ${term.weight})`,
          updatedAt: sql`now()`,
        },
      });
  }
}

function createTermEntries(
  value: string,
  source: string,
  baseWeight: number
) {
  return buildTermsFromText(value).map(term => ({
    term,
    normalizedTerm: normalizeSearchQuery(term).slice(0, 120),
    source,
    weight: baseWeight,
  }));
}

export async function rebuildSearchDocumentsForProducts(productIds?: number[]) {
  const db = getDb();
  const whereClause =
    productIds && productIds.length > 0
      ? inArray(products.id, productIds)
      : undefined;

  const rows = whereClause
    ? await db
        .select({
          id: products.id,
          msId: products.msId,
          slug: products.slug,
          name: products.name,
          description: products.description,
          specs: products.specs,
          price: products.price,
          oldPrice: products.oldPrice,
          isActive: products.isActive,
          isAutoBlocked: products.isAutoBlocked,
          categoryId: products.categoryId,
          categoryName: categories.name,
          image: products.image,
          imageVariants: products.imageVariants,
          reviewCount: products.reviewCount,
          totalScore: productMerchandising.totalScore,
          stockCount: publicAvailableStockQtySql,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(productMerchandising, eq(productMerchandising.productId, products.id))
        .where(whereClause)
    : await db
        .select({
          id: products.id,
          msId: products.msId,
          slug: products.slug,
          name: products.name,
          description: products.description,
          specs: products.specs,
          price: products.price,
          oldPrice: products.oldPrice,
          isActive: products.isActive,
          isAutoBlocked: products.isAutoBlocked,
          categoryId: products.categoryId,
          categoryName: categories.name,
          image: products.image,
          imageVariants: products.imageVariants,
          reviewCount: products.reviewCount,
          totalScore: productMerchandising.totalScore,
          stockCount: publicAvailableStockQtySql,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(productMerchandising, eq(productMerchandising.productId, products.id));

  const docs = rows.map(row =>
    buildProductSearchDocument({
      ...row,
      brandName: getManufacturerNameFromProductSpecs(row.specs),
    })
  );

  await upsertSearchDocuments(docs);
  await upsertSearchTerms(
    docs.flatMap(doc => [
      ...createTermEntries(doc.title, "product_title", 5),
      ...createTermEntries(doc.attributesText ?? "", "product_attributes", 3),
      ...createTermEntries(doc.contentText ?? "", "product_content", 1),
      ...createTermEntries(doc.brandName ?? "", "brand", 4),
      ...createTermEntries(doc.categoryName ?? "", "category", 3),
      ...createTermEntries(doc.exactText ?? "", "exact", 8),
    ])
  );

  return docs.length;
}

export async function rebuildSearchDocumentsForCategories(categoryIds?: number[]) {
  const db = getDb();
  const allCategories = await db.select().from(categories);
  const rows = categoryIds?.length
    ? allCategories.filter(row => categoryIds.includes(row.id))
    : allCategories;
  const visibleCategoryIds = buildPublicVisibleCategoryIdSet(allCategories);
  const hiddenCategoryIds = rows
    .filter(row => !visibleCategoryIds.has(row.id))
    .map(row => row.id);

  if (hiddenCategoryIds.length > 0) {
    await removeSearchDocumentsForEntity("category", hiddenCategoryIds);
  }

  const visibleRows = rows.filter(row => visibleCategoryIds.has(row.id));

  const docs = [];
  for (const row of visibleRows) {
    const [stats] = await db
      .select({
        productCount: sql<number>`count(*)`,
      })
      .from(products)
      .where(eq(products.categoryId, row.id));

    docs.push({
      entityType: "category" as const,
      entityId: row.id,
      title: row.name,
      subtitle: toSearchSubtitle(["Категория", stats?.productCount ? `${stats.productCount} товаров` : null]),
      contentText: sanitizeTextValue(row.description),
      attributesText: "",
      exactText: [row.slug, row.msId, row.name].filter(Boolean).join(" "),
      url: `/catalog?cat=${row.slug}`,
      imageUrl: null,
      price: null,
      oldPrice: null,
      brandId: null,
      brandName: null,
      categoryId: row.id,
      categoryName: row.name,
      sku: null,
      article: null,
      barcode: null,
      externalCode: row.msId ?? null,
      moyskladId: row.msId ?? null,
      isActive: true,
      isVisible: true,
      inStock: true,
      stockCount: 0,
      sortWeight: Number(row.sortOrder ?? 0),
      popularityScore: stats?.productCount ?? 0,
    });
  }

  await upsertSearchDocuments(docs);
  await upsertSearchTerms(
    docs.flatMap(doc => [
      ...createTermEntries(doc.title, "category_title", 4),
      ...createTermEntries(doc.contentText ?? "", "category_content", 2),
    ])
  );
  return docs.length;
}

export async function rebuildSearchDocumentsForPages() {
  const seeds = await buildPageSeeds();
  const db = getDb();
  await db.delete(searchDocuments).where(eq(searchDocuments.entityType, "page"));
  const docs = seeds.map(seed => ({
    entityType: "page" as const,
    entityId: seed.entityId,
    title: seed.title,
    subtitle: seed.subtitle ?? null,
    contentText: sanitizeTextValue(seed.contentText),
    attributesText: seed.categoryName ?? "",
    exactText: [seed.title, seed.url, seed.categoryName].filter(Boolean).join(" "),
    url: seed.url,
    imageUrl: null,
    price: null,
    oldPrice: null,
    brandId: null,
    brandName: null,
    categoryId: null,
    categoryName: seed.categoryName ?? null,
    sku: null,
    article: null,
    barcode: null,
    externalCode: null,
    moyskladId: null,
    isActive: true,
    isVisible: true,
    inStock: true,
    stockCount: 0,
    sortWeight: 0,
    popularityScore: 0,
  }));

  await upsertSearchDocuments(docs);
  await upsertSearchTerms(
    docs.flatMap(doc => [
      ...createTermEntries(doc.title, "page_title", 3),
      ...createTermEntries(doc.contentText ?? "", "page_content", 1),
    ])
  );
  return docs.length;
}

export async function removeSearchDocumentsForEntity(entityType: SearchEntityType, entityIds: number[]) {
  if (!entityIds.length) return;
  const db = getDb();
  await db
    .delete(searchDocuments)
    .where(and(eq(searchDocuments.entityType, entityType), inArray(searchDocuments.entityId, entityIds)));
}

export async function enqueueSearchReindexJob(input: {
  entityType: SearchEntityType;
  entityId?: number | null;
  reason: string;
}) {
  const db = getDb();
  const result = await db.insert(searchReindexJobs).values({
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    reason: input.reason,
    status: "pending",
  });
  return Number((result as { insertId?: number }).insertId ?? 0);
}

export async function processSearchReindexJobs(limit = 50) {
  const db = getDb();
  const jobs = await db
    .select()
    .from(searchReindexJobs)
    .where(inArray(searchReindexJobs.status, ["pending", "error"] as SearchReindexStatus[]))
    .orderBy(asc(searchReindexJobs.createdAt))
    .limit(limit);

  const summary = { processed: 0, failed: 0 };

  for (const job of jobs) {
    await db
      .update(searchReindexJobs)
      .set({ status: "running", attempts: job.attempts + 1, startedAt: new Date(), lastError: null })
      .where(eq(searchReindexJobs.id, job.id));

    try {
      if (job.entityType === "product") {
        if (job.entityId) {
          const existing = await db
            .select({ id: products.id })
            .from(products)
            .where(eq(products.id, job.entityId))
            .limit(1);
          if (existing.length > 0) {
            await rebuildSearchDocumentsForProducts([job.entityId]);
          } else {
            await removeSearchDocumentsForEntity("product", [job.entityId]);
          }
        } else {
          await rebuildSearchDocumentsForProducts();
        }
      } else if (job.entityType === "category") {
        if (job.entityId) {
          const existing = await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.id, job.entityId))
            .limit(1);
          if (existing.length > 0) {
            await rebuildSearchDocumentsForCategories([job.entityId]);
          } else {
            await removeSearchDocumentsForEntity("category", [job.entityId]);
          }
        } else {
          await rebuildSearchDocumentsForCategories();
        }
      } else if (job.entityType === "page") {
        await rebuildSearchDocumentsForPages();
      }

      await db
        .update(searchReindexJobs)
        .set({ status: "done", finishedAt: new Date() })
        .where(eq(searchReindexJobs.id, job.id));
      summary.processed += 1;
    } catch (error) {
      await db
        .update(searchReindexJobs)
        .set({
          status: "error",
          lastError: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        })
        .where(eq(searchReindexJobs.id, job.id));
      summary.failed += 1;
    }
  }

  return summary;
}

export async function rebuildSearchIndex(entityTypes: SearchEntityType[]) {
  const counts: Record<SearchEntityType, number> = {
    product: 0,
    category: 0,
    page: 0,
  };
  if (entityTypes.includes("product")) counts.product = await rebuildSearchDocumentsForProducts();
  if (entityTypes.includes("category")) counts.category = await rebuildSearchDocumentsForCategories();
  if (entityTypes.includes("page")) counts.page = await rebuildSearchDocumentsForPages();
  return counts;
}

export function calculateSearchScore(candidate: SearchCandidate, tokens: string[], originalQuery: string) {
  const title = normalizeSearchQuery(candidate.title);
  const subtitle = normalizeSearchQuery(candidate.subtitle ?? "");
  const brand = normalizeSearchQuery(candidate.brandName ?? "");
  const category = normalizeSearchQuery(candidate.categoryName ?? "");
  const exactBucket = normalizeSearchQuery(
    [
      candidate.sku,
      candidate.article,
      candidate.barcode,
      candidate.externalCode,
      candidate.moyskladId,
      candidate.exactText,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const normalizedQuery = normalizeSearchQuery(originalQuery);
  const exactMatchScore =
    exactBucket === normalizedQuery ||
    [candidate.sku, candidate.article, candidate.barcode, candidate.externalCode, candidate.moyskladId]
      .filter(Boolean)
      .some(value => normalizeSearchQuery(String(value)) === normalizedQuery)
      ? 200
      : 0;

  const tokenTitleBoost = tokens.reduce(
    (sum, token) => sum + (title.includes(token) ? 8 : 0) + (subtitle.includes(token) ? 2 : 0),
    0
  );
  const tokenBrandBoost = tokens.reduce((sum, token) => sum + (brand.includes(token) ? 6 : 0), 0);
  const tokenCategoryBoost = tokens.reduce(
    (sum, token) => sum + (category.includes(token) ? 4 : 0),
    0
  );
  const stockBoost = candidate.inStock ? 5 : -3;

  return (
    exactMatchScore +
    candidate.exactMatchScore * 10 +
    candidate.exactScore * 10 +
    candidate.titleScore * 5 +
    candidate.attributesScore * 3 +
    candidate.contentScore +
    tokenTitleBoost +
    tokenBrandBoost +
    tokenCategoryBoost +
    candidate.popularityScore * 0.35 +
    candidate.sortWeight * 0.08 +
    candidate.fallbackScore * 2 +
    stockBoost
  );
}

function buildSearchFacets(rows: SearchDocumentRow[]) {
  const categoriesMap = new Map<number, SearchFacetCount>();
  const brandsMap = new Map<string, SearchFacetCount>();
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;

  for (const row of rows) {
    if (row.entityType !== "product") continue;
    if (typeof row.categoryId === "number" && row.categoryName) {
      const existing = categoriesMap.get(row.categoryId) ?? {
        id: row.categoryId,
        name: row.categoryName,
        count: 0,
      };
      existing.count += 1;
      categoriesMap.set(row.categoryId, existing);
    }

    if (row.brandName) {
      const key = row.brandName.trim().toLowerCase();
      const existing = brandsMap.get(key) ?? {
        id: row.brandId ?? 0,
        name: row.brandName,
        count: 0,
      };
      existing.count += 1;
      brandsMap.set(key, existing);
    }

    if (typeof row.price === "number" && row.price > 0) {
      minPrice = Math.min(minPrice, row.price);
      maxPrice = Math.max(maxPrice, row.price);
    }
  }

  return {
    categories: Array.from(categoriesMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")),
    brands: Array.from(brandsMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru")),
    price: {
      min: Number.isFinite(minPrice) ? minPrice : 0,
      max: maxPrice,
    },
  };
}

function pickCorrectedQuery(
  query: string,
  termRows: Array<{ term: string; normalizedTerm: string }>
) {
  const normalizedQuery = normalizeSearchQuery(query);
  const queryTokens = tokenizeSearchQuery(query);
  if (queryTokens.length !== 1) return undefined;
  const [token] = queryTokens;

  let best: { term: string; distance: number } | null = null;
  for (const row of termRows) {
    const candidate = row.normalizedTerm;
    if (!candidate || Math.abs(candidate.length - token.length) > 2) continue;
    const distance = levenshtein(token, candidate);
    if (distance > 2) continue;
    if (!best || distance < best.distance) {
      best = { term: row.term, distance };
    }
  }

  if (!best || normalizeSearchQuery(best.term) === normalizedQuery) return undefined;
  return best.term;
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }
  return matrix[b.length][a.length];
}

async function fetchCandidateDocuments(args: {
  normalizedQuery: string;
  expandedTokens: string[];
  entityTypes: SearchEntityType[];
  settings: SearchSettings;
}) {
  const db = getDb();
  const booleanQuery = buildBooleanSearchQuery(args.expandedTokens);
  const likePatterns = args.expandedTokens.slice(0, 5).map(buildLikePattern);

  const whereConditions = [
    inArray(searchDocuments.entityType, args.entityTypes),
  ];
  if (!args.settings.showInactive) {
    whereConditions.push(eq(searchDocuments.isActive, true));
    whereConditions.push(eq(searchDocuments.isVisible, true));
  }
  if (!args.settings.showZeroPrice) {
    whereConditions.push(
      or(
        sql`${searchDocuments.price} IS NULL`,
        sql`${searchDocuments.price} > 0`
      )!
    );
  }

  const searchCondition = or(
    eq(searchDocuments.sku, args.normalizedQuery),
    eq(searchDocuments.article, args.normalizedQuery),
    eq(searchDocuments.barcode, args.normalizedQuery),
    eq(searchDocuments.externalCode, args.normalizedQuery),
    eq(searchDocuments.moyskladId, args.normalizedQuery),
    booleanQuery
      ? sql`(
          match(${searchDocuments.title}) against (${booleanQuery} in boolean mode)
          or match(${searchDocuments.exactText}) against (${booleanQuery} in boolean mode)
          or match(${searchDocuments.attributesText}) against (${booleanQuery} in boolean mode)
          or match(${searchDocuments.contentText}) against (${booleanQuery} in boolean mode)
        )`
      : undefined,
    ...likePatterns.flatMap(pattern => [
      like(searchDocuments.title, pattern),
      like(searchDocuments.brandName, pattern),
      like(searchDocuments.categoryName, pattern),
      like(searchDocuments.exactText, pattern),
    ])
  );

  const rows = await db
    .select({
      id: searchDocuments.id,
      entityType: searchDocuments.entityType,
      entityId: searchDocuments.entityId,
      title: searchDocuments.title,
      subtitle: searchDocuments.subtitle,
      contentText: searchDocuments.contentText,
      attributesText: searchDocuments.attributesText,
      exactText: searchDocuments.exactText,
      url: searchDocuments.url,
      imageUrl: searchDocuments.imageUrl,
      price: searchDocuments.price,
      oldPrice: searchDocuments.oldPrice,
      brandId: searchDocuments.brandId,
      brandName: searchDocuments.brandName,
      categoryId: searchDocuments.categoryId,
      categoryName: searchDocuments.categoryName,
      sku: searchDocuments.sku,
      article: searchDocuments.article,
      barcode: searchDocuments.barcode,
      externalCode: searchDocuments.externalCode,
      moyskladId: searchDocuments.moyskladId,
      isActive: searchDocuments.isActive,
      isVisible: searchDocuments.isVisible,
      inStock: searchDocuments.inStock,
      stockCount: searchDocuments.stockCount,
      sortWeight: searchDocuments.sortWeight,
      popularityScore: searchDocuments.popularityScore,
      createdAt: searchDocuments.createdAt,
      updatedAt: searchDocuments.updatedAt,
      indexedAt: searchDocuments.indexedAt,
      titleScore: booleanQuery ? sql<number>`coalesce(match(${searchDocuments.title}) against (${booleanQuery} in boolean mode), 0)` : sql<number>`0`,
      contentScore:
        booleanQuery && args.settings.includeDescription
          ? sql<number>`coalesce(match(${searchDocuments.contentText}) against (${booleanQuery} in boolean mode), 0)`
          : sql<number>`0`,
      attributesScore:
        booleanQuery && args.settings.includeAttributes
          ? sql<number>`coalesce(match(${searchDocuments.attributesText}) against (${booleanQuery} in boolean mode), 0)`
          : sql<number>`0`,
      exactScore:
        booleanQuery &&
        (args.settings.includeArticles || args.settings.includeSku || args.settings.includeBarcodes)
          ? sql<number>`coalesce(match(${searchDocuments.exactText}) against (${booleanQuery} in boolean mode), 0)`
          : sql<number>`0`,
      exactMatchScore: sql<number>`case
        when lower(coalesce(${searchDocuments.sku}, '')) = ${args.normalizedQuery} then 1
        when lower(coalesce(${searchDocuments.article}, '')) = ${args.normalizedQuery} then 1
        when lower(coalesce(${searchDocuments.barcode}, '')) = ${args.normalizedQuery} then 1
        when lower(coalesce(${searchDocuments.externalCode}, '')) = ${args.normalizedQuery} then 1
        when lower(coalesce(${searchDocuments.moyskladId}, '')) = ${args.normalizedQuery} then 1
        else 0
      end`,
      fallbackScore: sql<number>`0`,
    })
    .from(searchDocuments)
    .where(and(...whereConditions, searchCondition))
    .orderBy(desc(searchDocuments.popularityScore), desc(searchDocuments.updatedAt))
    .limit(250);

  if (rows.length > 0) {
    return rows as SearchCandidate[];
  }

  // Fallback pass: limited LIKE-based search for typo-ish or sparse cases.
  const fallbackTokens = args.expandedTokens.slice(0, 3);
  if (fallbackTokens.length === 0) return [] as SearchCandidate[];
  const fallbackPatterns = fallbackTokens.map(buildLikePattern);
  const fallbackRows = await db
    .select({
      id: searchDocuments.id,
      entityType: searchDocuments.entityType,
      entityId: searchDocuments.entityId,
      title: searchDocuments.title,
      subtitle: searchDocuments.subtitle,
      contentText: searchDocuments.contentText,
      attributesText: searchDocuments.attributesText,
      exactText: searchDocuments.exactText,
      url: searchDocuments.url,
      imageUrl: searchDocuments.imageUrl,
      price: searchDocuments.price,
      oldPrice: searchDocuments.oldPrice,
      brandId: searchDocuments.brandId,
      brandName: searchDocuments.brandName,
      categoryId: searchDocuments.categoryId,
      categoryName: searchDocuments.categoryName,
      sku: searchDocuments.sku,
      article: searchDocuments.article,
      barcode: searchDocuments.barcode,
      externalCode: searchDocuments.externalCode,
      moyskladId: searchDocuments.moyskladId,
      isActive: searchDocuments.isActive,
      isVisible: searchDocuments.isVisible,
      inStock: searchDocuments.inStock,
      stockCount: searchDocuments.stockCount,
      sortWeight: searchDocuments.sortWeight,
      popularityScore: searchDocuments.popularityScore,
      createdAt: searchDocuments.createdAt,
      updatedAt: searchDocuments.updatedAt,
      indexedAt: searchDocuments.indexedAt,
      titleScore: sql<number>`0`,
      contentScore: sql<number>`0`,
      attributesScore: sql<number>`0`,
      exactScore: sql<number>`0`,
      exactMatchScore: sql<number>`0`,
      fallbackScore: sql<number>`${fallbackTokens.length}`,
    })
    .from(searchDocuments)
    .where(
      and(
        ...whereConditions,
        or(
          ...fallbackPatterns.flatMap(pattern => [
            like(searchDocuments.title, pattern),
            like(searchDocuments.brandName, pattern),
            like(searchDocuments.categoryName, pattern),
            like(searchDocuments.attributesText, pattern),
            like(searchDocuments.exactText, pattern),
          ])
        )
      )
    )
    .limit(120);

  return fallbackRows as SearchCandidate[];
}

async function getSearchPopularTerms() {
  if (internalCache.popular.expiresAt > Date.now()) {
    return internalCache.popular.value;
  }
  const db = getDb();
  const rows = await db
    .select({
      normalizedQuery: searchLogs.normalizedQuery,
      count: sql<number>`count(*)`,
    })
    .from(searchLogs)
    .groupBy(searchLogs.normalizedQuery)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  const value = rows.map(row => row.normalizedQuery);
  internalCache.popular = {
    expiresAt: Date.now() + POPULAR_CACHE_TTL_MS,
    value,
  };
  return value;
}

function hashValue(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

async function insertSearchLog(args: {
  query: string;
  normalizedQuery: string;
  correctedQuery?: string;
  resultsCount: number;
  userId?: number | null;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = getDb();
  await db.insert(searchLogs).values({
    query: args.query.slice(0, 255),
    normalizedQuery: args.normalizedQuery.slice(0, 255),
    correctedQuery: args.correctedQuery?.slice(0, 255) ?? null,
    resultsCount: args.resultsCount,
    userId: args.userId ?? null,
    sessionId: args.sessionId ?? null,
    ipHash: hashValue(args.ip),
    userAgentHash: hashValue(args.userAgent),
  });
  const [lastInsertRows] = await db.execute(sql`SELECT LAST_INSERT_ID() AS id`);
  const row = Array.isArray(lastInsertRows) ? (lastInsertRows[0] as { id?: number } | undefined) : undefined;
  return Number(row?.id ?? 0);
}

export async function searchSite(args: {
  query: string;
  page?: number;
  limit?: number;
  entityTypes?: SearchEntityType[];
  categoryId?: number;
  brandId?: number;
  priceFrom?: number;
  priceTo?: number;
  inStockOnly?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest" | "popular";
  sessionId?: string;
  userId?: number | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const normalizedQuery = normalizeSearchQuery(args.query);
  const emptyResult = {
    searchLogId: 0,
    query: args.query,
    normalizedQuery,
    correctedQuery: undefined as string | undefined,
    total: 0,
    products: [] as SearchProductCard[],
    categories: [] as Array<{ id: number; title: string; subtitle: string | null; url: string; count: number }>,
    pages: [] as Array<{ id: number; title: string; subtitle: string | null; url: string }>,
    facets: {
      categories: [] as SearchFacetCount[],
      brands: [] as SearchFacetCount[],
      price: { min: 0, max: 0 },
    },
  };

  try {
    const settings = await getSearchSettings();
    const expandedTokens = await expandQueryWithSynonyms(args.query);
    const entityTypes = args.entityTypes?.length
      ? args.entityTypes
      : (["product", "category", ...(settings.includePages ? ["page" as const] : [])] as SearchEntityType[]);

    const candidates = await fetchCandidateDocuments({
      normalizedQuery,
      expandedTokens,
      entityTypes,
      settings,
    });

    const baseFiltered = candidates.filter(candidate => {
      if (candidate.entityType !== "product") return true;
      if (!settings.showZeroPrice && (!candidate.price || candidate.price <= 0)) return false;
      if (!settings.showInactive && (!candidate.isActive || !candidate.isVisible)) return false;
      if (args.categoryId && candidate.categoryId !== args.categoryId) return false;
      if (args.brandId && candidate.brandId !== args.brandId) return false;
      if (args.inStockOnly && !candidate.inStock) return false;
      return true;
    });

    let filtered = baseFiltered.filter(candidate => {
      if (candidate.entityType !== "product") return true;
      if (typeof args.priceFrom === "number" && typeof candidate.price === "number" && candidate.price < args.priceFrom) return false;
      if (typeof args.priceTo === "number" && typeof candidate.price === "number" && candidate.price > args.priceTo) return false;
      return true;
    });

    const correctedQuery =
      filtered.length === 0
        ? pickCorrectedQuery(
            args.query,
            await getDb()
              .select({ term: searchTerms.term, normalizedTerm: searchTerms.normalizedTerm })
              .from(searchTerms)
              .orderBy(desc(searchTerms.usageCount), desc(searchTerms.weight))
              .limit(500)
          )
        : undefined;

    filtered = filtered
      .map(candidate => ({
        ...candidate,
        _score: calculateSearchScore(candidate, expandedTokens, args.query),
      }))
      .sort((a, b) => {
        if (args.sort === "price_asc") return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
        if (args.sort === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
        if (args.sort === "newest") {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        if (args.sort === "popular") {
          return (b.popularityScore ?? 0) - (a.popularityScore ?? 0) || b._score - a._score;
        }
        const stockDiff = Number(b.inStock) - Number(a.inStock);
        if (settings.showOutOfStock && stockDiff !== 0) return stockDiff;
        return b._score - a._score || (b.popularityScore ?? 0) - (a.popularityScore ?? 0);
      });

    const productDocs = filtered.filter(item => item.entityType === "product");
    const facetProductDocs = baseFiltered.filter(item => item.entityType === "product");
    const categoryDocs = filtered.filter(item => item.entityType === "category").slice(0, 8);
    const pageDocs = filtered.filter(item => item.entityType === "page").slice(0, 8);
    const facets = buildSearchFacets(facetProductDocs);

    const productIds = productDocs.map(item => item.entityId);
    const db = getDb();
    const productRows = productIds.length
      ? await db
          .select({
            id: products.id,
            slug: products.slug,
            name: products.name,
            price: products.price,
            oldPrice: products.oldPrice,
            badge: products.badge,
            image: products.image,
            imageVariants: products.imageVariants,
            categoryId: products.categoryId,
            categoryName: categories.name,
            rating: products.rating,
            reviewCount: products.reviewCount,
            inStock: sql<boolean>`${publicAvailableStockQtySql} > 0`,
            specs: products.specs,
            merchandisingBadges: productMerchandising.badges,
          })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .leftJoin(productMerchandising, eq(productMerchandising.productId, products.id))
          .where(inArray(products.id, productIds))
      : [];

    const orderedProducts = productDocs
      .map(doc => productRows.find(row => row.id === doc.entityId))
      .filter(Boolean) as SearchProductCard[];

    const page = args.page ?? 1;
    const limit = args.limit ?? 24;
    const start = (page - 1) * limit;
    const paginatedProducts = orderedProducts.slice(start, start + limit);

    const searchLogId = await insertSearchLog({
      query: args.query,
      normalizedQuery,
      correctedQuery,
      resultsCount: productDocs.length + categoryDocs.length + pageDocs.length,
      userId: args.userId ?? null,
      sessionId: args.sessionId ?? null,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null,
    });

    return {
      searchLogId,
      query: args.query,
      normalizedQuery,
      correctedQuery,
      total: productDocs.length,
      products: paginatedProducts,
      categories: categoryDocs.map(item => ({
        id: item.entityId,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url,
        count: item.popularityScore ?? 0,
      })),
      pages: pageDocs.map(item => ({
        id: item.entityId,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url,
      })),
      facets,
    };
  } catch (error) {
    if (isMissingSearchInfrastructureError(error)) {
      return emptyResult;
    }
    throw error;
  }
}

export async function searchSuggestions(query: string, limit = 8) {
  try {
    const settings = await getSearchSettings();
    const normalizedQuery = normalizeSearchQuery(query);
    const expandedTokens = await expandQueryWithSynonyms(query);
    const candidates = await fetchCandidateDocuments({
      normalizedQuery,
      expandedTokens,
      entityTypes: ["product", "category", ...(settings.includePages ? ["page" as const] : [])],
      settings,
    });

    const sorted = candidates
      .map(candidate => ({
        ...candidate,
        _score: calculateSearchScore(candidate, expandedTokens, query),
      }))
      .sort((a, b) => b._score - a._score);

    const productsOut = sorted
      .filter(item => item.entityType === "product")
      .slice(0, limit)
      .map(item => ({
        id: item.entityId,
        title: item.title,
        subtitle: item.subtitle ?? "",
        url: item.url,
        imageUrl: item.imageUrl ?? "/images/nofoto.jpg",
        price: item.price ?? undefined,
        inStock: item.inStock,
      }));

    const categoriesOut = sorted
      .filter(item => item.entityType === "category")
      .slice(0, Math.max(2, Math.floor(limit / 3)))
      .map(item => ({
        id: item.entityId,
        title: item.title,
        url: item.url,
      }));

    const pagesOut = sorted
      .filter(item => item.entityType === "page")
      .slice(0, Math.max(2, Math.floor(limit / 4)))
      .map(item => ({
        id: item.entityId,
        title: item.title,
        url: item.url,
      }));

    return {
      products: productsOut,
      categories: categoriesOut,
      pages: pagesOut,
    };
  } catch (error) {
    if (isMissingSearchInfrastructureError(error)) {
      return {
        products: [],
        categories: [],
        pages: [],
      };
    }
    throw error;
  }
}

export async function logSearchClick(input: z.infer<typeof searchLogClickInputSchema>) {
  const db = getDb();
  await db.insert(searchClickLogs).values({
    searchLogId: input.searchLogId ?? 0,
    entityType: input.entityType,
    entityId: input.entityId,
    position: input.position ?? 0,
    url: input.url,
  });
  return { success: true };
}

export async function getSearchAdminStats() {
  const db = getDb();
  const [totals] = await db
    .select({
      totalLogs: sql<number>`count(*)`,
      noResults: sql<number>`sum(case when ${searchLogs.resultsCount} = 0 then 1 else 0 end)`,
      lowResults: sql<number>`sum(case when ${searchLogs.resultsCount} between 1 and 3 then 1 else 0 end)`,
    })
    .from(searchLogs);

  const popularQueries = await db
    .select({
      query: searchLogs.normalizedQuery,
      count: sql<number>`count(*)`,
      avgResults: sql<number>`avg(${searchLogs.resultsCount})`,
    })
    .from(searchLogs)
    .groupBy(searchLogs.normalizedQuery)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(12);

  const noResultQueries = await db
    .select({
      query: searchLogs.normalizedQuery,
      count: sql<number>`count(*)`,
    })
    .from(searchLogs)
    .where(eq(searchLogs.resultsCount, 0))
    .groupBy(searchLogs.normalizedQuery)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(12);

  const noClickQueries = await db.execute(sql`
    select l.normalized_query as query, count(*) as count
    from ${searchLogs} l
    left join ${searchClickLogs} c on c.search_log_id = l.id
    where c.id is null
    group by l.normalized_query
    order by count(*) desc
    limit 12
  `);

  const topClickedProducts = await db.execute(sql`
    select d.title, d.url, c.entity_id as entityId, count(*) as count
    from ${searchClickLogs} c
    inner join ${searchDocuments} d
      on d.entity_type = c.entity_type and d.entity_id = c.entity_id
    where c.entity_type = 'product'
    group by c.entity_id, d.title, d.url
    order by count(*) desc
    limit 12
  `);

  const queue = await db
    .select({
      pending: sql<number>`sum(case when ${searchReindexJobs.status} = 'pending' then 1 else 0 end)`,
      running: sql<number>`sum(case when ${searchReindexJobs.status} = 'running' then 1 else 0 end)`,
      errors: sql<number>`sum(case when ${searchReindexJobs.status} = 'error' then 1 else 0 end)`,
      done: sql<number>`sum(case when ${searchReindexJobs.status} = 'done' then 1 else 0 end)`,
    })
    .from(searchReindexJobs);

  return {
    totals: {
      totalLogs: totals?.totalLogs ?? 0,
      noResults: totals?.noResults ?? 0,
      lowResults: totals?.lowResults ?? 0,
    },
    popularQueries,
    noResultQueries,
    noClickQueries: Array.isArray(noClickQueries) ? noClickQueries : [],
    topClickedProducts: Array.isArray(topClickedProducts) ? topClickedProducts : [],
    queue: queue[0] ?? { pending: 0, running: 0, errors: 0, done: 0 },
    popularSuggestions: await getSearchPopularTerms(),
  };
}

export async function listSearchSynonyms() {
  const db = getDb();
  return db.select().from(searchSynonyms).orderBy(asc(searchSynonyms.term));
}

export async function createSearchSynonym(input: z.infer<typeof searchSynonymInputSchema>) {
  const db = getDb();
  const result = await db.insert(searchSynonyms).values({
    term: normalizeSynonymTerm(input.term),
    synonymsJson: Array.from(new Set(input.synonyms.map(item => normalizeSynonymTerm(item)).filter(Boolean))),
    isActive: input.isActive ?? true,
  });
  clearSearchCaches();
  return { success: true, id: Number((result as { insertId?: number }).insertId ?? 0) };
}

export async function updateSearchSynonym(
  id: number,
  input: z.infer<typeof searchSynonymInputSchema>
) {
  const db = getDb();
  await db
    .update(searchSynonyms)
    .set({
      term: normalizeSynonymTerm(input.term),
      synonymsJson: Array.from(new Set(input.synonyms.map(item => normalizeSynonymTerm(item)).filter(Boolean))),
      isActive: input.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(searchSynonyms.id, id));
  clearSearchCaches();
  return { success: true };
}

export async function deleteSearchSynonym(id: number) {
  const db = getDb();
  await db.delete(searchSynonyms).where(eq(searchSynonyms.id, id));
  clearSearchCaches();
  return { success: true };
}
