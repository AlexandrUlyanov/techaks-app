import { z } from "zod";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { createRouter, protectedProcedure, publicQuery, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { blogAiSuggestions, posts } from "@db/schema";
import {
  BLOG_STATUSES,
  estimateReadingTimeMinutes,
  normalizeExcerpt,
  normalizeSeoField,
  resolveBlogStatus,
  sanitizeBlogContent,
  slugifyBlogTitle,
} from "../lib/blog-content";
import {
  blogAiInputSchema,
  generateBlogAiSuggestions,
  markBlogAiSuggestionsApplied,
} from "../lib/blog-ai-assistant";
import { enqueueSearchReindexJob, rebuildSearchDocumentsForPages } from "../lib/search";

const blogStatusSchema = z.enum(BLOG_STATUSES);

const postSchema = z.object({
  slug: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  excerpt: z.string().trim().min(1).max(320),
  content: z.string().trim().min(1),
  category: z.string().trim().min(1).max(50),
  image: z.string().trim().min(1).max(255),
  ogImage: z.string().trim().max(255).optional().default(""),
  metaTitle: z.string().trim().max(255).optional().default(""),
  metaDescription: z.string().trim().max(320).optional().default(""),
  authorName: z.string().trim().min(1).max(120).optional().default("Редакция ТЕХАКС"),
  status: blogStatusSchema.default("draft"),
  featured: z.boolean().default(false),
  publishedAt: z.union([z.string().datetime(), z.null()]).optional().default(null),
});

const liveCondition = or(
  eq(posts.status, "published"),
  and(eq(posts.status, "scheduled"), sql`${posts.publishedAt} <= NOW()`)
);

function selectPostFields() {
  return {
    id: posts.id,
    slug: posts.slug,
    title: posts.title,
    excerpt: posts.excerpt,
    content: posts.content,
    contentFormat: posts.contentFormat,
    category: posts.category,
    image: posts.image,
    ogImage: posts.ogImage,
    metaTitle: posts.metaTitle,
    metaDescription: posts.metaDescription,
    authorName: posts.authorName,
    status: posts.status,
    featured: posts.featured,
    readingTimeMinutes: posts.readingTimeMinutes,
    published: posts.published,
    publishedAt: posts.publishedAt,
    updatedAt: posts.updatedAt,
    createdAt: posts.createdAt,
  };
}

function normalizePostInput(data: z.infer<typeof postSchema>) {
  const sanitizedContent = sanitizeBlogContent(data.content);
  const resolved = resolveBlogStatus({
    status: data.status,
    publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
  });

  return {
    slug: slugifyBlogTitle(data.slug || data.title),
    title: normalizeSeoField(data.title, 255),
    excerpt: normalizeExcerpt(data.excerpt),
    content: sanitizedContent,
    contentFormat: "html",
    category: normalizeSeoField(data.category, 50),
    image: data.image.trim(),
    ogImage: data.ogImage?.trim() || data.image.trim(),
    metaTitle: normalizeSeoField(data.metaTitle || data.title, 255),
    metaDescription: normalizeExcerpt(
      data.metaDescription || data.excerpt || estimateExcerptFromContent(sanitizedContent)
    ),
    authorName: normalizeSeoField(data.authorName || "Редакция ТЕХАКС", 120),
    status: resolved.status,
    featured: data.featured,
    readingTimeMinutes: estimateReadingTimeMinutes(sanitizedContent),
    published: resolved.published,
    publishedAt: resolved.publishedAt,
    updatedAt: new Date(),
  };
}

export const blogRouter = createRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "manage", "BlogPost");
    const db = getDb();
    return db.select(selectPostFields()).from(posts).orderBy(desc(posts.createdAt));
  }),

  getPublished: publicQuery
    .input(
      z
        .object({
          category: z.string().trim().max(50).optional(),
        })
        .optional()
        .default({})
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [liveCondition];
      if (input.category) conditions.push(eq(posts.category, input.category));
      return db
        .select(selectPostFields())
        .from(posts)
        .where(and(...conditions))
        .orderBy(desc(posts.featured), desc(posts.publishedAt), desc(posts.createdAt));
    }),

  getCategories: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        category: posts.category,
        count: sql<number>`count(*)`,
      })
      .from(posts)
      .where(liveCondition)
      .groupBy(posts.category)
      .orderBy(desc(sql<number>`count(*)`), posts.category);

    return rows.map(row => ({
      category: row.category,
      count: Number(row.count),
    }));
  }),

  getFeatured: publicQuery.query(async () => {
    const db = getDb();
    const [featuredPost] = await db
      .select(selectPostFields())
      .from(posts)
      .where(and(liveCondition, eq(posts.featured, true)))
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
      .limit(1);

    return featuredPost ?? null;
  }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [post] = await db
        .select(selectPostFields())
        .from(posts)
        .where(eq(posts.slug, input.slug))
        .limit(1);

      if (!post) return null;
      if ((post.status === "draft" || post.status === "archived") && !post.published) {
        return null;
      }

      return post;
    }),

  getRelated: publicQuery
    .input(
      z.object({
        id: z.number(),
        category: z.string().trim().max(50),
        limit: z.number().int().min(1).max(6).default(3),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select(selectPostFields())
        .from(posts)
        .where(and(liveCondition, eq(posts.category, input.category), ne(posts.id, input.id)))
        .orderBy(desc(posts.featured), desc(posts.publishedAt), desc(posts.createdAt))
        .limit(input.limit);
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        data: postSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "BlogPost");
      const db = getDb();
      const normalized = normalizePostInput(input.data);
      let postId = input.id ?? 0;

      if (input.id) {
        await db.update(posts).set(normalized).where(eq(posts.id, input.id));
      } else {
        const result = await db.insert(posts).values({
          ...normalized,
          createdAt: new Date(),
        });
        postId = result[0].insertId;
      }
      await enqueueSearchReindexJob({
        entityType: "page",
        entityId: 100000 + postId,
        reason: input.id ? "page_updated" : "page_created",
      });
      await rebuildSearchDocumentsForPages();
      return { success: true, id: postId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "delete", "BlogPost");
      const db = getDb();
      await db.delete(posts).where(eq(posts.id, input.id));
      await enqueueSearchReindexJob({
        entityType: "page",
        entityId: 100000 + input.id,
        reason: "page_deleted",
      });
      await rebuildSearchDocumentsForPages();
      return { success: true };
    }),

  generateAiSuggestions: protectedProcedure
    .input(blogAiInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "BlogPost");
      return generateBlogAiSuggestions(input, ctx.user.id);
    }),

  listAiSuggestions: protectedProcedure
    .input(z.object({ postId: z.number().optional() }).optional().default({}))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "BlogPost");
      const db = getDb();
      const conditions = [eq(blogAiSuggestions.status, "suggested")];
      if (input.postId) {
        conditions.push(eq(blogAiSuggestions.postId, input.postId));
      }

      return db
        .select()
        .from(blogAiSuggestions)
        .where(and(...conditions))
        .orderBy(desc(blogAiSuggestions.createdAt))
        .limit(30);
    }),

  markAiSuggestionsApplied: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "BlogPost");
      await markBlogAiSuggestionsApplied(input.ids);
      return { success: true };
    }),
});

function estimateExcerptFromContent(content: string) {
  return normalizeExcerpt(content).slice(0, 220);
}
