import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import {
  getMerchandisingSummary,
  getRecommendedProducts,
  listMerchandisingProducts,
  recalculateMerchandisingScores,
  updateManualMerchandising,
} from "../lib/merchandising-score";
import { getDb } from "../queries/connection";
import { merchandisingHistory, productMerchandising } from "@db/schema";
import { desc, eq } from "drizzle-orm";

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
      return getRecommendedProducts({
        limit: input?.limit ?? 10,
        categoryId: input?.categoryId,
        excludeProductId: input?.excludeProductId,
      });
    }),

  dashboard: publicQuery.query(async () => {
    const summary = await getMerchandisingSummary();
    const products = await listMerchandisingProducts({ page: 1, limit: 50 });

    return {
      generatedAt: new Date().toISOString(),
      ...summary,
      items: products.items,
    };
  }),

  products: publicQuery
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(50),
          categoryId: z.number().optional(),
          badge: z.string().optional(),
          status: z.string().optional(),
          scoreMin: z.number().optional(),
          stockStatus: z.enum(["in_stock", "out_of_stock"]).optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listMerchandisingProducts({
        page: input?.page ?? 1,
        limit: input?.limit ?? 50,
        categoryId: input?.categoryId,
        badge: input?.badge,
        status: input?.status,
        scoreMin: input?.scoreMin,
        stockStatus: input?.stockStatus,
        search: input?.search,
      });
    }),

  score: publicQuery
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [score] = await db
        .select()
        .from(productMerchandising)
        .where(eq(productMerchandising.productId, input.productId))
        .limit(1);
      return score ?? null;
    }),

  history: publicQuery
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(merchandisingHistory)
        .where(eq(merchandisingHistory.productId, input.productId))
        .orderBy(desc(merchandisingHistory.createdAt))
        .limit(50);
    }),

  recalculate: publicQuery
    .input(
      z
        .object({
          scope: z.enum(["all", "category"]).default("all"),
          categoryId: z.number().optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      return recalculateMerchandisingScores(input?.scope === "category" ? input.categoryId : undefined);
    }),

  updateProduct: publicQuery
    .input(
      z.object({
        productId: z.number(),
        manualPriority: z.number().min(-100).max(100),
        badges: z.array(z.string()).default([]),
        isFeatured: z.boolean().default(false),
        isHiddenFromPromo: z.boolean().default(false),
        comment: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return updateManualMerchandising(input);
    }),
});
