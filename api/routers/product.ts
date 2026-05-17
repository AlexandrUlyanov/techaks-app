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
import { and, eq, asc, desc, like, or, sql } from "drizzle-orm";
import {
  applyCategorySpecStandardization,
  applyCategorySpecValueStandardization,
  getCategorySpecStandardization,
  getCategorySpecValueStandardization,
  upsertCategorySpecRule,
  upsertCategorySpecRulesBulk,
  upsertCategorySpecValueRule,
  upsertCategorySpecValueRulesBulk,
} from "../lib/product-spec-standardization";
import { suggestCategorySpecRulesWithGemini } from "../lib/gemini-spec-standardization";
import {
  getManufacturerFilterKeys,
  getManufacturerNameFromProductSpecs,
} from "../lib/manufacturers";
import {
  applyProductAutoBlockState,
  buildPublicProductVisibilityCondition,
  getAdminProductPublicationStatus,
} from "../lib/product-visibility";

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

function buildManufacturerCondition(normalizedName: string) {
  const keys = getManufacturerFilterKeys();
  return sql`EXISTS (
    SELECT 1 FROM ${productSpecValues}
    WHERE ${productSpecValues.productId} = ${products.id}
      AND ${productSpecValues.normalizedKey} IN (${sql.join(keys, sql`, `)})
      AND ${productSpecValues.normalizedValue} = ${normalizedName}
  )`;
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

const publicProductVisibilityCondition = buildPublicProductVisibilityCondition();

const productSelectFields = {
  id: products.id,
  msId: products.msId,
  slug: products.slug,
  name: products.name,
  categoryId: products.categoryId,
  price: products.price,
  isActive: products.isActive,
  isAutoBlocked: products.isAutoBlocked,
  autoBlockReason: products.autoBlockReason,
  oldPrice: products.oldPrice,
  badge: products.badge,
  image: products.image,
  description: products.description,
  specs: products.specs,
  inStock: products.inStock,
  rating: products.rating,
  reviewCount: products.reviewCount,
  createdAt: products.createdAt,
  categoryName: categories.name,
};

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
      return await db
        .select(productSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          specCondition
            ? sql`${publicProductVisibilityCondition} AND ${searchCondition} AND ${specCondition}`
            : sql`${publicProductVisibilityCondition} AND ${searchCondition}`
        )
        .limit(input.limit);
    }),
  getAll: publicQuery.query(async () => {
    const db = getDb();
    return await db
      .select(productSelectFields)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(publicProductVisibilityCondition)
      .orderBy(desc(products.createdAt));
  }),

  getAdminAll: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Product");
    const db = getDb();
    const rows = await db
      .select(productSelectFields)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.createdAt));
    return rows.map(row => ({
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

      const itemsWithStocks = items.map(item => ({
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

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select(productSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(eq(products.slug, input.slug), publicProductVisibilityCondition))
        .limit(1);
      return result[0] || null;
    }),

  getCategories: publicQuery.query(async () => {
    const db = getDb();
    return await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder));
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

      return await db
        .select(productSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          specCondition
            ? sql`${publicProductVisibilityCondition} AND ${manufacturerCondition} AND ${specCondition}`
            : sql`${publicProductVisibilityCondition} AND ${manufacturerCondition}`
        );
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
        const specCondition = buildSpecFilterConditions(specFilters);
        return await db
          .select(productSelectFields)
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(
            specCondition
              ? sql`${publicProductVisibilityCondition} AND ${specCondition}`
              : publicProductVisibilityCondition
          );
      }

      const allCats = await db.select().from(categories);
      const targetCat = allCats.find(c => c.slug === categorySlug);

      if (!targetCat) return [];

      const targetIds = collectDescendantCategoryIds(allCats, targetCat.id);

      const specCondition = buildSpecFilterConditions(specFilters);
      const categoryCondition = sql`${products.categoryId} IN (${sql.join(
        targetIds.map(categoryId => sql`${categoryId}`),
        sql`, `
      )})`;

      return await db
        .select(productSelectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          specCondition
            ? sql`${categoryCondition} AND ${publicProductVisibilityCondition} AND ${specCondition}`
            : sql`${categoryCondition} AND ${publicProductVisibilityCondition}`
        );
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
          totalStock: sql<number>`coalesce(sum(${productStocks.quantity}), 0)`,
        })
        .from(products)
        .leftJoin(productStocks, eq(productStocks.productId, products.id))
        .where(
          sql`${products.categoryId} IN (${sql.join(targetIds, sql`, `)}) AND ${publicProductVisibilityCondition}`
        )
        .groupBy(
          products.id,
          products.slug,
          products.name,
          products.image,
          products.price
        )
        .orderBy(
          desc(sql`coalesce(sum(${productStocks.quantity}), 0)`),
          desc(products.inStock),
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

      if (categorySlug !== "all") {
        const allCats = await db.select().from(categories);
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
              .where(eq(schema.productSpecRules.categoryId, rootCategoryId));
      const rulesByKey = new Map(
        rules.map(rule => [rule.sourceNormalizedKey, rule])
      );

      const filters = new Map<string, {
        key: string;
        normalizedKey: string;
        values: { value: string; normalizedValue: string; count: number }[];
      }>();

      for (const row of rows) {
        const rule = rulesByKey.get(row.normalizedKey);
        if (rule && !rule.isFilterable) continue;

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
      const [manufacturer] = await db
        .select()
        .from(manufacturers)
        .where(eq(manufacturers.slug, input.manufacturerSlug))
        .limit(1);

      if (!manufacturer) return [];

      const matchingProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(
          sql`${publicProductVisibilityCondition} AND ${buildManufacturerCondition(manufacturer.normalizedName)}`
        );

      if (matchingProducts.length === 0) return [];

      const productIds = matchingProducts.map(product => product.id);
      const rows = await db
        .select({
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
        const current = filters.get(row.normalizedKey) ?? {
          key: row.key,
          normalizedKey: row.normalizedKey,
          values: [],
        };
        current.values.push({
          value: row.value,
          normalizedValue: row.normalizedValue,
          count: Number(row.count),
        });
        filters.set(row.normalizedKey, current);
      }

      return Array.from(filters.values())
        .filter(filter => !getManufacturerFilterKeys().includes(filter.normalizedKey))
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
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const product = await db
        .select()
        .from(products)
        .where(and(eq(products.slug, input.slug), publicProductVisibilityCondition))
        .limit(1);

      if (!product[0]) return [];

      return await db
        .select({
          storeName: stores.name,
          storeAddress: stores.address,
          quantity: productStocks.quantity,
        })
        .from(productStocks)
        .innerJoin(stores, eq(productStocks.storeId, stores.id))
        .where(eq(productStocks.productId, product[0].id));
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
      if (input.id) {
        await db
          .update(products)
          .set(payload)
          .where(eq(products.id, input.id));
        return { success: true, id: input.id };
      } else {
        const result = await db.insert(products).values(payload);
        return { success: true, id: result[0].insertId };
      }
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
      return { success: true };
    }),

  deleteProduct: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "delete", "Product");
      const db = getDb();
      await db.delete(products).where(eq(products.id, input.id));
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
          description: z.string().nullable(),
          icon: z.string().nullable(),
          sortOrder: z.number(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Category");
      const db = getDb();
      if (input.id) {
        await db
          .update(categories)
          .set(input.data)
          .where(eq(categories.id, input.id));
        return { success: true, id: input.id };
      } else {
        const result = await db.insert(categories).values(input.data);
        return { success: true, id: result[0].insertId };
      }
    }),
});
