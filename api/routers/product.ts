import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { products, categories } from "@db/schema";
import { eq } from "drizzle-orm";

export const productRouter = createRouter({
  getAll: publicQuery.query(async () => {
    const db = getDb();
    return await db.select().from(products);
  }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(products)
        .where(eq(products.slug, input.slug))
        .limit(1);
      return result[0] || null;
    }),

  getCategories: publicQuery.query(async () => {
    const db = getDb();
    return await db.select().from(categories);
  }),

  getByCategory: publicQuery
    .input(z.object({ categorySlug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      if (input.categorySlug === "all") {
        return await db.select().from(products);
      }
      
      const category = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, input.categorySlug))
        .limit(1);
        
      if (!category[0]) return [];
      
      return await db
        .select()
        .from(products)
        .where(eq(products.categoryId, category[0].id));
    }),
});
