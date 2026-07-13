import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { deliveryJobs, orders } from "@db/schema";
import { getDb } from "../queries/connection";
import { expireDeliveryQuotes } from "./delivery-quotes";
import { ensureYandexDeliveryOrderForHandedToDelivery } from "./yandex-delivery-orders";

const LOCK_TTL_MS = 5 * 60_000;

function retryDelayMs(attempt: number) {
  return Math.min(30 * 60_000, Math.max(15_000, 15_000 * 2 ** attempt));
}

export async function enqueueDeliveryDispatch(params: {
  db?: ReturnType<typeof getDb>;
  orderId: number;
  actorUserId?: number | null;
  source?: string;
  force?: boolean;
}) {
  const db = params.db ?? getDb();
  const idempotencyKey = `dispatch:${params.orderId}`;
  await db
    .insert(deliveryJobs)
    .values({
      orderId: params.orderId,
      type: "dispatch",
      status: "pending",
      idempotencyKey,
      payloadJson: {
        actorUserId: params.actorUserId ?? null,
        source: params.source || "status_change",
      },
    })
    .onDuplicateKeyUpdate({
      set: {
        status: params.force
          ? "pending"
          : sql`CASE
              WHEN ${deliveryJobs.status} IN ('completed', 'dead') THEN ${deliveryJobs.status}
              ELSE 'pending'
            END`,
        attempts: params.force ? 0 : sql`${deliveryJobs.attempts}`,
        runAfter: new Date(),
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
      },
    });
}

export async function reconcileDeliveryDispatchJobs(limit = 50) {
  const db = getDb();
  const candidates = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.deliveryType, "delivery"),
        eq(orders.status, "handed_to_delivery"),
        or(eq(orders.deliveryProviderOrderId, ""), sql`${orders.deliveryProviderOrderId} IS NULL`),
      ),
    )
    .limit(limit);

  for (const candidate of candidates) {
    await enqueueDeliveryDispatch({
      db,
      orderId: candidate.id,
      source: "reconciliation",
    });
  }

  return candidates.length;
}

export async function processDeliveryJobs(limit = 5) {
  const db = getDb();
  await expireDeliveryQuotes(db);
  const workerId = randomUUID();
  const staleBefore = new Date(Date.now() - LOCK_TTL_MS);
  const now = new Date();

  await db
    .update(deliveryJobs)
    .set({ status: "pending", lockedAt: null, lockedBy: null, updatedAt: now })
    .where(
      and(
        eq(deliveryJobs.status, "processing"),
        or(lt(deliveryJobs.lockedAt, staleBefore), sql`${deliveryJobs.lockedAt} IS NULL`),
      ),
    );

  const candidates = await db
    .select()
    .from(deliveryJobs)
    .where(
      and(
        inArray(deliveryJobs.status, ["pending", "failed"]),
        lte(deliveryJobs.runAfter, now),
        sql`${deliveryJobs.attempts} < ${deliveryJobs.maxAttempts}`,
      ),
    )
    .orderBy(asc(deliveryJobs.runAfter), asc(deliveryJobs.id))
    .limit(limit);

  let processed = 0;
  for (const job of candidates) {
    const lockResult = await db
      .update(deliveryJobs)
      .set({ status: "processing", lockedAt: new Date(), lockedBy: workerId })
      .where(
        and(
          eq(deliveryJobs.id, job.id),
          inArray(deliveryJobs.status, ["pending", "failed"]),
        ),
      );
    if (Number((lockResult as any)?.[0]?.affectedRows ?? 0) !== 1) continue;

    try {
      const payload = (job.payloadJson || {}) as { actorUserId?: number | null };
      await ensureYandexDeliveryOrderForHandedToDelivery({
        db,
        orderId: job.orderId,
        actorUserId: payload.actorUserId ?? null,
        historyActionType: "yandex_delivery_dispatch_job",
      });
      await db
        .update(deliveryJobs)
        .set({
          status: "completed",
          attempts: job.attempts + 1,
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(deliveryJobs.id, job.id));
      processed += 1;
    } catch (error) {
      if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
        await db
          .update(deliveryJobs)
          .set({
            status: "blocked",
            runAfter: new Date(Date.now() + 5 * 60_000),
            lockedAt: null,
            lockedBy: null,
            lastError: error.message,
            updatedAt: new Date(),
          })
          .where(eq(deliveryJobs.id, job.id));
        continue;
      }

      const attempts = job.attempts + 1;
      const exhausted = attempts >= job.maxAttempts;
      await db
        .update(deliveryJobs)
        .set({
          status: exhausted ? "dead" : "failed",
          attempts,
          runAfter: new Date(Date.now() + retryDelayMs(attempts)),
          lockedAt: null,
          lockedBy: null,
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(eq(deliveryJobs.id, job.id));
    }
  }

  return processed;
}
