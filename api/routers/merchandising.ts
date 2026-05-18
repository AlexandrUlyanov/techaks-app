import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import {
  bulkUpdateMerchandisingBadge,
  getMerchandisingDisabledBadges,
  getMerchandisingSummary,
  getRecommendedProducts,
  listMerchandisingProducts,
  recalculateMerchandisingScores,
  saveMerchandisingDisabledBadges,
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
          placement: z
            .enum(["home_weekly", "home_popular", "product_related", "admin"])
            .default("home_weekly"),
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

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Merchandising");
    const summary = await getMerchandisingSummary();
    const products = await listMerchandisingProducts({ page: 1, limit: 50 });
    const disabledBadges = await getMerchandisingDisabledBadges();

    return {
      generatedAt: new Date().toISOString(),
      disabledBadges,
      ...summary,
      items: products.items,
    };
  }),

  badgeSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Merchandising");
    return {
      disabledBadges: await getMerchandisingDisabledBadges(),
    };
  }),

  products: protectedProcedure
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
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Merchandising");
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

  score: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Merchandising");
      const db = getDb();
      const [score] = await db
        .select()
        .from(productMerchandising)
        .where(eq(productMerchandising.productId, input.productId))
        .limit(1);
      return score ?? null;
    }),

  history: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Merchandising");
      const db = getDb();
      return db
        .select()
        .from(merchandisingHistory)
        .where(eq(merchandisingHistory.productId, input.productId))
        .orderBy(desc(merchandisingHistory.createdAt))
        .limit(50);
    }),

  recalculate: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(["all", "category"]).default("all"),
          categoryId: z.number().optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");
      return recalculateMerchandisingScores(input?.scope === "category" ? input.categoryId : undefined);
    }),

  updateProduct: protectedProcedure
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
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");
      return updateManualMerchandising(input);
    }),

  updateBadgeSettings: protectedProcedure
    .input(
      z.object({
        disabledBadges: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");
      const disabledBadges = await saveMerchandisingDisabledBadges(input.disabledBadges);
      return { success: true, disabledBadges };
    }),

  bulkBadgeAction: protectedProcedure
    .input(
      z.object({
        badge: z.string(),
        action: z.enum([
          "add_filtered",
          "remove_filtered",
          "remove_all",
          "disable_globally",
          "enable_globally",
        ]),
        categoryId: z.number().optional(),
        status: z.string().optional(),
        scoreMin: z.number().optional(),
        stockStatus: z.enum(["in_stock", "out_of_stock"]).optional(),
        search: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");

      if (input.action === "disable_globally" || input.action === "enable_globally") {
        const current = new Set(await getMerchandisingDisabledBadges());
        if (input.action === "disable_globally") current.add(input.badge);
        else current.delete(input.badge);
        const disabledBadges = await saveMerchandisingDisabledBadges(Array.from(current));
        return { success: true, mode: input.action, disabledBadges };
      }

      const result = await bulkUpdateMerchandisingBadge({
        badge: input.badge,
        action: input.action === "add_filtered" ? "add" : "remove",
        categoryId: input.action === "remove_all" ? undefined : input.categoryId,
        status: input.action === "remove_all" ? undefined : input.status,
        scoreMin: input.action === "remove_all" ? undefined : input.scoreMin,
        stockStatus: input.action === "remove_all" ? undefined : input.stockStatus,
        search: input.action === "remove_all" ? undefined : input.search,
        updatedBy: String(ctx.user?.id ?? "admin"),
      });

      return {
        mode: input.action,
        ...result,
      };
    }),
});
