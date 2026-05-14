import axios from "axios";
import axiosRetry from "axios-retry";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import { getAppSetting } from "./app-settings";

const moyskladApi = axios.create({
  baseURL: "https://api.moysklad.ru/api/remap/1.2",
  headers: { "Accept-Encoding": "gzip" },
});

axiosRetry(moyskladApi, {
  retries: 5,
  retryDelay: retryCount => retryCount * 2000,
  retryCondition: error =>
    error.response?.status === 429 || error.response?.status === 500,
});

function getMsIdFromHref(href?: string | null): string | null {
  return href?.split("/").pop()?.split("?")[0] ?? null;
}

function parseLock(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (!parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function runMoyskladStockReconcile() {
  const db = getDb();
  const token = (await getAppSetting("moysklad_token"))?.trim();
  if (!token) throw new Error("Не найден токен МойСклад");

  const fullSyncLockRaw = await getAppSetting("moysklad_full_sync_lock");
  const fullSyncLock = parseLock(fullSyncLockRaw);
  if (fullSyncLock && fullSyncLock.expiresAt > Date.now()) {
    return { skipped: true as const, reason: "full_sync_running" as const };
  }

  const [activeProfile] = await db
    .select()
    .from(schema.syncProfiles)
    .where(
      sql`${schema.syncProfiles.provider} = 'moysklad' AND ${schema.syncProfiles.isDefault} = true`
    )
    .limit(1);

  const cfg = (activeProfile?.configJson ?? {}) as {
    selectedStores?: string[];
  };
  const selectedStores = Array.isArray(cfg.selectedStores) ? cfg.selectedStores : [];

  const [runRes] = await db.insert(schema.syncRuns).values({
    profileId: activeProfile?.id ?? null,
    runType: "reconcile",
    status: "running",
    message: "Reconcile остатков запущен",
    configSnapshot: { selectedStores },
  });
  const runId = runRes.insertId;

  try {
    const localProducts = await db
      .select({ id: schema.products.id, msId: schema.products.msId })
      .from(schema.products);
    const msProductToLocal = new Map<string, number>();
    for (const p of localProducts) {
      if (p.msId) msProductToLocal.set(p.msId, p.id);
    }

    const localStores = await db
      .select({ id: schema.stores.id, msId: schema.stores.msId })
      .from(schema.stores);
    const msStoreToLocal = new Map<string, number>();
    for (const s of localStores) {
      if (s.msId) msStoreToLocal.set(s.msId, s.id);
    }

    let offset = 0;
    let hasMore = true;
    const collected: Array<{ productId: number; storeId: number; quantity: number }> = [];

    while (hasMore) {
      const res = await moyskladApi.get(
        `/report/stock/bystore?offset=${offset}&limit=1000`,
        { headers: { Authorization: token } }
      );
      const rows = (res.data?.rows ?? []) as Array<Record<string, unknown>>;
      if (rows.length < 1000) hasMore = false;
      offset += 1000;

      for (const row of rows) {
        const msProductId = getMsIdFromHref(
          (row.meta as { href?: string } | undefined)?.href
        );
        if (!msProductId) continue;
        const localProductId = msProductToLocal.get(msProductId);
        if (!localProductId) continue;

        const stockByStore = Array.isArray(row.stockByStore)
          ? (row.stockByStore as Array<Record<string, unknown>>)
          : [];

        for (const storeStock of stockByStore) {
          const qtyRaw = Number(storeStock.stock ?? 0);
          const quantity = Number.isFinite(qtyRaw) ? Math.max(0, Math.round(qtyRaw)) : 0;
          if (quantity <= 0) continue;

          const msStoreId = getMsIdFromHref(
            (storeStock.meta as { href?: string } | undefined)?.href
          );
          if (!msStoreId) continue;
          if (selectedStores.length > 0 && !selectedStores.includes(msStoreId)) continue;

          const localStoreId = msStoreToLocal.get(msStoreId);
          if (!localStoreId) continue;
          collected.push({ productId: localProductId, storeId: localStoreId, quantity });
        }
      }
    }

    await db.execute(sql`DELETE FROM product_stocks`);
    if (collected.length > 0) {
      await db.insert(schema.productStocks).values(collected);
    }

    await db.update(schema.products).set({ inStock: false });
    await db.execute(sql`
      UPDATE products p
      SET p.in_stock = true
      WHERE EXISTS (
        SELECT 1
        FROM product_stocks ps
        WHERE ps.product_id = p.id AND ps.quantity > 0
      )
    `);

    await db
      .update(schema.syncRuns)
      .set({
        status: "success",
        message: "Reconcile остатков завершен",
        statsJson: {
          rowsProcessed: collected.length,
          storesFiltered: selectedStores.length,
        },
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, runId));

    return {
      skipped: false as const,
      rowsProcessed: collected.length,
      storesFiltered: selectedStores.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "reconcile failed";
    await db
      .update(schema.syncRuns)
      .set({
        status: "error",
        message,
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, runId));
    throw error;
  }
}

