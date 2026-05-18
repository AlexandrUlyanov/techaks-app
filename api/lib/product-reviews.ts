import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { orders, orderItems, productReviewHistory, productReviewRequests, productReviews, products } from "@db/schema";
import type { getDb } from "../queries/connection";

export const REVIEW_STATUS_PENDING = "pending_moderation";
export const REVIEW_STATUS_PUBLISHED = "published";
export const REVIEW_STATUS_REJECTED = "rejected";
export const REVIEW_STATUS_HIDDEN = "hidden";

export const REVIEW_ACTIVE_STATUSES = [
  REVIEW_STATUS_PENDING,
  REVIEW_STATUS_PUBLISHED,
  REVIEW_STATUS_REJECTED,
  REVIEW_STATUS_HIDDEN,
] as const;

export const REVIEW_PUBLISHED_STATUSES = [REVIEW_STATUS_PUBLISHED] as const;

export type ReviewStatus = (typeof REVIEW_ACTIVE_STATUSES)[number];

type Db = ReturnType<typeof getDb>;

export const REVIEW_ELIGIBLE_ORDER_STATUSES = [
  "paid",
  "processing",
  "confirmed_by_customer",
  "ready_for_pickup",
  "assembling",
  "assembled",
  "awaiting_dispatch",
  "handed_to_delivery",
  "in_delivery",
  "delivered",
  "completed",
];

function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}

export async function recalculateProductReviewStats(db: Db, productId: number) {
  const [aggregate] = await db
    .select({
      avgRating: sql<number>`coalesce(avg(${productReviews.rating}), 0)`,
      totalCount: sql<number>`count(*)`,
    })
    .from(productReviews)
    .where(
      and(
        eq(productReviews.productId, productId),
        eq(productReviews.status, REVIEW_STATUS_PUBLISHED)
      )
    );

  const rating = roundRating(Number(aggregate?.avgRating ?? 0));
  const reviewCount = Number(aggregate?.totalCount ?? 0);

  await db
    .update(products)
    .set({
      rating: rating.toFixed(1),
      reviewCount,
    })
    .where(eq(products.id, productId));

  return { rating, reviewCount };
}

export async function addProductReviewHistory(
  db: Db,
  input: {
    reviewId: number;
    actorUserId?: number | null;
    actionType: string;
    oldStatus?: string | null;
    newStatus?: string | null;
    note?: string | null;
    payloadJson?: unknown;
  }
) {
  await db.insert(productReviewHistory).values({
    reviewId: input.reviewId,
    actorUserId: input.actorUserId ?? null,
    actionType: input.actionType,
    oldStatus: input.oldStatus ?? null,
    newStatus: input.newStatus ?? null,
    note: input.note ?? null,
    payloadJson: (input.payloadJson ?? null) as any,
  });
}

export async function findVerifiedPurchaseOrder(
  db: Db,
  userId: number,
  productId: number
) {
  const rows = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, productId),
        or(
          inArray(orders.status, REVIEW_ELIGIBLE_ORDER_STATUSES as unknown as string[]),
          inArray(orders.paymentStatus, ["paid", "partially_paid"])
        )
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getReviewEligibility(db: Db, userId: number, productId: number) {
  const existingRows = await db
    .select({
      id: productReviews.id,
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
      publishedAt: productReviews.publishedAt,
      updatedAt: productReviews.updatedAt,
      orderId: productReviews.orderId,
    })
    .from(productReviews)
    .where(
      and(eq(productReviews.userId, userId), eq(productReviews.productId, productId))
    )
    .limit(1);

  const existingReview = existingRows[0] ?? null;
  const verifiedOrder = await findVerifiedPurchaseOrder(db, userId, productId);

  return {
    canReview: true,
    verifiedPurchase: Boolean(verifiedOrder),
    verifiedOrderId: verifiedOrder?.orderId ?? null,
    verifiedOrderNumber: verifiedOrder?.orderNumber ?? null,
    existingReview,
  };
}

export async function ensureReviewRequestRowsForOrder(db: Db, orderId: number) {
  const rows = await db
    .select({
      orderId: orders.id,
      userId: orders.userId,
      productId: orderItems.productId,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.orderId, orderId));

  const inserted: Array<{ orderId: number; productId: number; userId: number }> = [];
  for (const row of rows) {
    if (!row.userId) continue;
    const existing = await db
      .select({ id: productReviewRequests.id })
      .from(productReviewRequests)
      .where(
        and(
          eq(productReviewRequests.orderId, row.orderId),
          eq(productReviewRequests.productId, row.productId)
        )
      )
      .limit(1);

    if (existing[0]) continue;

    await db.insert(productReviewRequests).values({
      orderId: row.orderId,
      userId: row.userId,
      productId: row.productId,
      requestStatus: "pending",
    });
    inserted.push({
      orderId: row.orderId,
      productId: row.productId,
      userId: row.userId,
    });
  }

  return inserted;
}

export async function markReviewRequestCompleted(db: Db, userId: number, productId: number) {
  await db
    .update(productReviewRequests)
    .set({
      requestStatus: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(productReviewRequests.userId, userId),
        eq(productReviewRequests.productId, productId)
      )
    );
}
