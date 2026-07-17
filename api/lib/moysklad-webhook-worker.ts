import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import {
  acquireMoyskladWorkerLock,
  releaseMoyskladWorkerLock,
} from "./moysklad-runtime";
import { getMoyskladClient } from "./moysklad-client";
import {
  getMoyskladPublicationConfig,
  getPublicationValue,
  resolveMoyskladPublicationField,
} from "./moysklad-publication";
import { enqueueSearchReindexJob } from "./search";

const MAX_ATTEMPTS = 6;

type StoreStockRow = {
  quantity: number;
  msStoreId: string | null;
  storeName: string | null;
};

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractMsIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  return href.split("/").pop()?.split("?")[0] ?? null;
}

function extractMsStoreId(row: Record<string, unknown>): string | null {
  const directMeta = toObject(row.meta);
  const nestedStore = toObject(row.store);
  const nestedStoreMeta = toObject(nestedStore?.meta);
  return (
    extractMsIdFromHref(typeof directMeta?.href === "string" ? directMeta.href : null) ??
    extractMsIdFromHref(typeof nestedStoreMeta?.href === "string" ? nestedStoreMeta.href : null) ??
    (typeof row.storeId === "string" ? row.storeId : null) ??
    (typeof row.store_id === "string" ? row.store_id : null)
  );
}

function parseStockByStore(payload: Record<string, unknown>): StoreStockRow[] {
  const source =
    (Array.isArray(payload.stockByStore) ? payload.stockByStore : null) ??
    (Array.isArray(payload.stock_by_store) ? payload.stock_by_store : null) ??
    [];

  return source
    .map(row => {
      const obj = toObject(row);
      if (!obj) return null;
      const quantity = Number(obj.stock ?? obj.quantity ?? obj.value ?? 0);
      const msStoreId = extractMsStoreId(obj);
      const storeName =
        (typeof obj.name === "string" ? obj.name : null) ??
        (typeof obj.storeName === "string" ? obj.storeName : null) ??
        (typeof obj.store_name === "string" ? obj.store_name : null);
      return {
        quantity: Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0,
        msStoreId,
        storeName,
      };
    })
    .filter((row): row is StoreStockRow => Boolean(row));
}

function detectMsProductId(payload: Record<string, unknown>): string | null {
  if (typeof payload.id === "string") return payload.id;

  const product = toObject(payload.product);
  if (typeof product?.id === "string") return product.id;

  const meta = toObject(payload.meta);
  const assortment = toObject(payload.assortment);
  const assortmentMeta = toObject(assortment?.meta);
  const productMeta = toObject(product?.meta);
  const href =
    (typeof meta?.href === "string" ? meta.href : null) ??
    (typeof assortmentMeta?.href === "string" ? assortmentMeta.href : null) ??
    (typeof productMeta?.href === "string" ? productMeta.href : null);

  return extractMsIdFromHref(href);
}

function isProductEntityPayload(payload: Record<string, unknown>) {
  const product = toObject(payload.product);
  const meta = toObject(payload.meta);
  const productMeta = toObject(product?.meta);
  const href =
    (typeof meta?.href === "string" ? meta.href : null) ??
    (typeof productMeta?.href === "string" ? productMeta.href : null);

  const declaredType =
    (typeof meta?.type === "string" ? meta.type : null) ??
    (typeof productMeta?.type === "string" ? productMeta.type : null);

  return declaredType === "product" || Boolean(href?.includes("/entity/product/"));
}

function hasStockPayload(payload: Record<string, unknown>) {
  const rows = parseStockByStore(payload);
  return rows.length > 0;
}

function getBackoffMinutes(attempt: number) {
  if (attempt <= 1) return 1;
  if (attempt === 2) return 5;
  if (attempt === 3) return 15;
  return 60;
}

async function markProductInStock(productId: number) {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.productStocks.quantity}), 0)`,
    })
    .from(schema.productStocks)
    .where(eq(schema.productStocks.productId, productId));

  await db
    .update(schema.products)
    .set({ inStock: (row?.total ?? 0) > 0 })
    .where(eq(schema.products.id, productId));
}

async function processStockEvent(payload: Record<string, unknown>) {
  const db = getDb();
  const msProductId = detectMsProductId(payload);
  if (!msProductId) {
    return { success: true as const, skipped: true as const };
  }

  const [product] = await db
    .select({ id: schema.products.id, msId: schema.products.msId })
    .from(schema.products)
    .where(eq(schema.products.msId, msProductId))
    .limit(1);

  if (!product) {
    return { success: false, retriable: true, reason: `local product not found for msId=${msProductId}` as const };
  }

  const stockRows = parseStockByStore(payload);
  if (stockRows.length === 0) {
    return { success: false, retriable: false, reason: "stockByStore is empty" as const };
  }

  const stores = await db.select({ id: schema.stores.id, msId: schema.stores.msId, name: schema.stores.name }).from(schema.stores);
  const msStoreToLocal = new Map<string, number>();
  const nameToLocal = new Map<string, number>();

  for (const store of stores) {
    if (store.msId) msStoreToLocal.set(store.msId, store.id);
    nameToLocal.set(store.name.toLowerCase().trim(), store.id);
  }

  await db.delete(schema.productStocks).where(eq(schema.productStocks.productId, product.id));

  for (const row of stockRows) {
    const localStoreId =
      (row.msStoreId ? msStoreToLocal.get(row.msStoreId) : undefined) ??
      (row.storeName ? nameToLocal.get(row.storeName.toLowerCase().trim()) : undefined);

    if (!localStoreId || row.quantity <= 0) continue;

    await db.insert(schema.productStocks).values({
      productId: product.id,
      storeId: localStoreId,
      quantity: row.quantity,
    });
  }

  await markProductInStock(product.id);
  return { success: true as const };
}

async function processProductPublicationEvent(payload: Record<string, unknown>) {
  const config = await getMoyskladPublicationConfig();
  if (!config.strictMode) {
    return { success: true as const, skipped: true as const };
  }

  if (!isProductEntityPayload(payload)) {
    return { success: true as const, skipped: true as const };
  }

  const msProductId = detectMsProductId(payload);
  if (!msProductId) {
    return { success: false, retriable: false, reason: "msProductId not found in payload" as const };
  }

  const field = await resolveMoyskladPublicationField(config);
  const client = await getMoyskladClient();
  const remoteProduct = await client.get<Record<string, unknown>>(`/entity/product/${msProductId}`);
  const allowed = getPublicationValue(remoteProduct, field.id) === true;
  const db = getDb();
  const [localProduct] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.msId, msProductId))
    .limit(1);

  if (!localProduct) {
    return { success: true as const, skipped: true as const };
  }

  if (allowed || config.hideDisabled) {
    await db
      .update(schema.products)
      .set({ isPublishedFromMoySklad: allowed })
      .where(eq(schema.products.id, localProduct.id));
    await enqueueSearchReindexJob({
      entityType: "product",
      entityId: localProduct.id,
      reason: "moysklad_publication_webhook",
    });
  }

  return { success: true as const, skipped: false as const };
}

export async function processMoyskladWebhookQueue(limit = 50) {
  const workerLock = await acquireMoyskladWorkerLock("webhook", 10 * 60_000);
  if (!workerLock) {
    return {
      processed: 0,
      done: 0,
      failed: 0,
      dead: 0,
      skipped: 0,
      reason: "worker_locked" as const,
    };
  }

  const db = getDb();
  try {
    const now = new Date();
    const dueRows = await db
      .select()
      .from(schema.webhookEvents)
      .where(
        and(
          eq(schema.webhookEvents.provider, "moysklad"),
          inArray(schema.webhookEvents.status, ["new", "failed"]),
          sql`(${schema.webhookEvents.processedAt} IS NULL OR ${schema.webhookEvents.processedAt} <= ${now})`,
          lt(schema.webhookEvents.attempts, MAX_ATTEMPTS)
        )
      )
      .orderBy(asc(schema.webhookEvents.createdAt))
      .limit(limit);

    let processed = 0;
    let done = 0;
    let failed = 0;
    let dead = 0;
    let skipped = 0;

    for (const event of dueRows) {
      processed += 1;
      await db
        .update(schema.webhookEvents)
        .set({ status: "processing", attempts: event.attempts + 1, lastError: null })
        .where(eq(schema.webhookEvents.id, event.id));

    const payload = toObject(event.payloadJson);
    if (!payload) {
      skipped += 1;
      await db
        .update(schema.webhookEvents)
        .set({
          status: "dead",
          lastError: "invalid payload json",
          processedAt: new Date(),
        })
        .where(eq(schema.webhookEvents.id, event.id));
      dead += 1;
      continue;
    }

    try {
      if (!hasStockPayload(payload)) {
        const publicationResult = await processProductPublicationEvent(payload);
        if (!publicationResult.success) {
          await db
            .update(schema.webhookEvents)
            .set({
              status: publicationResult.retriable ? "failed" : "dead",
              lastError: publicationResult.reason,
              processedAt: publicationResult.retriable ? new Date(Date.now() + 60_000) : new Date(),
            })
            .where(eq(schema.webhookEvents.id, event.id));
          if (publicationResult.retriable) failed += 1;
          else dead += 1;
          continue;
        }

        if (publicationResult.skipped) skipped += 1;
        await db
          .update(schema.webhookEvents)
          .set({ status: "done", lastError: null, processedAt: new Date() })
          .where(eq(schema.webhookEvents.id, event.id));
        done += 1;
        continue;
      }

      const stockResult = await processStockEvent(payload);
      if (stockResult.success) {
        await db
          .update(schema.webhookEvents)
          .set({ status: "done", processedAt: new Date(), lastError: null })
          .where(eq(schema.webhookEvents.id, event.id));
        done += 1;
        continue;
      }

      if (!stockResult.retriable) {
        await db
          .update(schema.webhookEvents)
          .set({
            status: "dead",
            lastError: stockResult.reason,
            processedAt: new Date(),
          })
          .where(eq(schema.webhookEvents.id, event.id));
        dead += 1;
        continue;
      }

      const attemptsAfter = event.attempts + 1;
      if (attemptsAfter >= MAX_ATTEMPTS) {
        await db
          .update(schema.webhookEvents)
          .set({
            status: "dead",
            lastError: stockResult.reason,
            processedAt: new Date(),
          })
          .where(eq(schema.webhookEvents.id, event.id));
        dead += 1;
        continue;
      }

      const backoffMinutes = getBackoffMinutes(attemptsAfter);
      const nextTryAt = new Date(Date.now() + backoffMinutes * 60_000);
      await db
        .update(schema.webhookEvents)
        .set({
          status: "failed",
          lastError: stockResult.reason,
          processedAt: nextTryAt,
        })
        .where(eq(schema.webhookEvents.id, event.id));
      failed += 1;
    } catch (error) {
      const attemptsAfter = event.attempts + 1;
      const reason = error instanceof Error ? error.message : "unknown queue error";

      if (attemptsAfter >= MAX_ATTEMPTS) {
        await db
          .update(schema.webhookEvents)
          .set({
            status: "dead",
            lastError: reason,
            processedAt: new Date(),
          })
          .where(eq(schema.webhookEvents.id, event.id));
        dead += 1;
      } else {
        const backoffMinutes = getBackoffMinutes(attemptsAfter);
        const nextTryAt = new Date(Date.now() + backoffMinutes * 60_000);
        await db
          .update(schema.webhookEvents)
          .set({
            status: "failed",
            lastError: reason,
            processedAt: nextTryAt,
          })
          .where(eq(schema.webhookEvents.id, event.id));
        failed += 1;
      }
    }
    }

    return { processed, done, failed, dead, skipped };
  } finally {
    await releaseMoyskladWorkerLock("webhook", workerLock.owner);
  }
}
