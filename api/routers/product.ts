import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  products,
  categories,
  reviews,
  productStocks,
  productSpecValues,
  stores,
} from "@db/schema";
import * as schema from "@db/schema";
import { eq, asc, desc, like, or, sql } from "drizzle-orm";
import {
  applyCategorySpecStandardization,
  getCategorySpecStandardization,
  upsertCategorySpecRule,
} from "../lib/product-spec-standardization";

const productSchema = z.object({
  slug: z.string(),
  name: z.string(),
  categoryId: z.number(),
  price: z.number(),
  oldPrice: z.number().nullable(),
  badge: z.string().nullable(),
  image: z.string(),
  description: z.string(),
  specs: z.any(),
  inStock: z.boolean(),
  rating: z.string(),
  reviewCount: z.number(),
});

const specFilterSchema = z.object({
  normalizedKey: z.string(),
  normalizedValue: z.string(),
});

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
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          categoryId: products.categoryId,
          price: products.price,
          oldPrice: products.oldPrice,
          badge: products.badge,
          image: products.image,
          description: products.description,
          specs: products.specs as any,
          inStock: products.inStock,
          rating: products.rating,
          reviewCount: products.reviewCount,
          createdAt: products.createdAt,
          categoryName: categories.name,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(specCondition ? sql`${searchCondition} AND ${specCondition}` : searchCondition)
        .limit(input.limit);
    }),
  getAll: publicQuery.query(async () => {
    const db = getDb();
    return await db
      .select({
        id: products.id,
        msId: products.msId,
        slug: products.slug,
        name: products.name,
        categoryId: products.categoryId,
        price: products.price,
        oldPrice: products.oldPrice,
        badge: products.badge,
        image: products.image,
        description: products.description,
        specs: products.specs as any,
        inStock: products.inStock,
        rating: products.rating,
        reviewCount: products.reviewCount,
        createdAt: products.createdAt,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.createdAt));
  }),

  getPaginated: publicQuery
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;

      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(products);

      if (input.search && input.search.trim() !== "") {
        const term = `%${input.search}%`;
        countQuery = db
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .where(like(products.name, term)) as any;
      }

      const totalResult = await countQuery;
      const total = totalResult[0]?.count || 0;

      const items = await db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          categoryId: products.categoryId,
          price: products.price,
          oldPrice: products.oldPrice,
          badge: products.badge,
          image: products.image,
          description: products.description,
          specs: products.specs as any,
          inStock: products.inStock,
          rating: products.rating,
          reviewCount: products.reviewCount,
          createdAt: products.createdAt,
          categoryName: categories.name,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          input.search && input.search.trim() !== ""
            ? like(products.name, `%${input.search}%`)
            : undefined
        )
        .orderBy(desc(products.createdAt))
        .limit(input.limit)
        .offset(offset);

      const productIds = items.map(i => i.id);
      let stocksData: any[] = [];
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
            sql`${productStocks.productId} IN (${sql.join(productIds, sql`, `)})`
          );
      }

      const itemsWithStocks = items.map(item => ({
        ...item,
        stocks: stocksData.filter(s => s.productId === item.id),
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
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          categoryId: products.categoryId,
          price: products.price,
          oldPrice: products.oldPrice,
          badge: products.badge,
          image: products.image,
          description: products.description,
          specs: products.specs as any,
          inStock: products.inStock,
          rating: products.rating,
          reviewCount: products.reviewCount,
          createdAt: products.createdAt,
          categoryName: categories.name,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(eq(products.slug, input.slug))
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

  getByCategory: publicQuery
    .input(
      z.object({
        categorySlug: z.string(),
        specFilters: z.array(specFilterSchema).optional().default([]),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const selectFields = {
        id: products.id,
        msId: products.msId,
        slug: products.slug,
        name: products.name,
        categoryId: products.categoryId,
        price: products.price,
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

      if (input.categorySlug === "all") {
        const specCondition = buildSpecFilterConditions(input.specFilters);
        return await db
          .select(selectFields)
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(specCondition);
      }

      const allCats = await db.select().from(categories);
      const targetCat = allCats.find((c: any) => c.slug === input.categorySlug);

      if (!targetCat) return [];

      const getDescendants = (parentId: number): number[] => {
        const children = allCats.filter((c: any) => c.parentId === parentId).map((c: any) => c.id);
        let descendants = [...children];
        for (const childId of children) {
          descendants = [...descendants, ...getDescendants(childId)];
        }
        return descendants;
      };

      const targetIds = [targetCat.id, ...getDescendants(targetCat.id)];

      const specCondition = buildSpecFilterConditions(input.specFilters);
      const categoryCondition = sql`${products.categoryId} IN (${sql.join(targetIds, sql`, `)})`;

      return await db
        .select(selectFields)
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(specCondition ? sql`${categoryCondition} AND ${specCondition}` : categoryCondition);
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
        const targetCat = allCats.find((c: any) => c.slug === categorySlug);
        if (!targetCat) return [];
        rootCategoryId = targetCat.id;

        const getDescendants = (parentId: number): number[] => {
          const children = allCats.filter((c: any) => c.parentId === parentId).map((c: any) => c.id);
          let descendants = [...children];
          for (const childId of children) {
            descendants = [...descendants, ...getDescendants(childId)];
          }
          return descendants;
        };

        categoryIds = [targetCat.id, ...getDescendants(targetCat.id)];
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
        .where(
          categoryIds
            ? sql`${productSpecValues.categoryId} IN (${sql.join(categoryIds, sql`, `)})`
            : undefined
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

  getSpecStandardization: publicQuery
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ input }) => {
      return getCategorySpecStandardization(input.categoryId);
    }),

  upsertSpecRule: publicQuery
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
    .mutation(async ({ input }) => {
      return upsertCategorySpecRule(input);
    }),

  applySpecStandardization: publicQuery
    .input(
      z.object({
        categoryId: z.number(),
        limit: z.number().min(1).max(20000).default(10000),
      })
    )
    .mutation(async ({ input }) => {
      return applyCategorySpecStandardization(input);
    }),

  getStockBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const product = await db
        .select()
        .from(products)
        .where(eq(products.slug, input.slug))
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
  upsertProduct: publicQuery
    .input(
      z.object({
        id: z.number().optional(),
        data: productSchema,
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.id) {
        await db
          .update(products)
          .set(input.data)
          .where(eq(products.id, input.id));
        return { success: true, id: input.id };
      } else {
        const result = await db.insert(products).values(input.data);
        return { success: true, id: result[0].insertId };
      }
    }),

  deleteProduct: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(products).where(eq(products.id, input.id));
      return { success: true };
    }),

  upsertCategory: publicQuery
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
    .mutation(async ({ input }) => {
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
