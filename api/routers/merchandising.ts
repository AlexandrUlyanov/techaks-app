import { z } from "zod";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { categories, products, productStocks } from "@db/schema";

const productFields = {
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
  totalStock: sql<number>`coalesce(sum(${productStocks.quantity}), 0)`,
  storeCount: sql<number>`count(distinct ${productStocks.storeId})`,
};

type RecommendationInput = {
  limit: number;
  categoryId?: number;
  excludeProductId?: number;
};

async function getStockBasedRecommendations(input: RecommendationInput) {
  const db = getDb();
  const conditions = [eq(products.inStock, true)];
  if (input.categoryId) conditions.push(eq(products.categoryId, input.categoryId));
  if (input.excludeProductId) conditions.push(ne(products.id, input.excludeProductId));

  const rows = await db
    .select(productFields)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productStocks, eq(productStocks.productId, products.id))
    .where(and(...conditions))
    .groupBy(
      products.id,
      products.msId,
      products.slug,
      products.name,
      products.categoryId,
      products.price,
      products.oldPrice,
      products.badge,
      products.image,
      products.description,
      products.specs,
      products.inStock,
      products.rating,
      products.reviewCount,
      products.createdAt,
      categories.name
    )
    .orderBy(
      desc(sql`coalesce(sum(${productStocks.quantity}), 0)`),
      desc(products.createdAt)
    )
    .limit(input.limit);

  if (rows.length >= input.limit || input.categoryId) return rows;

  return rows;
}

export const merchandisingRouter = createRouter({
  recommendations: publicQuery
    .input(
      z
        .object({
          placement: z.enum(["home_weekly", "product_related", "admin"]).default("home_weekly"),
          limit: z.number().min(1).max(50).default(10),
          categoryId: z.number().optional(),
          excludeProductId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getStockBasedRecommendations({
        limit: input?.limit ?? 10,
        categoryId: input?.categoryId,
        excludeProductId: input?.excludeProductId,
      });
    }),

  dashboard: publicQuery.query(async () => {
    const rows = await getStockBasedRecommendations({ limit: 50 });
    const totalStock = rows.reduce((sum, row) => sum + Number(row.totalStock || 0), 0);
    const withStock = rows.filter(row => Number(row.totalStock || 0) > 0).length;

    return {
      generatedAt: new Date().toISOString(),
      totalCandidates: rows.length,
      candidatesWithStock: withStock,
      totalStock,
      items: rows,
    };
  }),
});
