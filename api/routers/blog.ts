import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { posts } from "@db/schema";
import { eq, desc } from "drizzle-orm";

const postSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  category: z.string().min(1),
  image: z.string().min(1),
  published: z.boolean().default(true),
});

export const blogRouter = createRouter({
  getAll: publicQuery.query(async () => {
    const db = getDb();
    return await db.select().from(posts).orderBy(desc(posts.createdAt));
  }),

  getPublished: publicQuery.query(async () => {
    const db = getDb();
    return await db
      .select()
      .from(posts)
      .where(eq(posts.published, true))
      .orderBy(desc(posts.createdAt));
  }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(posts)
        .where(eq(posts.slug, input.slug))
        .limit(1);
      return result[0] || null;
    }),

  upsert: publicQuery
    .input(z.object({
      id: z.number().optional(),
      data: postSchema
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.id) {
        await db.update(posts).set(input.data).where(eq(posts.id, input.id));
        return { success: true, id: input.id };
      } else {
        const result = await db.insert(posts).values(input.data);
        return { success: true, id: result[0].insertId };
      }
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(posts).where(eq(posts.id, input.id));
      return { success: true };
    }),
});
