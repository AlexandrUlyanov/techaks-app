import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import {
  requireAbility,
  createRouter,
  protectedProcedure,
  publicQuery,
} from "../middleware";
import { getDb } from "../queries/connection";
import { categories, listingPages } from "@db/schema";
import { writeAdminAuditLog } from "../lib/admin-audit";
import {
  buildDemandClusterDraft,
  demandClusterIntents,
  demandClusterSources,
  getDemandClusterByListingPageId,
  upsertDemandClusterForListingPage,
} from "../lib/listing-demand";
import {
  buildCategoryListingUrl,
  buildCategoryListingTitle,
  buildCategoryListingViewModel,
  buildFilterListingDescription,
  buildFilterListingUrl,
  buildFilterListingTitle,
  countVisibleProductsForCategory,
  deriveListingSeoStatus,
  listingDuplicateRisks,
  listingIndexationModes,
  listingSeoStatuses,
  listFilterListingCandidates,
  resolveCategoryListingBySlug,
  resolveFilterListing,
  scoreListingContent,
  trimOrNull,
} from "../lib/listing-pages";

const listingIndexationModeSchema = z.enum(listingIndexationModes);
const listingSeoStatusSchema = z.enum(listingSeoStatuses);
const listingDuplicateRiskSchema = z.enum(listingDuplicateRisks);
const demandClusterIntentSchema = z.enum(demandClusterIntents);
const demandClusterSourceSchema = z.enum(demandClusterSources);
const demandClusterInputSchema = z.object({
  primaryQuery: z.string().trim().min(1).max(255),
  supportingQueries: z.array(z.string().trim().min(1).max(255)).max(30).default([]),
  synonyms: z.array(z.string().trim().min(1).max(255)).max(30).default([]),
  negatives: z.array(z.string().trim().min(1).max(255)).max(30).default([]),
  intent: demandClusterIntentSchema.default("commercial"),
  source: demandClusterSourceSchema.default("manual"),
  sourceLabel: z.string().trim().max(120).nullable().optional(),
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  ctr: z.number().min(0).max(100).nullable().optional(),
  avgPosition: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const listingRouter = createRouter({
  getPublicCategoryListing: publicQuery
    .input(z.object({ categorySlug: z.string().trim().min(1) }))
    .query(async ({ input }) => {
      return resolveCategoryListingBySlug(input.categorySlug);
    }),

  getPublicFilterListing: publicQuery
    .input(
      z.object({
        categorySlug: z.string().trim().min(1),
        filterKey: z.string().trim().min(1),
        filterValue: z.string().trim().min(1),
      })
    )
    .query(async ({ input }) => {
      return resolveFilterListing(input);
    }),

  listCategoryListings: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          indexationMode: listingIndexationModeSchema.optional(),
          seoTextStatus: listingSeoStatusSchema.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Listing");
      const db = getDb();
      const search = input?.search?.trim();
      const categoryWhere = search
        ? or(
            like(categories.name, `%${search}%`),
            like(categories.slug, `%${search}%`),
            like(categories.description, `%${search}%`)
          )
        : undefined;

      const [categoryRows, listingRows] = await Promise.all([
        db.select().from(categories).where(categoryWhere).orderBy(asc(categories.sortOrder), asc(categories.name)),
        db
          .select()
          .from(listingPages)
          .where(eq(listingPages.type, "category"))
          .orderBy(desc(listingPages.updatedAt)),
      ]);

      const listingByCategoryId = new Map(
        listingRows.map(item => [item.categoryId, item] as const)
      );
      const countsByCategoryId = new Map<number, number>(
        await Promise.all(
          categoryRows.map(async category => [
            category.id,
            await countVisibleProductsForCategory(category.id),
          ] as const)
        )
      );

      const items = categoryRows
        .map(category =>
          buildCategoryListingViewModel(
            category,
            listingByCategoryId.get(category.id) ?? null,
            countsByCategoryId.get(category.id) ?? 0
          )
        )
        .filter(item =>
          input?.indexationMode ? item.indexationMode === input.indexationMode : true
        )
        .filter(item =>
          input?.seoTextStatus ? item.seoTextStatus === input.seoTextStatus : true
        );

      const summary = {
        total: items.length,
        custom: items.filter(item => item.id !== null).length,
        indexable: items.filter(item => item.indexationMode === "index").length,
        noindex: items.filter(item => item.indexationMode === "noindex").length,
        ready: items.filter(item => item.seoTextStatus === "ready" || item.seoTextStatus === "published").length,
        highRisk: items.filter(item => item.duplicateRisk === "high").length,
      };

      return { items, summary };
    }),

  getCategoryListing: protectedProcedure
    .input(z.object({ categoryId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Listing");
      const db = getDb();
      const [categoryRows, listingRows, productCount] = await Promise.all([
        db.select().from(categories).where(eq(categories.id, input.categoryId)).limit(1),
        db
          .select()
          .from(listingPages)
          .where(
            and(
              eq(listingPages.type, "category"),
              eq(listingPages.categoryId, input.categoryId)
            )
          )
          .limit(1),
        countVisibleProductsForCategory(input.categoryId),
      ]);
      const category = categoryRows[0];

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Категория не найдена." });
      }

      const listing = listingRows[0] ?? null;
      return buildCategoryListingViewModel(
        category,
        listing,
        productCount
      );
    }),

  listFilterListingCandidates: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Listing");
      const items = await listFilterListingCandidates(input.categoryId);
      const search = input.search?.trim().toLowerCase();
      if (!search) return items;
      return items.filter(item =>
        [item.key, item.value, item.normalizedKey, item.normalizedValue]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }),

  getFilterListing: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        filterKey: z.string().trim().min(1),
        filterValue: z.string().trim().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Listing");
      const [category] = await getDb()
        .select()
        .from(categories)
        .where(eq(categories.id, input.categoryId))
        .limit(1);

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Категория не найдена." });
      }

      const listing = await resolveFilterListing({
        categorySlug: category.slug,
        filterKey: input.filterKey,
        filterValue: input.filterValue,
        includeUnpublished: true,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Фильтр-листинг не найден." });
      }

      return listing;
    }),

  getCategoryDemandCluster: protectedProcedure
    .input(z.object({ categoryId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Listing");
      const target = await resolveListingDemandTarget({ categoryId: input.categoryId });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Категория не найдена." });
      }
      const current =
        target.listing?.id ? await getDemandClusterByListingPageId(target.listing.id) : null;
      const draft = await buildDemandClusterDraft({
        category: target.category,
        listing: target.listing,
      });

      return {
        current,
        draft: draft.draft,
        suggestions: draft.suggestions,
        listingPageId: target.listing?.id ?? null,
      };
    }),

  getFilterDemandCluster: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        filterKey: z.string().trim().min(1),
        filterValue: z.string().trim().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Listing");
      const target = await resolveListingDemandTarget(input);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Листинг не найден." });
      }
      const current =
        target.listing?.id ? await getDemandClusterByListingPageId(target.listing.id) : null;
      const draft = await buildDemandClusterDraft({
        category: target.category,
        listing: target.listing,
        filterLabel: target.filterLabel,
        filterValue: target.filterValueLabel,
      });

      return {
        current,
        draft: draft.draft,
        suggestions: draft.suggestions,
        listingPageId: target.listing?.id ?? null,
      };
    }),

  upsertCategoryDemandCluster: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        data: demandClusterInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Listing");
      const target = await resolveListingDemandTarget({ categoryId: input.categoryId });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Категория не найдена." });
      }

      const listing = await ensureCategoryListingPage(target.category, target.listing, ctx.user.id);
      const result = await upsertDemandClusterForListingPage({
        listingPageId: listing.id,
        userId: ctx.user.id,
        data: input.data,
      });

      const after = await getDemandClusterByListingPageId(listing.id);
      await writeAdminAuditLog({
        ctx,
        action: result.before ? "listing.demand.update" : "listing.demand.create",
        entityType: "listing-demand-cluster",
        entityId: result.id,
        entityLabel: target.category.name,
        before: result.before,
        after,
        meta: {
          listingType: "category",
          listingPageId: listing.id,
          categoryId: target.category.id,
          categorySlug: target.category.slug,
        },
      });

      return { success: true, id: result.id, listingPageId: listing.id };
    }),

  upsertFilterDemandCluster: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        filterKey: z.string().trim().min(1),
        filterValue: z.string().trim().min(1),
        data: demandClusterInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Listing");
      const target = await resolveListingDemandTarget(input);
      if (!target || !target.filterKey || !target.filterValue) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Листинг не найден." });
      }

      const listing = await ensureFilterListingPage(
        target.category,
        target.listing,
        {
          filterKey: target.filterKey,
          filterValue: target.filterValue,
          filterLabel: target.filterLabel ?? target.filterKey,
          filterValueLabel: target.filterValueLabel ?? target.filterValue,
        },
        ctx.user.id
      );
      const result = await upsertDemandClusterForListingPage({
        listingPageId: listing.id,
        userId: ctx.user.id,
        data: input.data,
      });

      const after = await getDemandClusterByListingPageId(listing.id);
      await writeAdminAuditLog({
        ctx,
        action: result.before ? "listing.demand.update" : "listing.demand.create",
        entityType: "listing-demand-cluster",
        entityId: result.id,
        entityLabel: `${target.category.name}: ${target.filterLabel}=${target.filterValueLabel}`,
        before: result.before,
        after,
        meta: {
          listingType: "filter",
          listingPageId: listing.id,
          categoryId: target.category.id,
          categorySlug: target.category.slug,
          filterKey: target.filterKey,
          filterValue: target.filterValue,
        },
      });

      return { success: true, id: result.id, listingPageId: listing.id };
    }),

  upsertCategoryListing: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        data: z.object({
          title: z.string().nullable().optional(),
          metaDescription: z.string().nullable().optional(),
          h1: z.string().nullable().optional(),
          introText: z.string().nullable().optional(),
          bottomText: z.string().nullable().optional(),
          canonicalUrl: z.string().nullable().optional(),
          indexationMode: listingIndexationModeSchema,
          seoTextStatus: listingSeoStatusSchema.optional(),
          isPublished: z.boolean().default(true),
          isAutoGenerated: z.boolean().default(false),
          demandScore: z.number().int().min(0).max(100).default(0),
          duplicateRisk: listingDuplicateRiskSchema.default("low"),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Listing");
      const db = getDb();
      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, input.categoryId))
        .limit(1);

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Категория не найдена." });
      }

      const [existing] = await db
        .select()
        .from(listingPages)
        .where(
          and(
            eq(listingPages.type, "category"),
            eq(listingPages.categoryId, input.categoryId)
          )
        )
        .limit(1);

      const payload = {
        type: "category" as const,
        categoryId: input.categoryId,
        filterKey: null,
        filterValue: null,
        slug: category.slug,
        url: buildCategoryListingUrl(category.slug),
        title: trimOrNull(input.data.title),
        metaDescription: trimOrNull(input.data.metaDescription),
        h1: trimOrNull(input.data.h1),
        introText: trimOrNull(input.data.introText),
        bottomText: trimOrNull(input.data.bottomText),
        canonicalUrl:
          input.data.indexationMode === "canonical_to_parent"
            ? trimOrNull(input.data.canonicalUrl) ?? buildCategoryListingUrl(category.slug)
            : trimOrNull(input.data.canonicalUrl),
        indexationMode: input.data.indexationMode,
        seoTextStatus:
          input.data.seoTextStatus ??
          deriveListingSeoStatus(
            scoreListingContent({
              title: trimOrNull(input.data.title),
              metaDescription: trimOrNull(input.data.metaDescription),
              h1: trimOrNull(input.data.h1),
              introText: trimOrNull(input.data.introText),
              bottomText: trimOrNull(input.data.bottomText),
            })
          ),
        isPublished: input.data.isPublished,
        isAutoGenerated: input.data.isAutoGenerated,
        demandScore: input.data.demandScore,
        contentScore: scoreListingContent({
          title: trimOrNull(input.data.title),
          metaDescription: trimOrNull(input.data.metaDescription),
          h1: trimOrNull(input.data.h1),
          introText: trimOrNull(input.data.introText),
          bottomText: trimOrNull(input.data.bottomText),
        }),
        duplicateRisk: input.data.duplicateRisk,
        updatedBy: ctx.user.id,
        updatedAt: new Date(),
      };

      let listingId = existing?.id ?? 0;

      if (existing) {
        await db.update(listingPages).set(payload).where(eq(listingPages.id, existing.id));
      } else {
        const result = await db.insert(listingPages).values({
          ...payload,
          createdBy: ctx.user.id,
        });
        listingId = result[0].insertId;
      }

      await writeAdminAuditLog({
        ctx,
        action: existing ? "listing.category.update" : "listing.category.create",
        entityType: "listing",
        entityId: existing?.id ?? listingId,
        entityLabel: category.name,
        before: existing ?? null,
        after: payload,
        meta: {
          categoryId: category.id,
          categorySlug: category.slug,
          listingType: "category",
        },
      });

      return {
        success: true,
        id: existing?.id ?? listingId,
      };
    }),

  upsertFilterListing: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().int().positive(),
        filterKey: z.string().trim().min(1),
        filterValue: z.string().trim().min(1),
        data: z.object({
          title: z.string().nullable().optional(),
          metaDescription: z.string().nullable().optional(),
          h1: z.string().nullable().optional(),
          introText: z.string().nullable().optional(),
          bottomText: z.string().nullable().optional(),
          canonicalUrl: z.string().nullable().optional(),
          indexationMode: listingIndexationModeSchema,
          seoTextStatus: listingSeoStatusSchema.optional(),
          isPublished: z.boolean().default(true),
          isAutoGenerated: z.boolean().default(false),
          demandScore: z.number().int().min(0).max(100).default(0),
          duplicateRisk: listingDuplicateRiskSchema.default("low"),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Listing");
      const db = getDb();
      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, input.categoryId))
        .limit(1);

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Категория не найдена." });
      }

      const resolved = await resolveFilterListing({
        categorySlug: category.slug,
        filterKey: input.filterKey,
        filterValue: input.filterValue,
        includeUnpublished: true,
      });

      if (!resolved) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Такой фильтр нельзя использовать для листинга." });
      }

      const [existing] = await db
        .select()
        .from(listingPages)
        .where(
          and(
            eq(listingPages.type, "filter"),
            eq(listingPages.categoryId, input.categoryId),
            eq(listingPages.filterKey, input.filterKey),
            eq(listingPages.filterValue, input.filterValue)
          )
        )
        .limit(1);

      const payload = {
        type: "filter" as const,
        categoryId: input.categoryId,
        filterKey: input.filterKey,
        filterValue: input.filterValue,
        slug: category.slug,
        url: buildFilterListingUrl(category.slug, input.filterKey, input.filterValue),
        title: trimOrNull(input.data.title),
        metaDescription: trimOrNull(input.data.metaDescription),
        h1: trimOrNull(input.data.h1),
        introText: trimOrNull(input.data.introText),
        bottomText: trimOrNull(input.data.bottomText),
        canonicalUrl:
          input.data.indexationMode === "canonical_to_parent"
            ? trimOrNull(input.data.canonicalUrl) ?? buildCategoryListingUrl(category.slug)
            : trimOrNull(input.data.canonicalUrl),
        indexationMode: input.data.indexationMode,
        seoTextStatus:
          input.data.seoTextStatus ??
          deriveListingSeoStatus(
            scoreListingContent({
              title: trimOrNull(input.data.title),
              metaDescription: trimOrNull(input.data.metaDescription),
              h1: trimOrNull(input.data.h1),
              introText: trimOrNull(input.data.introText),
              bottomText: trimOrNull(input.data.bottomText),
            })
          ),
        isPublished: input.data.isPublished,
        isAutoGenerated: input.data.isAutoGenerated,
        demandScore: input.data.demandScore,
        contentScore: scoreListingContent({
          title: trimOrNull(input.data.title),
          metaDescription: trimOrNull(input.data.metaDescription),
          h1: trimOrNull(input.data.h1),
          introText: trimOrNull(input.data.introText),
          bottomText: trimOrNull(input.data.bottomText),
        }),
        duplicateRisk: input.data.duplicateRisk,
        updatedBy: ctx.user.id,
        updatedAt: new Date(),
      };

      let listingId = existing?.id ?? 0;

      if (existing) {
        await db.update(listingPages).set(payload).where(eq(listingPages.id, existing.id));
      } else {
        const result = await db.insert(listingPages).values({
          ...payload,
          createdBy: ctx.user.id,
        });
        listingId = result[0].insertId;
      }

      await writeAdminAuditLog({
        ctx,
        action: existing ? "listing.filter.update" : "listing.filter.create",
        entityType: "listing",
        entityId: existing?.id ?? listingId,
        entityLabel: `${category.name}: ${resolved.filterLabel}=${resolved.filterValueLabel}`,
        before: existing ?? null,
        after: payload,
        meta: {
          categoryId: category.id,
          categorySlug: category.slug,
          listingType: "filter",
          filterKey: input.filterKey,
          filterValue: input.filterValue,
        },
      });

      return {
        success: true,
        id: existing?.id ?? listingId,
      };
    }),
});

async function resolveListingDemandTarget(input: {
  categoryId: number;
  filterKey?: string;
  filterValue?: string;
}) {
  const db = getDb();
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, input.categoryId))
    .limit(1);

  if (!category) return null;

  if (input.filterKey && input.filterValue) {
    const listing = await resolveFilterListing({
      categorySlug: category.slug,
      filterKey: input.filterKey,
      filterValue: input.filterValue,
      includeUnpublished: true,
    });
    if (!listing) return null;

    const listingRow = listing.id
      ? (
          await db
            .select()
            .from(listingPages)
            .where(eq(listingPages.id, listing.id))
            .limit(1)
        )[0] ?? null
      : null;

    return {
      category,
      listing: listingRow,
      filterKey: listing.filterKey,
      filterValue: listing.filterValue,
      filterLabel: listing.filterLabel,
      filterValueLabel: listing.filterValueLabel,
    };
  }

  const [listing] = await db
    .select()
    .from(listingPages)
    .where(and(eq(listingPages.type, "category"), eq(listingPages.categoryId, category.id)))
    .limit(1);

  return {
    category,
    listing: listing ?? null,
    filterKey: null,
    filterValue: null,
    filterLabel: null,
    filterValueLabel: null,
  };
}

async function ensureCategoryListingPage(
  category: typeof categories.$inferSelect,
  existing: typeof listingPages.$inferSelect | null,
  userId: number
) {
  if (existing) return existing;

  const db = getDb();
  const payload = {
    type: "category" as const,
    categoryId: category.id,
    filterKey: null,
    filterValue: null,
    slug: category.slug,
    url: buildCategoryListingUrl(category.slug),
    title: category.metaTitle ?? buildCategoryListingTitle(category.name),
    metaDescription: category.metaDescription ?? null,
    h1: category.name,
    introText: category.description ?? null,
    bottomText: null,
    canonicalUrl: null,
    indexationMode: "index" as const,
    seoTextStatus: deriveListingSeoStatus(
      trimOrNull(category.metaTitle)
        ? 24 + (category.metaDescription ? 22 : 0) + 18 + (category.description ? 22 : 0)
        : scoreFallbackCategoryContent(category)
    ),
    isPublished: true,
    isAutoGenerated: true,
    demandScore: 0,
    contentScore: scoreFallbackCategoryContent(category),
    duplicateRisk: "low" as const,
    createdBy: userId,
    updatedBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.insert(listingPages).values(payload);
  const [created] = await db
    .select()
    .from(listingPages)
    .where(eq(listingPages.id, result[0].insertId))
    .limit(1);
  return created;
}

function scoreFallbackCategoryContent(category: typeof categories.$inferSelect) {
  return Math.min(
    100,
    (category.metaTitle ? 24 : 0) +
      (category.metaDescription ? 22 : 0) +
      18 +
      (category.description ? 22 : 0)
  );
}

async function ensureFilterListingPage(
  category: typeof categories.$inferSelect,
  existing: typeof listingPages.$inferSelect | null,
  filter: {
    filterKey: string;
    filterValue: string;
    filterLabel: string;
    filterValueLabel: string;
  },
  userId: number
) {
  if (existing) return existing;

  const db = getDb();
  const payload = {
    type: "filter" as const,
    categoryId: category.id,
    filterKey: filter.filterKey,
    filterValue: filter.filterValue,
    slug: category.slug,
    url: buildFilterListingUrl(category.slug, filter.filterKey, filter.filterValue),
    title: buildFilterListingTitle(category.name, filter.filterLabel, filter.filterValueLabel),
    metaDescription: buildFilterListingDescription(
      category.name,
      filter.filterLabel,
      filter.filterValueLabel
    ),
    h1: `${category.name}: ${filter.filterValueLabel}`,
    introText: null,
    bottomText: null,
    canonicalUrl: buildCategoryListingUrl(category.slug),
    indexationMode: "noindex" as const,
    seoTextStatus: "draft" as const,
    isPublished: false,
    isAutoGenerated: true,
    demandScore: 0,
    contentScore: scoreListingContent({
      title: buildFilterListingTitle(category.name, filter.filterLabel, filter.filterValueLabel),
      metaDescription: buildFilterListingDescription(
        category.name,
        filter.filterLabel,
        filter.filterValueLabel
      ),
      h1: `${category.name}: ${filter.filterValueLabel}`,
      introText: null,
      bottomText: null,
    }),
    duplicateRisk: "medium" as const,
    createdBy: userId,
    updatedBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.insert(listingPages).values(payload);
  const [created] = await db
    .select()
    .from(listingPages)
    .where(eq(listingPages.id, result[0].insertId))
    .limit(1);
  return created;
}
