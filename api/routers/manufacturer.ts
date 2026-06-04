import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import {
  collectManufacturerLogos,
  getManufacturerBySlug,
  getManufacturerByProductSlug,
  getManufacturers,
  getManufacturersByCategory,
  getManufacturersByCategorySlugs,
  syncManufacturersFromProducts,
  updateManufacturer,
} from "../lib/manufacturers";

export const manufacturerRouter = createRouter({
  getAll: publicQuery
    .input(
      z
        .object({
          onlyVisible: z.boolean().default(false),
          withProductsOnly: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getManufacturers(input);
    }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return getManufacturerBySlug(input.slug);
    }),

  getByProductSlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return getManufacturerByProductSlug(input.slug);
    }),

  getByCategory: publicQuery
    .input(
      z.object({
        categorySlug: z.string(),
        limit: z.number().min(1).max(40).default(12),
      })
    )
    .query(async ({ input }) => {
      return getManufacturersByCategory(input);
    }),

  getByCategories: publicQuery
    .input(
      z.object({
        categorySlugs: z.array(z.string()).min(1).max(100),
        limit: z.number().min(1).max(40).default(12),
      })
    )
    .query(async ({ input }) => {
      return getManufacturersByCategorySlugs(input);
    }),

  syncCatalog: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "manage", "Product");
    return syncManufacturersFromProducts();
  }),

  collectLogos: protectedProcedure
    .input(z.object({ force: z.boolean().default(false) }).optional())
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return collectManufacturerLogos(input);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string(),
        website: z.string().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        metaTitle: z.string().nullable().optional(),
        metaDescription: z.string().nullable().optional(),
        isVisible: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Product");
      return updateManufacturer(input);
    }),
});
