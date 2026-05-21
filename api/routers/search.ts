import { z } from "zod";
import { createRouter, protectedProcedure, publicQuery, requireAbility } from "../middleware";
import {
  createSearchSynonym,
  deleteSearchSynonym,
  getSearchAdminStats,
  getSearchSettings,
  rebuildSearchDocumentsForCategories,
  rebuildSearchDocumentsForPages,
  rebuildSearchDocumentsForProducts,
  listSearchSynonyms,
  logSearchClick,
  processSearchReindexJobs,
  rebuildSearchIndex,
  saveSearchSettings,
  searchLogClickInputSchema,
  searchQueryInputSchema,
  searchReindexEntityInputSchema,
  searchReindexInputSchema,
  searchSettingsInputSchema,
  searchSite,
  searchSuggestions,
  searchSuggestionsInputSchema,
  searchSynonymInputSchema,
  updateSearchSynonym,
} from "../lib/search";

export const searchRouter = createRouter({
  query: publicQuery.input(searchQueryInputSchema).query(async ({ ctx, input }) => {
    return searchSite({
      ...input,
      userId: ctx.user?.id ?? null,
      ip:
        ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        ctx.req.headers.get("x-real-ip") ||
        null,
      userAgent: ctx.req.headers.get("user-agent"),
    });
  }),

  suggestions: publicQuery
    .input(searchSuggestionsInputSchema)
    .query(async ({ input }) => searchSuggestions(input.query, input.limit ?? 8)),

  popular: publicQuery.query(async () => {
    const stats = await getSearchAdminStats();
    return stats.popularSuggestions;
  }),

  logClick: publicQuery
    .input(searchLogClickInputSchema)
    .mutation(async ({ input }) => logSearchClick(input)),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Search");
    return getSearchSettings();
  }),

  saveSettings: protectedProcedure
    .input(searchSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Search");
      return saveSearchSettings(input);
    }),

  adminStats: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Search");
    return getSearchAdminStats();
  }),

  reindex: protectedProcedure
    .input(searchReindexInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Search");
      const counts = await rebuildSearchIndex(input.entityTypes ?? ["product", "category", "page"]);
      const processed = await processSearchReindexJobs(500);
      return { success: true, counts, processed };
    }),

  reindexEntity: protectedProcedure
    .input(searchReindexEntityInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Search");
      const counts = { product: 0, category: 0, page: 0 };
      if (input.entityType === "product") {
        counts.product = input.entityId
          ? await rebuildSearchDocumentsForProducts([input.entityId])
          : await rebuildSearchDocumentsForProducts();
      } else if (input.entityType === "category") {
        counts.category = input.entityId
          ? await rebuildSearchDocumentsForCategories([input.entityId])
          : await rebuildSearchDocumentsForCategories();
      } else {
        counts.page = await rebuildSearchDocumentsForPages();
      }
      return { success: true, counts };
    }),

  synonyms: createRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      requireAbility(ctx, "read", "Search");
      return listSearchSynonyms();
    }),

    create: protectedProcedure
      .input(searchSynonymInputSchema)
      .mutation(async ({ ctx, input }) => {
        requireAbility(ctx, "manage", "Search");
        return createSearchSynonym(input);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: searchSynonymInputSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireAbility(ctx, "manage", "Search");
        return updateSearchSynonym(input.id, input.data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        requireAbility(ctx, "manage", "Search");
        return deleteSearchSynonym(input.id);
      }),
  }),
});
