import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { products, categories, reviews } from "@db/schema";
import { eq, asc, desc } from "drizzle-orm";

const productSchema = z.object({
  slug: z.string(),
  name: z.string(),
  categoryId: z.number(),
  price: z.number(),
  oldPrice: z.number().nullable(),
  badge: z.string().nullable(),
  image: z.string(),
  description: z.string(),
  specs: z.any(),
  inStock: z.boolean(),
  rating: z.string(),
  reviewCount: z.number(),
});

export const productRouter = createRouter({
  getAll: publicQuery.query(async () => {
    const db = getDb();
    return await db.select().from(products).orderBy(desc(products.createdAt));
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
    return await db.select().from(categories).orderBy(asc(categories.sortOrder));
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

  getReviews: publicQuery
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return await db
        .select()
        .from(reviews)
        .where(eq(reviews.productId, input.productId))
        .orderBy(desc(reviews.createdAt));
    }),

  // Admin mutations
  upsertProduct: publicQuery
    .input(z.object({
      id: z.number().optional(),
      data: productSchema
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.id) {
        await db.update(products).set(input.data).where(eq(products.id, input.id));
        return { success: true, id: input.id };
      } else {
        const result = await db.insert(products).values(input.data);
        return { success: true, id: result[0].insertId };
      }
    }),

  deleteProduct: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(products).where(eq(products.id, input.id));
      return { success: true };
    }),

  upsertCategory: publicQuery
    .input(z.object({
      id: z.number().optional(),
      data: z.object({
        slug: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        icon: z.string().nullable(),
        sortOrder: z.number(),
      })
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.id) {
        await db.update(categories).set(input.data).where(eq(categories.id, input.id));
        return { success: true, id: input.id };
      } else {
        const result = await db.insert(categories).values(input.data);
        return { success: true, id: result[0].insertId };
      }
    }),
});
