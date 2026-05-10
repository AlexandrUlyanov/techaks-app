import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import {
  collectManufacturerLogos,
  getManufacturerBySlug,
  getManufacturers,
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

  syncCatalog: publicQuery.mutation(async () => {
    return syncManufacturersFromProducts();
  }),

  collectLogos: publicQuery
    .input(z.object({ force: z.boolean().default(false) }).optional())
    .mutation(async ({ input }) => {
      return collectManufacturerLogos(input);
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string(),
        website: z.string().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        isVisible: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      return updateManufacturer(input);
    }),
});
