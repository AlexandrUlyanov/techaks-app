import axios from "axios";
import axiosRetry from "axios-retry";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import { getAppSetting } from "./app-settings";
import {
  acquireMoyskladWorkerLock,
  releaseMoyskladWorkerLock,
  reportMoyskladPressure,
} from "./moysklad-runtime";

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

function parseLock(raw: string | null): { expiresAt: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (!parsed?.expiresAt) return null;
    return { expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export async function runMoyskladStockReconcile() {
  const workerLock = await acquireMoyskladWorkerLock("reconcile", 45 * 60_000);
  if (!workerLock) {
    return { skipped: true as const, reason: "worker_locked" as const };
  }

  const db = getDb();
  let runId: number | null = null;
  try {
    const token = (await getAppSetting("moysklad_token"))?.trim();
    if (!token) throw new Error("Не найден токен МойСклад");

    const fullSyncLockRaw = await getAppSetting("moysklad_full_sync_lock");
    const fullSyncLock = parseLock(fullSyncLockRaw);
    if (fullSyncLock && fullSyncLock.expiresAt > Date.now()) {
      return { skipped: true as const, reason: "full_sync_running" as const };
    }

    let activeProfile: typeof schema.syncProfiles.$inferSelect | null = null;
    let selectedStores: string[] = [];
    try {
      const [profileRow] = await db
        .select()
        .from(schema.syncProfiles)
        .where(
          sql`${schema.syncProfiles.provider} = 'moysklad' AND ${schema.syncProfiles.isDefault} = true`
        )
        .limit(1);
      activeProfile = profileRow ?? null;
      const cfg = (activeProfile?.configJson ?? {}) as { selectedStores?: string[] };
      selectedStores = Array.isArray(cfg.selectedStores) ? cfg.selectedStores : [];
    } catch (error) {
      console.warn("[reconcile] sync_profiles unavailable, fallback to all stores:", error);
    }

    const [runRes] = await db.insert(schema.syncRuns).values({
      profileId: activeProfile?.id ?? null,
      runType: "reconcile",
      status: "running",
      message: "Reconcile остатков запущен",
      configSnapshot: { selectedStores },
    });
    runId = Number(runRes.insertId);

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
    let rowsProcessed = 0;
    const insertBuffer: Array<{ productId: number; storeId: number; quantity: number }> = [];
    const INSERT_CHUNK = 1000;

    const flushBuffer = async () => {
      if (insertBuffer.length === 0) return;
      await db.insert(schema.productStocks).values(insertBuffer.splice(0, insertBuffer.length));
    };

    await db.execute(sql`DELETE FROM product_stocks`);

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
          insertBuffer.push({ productId: localProductId, storeId: localStoreId, quantity });
          rowsProcessed += 1;
          if (insertBuffer.length >= INSERT_CHUNK) {
            await flushBuffer();
          }
        }
      }
    }

    await flushBuffer();

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
          rowsProcessed,
          storesFiltered: selectedStores.length,
        },
        finishedAt: new Date(),
      })
      .where(eq(schema.syncRuns.id, runId));

    return {
      skipped: false as const,
      rowsProcessed,
      storesFiltered: selectedStores.length,
    };
  } catch (error) {
    if (runId) {
      const message = error instanceof Error ? error.message : "reconcile failed";
      await db
        .update(schema.syncRuns)
        .set({
          status: "error",
          message,
          finishedAt: new Date(),
        })
        .where(eq(schema.syncRuns.id, runId));
    }
    if (axios.isAxiosError(error)) {
      await reportMoyskladPressure({
        kind:
          error.response?.status === 429
            ? "rate_limit"
            : typeof error.response?.status === "number" && error.response.status >= 500
              ? "server"
              : /timeout|etimedout|aborted/i.test(String(error.message || ""))
                ? "timeout"
                : /econnreset|socket hang up|network/i.test(String(error.message || ""))
                  ? "network"
                  : "unknown",
        endpoint: "/report/stock/bystore",
        message: error.message,
        retry: false,
      });
    }
    throw error;
  } finally {
    await releaseMoyskladWorkerLock("reconcile", workerLock.owner);
  }
}
