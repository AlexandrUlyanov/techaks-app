import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import {
  applyBadgeAssignments,
  generateCategoryBadgeSuggestions,
  getAiBadgeQualityDashboard,
  getBadgeAssignmentPreview,
  listBadgeCatalog,
  listCategoryBadgeSuggestions,
  reviewBadgeSuggestion,
  upsertBadgeCatalog,
} from "../lib/merchandising-ai-badges";
import {
  bulkUpdateMerchandisingBadge as bulkLegacyBadgeAction,
  getMerchandisingDisabledBadges as getLegacyDisabledBadges,
  getMerchandisingSummary as getLegacySummary,
  getRecommendedProducts as getLegacyRecommendedProducts,
  listMerchandisingProducts as listLegacyMerchandisingProducts,
  recalculateMerchandisingScores as recalculateLegacyScores,
  saveMerchandisingDisabledBadges as saveLegacyDisabledBadges,
  updateManualMerchandising as updateLegacyManualMerchandising,
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
      return getLegacyRecommendedProducts({
        limit: input?.limit ?? 10,
        categoryId: input?.categoryId,
        excludeProductId: input?.excludeProductId,
      });
    }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Merchandising");
    const summary = await getLegacySummary();
    const products = await listLegacyMerchandisingProducts({ page: 1, limit: 50 });
    const disabledBadges = await getLegacyDisabledBadges();

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
      disabledBadges: await getLegacyDisabledBadges(),
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
      return listLegacyMerchandisingProducts({
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
      return recalculateLegacyScores(input?.scope === "category" ? input.categoryId : undefined);
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
      return updateLegacyManualMerchandising(input);
    }),

  updateBadgeSettings: protectedProcedure
    .input(
      z.object({
        disabledBadges: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");
      const disabledBadges = await saveLegacyDisabledBadges(input.disabledBadges);
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
        const current = new Set(await getLegacyDisabledBadges());
        if (input.action === "disable_globally") current.add(input.badge);
        else current.delete(input.badge);
        const disabledBadges = await saveLegacyDisabledBadges(Array.from(current));
        return { success: true, mode: input.action, disabledBadges };
      }

      const result = await bulkLegacyBadgeAction({
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

  catalog: protectedProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          source: z.string().optional(),
          badgeType: z.string().optional(),
          categoryId: z.number().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Merchandising");
      return listBadgeCatalog(input);
    }),

  upsertCatalogBadge: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        code: z.string().optional(),
        label: z.string().min(2).max(120),
        description: z.string().max(500).nullable().optional(),
        badgeType: z.string().optional(),
        audience: z.string().optional(),
        status: z.string().optional(),
        source: z.string().optional(),
        icon: z.string().max(80).nullable().optional(),
        colorToken: z.string().max(80).nullable().optional(),
        sortOrder: z.number().min(0).max(999).optional(),
        maxProductsPerItem: z.number().min(1).max(4).optional(),
        isVisibleOnSite: z.boolean().optional(),
        notes: z.string().max(1000).nullable().optional(),
        scopeType: z.enum(["global", "category", "category_tree"]).optional(),
        scopeId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");
      return upsertBadgeCatalog({
        ...input,
        updatedBy: String(ctx.user?.id ?? "admin"),
      });
    }),

  categorySuggestions: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Merchandising");
      return listCategoryBadgeSuggestions(input.categoryId);
    }),

  generateCategorySuggestions: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");
      return generateCategoryBadgeSuggestions({
        categoryId: input.categoryId,
        updatedBy: String(ctx.user?.id ?? "admin"),
      });
    }),

  reviewSuggestion: protectedProcedure
    .input(
      z.object({
        badgeId: z.number(),
        action: z.enum(["approve", "reject", "archive"]),
        label: z.string().min(2).max(120).optional(),
        description: z.string().max(500).nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");
      return reviewBadgeSuggestion({
        ...input,
        updatedBy: String(ctx.user?.id ?? "admin"),
      });
    }),

  assignmentPreview: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Merchandising");
      return getBadgeAssignmentPreview(input);
    }),

  applyAssignments: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Merchandising");
      return applyBadgeAssignments({
        categoryId: input.categoryId,
        updatedBy: String(ctx.user?.id ?? "admin"),
      });
    }),

  qualityDashboard: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Merchandising");
    return getAiBadgeQualityDashboard();
  }),
});
