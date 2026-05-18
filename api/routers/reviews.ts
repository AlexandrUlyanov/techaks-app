import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { createRouter, protectedProcedure, publicQuery, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import {
  orders,
  productReviewRequests,
  productReviews,
  products,
  users,
} from "@db/schema";
import {
  addProductReviewHistory,
  ensureReviewRequestRowsForOrder,
  findVerifiedPurchaseOrder,
  getReviewEligibility,
  markReviewRequestCompleted,
  recalculateProductReviewStats,
  REVIEW_STATUS_HIDDEN,
  REVIEW_STATUS_PENDING,
  REVIEW_STATUS_PUBLISHED,
  REVIEW_STATUS_REJECTED,
} from "../lib/product-reviews";
import { sendReviewRequestEmail } from "../lib/mail";
import { env } from "../lib/env";

const reviewInputSchema = z.object({
  productId: z.number(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(255),
  text: z.string().trim().min(20).max(5000),
  pros: z.string().trim().max(2000).optional().nullable(),
  cons: z.string().trim().max(2000).optional().nullable(),
  usageContext: z.string().trim().max(120).optional().nullable(),
  usageDuration: z.string().trim().max(120).optional().nullable(),
  isRecommended: z.boolean().optional().nullable(),
});

const adminReviewStatusSchema = z.enum([
  REVIEW_STATUS_PENDING,
  REVIEW_STATUS_PUBLISHED,
  REVIEW_STATUS_REJECTED,
  REVIEW_STATUS_HIDDEN,
]);

const REVIEW_SORT_MAP = {
  newest: desc(productReviews.publishedAt),
  highest: desc(productReviews.rating),
  lowest: productReviews.rating,
  verified: desc(productReviews.isVerifiedPurchase),
};

function formatReviewUrl(productSlug: string) {
  const base = env.isProduction ? "https://techaks.ru" : "http://localhost:5173";
  return `${base}/product/${productSlug}#reviews`;
}

function normalizeOptionalText(value?: string | null) {
  const safe = value?.trim();
  return safe ? safe : null;
}

export const reviewsRouter = createRouter({
  listProductReviews: publicQuery
    .input(
      z.object({
        productId: z.number(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(20).default(10),
        rating: z.number().int().min(1).max(5).optional(),
        verifiedOnly: z.boolean().optional(),
        sort: z.enum(["newest", "highest", "lowest", "verified"]).default("newest"),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const offset = (input.page - 1) * input.limit;
      const whereConditions = [
        eq(productReviews.productId, input.productId),
        eq(productReviews.status, REVIEW_STATUS_PUBLISHED),
      ];
      if (input.rating) {
        whereConditions.push(eq(productReviews.rating, input.rating));
      }
      if (input.verifiedOnly) {
        whereConditions.push(eq(productReviews.isVerifiedPurchase, true));
      }

      const items = await db
        .select({
          id: productReviews.id,
          productId: productReviews.productId,
          rating: productReviews.rating,
          title: productReviews.title,
          text: productReviews.text,
          pros: productReviews.pros,
          cons: productReviews.cons,
          usageContext: productReviews.usageContext,
          usageDuration: productReviews.usageDuration,
          isRecommended: productReviews.isRecommended,
          isVerifiedPurchase: productReviews.isVerifiedPurchase,
          storeReply: productReviews.storeReply,
          storeReplyCreatedAt: productReviews.storeReplyCreatedAt,
          publishedAt: productReviews.publishedAt,
          authorName: sql<string>`coalesce(${users.fullName}, ${users.email})`,
        })
        .from(productReviews)
        .innerJoin(users, eq(productReviews.userId, users.id))
        .where(and(...whereConditions))
        .orderBy(REVIEW_SORT_MAP[input.sort], desc(productReviews.publishedAt))
        .limit(input.limit)
        .offset(offset);

      const [summary] = await db
        .select({
          avgRating: sql<number>`coalesce(avg(${productReviews.rating}), 0)`,
          totalCount: sql<number>`count(*)`,
          verifiedCount: sql<number>`sum(case when ${productReviews.isVerifiedPurchase} = 1 then 1 else 0 end)`,
          five: sql<number>`sum(case when ${productReviews.rating} = 5 then 1 else 0 end)`,
          four: sql<number>`sum(case when ${productReviews.rating} = 4 then 1 else 0 end)`,
          three: sql<number>`sum(case when ${productReviews.rating} = 3 then 1 else 0 end)`,
          two: sql<number>`sum(case when ${productReviews.rating} = 2 then 1 else 0 end)`,
          one: sql<number>`sum(case when ${productReviews.rating} = 1 then 1 else 0 end)`,
        })
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, input.productId),
            eq(productReviews.status, REVIEW_STATUS_PUBLISHED)
          )
        );

      return {
        items,
        summary: {
          avgRating: Math.round(Number(summary?.avgRating ?? 0) * 10) / 10,
          totalCount: Number(summary?.totalCount ?? 0),
          verifiedCount: Number(summary?.verifiedCount ?? 0),
          ratingBreakdown: {
            5: Number(summary?.five ?? 0),
            4: Number(summary?.four ?? 0),
            3: Number(summary?.three ?? 0),
            2: Number(summary?.two ?? 0),
            1: Number(summary?.one ?? 0),
          },
        },
      };
    }),

  getEligibility: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return getReviewEligibility(db, ctx.user.id, input.productId);
    }),

  myReviews: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
        productName: products.name,
        productSlug: products.slug,
        productImage: products.image,
        orderId: productReviews.orderId,
        status: productReviews.status,
        rating: productReviews.rating,
        title: productReviews.title,
        text: productReviews.text,
        pros: productReviews.pros,
        cons: productReviews.cons,
        usageContext: productReviews.usageContext,
        usageDuration: productReviews.usageDuration,
        isRecommended: productReviews.isRecommended,
        isVerifiedPurchase: productReviews.isVerifiedPurchase,
        moderationNote: productReviews.moderationNote,
        storeReply: productReviews.storeReply,
        storeReplyCreatedAt: productReviews.storeReplyCreatedAt,
        publishedAt: productReviews.publishedAt,
        updatedAt: productReviews.updatedAt,
      })
      .from(productReviews)
      .innerJoin(products, eq(productReviews.productId, products.id))
      .where(eq(productReviews.userId, ctx.user.id))
      .orderBy(desc(productReviews.updatedAt));
  }),

  upsertMyReview: protectedProcedure
    .input(reviewInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const productRows = await db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
        })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!productRows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Товар не найден" });
      }

      const verifiedOrder = await findVerifiedPurchaseOrder(db, ctx.user.id, input.productId);
      const existingRows = await db
        .select()
        .from(productReviews)
        .where(
          and(eq(productReviews.userId, ctx.user.id), eq(productReviews.productId, input.productId))
        )
        .limit(1);

      const payload = {
        rating: input.rating,
        title: input.title.trim(),
        text: input.text.trim(),
        pros: normalizeOptionalText(input.pros),
        cons: normalizeOptionalText(input.cons),
        usageContext: normalizeOptionalText(input.usageContext),
        usageDuration: normalizeOptionalText(input.usageDuration),
        isRecommended: input.isRecommended ?? null,
        orderId: verifiedOrder?.orderId ?? null,
        isVerifiedPurchase: Boolean(verifiedOrder),
        moderationNote: null,
        status: REVIEW_STATUS_PENDING,
        publishedAt: null,
        rejectedAt: null,
        hiddenAt: null,
        updatedAt: new Date(),
      };

      let reviewId = existingRows[0]?.id ?? null;
      const previousStatus = existingRows[0]?.status ?? null;

      if (existingRows[0]) {
        await db.update(productReviews).set(payload).where(eq(productReviews.id, existingRows[0].id));
        reviewId = existingRows[0].id;
      } else {
        const created = await db.insert(productReviews).values({
          productId: input.productId,
          userId: ctx.user.id,
          createdAt: new Date(),
          ...payload,
        });
        reviewId = created[0].insertId;
      }

      await addProductReviewHistory(db, {
        reviewId,
        actorUserId: ctx.user.id,
        actionType: existingRows[0] ? "customer_review_updated" : "customer_review_created",
        oldStatus: previousStatus,
        newStatus: REVIEW_STATUS_PENDING,
        payloadJson: {
          rating: input.rating,
          verifiedOrderId: verifiedOrder?.orderId ?? null,
        },
      });

      await markReviewRequestCompleted(db, ctx.user.id, input.productId);

      if (previousStatus === REVIEW_STATUS_PUBLISHED) {
        await recalculateProductReviewStats(db, input.productId);
      }

      return {
        success: true,
        reviewId,
        status: REVIEW_STATUS_PENDING,
        reviewUrl: formatReviewUrl(productRows[0].slug),
      };
    }),

  adminAnalytics: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Review");
    const db = getDb();

    const [reviewsSummary] = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when ${productReviews.status} = ${REVIEW_STATUS_PENDING} then 1 else 0 end)`,
        published: sql<number>`sum(case when ${productReviews.status} = ${REVIEW_STATUS_PUBLISHED} then 1 else 0 end)`,
        rejected: sql<number>`sum(case when ${productReviews.status} = ${REVIEW_STATUS_REJECTED} then 1 else 0 end)`,
        hidden: sql<number>`sum(case when ${productReviews.status} = ${REVIEW_STATUS_HIDDEN} then 1 else 0 end)`,
        verified: sql<number>`sum(case when ${productReviews.isVerifiedPurchase} = 1 then 1 else 0 end)`,
        avgPublishedRating: sql<number>`coalesce(avg(case when ${productReviews.status} = ${REVIEW_STATUS_PUBLISHED} then ${productReviews.rating} end), 0)`,
      })
      .from(productReviews);

    const [productsCoverage] = await db
      .select({
        totalProducts: sql<number>`count(*)`,
        withPublishedReviews: sql<number>`sum(case when ${products.reviewCount} > 0 then 1 else 0 end)`,
      })
      .from(products);

    const lowRatedProducts = await db
      .select({
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        rating: products.rating,
        reviewCount: products.reviewCount,
      })
      .from(products)
      .where(sql`${products.reviewCount} > 0 AND ${products.rating} <= 3.5`)
      .orderBy(products.rating)
      .limit(8);

    const reminderCandidates = await db
      .select({ count: sql<number>`count(*)` })
      .from(productReviewRequests)
      .where(
        and(
          eq(productReviewRequests.requestStatus, "pending"),
          sql`${productReviewRequests.initialSentAt} IS NOT NULL`,
          sql`(${productReviewRequests.reminderSentAt} IS NULL OR ${productReviewRequests.reminderSentAt} < date_sub(now(), interval 5 day))`
        )
      );

    return {
      totalReviews: Number(reviewsSummary?.total ?? 0),
      pendingReviews: Number(reviewsSummary?.pending ?? 0),
      publishedReviews: Number(reviewsSummary?.published ?? 0),
      rejectedReviews: Number(reviewsSummary?.rejected ?? 0),
      hiddenReviews: Number(reviewsSummary?.hidden ?? 0),
      verifiedReviews: Number(reviewsSummary?.verified ?? 0),
      avgPublishedRating: Math.round(Number(reviewsSummary?.avgPublishedRating ?? 0) * 10) / 10,
      totalProducts: Number(productsCoverage?.totalProducts ?? 0),
      productsWithPublishedReviews: Number(productsCoverage?.withPublishedReviews ?? 0),
      lowRatedProducts,
      reminderCandidates: Number(reminderCandidates[0]?.count ?? 0),
    };
  }),

  adminList: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().trim().optional(),
        status: adminReviewStatusSchema.optional(),
        verifiedOnly: z.boolean().optional(),
        rating: z.number().int().min(1).max(5).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Review");
      const db = getDb();
      const offset = (input.page - 1) * input.limit;
      const conditions = [];

      if (input.search) {
        const pattern = `%${input.search}%`;
        conditions.push(
          or(
            like(products.name, pattern),
            like(productReviews.title, pattern),
            like(productReviews.text, pattern),
            like(users.email, pattern),
            like(users.fullName, pattern)
          )
        );
      }
      if (input.status) conditions.push(eq(productReviews.status, input.status));
      if (input.verifiedOnly) conditions.push(eq(productReviews.isVerifiedPurchase, true));
      if (input.rating) conditions.push(eq(productReviews.rating, input.rating));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await db
        .select({
          id: productReviews.id,
          productId: productReviews.productId,
          productName: products.name,
          productSlug: products.slug,
          userId: productReviews.userId,
          authorName: sql<string>`coalesce(${users.fullName}, ${users.email})`,
          authorEmail: users.email,
          status: productReviews.status,
          rating: productReviews.rating,
          title: productReviews.title,
          text: productReviews.text,
          pros: productReviews.pros,
          cons: productReviews.cons,
          moderationNote: productReviews.moderationNote,
          isVerifiedPurchase: productReviews.isVerifiedPurchase,
          storeReply: productReviews.storeReply,
          storeReplyCreatedAt: productReviews.storeReplyCreatedAt,
          createdAt: productReviews.createdAt,
          updatedAt: productReviews.updatedAt,
          publishedAt: productReviews.publishedAt,
        })
        .from(productReviews)
        .innerJoin(products, eq(productReviews.productId, products.id))
        .innerJoin(users, eq(productReviews.userId, users.id))
        .where(whereClause)
        .orderBy(desc(productReviews.updatedAt))
        .limit(input.limit)
        .offset(offset);

      const [count] = whereClause
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(productReviews)
            .innerJoin(products, eq(productReviews.productId, products.id))
            .innerJoin(users, eq(productReviews.userId, users.id))
            .where(whereClause)
        : await db.select({ count: sql<number>`count(*)` }).from(productReviews);

      return {
        items,
        total: Number(count?.count ?? 0),
      };
    }),

  adminModerate: protectedProcedure
    .input(
      z.object({
        reviewId: z.number(),
        status: z.enum([REVIEW_STATUS_PUBLISHED, REVIEW_STATUS_REJECTED, REVIEW_STATUS_HIDDEN]),
        moderationNote: z.string().trim().max(2000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Review");
      const db = getDb();
      const rows = await db
        .select({
          id: productReviews.id,
          productId: productReviews.productId,
          status: productReviews.status,
        })
        .from(productReviews)
        .where(eq(productReviews.id, input.reviewId))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Отзыв не найден" });
      }

      const nextPayload: Record<string, unknown> = {
        status: input.status,
        moderationNote: normalizeOptionalText(input.moderationNote),
        updatedAt: new Date(),
      };

      if (input.status === REVIEW_STATUS_PUBLISHED) {
        nextPayload.publishedAt = new Date();
        nextPayload.rejectedAt = null;
        nextPayload.hiddenAt = null;
      } else if (input.status === REVIEW_STATUS_REJECTED) {
        nextPayload.rejectedAt = new Date();
      } else if (input.status === REVIEW_STATUS_HIDDEN) {
        nextPayload.hiddenAt = new Date();
      }

      await db.update(productReviews).set(nextPayload as any).where(eq(productReviews.id, input.reviewId));
      await addProductReviewHistory(db, {
        reviewId: input.reviewId,
        actorUserId: ctx.user.id,
        actionType: "moderated",
        oldStatus: rows[0].status,
        newStatus: input.status,
        note: normalizeOptionalText(input.moderationNote),
      });
      await recalculateProductReviewStats(db, rows[0].productId);
      return { success: true };
    }),

  adminReply: protectedProcedure
    .input(
      z.object({
        reviewId: z.number(),
        reply: z.string().trim().min(3).max(3000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Review");
      const db = getDb();
      const rows = await db
        .select({
          id: productReviews.id,
        })
        .from(productReviews)
        .where(eq(productReviews.id, input.reviewId))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Отзыв не найден" });
      }

      await db
        .update(productReviews)
        .set({
          storeReply: input.reply.trim(),
          storeReplyAuthorId: ctx.user.id,
          storeReplyCreatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(productReviews.id, input.reviewId));

      await addProductReviewHistory(db, {
        reviewId: input.reviewId,
        actorUserId: ctx.user.id,
        actionType: "store_reply_added",
      });

      return { success: true };
    }),

  sendPendingReminders: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Review");
      const db = getDb();
      const limit = input?.limit ?? 20;
      const rows = await db
        .select({
          requestId: productReviewRequests.id,
          orderId: productReviewRequests.orderId,
          productId: productReviewRequests.productId,
          userId: productReviewRequests.userId,
          initialSentAt: productReviewRequests.initialSentAt,
          reminderSentAt: productReviewRequests.reminderSentAt,
          productName: products.name,
          productSlug: products.slug,
          orderNumber: orders.orderNumber,
          customerName: users.fullName,
          customerEmail: users.email,
        })
        .from(productReviewRequests)
        .innerJoin(products, eq(productReviewRequests.productId, products.id))
        .innerJoin(orders, eq(productReviewRequests.orderId, orders.id))
        .innerJoin(users, eq(productReviewRequests.userId, users.id))
        .where(
          and(
            eq(productReviewRequests.requestStatus, "pending"),
            sql`${productReviewRequests.initialSentAt} IS NOT NULL`,
            sql`(${productReviewRequests.reminderSentAt} IS NULL OR ${productReviewRequests.reminderSentAt} < date_sub(now(), interval 5 day))`
          )
        )
        .orderBy(productReviewRequests.initialSentAt)
        .limit(limit);

      let sent = 0;
      for (const row of rows) {
        const existingReview = await db
          .select({ id: productReviews.id })
          .from(productReviews)
          .where(
            and(
              eq(productReviews.userId, row.userId),
              eq(productReviews.productId, row.productId),
              inArray(productReviews.status, [
                REVIEW_STATUS_PENDING,
                REVIEW_STATUS_PUBLISHED,
                REVIEW_STATUS_REJECTED,
                REVIEW_STATUS_HIDDEN,
              ])
            )
          )
          .limit(1);

        if (existingReview[0]) {
          await db
            .update(productReviewRequests)
            .set({
              requestStatus: "completed",
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(productReviewRequests.id, row.requestId));
          continue;
        }

        await sendReviewRequestEmail({
          email: row.customerEmail,
          customerName: row.customerName,
          productName: row.productName,
          orderNumber: row.orderNumber,
          reviewUrl: formatReviewUrl(row.productSlug),
          isReminder: true,
        }).catch(err => {
          console.error("send review reminder failed", err);
        });

        await db
          .update(productReviewRequests)
          .set({
            reminderSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(productReviewRequests.id, row.requestId));
        sent += 1;
      }

      return { success: true, sent };
    }),

  ensureOrderRequests: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Review");
      const db = getDb();
      const inserted = await ensureReviewRequestRowsForOrder(db, input.orderId);
      return { success: true, inserted: inserted.length };
    }),
});
