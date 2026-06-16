import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  requireAbility,
  createRouter,
  protectedProcedure,
  publicQuery,
} from "../middleware";
import { getDb } from "../queries/connection";
import { categories, listingPages, products } from "@db/schema";
import { writeAdminAuditLog } from "../lib/admin-audit";
import {
  buildCategoryListingUrl,
  buildCategoryListingViewModel,
  deriveListingSeoStatus,
  listingDuplicateRisks,
  listingIndexationModes,
  listingSeoStatuses,
  resolveCategoryListingBySlug,
  scoreListingContent,
  trimOrNull,
} from "../lib/listing-pages";

const listingIndexationModeSchema = z.enum(listingIndexationModes);
const listingSeoStatusSchema = z.enum(listingSeoStatuses);
const listingDuplicateRiskSchema = z.enum(listingDuplicateRisks);

export const listingRouter = createRouter({
  getPublicCategoryListing: publicQuery
    .input(z.object({ categorySlug: z.string().trim().min(1) }))
    .query(async ({ input }) => {
      return resolveCategoryListingBySlug(input.categorySlug);
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

      const [categoryRows, listingRows, productCountRows] = await Promise.all([
        db.select().from(categories).where(categoryWhere).orderBy(asc(categories.sortOrder), asc(categories.name)),
        db
          .select()
          .from(listingPages)
          .where(eq(listingPages.type, "category"))
          .orderBy(desc(listingPages.updatedAt)),
        db
          .select({
            categoryId: products.categoryId,
            productCount: sql<number>`count(*)`,
          })
          .from(products)
          .where(eq(products.isActive, true))
          .groupBy(products.categoryId),
      ]);

      const listingByCategoryId = new Map(
        listingRows.map(item => [item.categoryId, item] as const)
      );
      const countsByCategoryId = new Map(
        productCountRows.map(item => [item.categoryId, Number(item.productCount ?? 0)] as const)
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
      const [categoryRows, listingRows, countRows] = await Promise.all([
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
        db
          .select({ productCount: sql<number>`count(*)` })
          .from(products)
          .where(and(eq(products.categoryId, input.categoryId), eq(products.isActive, true))),
      ]);
      const category = categoryRows[0];

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Категория не найдена." });
      }

      const listing = listingRows[0] ?? null;
      return buildCategoryListingViewModel(
        category,
        listing,
        Number(countRows[0]?.productCount ?? 0)
      );
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
});
