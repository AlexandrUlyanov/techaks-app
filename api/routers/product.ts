import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import {
  products,
  categories,
  reviews,
  productStocks,
  productSpecValues,
  stores,
  manufacturers,
} from "@db/schema";
import * as schema from "@db/schema";
import { and, eq, asc, desc, inArray, like, ne, or, sql } from "drizzle-orm";
import {
  applyCategorySpecStandardization,
  applyCategorySpecValueStandardization,
  bulkManageSpecOverview,
  getCategorySpecStandardization,
  getCategorySpecValueStandardization,
  getSpecStandardizationOverviewRows,
  upsertCategorySpecRule,
  upsertCategorySpecRulesBulk,
  upsertCategorySpecValueRule,
  upsertCategorySpecValueRulesBulk,
} from "../lib/product-spec-standardization";
import {
  normalizeSpecKeyForDisplay,
  normalizeSpecToken,
} from "../lib/product-normalization";
import { suggestCategorySpecRulesWithGemini } from "../lib/gemini-spec-standardization";
import {
  getManufacturerFilterKeys,
  getManufacturerNameFromProductSpecs,
} from "../lib/manufacturers";
import {
  applyProductAutoBlockState,
  getAdminProductPublicationStatus,
} from "../lib/product-visibility";
import { getProductReservationSummary, getProductStoreAvailability } from "../lib/product-reservations";
import {
  attachVisibleMerchandisingBadges,
  listHomepageFallbackProducts,
  productSelectFields,
  publicAvailableStockQtySql,
  publicProductSelectFields,
  publicProductVisibilityCondition,
} from "../lib/public-products";
import {
  enqueueSearchReindexJob,
  processSearchReindexJobs,
  rebuildSearchDocumentsForCategories,
  rebuildSearchDocumentsForProducts,
} from "../lib/search";
import { getProductVariants } from "../lib/product-variants";
import { writeAdminAuditLog } from "../lib/admin-audit";
import { buildPublicVisibleCategoryIdSet, filterPublicVisibleCategories } from "../lib/category-visibility";
import {
  CATEGORY_PREVIEW_IMAGE_LIMIT,
  normalizeCategoryPreviewImages,
  resolveCategoryPreviewImages,
} from "../../src/contracts/category-preview-images";
import { normalizeProductImageVariantSet } from "@contracts/product-images";

const productSchema = z.object({
  slug: z.string(),
  name: z.string(),
  categoryId: z.number(),
  price: z.number(),
  isActive: z.boolean().default(true),
  oldPrice: z.number().nullable(),
  badge: z.string().nullable(),
  image: z.string(),
  description: z.string(),
  specs: z.unknown(),
  inStock: z.boolean(),
  rating: z.string(),
  reviewCount: z.number(),
});

const specFilterSchema = z.object({
  normalizedKey: z.string(),
  normalizedValue: z.string(),
});

const adminVisibilityFilterSchema = z
  .enum(["all", "site_active", "manual_disabled", "auto_blocked", "zero_price"])
  .default("all");

function buildSpecFilterConditions(specFilters?: z.infer<typeof specFilterSchema>[]) {
  if (!specFilters?.length) return undefined;

  const grouped = new Map<string, string[]>();
  for (const filter of specFilters) {
    if (!filter.normalizedKey || !filter.normalizedValue) continue;
    const values = grouped.get(filter.normalizedKey) ?? [];
    if (!values.includes(filter.normalizedValue)) values.push(filter.normalizedValue);
    grouped.set(filter.normalizedKey, values);
  }

  const conditions = Array.from(grouped.entries()).map(([key, values]) => sql`EXISTS (
    SELECT 1 FROM ${productSpecValues}
    WHERE ${productSpecValues.productId} = ${products.id}
      AND ${productSpecValues.normalizedKey} = ${key}
      AND ${productSpecValues.normalizedValue} IN (${sql.join(values, sql`, `)})
  )`);

  if (conditions.length === 0) return undefined;
  return sql.join(conditions, sql` AND `);
}

function collectDescendantCategoryIds(
  allCategories: Array<typeof categories.$inferSelect>,
  categoryId: number
) {
  const ids = [categoryId];
  const stack = [categoryId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = allCategories
      .filter(category => category.parentId === current)
      .map(category => category.id);
    for (const childId of children) {
      ids.push(childId);
      stack.push(childId);
    }
  }

  return ids;
}

function collectAncestorCategoryIds(
  allCategories: Array<typeof categories.$inferSelect>,
  categoryId: number
) {
  const byId = new Map(allCategories.map(category => [category.id, category]));
  const ids: number[] = [];
  let currentId: number | null = categoryId;

  while (currentId) {
    const category = byId.get(currentId);
    if (!category) break;
    ids.unshift(category.id);
    currentId = category.parentId ?? null;
  }

  return ids;
}

function buildMergedSpecRulesForCategory(
  allCategories: Array<typeof categories.$inferSelect>,
  rules: Array<typeof schema.productSpecRules.$inferSelect>,
  categoryId: number
) {
  const ancestorCategoryIds = collectAncestorCategoryIds(allCategories, categoryId);
  const rulesByCategoryId = new Map<number, Array<(typeof rules)[number]>>();

  for (const rule of rules) {
    const bucket = rulesByCategoryId.get(rule.categoryId) ?? [];
    bucket.push(rule);
    rulesByCategoryId.set(rule.categoryId, bucket);
  }

  const mergedRules = new Map<string, (typeof rules)[number]>();
  for (const ancestorCategoryId of ancestorCategoryIds) {
    const categoryRules = rulesByCategoryId.get(ancestorCategoryId) ?? [];
    for (const rule of categoryRules) {
      mergedRules.set(rule.sourceNormalizedKey, rule);
    }
  }

  return mergedRules;
}

function normalizeCategoryPayload(
  data: {
    parentId?: number | null;
    slug: string;
    name: string;
    isActive?: boolean;
    description?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    imageUrl?: string | null;
    previewImages?: unknown;
    previewImageExclusions?: unknown;
    icon?: string | null;
    sortOrder: number;
  }
) {
  return {
    parentId: data.parentId ?? null,
    slug: data.slug.trim(),
    name: data.name.trim(),
    isActive: data.isActive ?? true,
    description: data.description?.trim() ? data.description.trim() : null,
    metaTitle: data.metaTitle?.trim() ? data.metaTitle.trim() : null,
    metaDescription: data.metaDescription?.trim() ? data.metaDescription.trim() : null,
    imageUrl: data.imageUrl?.trim() ? data.imageUrl.trim() : null,
    previewImages: normalizeCategoryPreviewImages(data.previewImages),
    previewImageExclusions: normalizeCategoryPreviewImages(data.previewImageExclusions),
    icon: data.icon?.trim() ? data.icon.trim() : null,
    sortOrder: data.sortOrder,
  };
}

async function collectCategoryPreviewImageSuggestions(
  categoryId: number,
  allCategoriesOverride?: Array<typeof categories.$inferSelect>,
  excludedImagesOverride?: unknown
) {
  const db = getDb();
  const allCategories = allCategoriesOverride ?? (await db.select().from(categories));
  const currentCategory = allCategories.find(category => category.id === categoryId);
  const categoryIds = collectDescendantCategoryIds(allCategories, categoryId);
  const excludedImages = new Set(
    normalizeCategoryPreviewImages(
      excludedImagesOverride ?? currentCategory?.previewImageExclusions,
      CATEGORY_PREVIEW_IMAGE_LIMIT * 4
    )
  );

  if (categoryIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      categoryId: products.categoryId,
      image: products.image,
      imageVariants: products.imageVariants,
    })
    .from(products)
    .where(inArray(products.categoryId, categoryIds))
    .orderBy(asc(products.id));

  const categoryById = new Map(allCategories.map(category => [category.id, category]));
  const directChildren = allCategories
    .filter(category => category.parentId === categoryId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);

  const rootBucketOrder = directChildren.map(category => category.id);
  const rootBucketByCategoryId = new Map<number, number | "self">();

  for (const descendantCategoryId of categoryIds) {
    if (descendantCategoryId === categoryId) {
      rootBucketByCategoryId.set(descendantCategoryId, "self");
      continue;
    }

    let currentId: number | null = descendantCategoryId;
    let resolvedRootId: number | null = null;

    while (currentId) {
      const currentCategory = categoryById.get(currentId);
      if (!currentCategory) break;
      if (currentCategory.parentId === categoryId) {
        resolvedRootId = currentCategory.id;
        break;
      }
      currentId = currentCategory.parentId ?? null;
    }

    rootBucketByCategoryId.set(descendantCategoryId, resolvedRootId ?? "self");
  }

  const bucketedImages = new Map<number | "self", string[]>();
  const suggestions: string[] = [];

  for (const row of rows) {
    const fallbackOriginal = typeof row.image === "string" ? row.image.trim() : "";
    const variants = normalizeProductImageVariantSet(row.imageVariants, fallbackOriginal);
    const image =
      variants.thumb ||
      variants.card ||
      variants.medium ||
      variants.original ||
      fallbackOriginal;
    if (!image || excludedImages.has(image) || excludedImages.has(fallbackOriginal)) continue;

    const bucketKey = rootBucketByCategoryId.get(row.categoryId) ?? "self";
    const bucket = bucketedImages.get(bucketKey) ?? [];
    if (bucket.includes(image)) continue;
    bucket.push(image);
    bucketedImages.set(bucketKey, bucket);
  }

  const pickNextFromBuckets = (bucketKeys: Array<number | "self">) => {
    let added = false;

    for (const bucketKey of bucketKeys) {
      const bucket = bucketedImages.get(bucketKey);
      if (!bucket || bucket.length === 0) continue;

      const nextImage = bucket.shift();
      if (!nextImage || suggestions.includes(nextImage) || excludedImages.has(nextImage)) continue;

      suggestions.push(nextImage);
      added = true;

      if (suggestions.length >= CATEGORY_PREVIEW_IMAGE_LIMIT) {
        return true;
      }
    }

    return added;
  };

  if (rootBucketOrder.length > 0) {
    while (suggestions.length < CATEGORY_PREVIEW_IMAGE_LIMIT) {
      const added = pickNextFromBuckets(rootBucketOrder);
      if (!added) break;
    }
  }

  if (suggestions.length < CATEGORY_PREVIEW_IMAGE_LIMIT) {
    const remainingBucketOrder = [
      ...rootBucketOrder,
      "self" as const,
      ...Array.from(bucketedImages.keys()).filter(
        bucketKey => bucketKey !== "self" && !rootBucketOrder.includes(bucketKey as number)
      ),
    ];

    while (suggestions.length < CATEGORY_PREVIEW_IMAGE_LIMIT) {
      const added = pickNextFromBuckets(remainingBucketOrder);
      if (!added) break;
    }
  }

  return suggestions;
}

async function validateCategoryMutationInput(input: {
  id?: number;
  data: ReturnType<typeof normalizeCategoryPayload>;
}) {
  const db = getDb();

  if (!input.data.slug) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Slug категории обязателен.",
    });
  }

  if (!input.data.name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Название категории обязательно.",
    });
  }

  const duplicateSlug = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      input.id
        ? and(eq(categories.slug, input.data.slug), ne(categories.id, input.id))
        : eq(categories.slug, input.data.slug)
    )
    .limit(1);

  if (duplicateSlug[0]) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Категория с таким slug уже существует.",
    });
  }

  if (input.data.parentId === undefined || input.data.parentId === null) {
    return;
  }

  const allCategories = await db.select().from(categories);
  const parentCategory = allCategories.find(category => category.id === input.data.parentId);

  if (!parentCategory) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Выбранная родительская категория не найдена.",
    });
  }

  if (!input.id) {
    return;
  }

  if (input.data.parentId === input.id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Категория не может быть родителем самой себя.",
    });
  }

  const descendantIds = collectDescendantCategoryIds(allCategories, input.id);
  if (descendantIds.includes(input.data.parentId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Нельзя переместить категорию внутрь её собственной ветки.",
    });
  }
}

async function buildPublicProductSpecs(
  db: ReturnType<typeof getDb>,
  product: Pick<typeof products.$inferSelect, "categoryId" | "specs">
) {
  const rawSpecs =
    product.specs && typeof product.specs === "object" && !Array.isArray(product.specs)
      ? (product.specs as Record<string, unknown>)
      : null;

  if (!rawSpecs) return product.specs;

  const allCategories = await db.select().from(categories);
  const ancestorCategoryIds = collectAncestorCategoryIds(
    allCategories,
    product.categoryId
  );

  if (ancestorCategoryIds.length === 0) return rawSpecs;

  const rules = await db
    .select()
    .from(schema.productSpecRules)
    .where(inArray(schema.productSpecRules.categoryId, ancestorCategoryIds));

  const mergedRules = buildMergedSpecRulesForCategory(
    allCategories,
    rules,
    product.categoryId
  );

  const nextSpecs: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(rawSpecs)) {
    const normalizedValue = String(rawValue ?? "").trim();
    if (!normalizedValue) continue;

    const displayKey = normalizeSpecKeyForDisplay(String(rawKey));
    if (isInternalProductSpecKey(displayKey)) continue;
    const normalizedKey = normalizeSpecToken(displayKey).slice(0, 120);
    const rule = mergedRules.get(normalizedKey);

    if (rule && !rule.isVisible) {
      continue;
    }

    const targetKey = rule?.targetKey || displayKey;
    if (!(targetKey in nextSpecs)) {
      nextSpecs[targetKey] = rawValue;
    }
  }

  return nextSpecs;
}

function buildManufacturerCondition(normalizedName: string) {
  const keys = getManufacturerFilterKeys();
  return sql`EXISTS (
    SELECT 1 FROM ${productSpecValues}
    WHERE ${productSpecValues.productId} = ${products.id}
      AND ${productSpecValues.normalizedKey} IN (${sql.join(keys, sql`, `)})
      AND ${productSpecValues.normalizedValue} = ${normalizedName}
  )`;
}

function isInternalProductSpecKey(key: string) {
  const normalizedDisplayKey = normalizeSpecKeyForDisplay(String(key));
  const normalizedToken = normalizeSpecToken(normalizedDisplayKey);
  return /^kpi(?:\s|$|\d|_)/i.test(normalizedToken);
}

function buildAdminProductWhere(input?: {
  search?: string;
  visibility?: z.infer<typeof adminVisibilityFilterSchema>;
}) {
  const conditions = [];
  const search = input?.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(products.name, pattern),
        like(products.slug, pattern),
        like(products.badge, pattern)
      )
    );
  }

  switch (input?.visibility ?? "all") {
    case "site_active":
      conditions.push(
        and(
          eq(products.isActive, true),
          eq(products.isAutoBlocked, false),
          sql`${products.price} > 0`
        )
      );
      break;
    case "manual_disabled":
      conditions.push(eq(products.isActive, false));
      break;
    case "auto_blocked":
      conditions.push(eq(products.isAutoBlocked, true));
      break;
    case "zero_price":
      conditions.push(sql`${products.price} <= 0`);
      break;
    case "all":
    default:
      break;
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export const productRouter = createRouter({
  search: publicQuery
    .input(
      z.object({
        query: z.string(),
        limit: z.number().optional().default(10),
        specFilters: z.array(specFilterSchema).optional().default([]),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const searchTerm = `%${input.query}%`;
      const searchCondition = or(
        like(products.name, searchTerm),
        like(products.description, searchTerm)
      );
      const specCondition = buildSpecFilterConditions(input.specFilters);
      const rows = await db
        .select(publicProductSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, products.id))
        .where(
          specCondition
            ? sql`${publicProductVisibilityCondition} AND ${searchCondition} AND ${specCondition}`
            : sql`${publicProductVisibilityCondition} AND ${searchCondition}`
        )
        .limit(input.limit);
      return attachVisibleMerchandisingBadges(rows);
    }),
  getAll: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select(publicProductSelectFields)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, products.id))
      .where(publicProductVisibilityCondition)
      .orderBy(desc(products.createdAt));
    return attachVisibleMerchandisingBadges(rows);
  }),

  getHomepageFallbackProducts: publicQuery
    .input(
      z
        .object({
          limit: z.number().min(1).max(20).default(12),
        })
        .optional()
    )
    .query(async ({ input }) =>
      listHomepageFallbackProducts(input?.limit ?? 12)
    ),

  getAdminAll: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Product");
    const db = getDb();
    const rows = await db
      .select(productSelectFields)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, products.id))
      .orderBy(desc(products.createdAt));
      const withBadges = await attachVisibleMerchandisingBadges(rows);
      return withBadges.map(row => ({
        ...row,
        siteStatus: getAdminProductPublicationStatus(row),
      }));
  }),

  getPaginated: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
        visibility: adminVisibilityFilterSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Product");
      const db = getDb();
      const offset = (input.page - 1) * input.limit;
      const whereClause = buildAdminProductWhere(input);

      const totalResult = whereClause
        ? await db
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .where(whereClause)
        : await db.select({ count: sql<number>`count(*)` }).from(products);
      const total = totalResult[0]?.count || 0;

      const items = await db
        .select(productSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, products.id))
        .where(whereClause)
        .orderBy(desc(products.createdAt))
        .limit(input.limit)
        .offset(offset);

      const productIds = items.map(i => i.id);
      type StockRow = {
        productId: number;
        quantity: number;
        storeName: string;
      };
      let stocksData: StockRow[] = [];
      if (productIds.length > 0) {
        stocksData = await db
          .select({
            productId: productStocks.productId,
            quantity: productStocks.quantity,
            storeName: stores.name,
          })
          .from(productStocks)
          .innerJoin(stores, eq(productStocks.storeId, stores.id))
          .where(
            sql`${productStocks.productId} IN (${sql.join(
              productIds.map(productId => sql`${productId}`),
              sql`, `
            )})`
          );
      }

      const visibleBadgeItems = await attachVisibleMerchandisingBadges(items);
      const itemsWithStocks = visibleBadgeItems.map(item => ({
        ...item,
        stocks: stocksData.filter(s => s.productId === item.id),
        siteStatus: getAdminProductPublicationStatus(item),
      }));

      return {
        items: itemsWithStocks,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  getByIds: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).max(20) }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Product");
      if (input.ids.length === 0) return [];
      const db = getDb();
      const rows = await db
        .select(productSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(
          schema.productMerchandising,
          eq(schema.productMerchandising.productId, products.id)
        )
        .where(inArray(products.id, input.ids));
      const withBadges = await attachVisibleMerchandisingBadges(rows);
      const byId = new Map(withBadges.map(row => [row.id, row]));
      return input.ids
        .map(id => byId.get(id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map(row => ({
          ...row,
          siteStatus: getAdminProductPublicationStatus(row),
        }));
    }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select(publicProductSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, products.id))
        .where(and(eq(products.slug, input.slug), publicProductVisibilityCondition))
        .limit(1);
      const [item] = await attachVisibleMerchandisingBadges(result);
      if (!item) return null;
      const publicSpecs = await buildPublicProductSpecs(db, item);
      const variants = await getProductVariants(db, item.id);
      return {
        ...item,
        specs: publicSpecs,
        variants,
      };
    }),

  getCategories: publicQuery
    .input(
      z
        .object({
          includeInactive: z.boolean().optional().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(categories)
        .orderBy(asc(categories.sortOrder));

      if (input?.includeInactive) {
        if (!ctx.ability?.can("read", "Category")) {
          return filterPublicVisibleCategories(rows);
        }
        return rows;
      }

      return filterPublicVisibleCategories(rows);
    }),

  getCatalogCategoryPreviews: publicQuery
    .input(
      z
        .object({
          scopeCategoryId: z.number().int().positive().optional(),
          includeInactive: z.boolean().optional().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
    const db = getDb();
    const allCategoriesRaw = await db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        isActive: categories.isActive,
        imageUrl: categories.imageUrl,
        previewImages: categories.previewImages,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder));
    const canIncludeInactive = input?.includeInactive && ctx.ability?.can("read", "Category");
    const allCategories = canIncludeInactive
      ? allCategoriesRaw
      : filterPublicVisibleCategories(allCategoriesRaw);

    const childrenByParentId = new Map<number | null, number[]>();
    for (const category of allCategories) {
      const key = category.parentId ?? null;
      const bucket = childrenByParentId.get(key) ?? [];
      bucket.push(category.id);
      childrenByParentId.set(key, bucket);
    }

    const scopedCategorySet =
      input?.scopeCategoryId && allCategories.some(category => category.id === input.scopeCategoryId)
        ? (() => {
            const scoped = new Set<number>();
            const stack = [input.scopeCategoryId as number];

            while (stack.length > 0) {
              const currentId = stack.pop()!;
              if (scoped.has(currentId)) continue;
              scoped.add(currentId);
              const children = childrenByParentId.get(currentId) ?? [];
              children.forEach(childId => stack.push(childId));
            }

            return scoped;
          })()
        : null;

    if (input?.scopeCategoryId && !scopedCategorySet) {
      return [];
    }

    const scopedCategoryIds = scopedCategorySet
      ? Array.from(scopedCategorySet)
      : null;
    const previewCondition =
      scopedCategoryIds && scopedCategoryIds.length > 0
        ? and(publicProductVisibilityCondition, inArray(products.categoryId, scopedCategoryIds))
        : publicProductVisibilityCondition;

    const countRows = await db
      .select({
        categoryId: products.categoryId,
        productCount: sql<number>`count(*)`,
      })
      .from(products)
      .where(previewCondition)
      .groupBy(products.categoryId);

    const previewIdRows = await db
      .select({
        categoryId: products.categoryId,
        previewProductId: sql<number>`min(${products.id})`,
      })
      .from(products)
      .where(previewCondition)
      .groupBy(products.categoryId);

    const previewProductIds = previewIdRows
      .map(row => Number(row.previewProductId || 0))
      .filter((value): value is number => value > 0);

    const previewProducts =
      previewProductIds.length > 0
        ? await db
            .select({
              id: products.id,
              categoryId: products.categoryId,
              image: products.image,
              imageVariants: products.imageVariants,
            })
            .from(products)
            .where(inArray(products.id, previewProductIds))
        : [];

    const previewByProductId = new Map(
      previewProducts.map(product => [product.id, product] as const)
    );
    const countByCategoryId = new Map(
      countRows.map(row => [row.categoryId, Number(row.productCount || 0)] as const)
    );
    const previewProductIdByCategoryId = new Map(
      previewIdRows.map(row => [row.categoryId, Number(row.previewProductId || 0)] as const)
    );
    return allCategories
      .filter(category => (scopedCategorySet ? scopedCategorySet.has(category.id) : true))
      .map(category => {
      const excludedImages = new Set(
        normalizeCategoryPreviewImages(
          category.previewImageExclusions,
          CATEGORY_PREVIEW_IMAGE_LIMIT * 4
        )
      );
      const resolvedPreviewImages = resolveCategoryPreviewImages(category.previewImages, category.imageUrl);
      const previewProduct = previewByProductId.get(
        previewProductIdByCategoryId.get(category.id) ?? 0
      );
      const fallbackPreviewImage = (() => {
        const fallbackOriginal = typeof previewProduct?.image === "string" ? previewProduct.image.trim() : "";
        if (!fallbackOriginal || excludedImages.has(fallbackOriginal)) return null;
        const variants = normalizeProductImageVariantSet(
          previewProduct?.imageVariants,
          fallbackOriginal
        );
        const optimized =
          variants.thumb ||
          variants.card ||
          variants.medium ||
          variants.original ||
          fallbackOriginal;
        return excludedImages.has(optimized) ? null : optimized;
      })();

      return {
        categoryId: category.id,
        productCount: countByCategoryId.get(category.id) ?? 0,
        previewImage:
          resolvedPreviewImages[0] ??
          fallbackPreviewImage ??
          null,
        previewImages: resolvedPreviewImages,
        previewImageVariants: previewProduct?.imageVariants ?? null,
        hasChildren: (childrenByParentId.get(category.id)?.length ?? 0) > 0,
      };
      });
    }),

  getCategoryPreviewImageSuggestions: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        excludedImages: z.array(z.string()).max(CATEGORY_PREVIEW_IMAGE_LIMIT * 4).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Category");
      return collectCategoryPreviewImageSuggestions(
        input.categoryId,
        undefined,
        input.excludedImages
      );
    }),

  getByManufacturer: publicQuery
    .input(
      z.object({
        manufacturerSlug: z.string(),
        specFilters: z.array(specFilterSchema).optional().default([]),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const [manufacturer] = await db
        .select()
        .from(manufacturers)
        .where(eq(manufacturers.slug, input.manufacturerSlug))
        .limit(1);

      if (!manufacturer) return [];

      const specCondition = buildSpecFilterConditions(input.specFilters);
      const manufacturerCondition = buildManufacturerCondition(
        manufacturer.normalizedName
      );

      const rows = await db
        .select(publicProductSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, products.id))
        .where(
          specCondition
            ? sql`${publicProductVisibilityCondition} AND ${manufacturerCondition} AND ${specCondition}`
            : sql`${publicProductVisibilityCondition} AND ${manufacturerCondition}`
        );
      return attachVisibleMerchandisingBadges(rows);
    }),

  getByCategory: publicQuery
    .input(
      z
        .object({
          categorySlug: z.string().optional().default("all"),
          specFilters: z.array(specFilterSchema).optional().default([]),
        })
        .optional()
        .default({
          categorySlug: "all",
          specFilters: [],
        })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const categorySlug = input?.categorySlug ?? "all";
      const specFilters = input?.specFilters ?? [];

      if (categorySlug === "all") {
        const visibleCategoryIds = Array.from(
          buildPublicVisibleCategoryIdSet(await db.select().from(categories))
        );
        if (visibleCategoryIds.length === 0) return [];
        const visibleCategoryCondition = inArray(products.categoryId, visibleCategoryIds);
        const specCondition = buildSpecFilterConditions(specFilters);
        const rows = await db
          .select(publicProductSelectFields)
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, products.id))
          .where(
            specCondition
              ? sql`${publicProductVisibilityCondition} AND ${visibleCategoryCondition} AND ${specCondition}`
              : sql`${publicProductVisibilityCondition} AND ${visibleCategoryCondition}`
          );
        return attachVisibleMerchandisingBadges(rows);
      }

      const allCats = filterPublicVisibleCategories(await db.select().from(categories));
      const targetCat = allCats.find(c => c.slug === categorySlug);

      if (!targetCat) return [];

      const targetIds = collectDescendantCategoryIds(allCats, targetCat.id);

      const specCondition = buildSpecFilterConditions(specFilters);
      const categoryCondition = sql`${products.categoryId} IN (${sql.join(
        targetIds.map(categoryId => sql`${categoryId}`),
        sql`, `
      )})`;

      const rows = await db
        .select(publicProductSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, products.id))
        .where(
          specCondition
            ? sql`${categoryCondition} AND ${publicProductVisibilityCondition} AND ${specCondition}`
            : sql`${categoryCondition} AND ${publicProductVisibilityCondition}`
        );
      return attachVisibleMerchandisingBadges(rows);
    }),

  getTopByCategoryStock: publicQuery
    .input(
      z.object({
        categorySlug: z.string(),
        limit: z.number().min(1).max(12).default(3),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      if (!input.categorySlug || input.categorySlug === "all") return [];

      const allCats = await db.select().from(categories);
      const targetCat = allCats.find(c => c.slug === input.categorySlug);
      if (!targetCat) return [];

      const targetIds = collectDescendantCategoryIds(allCats, targetCat.id);
      const rows = await db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          image: products.image,
          price: products.price,
          totalStock: publicAvailableStockQtySql,
        })
        .from(products)
        .where(
          sql`${products.categoryId} IN (${sql.join(targetIds, sql`, `)}) AND ${publicProductVisibilityCondition}`
        )
        .orderBy(
          desc(publicAvailableStockQtySql),
          desc(sql<boolean>`${publicAvailableStockQtySql} > 0`),
          asc(products.name)
        )
        .limit(input.limit);

      return rows.filter(item => Number(item.totalStock || 0) > 0);
    }),

  getSpecFilters: publicQuery
    .input(z.object({ categorySlug: z.string().default("all") }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const categorySlug = input?.categorySlug ?? "all";
      let categoryIds: number[] | null = null;
      let rootCategoryId: number | null = null;
      let allCats: Array<typeof categories.$inferSelect> = [];

      if (categorySlug !== "all") {
        allCats = await db.select().from(categories);
        const targetCat = allCats.find(c => c.slug === categorySlug);
        if (!targetCat) return [];
        rootCategoryId = targetCat.id;
        categoryIds = collectDescendantCategoryIds(allCats, targetCat.id);
      }

      const rows = await db
        .select({
          key: productSpecValues.specKey,
          normalizedKey: productSpecValues.normalizedKey,
          value: productSpecValues.specValue,
          normalizedValue: productSpecValues.normalizedValue,
          count: sql<number>`count(distinct ${productSpecValues.productId})`,
        })
        .from(productSpecValues)
        .innerJoin(products, eq(productSpecValues.productId, products.id))
        .where(
          categoryIds
            ? sql`${productSpecValues.categoryId} IN (${sql.join(categoryIds, sql`, `)}) AND ${publicProductVisibilityCondition}`
            : publicProductVisibilityCondition
        )
        .groupBy(
          productSpecValues.specKey,
          productSpecValues.normalizedKey,
          productSpecValues.specValue,
          productSpecValues.normalizedValue
        )
        .orderBy(productSpecValues.specKey, productSpecValues.specValue);

      const rules =
        rootCategoryId === null
          ? []
          : await db
              .select()
              .from(schema.productSpecRules)
              .where(
                inArray(
                  schema.productSpecRules.categoryId,
                  collectAncestorCategoryIds(allCats, rootCategoryId)
                )
              );
      const rulesByKey =
        rootCategoryId === null
          ? new Map<string, (typeof rules)[number]>()
          : buildMergedSpecRulesForCategory(allCats, rules, rootCategoryId);

      const filters = new Map<string, {
        key: string;
        normalizedKey: string;
        values: { value: string; normalizedValue: string; count: number }[];
      }>();

      for (const row of rows) {
        const rule = rulesByKey.get(row.normalizedKey);
        if (isInternalProductSpecKey(rule?.targetKey ?? row.key)) continue;
        if (rule && (!rule.isVisible || !rule.isFilterable)) continue;

        const filterKey = rule?.targetNormalizedKey ?? row.normalizedKey;
        const filterLabel = rule?.targetKey ?? row.key;
        const current = filters.get(filterKey) ?? {
          key: filterLabel,
          normalizedKey: filterKey,
          values: [],
        };
        current.values.push({
          value: row.value,
          normalizedValue: row.normalizedValue,
          count: Number(row.count),
        });
        filters.set(filterKey, current);
      }

      return Array.from(filters.values()).map(filter => ({
        ...filter,
        values: filter.values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      }));
    }),

  getManufacturerSpecFilters: publicQuery
    .input(z.object({ manufacturerSlug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const allCats = await db.select().from(categories);
      const [manufacturer] = await db
        .select()
        .from(manufacturers)
        .where(eq(manufacturers.slug, input.manufacturerSlug))
        .limit(1);

      if (!manufacturer) return [];

      const matchingProducts = await db
        .select({ id: products.id, categoryId: products.categoryId })
        .from(products)
        .where(
          sql`${publicProductVisibilityCondition} AND ${buildManufacturerCondition(manufacturer.normalizedName)}`
        );

      if (matchingProducts.length === 0) return [];

      const productIds = matchingProducts.map(product => product.id);
      const productCategoryIds = Array.from(
        new Set(matchingProducts.map(product => product.categoryId))
      );
      const ruleCategoryIds = Array.from(
        new Set(
          productCategoryIds.flatMap(categoryId =>
            collectAncestorCategoryIds(allCats, categoryId)
          )
        )
      );
      const rules =
        ruleCategoryIds.length > 0
          ? await db
              .select()
              .from(schema.productSpecRules)
              .where(inArray(schema.productSpecRules.categoryId, ruleCategoryIds))
          : [];
      const rulesByCategoryId = new Map<number, Map<string, (typeof rules)[number]>>();
      for (const categoryId of productCategoryIds) {
        rulesByCategoryId.set(
          categoryId,
          buildMergedSpecRulesForCategory(allCats, rules, categoryId)
        );
      }

      const rows = await db
        .select({
          categoryId: productSpecValues.categoryId,
          key: productSpecValues.specKey,
          normalizedKey: productSpecValues.normalizedKey,
          value: productSpecValues.specValue,
          normalizedValue: productSpecValues.normalizedValue,
          count: sql<number>`count(distinct ${productSpecValues.productId})`,
        })
        .from(productSpecValues)
        .where(
          sql`${productSpecValues.productId} IN (${sql.join(productIds, sql`, `)})`
        )
        .groupBy(
          productSpecValues.categoryId,
          productSpecValues.specKey,
          productSpecValues.normalizedKey,
          productSpecValues.specValue,
          productSpecValues.normalizedValue
        )
        .orderBy(productSpecValues.specKey, productSpecValues.specValue);

      const filters = new Map<
        string,
        {
          key: string;
          normalizedKey: string;
          values: { value: string; normalizedValue: string; count: number }[];
        }
      >();

      for (const row of rows) {
        const rule = rulesByCategoryId.get(row.categoryId)?.get(row.normalizedKey);
        if (isInternalProductSpecKey(rule?.targetKey ?? row.key)) continue;
        if (rule && (!rule.isVisible || !rule.isFilterable)) continue;

        const filterKey = rule?.targetNormalizedKey ?? row.normalizedKey;
        if (getManufacturerFilterKeys().includes(filterKey)) continue;

        const current = filters.get(filterKey) ?? {
          key: rule?.targetKey ?? row.key,
          normalizedKey: filterKey,
          values: [],
        };
        current.values.push({
          value: row.value,
          normalizedValue: row.normalizedValue,
          count: Number(row.count),
        });
        filters.set(filterKey, current);
      }

      return Array.from(filters.values())
        .map(filter => ({
          ...filter,
          values: filter.values.sort(
            (a, b) => b.count - a.count || a.value.localeCompare(b.value)
          ),
        }));
    }),

  getSpecStandardization: publicQuery
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ input }) => {
      return getCategorySpecStandardization(input.categoryId);
    }),

  getSpecStandardizationOverview: protectedProcedure
    .query(async ({ ctx }) => {
      requireAbility(ctx, "read", "Product");
      const db = getDb();
      const [allCategories, rows, rules] = await Promise.all([
        db.select().from(categories),
        getSpecStandardizationOverviewRows(),
        db.select().from(schema.productSpecRules),
      ]);

      const categoriesById = new Map(allCategories.map(category => [category.id, category]));
      const mergedRulesByCategoryId = new Map<
        number,
        Map<string, (typeof rules)[number]>
      >();

      for (const row of rows) {
        if (!mergedRulesByCategoryId.has(row.categoryId)) {
          mergedRulesByCategoryId.set(
            row.categoryId,
            buildMergedSpecRulesForCategory(allCategories, rules, row.categoryId)
          );
        }
      }

      return rows.map(row => {
        const rule = mergedRulesByCategoryId
          .get(row.categoryId)
          ?.get(row.sourceNormalizedKey);
        const category = categoriesById.get(row.categoryId);

        return {
          categoryId: row.categoryId,
          categoryName: category?.name ?? `Категория #${row.categoryId}`,
          categorySlug: category?.slug ?? "",
          sourceKey: row.sourceKey,
          sourceNormalizedKey: row.sourceNormalizedKey,
          targetKey: rule?.targetKey ?? row.sourceKey,
          targetNormalizedKey:
            rule?.targetNormalizedKey ??
            normalizeSpecToken(row.sourceKey).slice(0, 120),
          isVisible: rule?.isVisible ?? true,
          isFilterable: rule?.isFilterable ?? true,
          productCount: Number(row.productCount ?? 0),
          valueCount: Number(row.valueCount ?? 0),
        };
      });
    }),

  bulkManageSpecOverview: protectedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              categoryId: z.number().int().positive(),
              sourceKey: z.string().min(1),
              sourceNormalizedKey: z.string().min(1),
            })
          )
          .min(1),
        action: z.enum(["hide", "exclude_from_filters", "delete"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      const result = await bulkManageSpecOverview(input);
      await writeAdminAuditLog({
        ctx,
        action: `product_specs.${input.action}`,
        entityType: "product_specs",
        entityLabel: "Массовое управление свойствами товаров",
        meta: {
          action: input.action,
          selectedCount: input.items.length,
          affectedProducts: result.affectedProducts,
          affectedValues: result.affectedValues,
          affectedRules: result.affectedRules,
          sample: input.items.slice(0, 20),
        },
      });
      return result;
    }),

  getSpecValueStandardization: publicQuery
    .input(
      z.object({
        categoryId: z.number(),
        sourceNormalizedKey: z.string(),
      })
    )
    .query(async ({ input }) => {
      return getCategorySpecValueStandardization(input);
    }),

  upsertSpecRule: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        sourceKey: z.string(),
        sourceNormalizedKey: z.string(),
        targetKey: z.string(),
        isVisible: z.boolean().default(true),
        isFilterable: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return upsertCategorySpecRule(input);
    }),

  upsertSpecRulesBulk: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        rules: z.array(
          z.object({
            sourceKey: z.string(),
            sourceNormalizedKey: z.string(),
            targetKey: z.string(),
            isVisible: z.boolean().default(true),
            isFilterable: z.boolean().default(true),
            sortOrder: z.number().default(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return upsertCategorySpecRulesBulk(input);
    }),

  upsertSpecValueRule: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        specNormalizedKey: z.string(),
        sourceValue: z.string(),
        sourceNormalizedValue: z.string(),
        targetValue: z.string(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return upsertCategorySpecValueRule(input);
    }),

  upsertSpecValueRulesBulk: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        specNormalizedKey: z.string(),
        rules: z.array(
          z.object({
            sourceValue: z.string(),
            sourceNormalizedValue: z.string(),
            targetValue: z.string(),
            sortOrder: z.number().default(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return upsertCategorySpecValueRulesBulk(input);
    }),

  suggestSpecRulesWithAi: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        limit: z.number().min(1).max(200).default(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return suggestCategorySpecRulesWithGemini(input);
    }),

  applySpecStandardization: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        limit: z.number().min(1).max(20000).default(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return applyCategorySpecStandardization(input);
    }),

  applySpecValueStandardization: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        sourceNormalizedKey: z.string(),
        limit: z.number().min(1).max(20000).default(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return applyCategorySpecValueStandardization(input);
    }),

  getStockBySlug: publicQuery
    .input(
      z.object({
        slug: z.string(),
        variantId: z.number().optional().nullable(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const product = await db
        .select()
        .from(products)
        .where(and(eq(products.slug, input.slug), publicProductVisibilityCondition))
        .limit(1);

      if (!product[0]) return [];

      return await getProductStoreAvailability(
        db,
        product[0].id,
        input.variantId ?? null
      );
    }),

  getAdminVariants: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Product");
      const db = getDb();
      return getProductVariants(db, input.productId);
    }),

  getReservationSummary: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Product");
      const db = getDb();
      return getProductReservationSummary(db, input.productId);
    }),

  getReviews: publicQuery
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return await db
        .select()
        .from(reviews)
        .where(eq(reviews.productId, input.productId))
        .orderBy(desc(reviews.createdAt));
    }),

  // Admin mutations
  upsertProduct: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        data: productSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      const db = getDb();
      const payload = applyProductAutoBlockState(input.data);
      let productId = input.id ?? 0;
      if (input.id) {
        await db
          .update(products)
          .set(payload)
          .where(eq(products.id, input.id));
      } else {
        const result = await db.insert(products).values(payload);
        productId = result[0].insertId;
      }
      await enqueueSearchReindexJob({
        entityType: "product",
        entityId: productId,
        reason: input.id ? "product_updated" : "product_created",
      });
      await rebuildSearchDocumentsForProducts([productId]);
      return { success: true, id: productId };
    }),

  updateProductActivity: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      const db = getDb();
      await db
        .update(products)
        .set({ isActive: input.isActive })
        .where(eq(products.id, input.id));
      await enqueueSearchReindexJob({
        entityType: "product",
        entityId: input.id,
        reason: "product_activity_changed",
      });
      await rebuildSearchDocumentsForProducts([input.id]);
      return { success: true };
    }),

  deleteProduct: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "delete", "Product");
      const db = getDb();
      await db.delete(products).where(eq(products.id, input.id));
      await enqueueSearchReindexJob({
        entityType: "product",
        entityId: input.id,
        reason: "product_deleted",
      });
      await processSearchReindexJobs(10);
      return { success: true };
    }),

  getManufacturersFromProducts: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: products.id,
        specs: products.specs,
      })
      .from(products)
      .where(publicProductVisibilityCondition);

    const counts = new Map<string, number>();
    for (const row of rows) {
      const name = getManufacturerNameFromProductSpecs(row.specs);
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, productCount]) => ({ name, productCount }))
      .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, "ru"));
  }),

  upsertCategory: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        data: z.object({
          parentId: z.number().nullable().optional(),
          slug: z.string(),
          name: z.string(),
          isActive: z.boolean().optional().default(true),
          description: z.string().nullable(),
          metaTitle: z.string().nullable().optional(),
          metaDescription: z.string().nullable().optional(),
          imageUrl: z.string().nullable().optional(),
          previewImages: z.array(z.string()).max(CATEGORY_PREVIEW_IMAGE_LIMIT).optional().default([]),
          previewImageExclusions: z
            .array(z.string())
            .max(CATEGORY_PREVIEW_IMAGE_LIMIT * 4)
            .optional()
            .default([]),
          icon: z.string().nullable(),
          sortOrder: z.number(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Category");
      const db = getDb();
      const payload = normalizeCategoryPayload(input.data);
      await validateCategoryMutationInput({
        id: input.id,
        data: payload,
      });
      const [previousCategory] = input.id
        ? await db
            .select()
            .from(categories)
            .where(eq(categories.id, input.id))
            .limit(1)
        : [null];
      let categoryId = input.id ?? 0;
      if (input.id) {
        await db
          .update(categories)
          .set(payload)
          .where(eq(categories.id, input.id));
      } else {
        const result = await db.insert(categories).values(payload);
        categoryId = result[0].insertId;
      }
      await enqueueSearchReindexJob({
        entityType: "category",
        entityId: categoryId,
        reason: input.id ? "category_updated" : "category_created",
      });
      await rebuildSearchDocumentsForCategories([categoryId]);
      await writeAdminAuditLog({
        ctx,
        action: input.id ? "category.update" : "category.create",
        entityType: "category",
        entityId: categoryId,
        entityLabel: payload.name,
        before: previousCategory,
        after: {
          id: categoryId,
          ...payload,
        },
      });
      return { success: true, id: categoryId };
    }),

  updateCategoryActivity: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Category");
      const db = getDb();
      const allCategories = await db.select().from(categories);
      const reindexIds = [
        input.id,
        ...collectDescendantCategoryIds(allCategories, input.id),
      ];
      const [previousCategory] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, input.id))
        .limit(1);

      if (!previousCategory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Категория не найдена.",
        });
      }

      await db
        .update(categories)
        .set({ isActive: input.isActive })
        .where(eq(categories.id, input.id));
      await enqueueSearchReindexJob({
        entityType: "category",
        entityId: input.id,
        reason: "category_activity_changed",
      });
      await rebuildSearchDocumentsForCategories(reindexIds);
      await writeAdminAuditLog({
        ctx,
        action: "category.activity",
        entityType: "category",
        entityId: previousCategory.id,
        entityLabel: previousCategory.name,
        before: previousCategory,
        after: {
          ...previousCategory,
          isActive: input.isActive,
        },
      });
      return { success: true };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "delete", "Category");
      const db = getDb();

      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, input.id))
        .limit(1);

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Категория не найдена.",
        });
      }

      const [childRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(categories)
        .where(eq(categories.parentId, input.id));

      if (Number(childRow?.count ?? 0) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Нельзя удалить категорию, пока в ней есть подкатегории. Сначала перенесите или удалите дочерние разделы.",
        });
      }

      const [productRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(eq(products.categoryId, input.id));

      if (Number(productRow?.count ?? 0) > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Нельзя удалить категорию, к которой привязаны товары. Сначала перенесите товары в другой раздел.",
        });
      }

      await db.delete(categories).where(eq(categories.id, input.id));
      await enqueueSearchReindexJob({
        entityType: "category",
        entityId: input.id,
        reason: "category_deleted",
      });
      await processSearchReindexJobs(10);
      await writeAdminAuditLog({
        ctx,
        action: "category.delete",
        entityType: "category",
        entityId: category.id,
        entityLabel: category.name,
        before: category,
      });

      return { success: true };
    }),

  refreshAllCategoryPreviewImages: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireAbility(ctx, "manage", "Category");
      const db = getDb();
      const allCategories = await db.select().from(categories);
      let updated = 0;

      for (const category of allCategories) {
        const nextPreviewImages = await collectCategoryPreviewImageSuggestions(
          category.id,
          allCategories
        );

        const normalizedCurrent = normalizeCategoryPreviewImages(category.previewImages);
        const changed =
          normalizedCurrent.length !== nextPreviewImages.length ||
          normalizedCurrent.some((item, index) => item !== nextPreviewImages[index]);

        if (!changed) continue;

        await db
          .update(categories)
          .set({ previewImages: nextPreviewImages })
          .where(eq(categories.id, category.id));
        updated += 1;
      }

      await writeAdminAuditLog({
        ctx,
        action: "category.preview_images.refresh_all",
        entityType: "category",
        entityId: null,
        entityLabel: "all",
        after: { updated },
      });

      return { success: true, updated };
    }),

  updateCategoryPreviewImages: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        previewImages: z.array(z.string()).max(CATEGORY_PREVIEW_IMAGE_LIMIT),
        previewImageExclusions: z
          .array(z.string())
          .max(CATEGORY_PREVIEW_IMAGE_LIMIT * 4)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Category");
      const db = getDb();
      const [previousCategory] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, input.id))
        .limit(1);

      if (!previousCategory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Категория не найдена.",
        });
      }

      const previewImages = normalizeCategoryPreviewImages(
        input.previewImages,
        CATEGORY_PREVIEW_IMAGE_LIMIT
      );
      const previewImageExclusions = normalizeCategoryPreviewImages(
        input.previewImageExclusions,
        CATEGORY_PREVIEW_IMAGE_LIMIT * 4
      );

      await db
        .update(categories)
        .set({
          previewImages,
          previewImageExclusions,
        })
        .where(eq(categories.id, input.id));

      await writeAdminAuditLog({
        ctx,
        action: "category.preview_images.update",
        entityType: "category",
        entityId: previousCategory.id,
        entityLabel: previousCategory.name,
        before: {
          previewImages: previousCategory.previewImages,
          previewImageExclusions: previousCategory.previewImageExclusions,
        },
        after: {
          previewImages,
          previewImageExclusions,
        },
      });

      return { success: true };
    }),

  refreshCategoryPreviewImages: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        excludedImages: z
          .array(z.string())
          .max(CATEGORY_PREVIEW_IMAGE_LIMIT * 4)
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Category");
      const db = getDb();
      const [previousCategory] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, input.id))
        .limit(1);

      if (!previousCategory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Категория не найдена.",
        });
      }

      const previewImageExclusions = normalizeCategoryPreviewImages(
        input.excludedImages,
        CATEGORY_PREVIEW_IMAGE_LIMIT * 4
      );
      const previewImages = await collectCategoryPreviewImageSuggestions(
        input.id,
        undefined,
        previewImageExclusions
      );

      await db
        .update(categories)
        .set({
          previewImages,
          previewImageExclusions,
        })
        .where(eq(categories.id, input.id));

      await writeAdminAuditLog({
        ctx,
        action: "category.preview_images.refresh",
        entityType: "category",
        entityId: previousCategory.id,
        entityLabel: previousCategory.name,
        before: {
          previewImages: previousCategory.previewImages,
          previewImageExclusions: previousCategory.previewImageExclusions,
        },
        after: {
          previewImages,
          previewImageExclusions,
        },
      });

      return { success: true, previewImages, previewImageExclusions };
    }),

  reorderCategory: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        direction: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Category");
      const db = getDb();

      const allCategories = await db
        .select()
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.id));

      const current = allCategories.find(category => category.id === input.id);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Категория не найдена.",
        });
      }

      const siblings = allCategories
        .filter(category => (category.parentId ?? null) === (current.parentId ?? null))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"));

      const currentIndex = siblings.findIndex(category => category.id === current.id);
      if (currentIndex < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Не удалось определить позицию категории среди соседних разделов.",
        });
      }

      const targetIndex =
        input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= siblings.length) {
        return { success: true, changed: false };
      }

      const target = siblings[targetIndex];
      if (!target) {
        return { success: true, changed: false };
      }

      const beforeState = {
        current: {
          id: current.id,
          name: current.name,
          parentId: current.parentId,
          sortOrder: current.sortOrder,
        },
        target: {
          id: target.id,
          name: target.name,
          parentId: target.parentId,
          sortOrder: target.sortOrder,
        },
      };

      await db.transaction(async tx => {
        await tx
          .update(categories)
          .set({ sortOrder: target.sortOrder })
          .where(eq(categories.id, current.id));

        await tx
          .update(categories)
          .set({ sortOrder: current.sortOrder })
          .where(eq(categories.id, target.id));
      });

      const reindexIds = [current.id, target.id];
      for (const categoryId of reindexIds) {
        await enqueueSearchReindexJob({
          entityType: "category",
          entityId: categoryId,
          reason: "category_reordered",
        });
      }
      await rebuildSearchDocumentsForCategories(reindexIds);
      await writeAdminAuditLog({
        ctx,
        action: "category.reorder",
        entityType: "category",
        entityId: current.id,
        entityLabel: current.name,
        before: beforeState,
        after: {
          current: {
            ...beforeState.current,
            sortOrder: target.sortOrder,
          },
          target: {
            ...beforeState.target,
            sortOrder: current.sortOrder,
          },
        },
        meta: {
          direction: input.direction,
          siblingCategoryId: target.id,
          siblingCategoryName: target.name,
        },
      });

      return { success: true, changed: true };
    }),
});
