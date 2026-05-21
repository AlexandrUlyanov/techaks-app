import { z } from "zod";
import { createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import * as schema from "../../db/schema";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import axiosRetry from 'axios-retry';
import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import {
  normalizeProductDescriptions,
  rebuildProductSpecIndex,
} from "../lib/product-normalization-service";
import { previewProductNormalization } from "../lib/product-normalization";
import { getAppSetting, setAppSetting } from "../lib/app-settings";
import { processMoyskladWebhookQueue } from "../lib/moysklad-webhook-worker";
import { runMoyskladStockReconcile } from "../lib/moysklad-reconcile";
import { runMoyskladFullSyncWatchdog } from "../lib/moysklad-full-sync-watchdog";
import { applyProductAutoBlockState } from "../lib/product-visibility";
import {
  getMoyskladOrderSyncOverview,
  getMoyskladOrderSyncQueue,
  getMoyskladOrderSyncSettings,
  getOrderMoyskladSyncLog,
  loadMoyskladMetadata,
  processMoyskladOrderSyncJobs,
  retryMoyskladSyncJob,
  saveMoyskladOrderSyncSettings,
  syncOrderToMoyskladManually,
  validateMoyskladConfig,
} from "../lib/moysklad-order-sync";
import {
  getSyncRuntimeSettings,
  saveSyncRuntimeSettings,
  syncRuntimeSettingsInputSchema,
} from "../lib/sync-runtime-settings";
import { defineAbilityFor } from "../../contracts/ability";

const moyskladApi = axios.create({
  baseURL: "https://api.moysklad.ru/api/remap/1.2",
  headers: {
    "Accept-Encoding": "gzip",
  },
});

const syncConfigSchema = z.object({
  selectedStores: z.array(z.string()).default([]),
  selectedCategories: z.array(z.string()).default([]),
  syncProducts: z.boolean().default(true),
  syncStocks: z.boolean().default(true),
  syncPrices: z.boolean().default(true),
});

const orderSyncSettingsSchema = z.object({
  enabled: z.boolean(),
  organizationHref: z.string().trim().default(""),
  storeHref: z.string().trim().default(""),
  salesChannelHref: z.string().trim().default(""),
  createCounterparties: z.boolean(),
  statusMapping: z.record(z.string(), z.string()),
});

async function getActiveSyncProfile() {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(schema.syncProfiles)
    .where(
      and(
        eq(schema.syncProfiles.provider, "moysklad"),
        eq(schema.syncProfiles.isDefault, true)
      )
    )
    .limit(1);
  return profile ?? null;
}

async function getAuthHeader(input: { login?: string; password?: string }): Promise<string> {
  if (input.login && input.password) {
    return `Basic ${Buffer.from(`${input.login}:${input.password}`).toString("base64")}`;
  }
  const storedToken = await getAppSetting("moysklad_token");
  if (storedToken) {
    return storedToken;
  }
  throw new Error("Не указаны учетные данные и токен МойСклад не найден в настройках");
}

// Auto-retry for rate limits (429)
axiosRetry(moyskladApi, { 
  retries: 5, 
  retryDelay: (retryCount) => {
    console.log(`[Rate Limit] Retrying request... Attempt: ${retryCount}`);
    return retryCount * 2000; // 2s, 4s, 6s...
  },
  retryCondition: (error) => {
    return error.response?.status === 429 || error.response?.status === 500;
  }
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type MsRow = Record<string, unknown>;
type MsStoreRow = {
  id: string;
  name: string;
  address?: string | null;
};
type MsFolderRow = {
  id: string;
  name: string;
  productFolder?: {
    meta?: {
      href?: string;
    };
  };
};
type SyncLogDetails = {
  steps: string[];
  errors: string[];
  stats: Record<string, number>;
  logFileUrl: string | null;
};

type SyncProgressSnapshot = {
  phase: string;
  message: string;
  productsProcessed?: number;
  categoriesProcessed?: number;
  stocksProcessed?: number;
  preservedDescriptions?: number;
  normalizedProducts?: number;
  normalizedSpecs?: number;
  normalizationConflicts?: number;
  indexedSpecValues?: number;
  assortmentOffset?: number;
  assortmentBatchSize?: number;
  stockOffset?: number;
  stockBatchSize?: number;
  selectedStoresCount?: number;
  selectedCategoriesCount?: number;
};

const SYNC_LOCK_KEY = "moysklad_full_sync_lock";
const SYNC_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

type SyncLockPayload = {
  owner: string;
  expiresAt: number;
  startedAt: number;
};

function parseLockPayload(raw: string | null): SyncLockPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SyncLockPayload;
    if (!parsed?.owner || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function acquireSyncLock() {
  const db = getDb();
  const owner = randomUUID();
  const now = Date.now();
  const nextPayload: SyncLockPayload = {
    owner,
    startedAt: now,
    expiresAt: now + SYNC_LOCK_TTL_MS,
  };

  const [row] = await db
    .select({ key: schema.appSettings.key, value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SYNC_LOCK_KEY))
    .limit(1);

  if (!row) {
    await db.insert(schema.appSettings).values({
      key: SYNC_LOCK_KEY,
      value: JSON.stringify(nextPayload),
      updatedAt: new Date(),
    });
    return { acquired: true as const, owner };
  }

  const currentPayload = parseLockPayload(row.value);
  if (currentPayload && currentPayload.expiresAt > now) {
    return {
      acquired: false as const,
      reason: "already_running",
      expiresAt: currentPayload.expiresAt,
    };
  }

  await db
    .update(schema.appSettings)
    .set({
      value: JSON.stringify(nextPayload),
      updatedAt: new Date(),
    })
    .where(eq(schema.appSettings.key, SYNC_LOCK_KEY));

  return { acquired: true as const, owner };
}

async function releaseSyncLock(owner: string | null) {
  if (!owner) return;
  const db = getDb();
  const [row] = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SYNC_LOCK_KEY))
    .limit(1);

  const payload = parseLockPayload(row?.value ?? null);
  if (!payload || payload.owner !== owner) return;

  await db
    .update(schema.appSettings)
    .set({ value: null, updatedAt: new Date() })
    .where(eq(schema.appSettings.key, SYNC_LOCK_KEY));
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const apiMessage = (error.response?.data as { errors?: Array<{ error?: string }> } | undefined)
      ?.errors?.[0]?.error;
    return apiMessage || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function asSpecRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, specValue]) => [
      key,
      String(specValue ?? ""),
    ])
  );
}

function getMsIdFromHref(href?: string | null): string | null {
  return href?.split("/").pop()?.split("?")[0] ?? null;
}

function buildSyncProgressSnapshot(
  phase: string,
  message: string,
  stats: Record<string, number>,
  extra: Partial<SyncProgressSnapshot> = {}
): SyncProgressSnapshot {
  return {
    phase,
    message,
    productsProcessed: Number(stats.products ?? 0),
    categoriesProcessed: Number(stats.categories ?? 0),
    stocksProcessed: Number(stats.stocks ?? 0),
    preservedDescriptions: Number(stats.preservedDescriptions ?? 0),
    normalizedProducts: Number(stats.normalizedProducts ?? 0),
    normalizedSpecs: Number(stats.normalizedSpecs ?? 0),
    normalizationConflicts: Number(stats.normalizationConflicts ?? 0),
    indexedSpecValues: Number(stats.indexedSpecValues ?? 0),
    ...extra,
  };
}

function getStaleSyncReason(args: {
  startedAt: Date | string | null | undefined;
  heartbeatAt: Date | string | null | undefined;
  maxDurationMinutes: number;
  heartbeatTimeoutMinutes: number;
}) {
  const startedAt = args.startedAt
    ? args.startedAt instanceof Date
      ? args.startedAt
      : new Date(args.startedAt)
    : null;
  const heartbeatAt = args.heartbeatAt
    ? args.heartbeatAt instanceof Date
      ? args.heartbeatAt
      : new Date(args.heartbeatAt)
    : null;
  const now = Date.now();

  if (
    startedAt &&
    !Number.isNaN(startedAt.getTime()) &&
    now - startedAt.getTime() > args.maxDurationMinutes * 60_000
  ) {
    return `Превышено максимальное время синхронизации (${args.maxDurationMinutes} мин.)`;
  }

  const heartbeatBase = heartbeatAt && !Number.isNaN(heartbeatAt.getTime()) ? heartbeatAt : startedAt;
  if (
    heartbeatBase &&
    !Number.isNaN(heartbeatBase.getTime()) &&
    now - heartbeatBase.getTime() > args.heartbeatTimeoutMinutes * 60_000
  ) {
    return `Пропал heartbeat синхронизации (${args.heartbeatTimeoutMinutes} мин.)`;
  }

  return null;
}

async function fetchAllRows(endpoint: string, authHeader: string, limit = 1000): Promise<MsRow[]> {
  const rows: MsRow[] = [];
  let offset = 0;

  while (true) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const res = await moyskladApi.get(
      `${endpoint}${separator}offset=${offset}&limit=${limit}`,
      { headers: { Authorization: authHeader } }
    );
    const batch: MsRow[] = res.data.rows || [];
    rows.push(...batch);

    if (batch.length < limit) break;
    offset += limit;
  }

  return rows;
}

function normalizeStoreText(value?: string | null): string {
  const base = (value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ");

  return base
    .replace(/\b(проспект|пр-кт|пркт|пр)\b/g, "проспект")
    .replace(/\b(улица|ул)\b/g, "улица")
    .replace(/\b(дом|д)\b/g, "")
    .replace(/\b(торговый центр|тц)\b/g, "тц")
    .replace(/\b(а|б|в)\b(?=\s*$)/g, match => match.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchingLocalStore(msStore: MsStoreRow, localStores: typeof schema.stores.$inferSelect[]) {
  const msName = normalizeStoreText(msStore.name);
  const msAddress = normalizeStoreText(msStore.address);

  if (msStore.id) {
    const sameMsId = localStores.find(localStore => localStore.msId === msStore.id);
    if (sameMsId) return sameMsId;
  }

  return localStores.find(localStore => {
    const localName = normalizeStoreText(localStore.name);
    const localAddress = normalizeStoreText(localStore.address);

    if (msName && localName && msName === localName) return true;
    if (msAddress && localAddress && (msAddress.includes(localAddress) || localAddress.includes(msAddress))) return true;
    if (msName && localName && (msName.includes(localName) || localName.includes(msName))) return true;
    if (msName && localAddress && localAddress.includes(msName)) return true;
    if (msAddress && localName && msAddress.includes(localName)) return true;

    return false;
  });
}

function slugify(text: string): string {
    const ru: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
      'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      ' ': '-', 'ъ': '', 'ь': ''
    };
  
    return text
      .toLowerCase()
      .split('')
      .map(char => ru[char] || (/[a-z0-9-]/.test(char) ? char : ''))
      .join('')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
}

async function downloadImage(
  downloadUrl: string,
  authHeader: string,
  imageId: string,
  folderName: string = "general"
): Promise<string> {
  const baseDir = path.join(process.cwd(), "public", "images", folderName);

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const filePath = path.join(baseDir, `${imageId}.jpg`);
  const relativePath = `/images/${folderName}/${imageId}.jpg`;

  if (fs.existsSync(filePath)) {
    return relativePath;
  }

  try {
    // Retry wrapper for image downloads
    const getWithRetry = async (
      url: string,
      config: AxiosRequestConfig,
      retries = 3
    ): Promise<AxiosResponse> => {
      try {
        return await axios.get(url, config);
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 429 && retries > 0) {
           await delay(3000);
           return getWithRetry(url, config, retries - 1);
        }
        throw err;
      }
    };

    const res302 = await getWithRetry(downloadUrl, {
      headers: { Authorization: authHeader },
      maxRedirects: 0,
      validateStatus: (status: number) => status >= 200 && status < 400,
    });

    let finalUrl = downloadUrl;
    let useConfig: AxiosRequestConfig = { headers: { Authorization: authHeader } };

    if (res302.status === 302 || res302.status === 301) {
      finalUrl = res302.headers.location || downloadUrl;
      useConfig = { headers: {} }; 
    }

    const res = await getWithRetry(finalUrl, {
      ...useConfig,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(filePath);
    res.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(true));
      writer.on("error", reject);
    });

    return relativePath;
  } catch (error: unknown) {
    console.error(`Ошибка скачивания картинки ${imageId}:`, getErrorMessage(error, "Unknown image download error"));
    return "/images/nofoto.jpg";
  }
}

type MsImageRow = {
  id?: string;
  meta?: {
    downloadHref?: string;
  };
};

async function downloadProductImages(
  imageRows: MsImageRow[],
  authHeader: string,
  productMsId: string,
  folderName: string
) {
  const resolvedImages: string[] = [];

  for (const [index, imageRow] of imageRows.entries()) {
    const downloadHref = imageRow.meta?.downloadHref;
    if (!downloadHref) continue;

    const imagePath = await downloadImage(
      downloadHref,
      authHeader,
      imageRow.id || `${productMsId}-${index + 1}`,
      folderName
    );

    if (imagePath !== "/images/nofoto.jpg" && !resolvedImages.includes(imagePath)) {
      resolvedImages.push(imagePath);
    }
  }

  return resolvedImages;
}

export const syncRouter = createRouter({
  listProfiles: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const db = getDb();
    return db
      .select()
      .from(schema.syncProfiles)
      .where(eq(schema.syncProfiles.provider, "moysklad"))
      .orderBy(desc(schema.syncProfiles.isDefault), desc(schema.syncProfiles.updatedAt));
  }),

  upsertProfile: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(2).max(120),
        config: syncConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const db = getDb();
      if (input.id) {
        await db
          .update(schema.syncProfiles)
          .set({
            name: input.name,
            configJson: input.config,
            updatedBy: ctx.user?.id,
            updatedAt: new Date(),
          })
          .where(eq(schema.syncProfiles.id, input.id));
        return { success: true, id: input.id };
      }
      const [res] = await db.insert(schema.syncProfiles).values({
        name: input.name,
        provider: "moysklad",
        configJson: input.config,
        isDefault: false,
        createdBy: ctx.user?.id,
        updatedBy: ctx.user?.id,
      });
      return { success: true, id: res.insertId };
    }),

  setActiveProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const db = getDb();
      await db
        .update(schema.syncProfiles)
        .set({ isDefault: false, updatedAt: new Date(), updatedBy: ctx.user?.id })
        .where(eq(schema.syncProfiles.provider, "moysklad"));
      await db
        .update(schema.syncProfiles)
        .set({ isDefault: true, updatedAt: new Date(), updatedBy: ctx.user?.id })
        .where(eq(schema.syncProfiles.id, input.id));
      return { success: true };
    }),

  deleteProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const db = getDb();
      await db.delete(schema.syncProfiles).where(eq(schema.syncProfiles.id, input.id));
      return { success: true };
    }),

  getSavedConfig: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const profile = await getActiveSyncProfile();
    if (!profile) return syncConfigSchema.parse({});
    try {
      return syncConfigSchema.parse(profile.configJson);
    } catch {
      return syncConfigSchema.parse({});
    }
  }),

  saveConfig: protectedProcedure
    .input(syncConfigSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const db = getDb();
      const active = await getActiveSyncProfile();
      if (active) {
        await db
          .update(schema.syncProfiles)
          .set({
            configJson: input,
            updatedAt: new Date(),
            updatedBy: ctx.user?.id,
          })
          .where(eq(schema.syncProfiles.id, active.id));
        return { success: true, id: active.id };
      }
      const [res] = await db.insert(schema.syncProfiles).values({
        name: "Конфиг по умолчанию",
        provider: "moysklad",
        configJson: input,
        isDefault: true,
        createdBy: ctx.user?.id,
        updatedBy: ctx.user?.id,
      });
      return { success: true, id: res.insertId };
    }),

  getStores: publicQuery
    .input(z.object({ login: z.string().optional(), password: z.string().optional() }))
    .query(async ({ input }) => {
      const authHeader = await getAuthHeader(input);
      try {
        const rows = await fetchAllRows("/entity/store", authHeader);
        return rows.map(r => ({
          id: String(r.id ?? ""),
          name: String(r.name ?? ""),
        }));
      } catch (error: unknown) {
        throw new Error(getErrorMessage(error, "Ошибка получения складов"));
      }
    }),

  getCategories: publicQuery
    .input(z.object({ login: z.string().optional(), password: z.string().optional() }))
    .query(async ({ input }) => {
      const authHeader = await getAuthHeader(input);
      try {
        const rows = await fetchAllRows("/entity/productfolder", authHeader);
        return rows.map(r => {
          const productFolder = r.productFolder as { meta?: { href?: string } } | undefined;
          const parentId = getMsIdFromHref(productFolder?.meta?.href);
          return { id: String(r.id ?? ""), name: String(r.name ?? ""), parentId };
        });
      } catch (error: unknown) {
        throw new Error(getErrorMessage(error, "Ошибка получения категорий"));
      }
    }),

  getLogs: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const db = getDb();
    return await db.select().from(schema.syncLogs).orderBy(desc(schema.syncLogs.createdAt)).limit(50);
  }),

  getSyncLockStatus: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const raw = await getAppSetting(SYNC_LOCK_KEY);
    const payload = parseLockPayload(raw);
    if (!payload) return { locked: false };
    const now = Date.now();
    if (payload.expiresAt <= now) return { locked: false };
    return {
      locked: true,
      owner: payload.owner,
      startedAt: payload.startedAt,
      expiresAt: payload.expiresAt,
      ttlSeconds: Math.max(0, Math.floor((payload.expiresAt - now) / 1000)),
    };
  }),

  getWebhookQueueStats: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const db = getDb();

    const rows = await db
      .select({
        status: schema.webhookEvents.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.provider, "moysklad"))
      .groupBy(schema.webhookEvents.status);

    const recent = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.provider, "moysklad"))
      .orderBy(desc(schema.webhookEvents.createdAt))
      .limit(50);

    const byStatus: Record<string, number> = {};
    for (const row of rows) byStatus[row.status] = Number(row.count ?? 0);

    return { byStatus, recent };
  }),

  processWebhookQueue: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const result = await processMoyskladWebhookQueue(input?.limit ?? 100);
      return { success: true, ...result };
    }),

  runStocksReconcile: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "manage", "Sync");
    const result = await runMoyskladStockReconcile();
    return { success: true, ...result };
  }),

  runFullSyncWatchdogCheck: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "manage", "Sync");
    const result = await runMoyskladFullSyncWatchdog();
    return { success: true, ...result };
  }),

  requestFullSyncStop: protectedProcedure
    .input(
      z
        .object({
          reason: z.string().trim().min(3).max(500).optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const db = getDb();
      const [run] = await db
        .select()
        .from(schema.syncRuns)
        .where(and(eq(schema.syncRuns.runType, "full"), eq(schema.syncRuns.status, "running")))
        .orderBy(desc(schema.syncRuns.startedAt))
        .limit(1);

      if (!run) {
        return { success: true, stopped: false, message: "Активная полная синхронизация не найдена." };
      }

      const reason = input?.reason?.trim() || "Остановлено вручную оператором";
      const message = `Запрошена остановка синхронизации: ${reason}`;

      await db
        .update(schema.syncRuns)
        .set({
          cancelRequested: true,
          abortReason: reason,
          message,
          heartbeatAt: new Date(),
          progressJson: buildSyncProgressSnapshot(
            run.phase ?? "cancelling",
            message,
            (run.statsJson as Record<string, number> | null) ?? {},
            {
              phase: run.phase ?? "cancelling",
              message,
            }
          ),
        })
        .where(eq(schema.syncRuns.id, run.id));

      await db.insert(schema.syncLogs).values({
        type: "moysklad_control",
        status: "running",
        message,
        details: {
          runId: run.id,
          requestedBy: ctx.user?.id ?? null,
          lockOwner: run.lockOwner ?? null,
        },
      });

      return { success: true, stopped: true, runId: run.id, message };
    }),

  clearStaleFullSyncLock: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "manage", "Sync");
    const db = getDb();
    const runtimeSettings = await getSyncRuntimeSettings();
    const rawLock = await getAppSetting(SYNC_LOCK_KEY);
    const payload = parseLockPayload(rawLock);

    if (!payload) {
      return { success: true, cleared: false, message: "Lock уже отсутствует." };
    }

    const [run] = await db
      .select()
      .from(schema.syncRuns)
      .where(and(eq(schema.syncRuns.runType, "full"), eq(schema.syncRuns.status, "running")))
      .orderBy(desc(schema.syncRuns.startedAt))
      .limit(1);

    if (!run) {
      await releaseSyncLock(payload.owner);
      await db.insert(schema.syncLogs).values({
        type: "moysklad_control",
        status: "success",
        message: "Stale lock очищен: активный full sync не найден.",
        details: {
          lockOwner: payload.owner,
          requestedBy: ctx.user?.id ?? null,
        },
      });
      return {
        success: true,
        cleared: true,
        message: "Lock очищен: активный full sync не найден.",
      };
    }

    const staleReason = getStaleSyncReason({
      startedAt: run.startedAt,
      heartbeatAt: run.heartbeatAt,
      maxDurationMinutes: runtimeSettings.fullSyncMaxDurationMinutes,
      heartbeatTimeoutMinutes: runtimeSettings.fullSyncHeartbeatTimeoutMinutes,
    });

    if (!staleReason) {
      throw new Error("Нельзя снять lock: активная синхронизация выглядит живой.");
    }

    if (run.lockOwner && run.lockOwner === payload.owner) {
      await releaseSyncLock(payload.owner);
    } else {
      await setAppSetting(SYNC_LOCK_KEY, null);
    }

    await db.insert(schema.syncLogs).values({
      type: "moysklad_control",
      status: "success",
      message: `Stale lock очищен вручную: ${staleReason}`,
      details: {
        runId: run.id,
        lockOwner: payload.owner,
        runLockOwner: run.lockOwner ?? null,
        requestedBy: ctx.user?.id ?? null,
      },
    });

    return {
      success: true,
      cleared: true,
      message: `Stale lock очищен вручную: ${staleReason}`,
      runId: run.id,
    };
  }),

  getRecentReconcileRuns: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const db = getDb();
    return db
      .select()
      .from(schema.syncRuns)
      .where(eq(schema.syncRuns.runType, "reconcile"))
      .orderBy(desc(schema.syncRuns.startedAt))
      .limit(20);
  }),

  getSyncOverview: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const db = getDb();

    const [lastFullSuccess] = await db
      .select()
      .from(schema.syncRuns)
      .where(and(eq(schema.syncRuns.runType, "full"), eq(schema.syncRuns.status, "success")))
      .orderBy(desc(schema.syncRuns.finishedAt))
      .limit(1);

    const [lastReconcileSuccess] = await db
      .select()
      .from(schema.syncRuns)
      .where(and(eq(schema.syncRuns.runType, "reconcile"), eq(schema.syncRuns.status, "success")))
      .orderBy(desc(schema.syncRuns.finishedAt))
      .limit(1);

    const [failedDeadCounts] = await db
      .select({
        failed: sql<number>`sum(case when ${schema.webhookEvents.status} = 'failed' then 1 else 0 end)`,
        dead: sql<number>`sum(case when ${schema.webhookEvents.status} = 'dead' then 1 else 0 end)`,
      })
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.provider, "moysklad"));

    const [oldestPending] = await db
      .select({ createdAt: schema.webhookEvents.createdAt })
      .from(schema.webhookEvents)
      .where(
        and(
          eq(schema.webhookEvents.provider, "moysklad"),
          inArray(schema.webhookEvents.status, ["new", "failed"])
        )
      )
      .orderBy(sql`${schema.webhookEvents.createdAt} asc`)
      .limit(1);

    const lagMinutes = oldestPending?.createdAt
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(oldestPending.createdAt).getTime()) / 60000)
        )
      : 0;

    return {
      lastFullSuccess: lastFullSuccess?.finishedAt ?? null,
      lastReconcileSuccess: lastReconcileSuccess?.finishedAt ?? null,
      failedCount: Number(failedDeadCounts?.failed ?? 0),
      deadCount: Number(failedDeadCounts?.dead ?? 0),
      webhookLagMinutes: lagMinutes,
    };
  }),

  getCurrentRunStatus: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const db = getDb();
    const [run] = await db
      .select()
      .from(schema.syncRuns)
      .where(and(eq(schema.syncRuns.runType, "full"), eq(schema.syncRuns.status, "running")))
      .orderBy(desc(schema.syncRuns.startedAt))
      .limit(1);

    return run ?? null;
  }),

  getRuntimeSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    return getSyncRuntimeSettings();
  }),

  saveRuntimeSettings: protectedProcedure
    .input(syncRuntimeSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const settings = await saveSyncRuntimeSettings(input);
      return { success: true, settings };
    }),

  getWebhookSetupStatus: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    const db = getDb();
    const secret = (await getAppSetting("moysklad_webhook_secret"))?.trim() ?? "";
    const hasSecret = secret.length > 0;

    const [rows24h] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.webhookEvents)
      .where(
        and(
          eq(schema.webhookEvents.provider, "moysklad"),
          sql`${schema.webhookEvents.createdAt} >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        )
      );

    const [lastEvent] = await db
      .select({ createdAt: schema.webhookEvents.createdAt })
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.provider, "moysklad"))
      .orderBy(desc(schema.webhookEvents.createdAt))
      .limit(1);

    return {
      hasSecret,
      events24h: Number(rows24h?.count ?? 0),
      lastEventAt: lastEvent?.createdAt ?? null,
    };
  }),

  getMoyskladOrderSyncOverview: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    return getMoyskladOrderSyncOverview();
  }),

  getMoyskladOrderSyncSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    return getMoyskladOrderSyncSettings();
  }),

  saveMoyskladOrderSyncSettings: protectedProcedure
    .input(orderSyncSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      await saveMoyskladOrderSyncSettings(input);
      return { success: true };
    }),

  validateMoyskladOrderSyncConfig: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    return validateMoyskladConfig();
  }),

  loadMoyskladOrderMetadata: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Sync");
    return loadMoyskladMetadata();
  }),

  getMoyskladOrderSyncQueue: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(100) }).optional())
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Sync");
      return getMoyskladOrderSyncQueue(input?.limit ?? 100);
    }),

  runMoyskladOrderSyncWorker: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const result = await processMoyskladOrderSyncJobs(input?.limit ?? 10);
      return result;
    }),

  retryMoyskladOrderSyncJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      await retryMoyskladSyncJob(input.jobId);
      return { success: true };
    }),

  syncOrderToMoyskladManually: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      return syncOrderToMoyskladManually(input.orderId);
    }),

  getOrderMoyskladSyncLog: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Sync");
      return getOrderMoyskladSyncLog(input.orderId);
    }),

  retryWebhookEvents: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage", "Sync");
      const db = getDb();
      await db
        .update(schema.webhookEvents)
        .set({
          status: "new",
          processedAt: null,
          lastError: null,
        })
        .where(
          and(
            eq(schema.webhookEvents.provider, "moysklad"),
            inArray(schema.webhookEvents.id, input.ids)
          )
        );

      return { success: true, retried: input.ids.length };
    }),

  wipeCatalog: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "manage", "Sync");
    const db = getDb();
    try {
      // Delete in order to respect dependencies
      await db.execute(sql`DELETE FROM product_stocks`);
      await db.execute(sql`DELETE FROM reviews`);
      await db.execute(sql`DELETE FROM order_items`);
      await db.execute(sql`DELETE FROM products`);
      await db.execute(sql`DELETE FROM categories`);
      return { success: true, message: "Каталог успешно очищен" };
    } catch (error: unknown) {
      throw new Error("Ошибка при очистке каталога: " + getErrorMessage(error, "unknown error"));
    }
  }),

  runSync: protectedProcedure
    .input(z.object({
      login: z.string().optional(),
      password: z.string().optional(),
      syncProducts: z.boolean(),
      syncStocks: z.boolean(),
      syncPrices: z.boolean(),
      selectedStores: z.array(z.string()).optional(),
      selectedCategories: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "sync", "Sync");
      let lockOwner: string | null = null;
      const workerId = `api:${process.pid}`;
      let activeProfile: typeof schema.syncProfiles.$inferSelect | null = null;
      let selectedStores = input.selectedStores;
      let selectedCategories = input.selectedCategories;
      let syncProducts = input.syncProducts;
      let syncStocks = input.syncStocks;
      let syncPrices = input.syncPrices;

      if (
        (!selectedStores || selectedStores.length === 0) &&
        (!selectedCategories || selectedCategories.length === 0)
      ) {
        activeProfile = await getActiveSyncProfile();
        if (activeProfile) {
          try {
            const savedConfig = syncConfigSchema.parse(activeProfile.configJson);
            selectedStores = savedConfig.selectedStores;
            selectedCategories = savedConfig.selectedCategories;
            syncProducts = savedConfig.syncProducts;
            syncStocks = savedConfig.syncStocks;
            syncPrices = savedConfig.syncPrices;
          } catch {
            // ignore invalid saved config
          }
        }
      }
      if (!activeProfile) {
        activeProfile = await getActiveSyncProfile();
      }
      let fileLogContent = `=== Синхронизация МойСклад [${new Date().toISOString()}] ===\n\n`;
      const writeLog = (msg: string) => {
        console.log(msg);
        fileLogContent += `[${new Date().toISOString()}] ${msg}\n`;
      };

      writeLog("Starting filtered MoySklad sync...");
      const authHeader = await getAuthHeader(input);
      const db = getDb();
      
      const logDetails: SyncLogDetails = {
        steps: [],
        errors: [],
        stats: { categories: 0, products: 0, stocks: 0 },
        logFileUrl: null,
      };
      let currentLogId: number | null = null;
      let currentRunId: number | null = null;
      let currentPhase = "starting";
      let nextHeartbeatAt = 0;

      const shouldHeartbeat = () => Date.now() >= nextHeartbeatAt;

      const saveLogFile = () => {
        try {
          const logsDir = path.join(process.cwd(), "public", "logs");
          if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
          const fileName = `sync_${Date.now()}.log`;
          fs.writeFileSync(path.join(logsDir, fileName), fileLogContent);
          logDetails.logFileUrl = `/logs/${fileName}`;
        } catch (e) {
          console.error("Failed to save log file", e);
        }
      };

      const updateRunStatus = async ({
        status,
        message,
        phase,
        progress,
        forceHeartbeat = false,
        finishedAt,
        statsJson,
        abortReason,
      }: {
        status?: "running" | "success" | "error";
        message?: string;
        phase?: string;
        progress?: Partial<SyncProgressSnapshot>;
        forceHeartbeat?: boolean;
        finishedAt?: Date | null;
        statsJson?: Record<string, number>;
        abortReason?: string | null;
      }) => {
        if (!currentRunId) return;
        if (phase) currentPhase = phase;

        const mergedProgress = progress
          ? buildSyncProgressSnapshot(
              currentPhase,
              message ?? progress.message ?? "Синхронизация выполняется",
              logDetails.stats,
              progress
            )
          : undefined;

        const shouldWriteHeartbeatNow = forceHeartbeat || shouldHeartbeat();
        if (!status && !message && !phase && !mergedProgress && !statsJson && !abortReason && !shouldWriteHeartbeatNow) {
          return;
        }

        const patch: Partial<typeof schema.syncRuns.$inferInsert> = {};
        if (status) patch.status = status;
        if (message) patch.message = message;
        if (phase) patch.phase = phase;
        if (mergedProgress) patch.progressJson = mergedProgress;
        if (typeof finishedAt !== "undefined") patch.finishedAt = finishedAt;
        if (statsJson) patch.statsJson = statsJson;
        if (typeof abortReason !== "undefined") patch.abortReason = abortReason;
        if (shouldWriteHeartbeatNow) {
          patch.heartbeatAt = new Date();
          nextHeartbeatAt = Date.now() + 10_000;
        }

        await db
          .update(schema.syncRuns)
          .set(patch)
          .where(eq(schema.syncRuns.id, currentRunId));
      };

      const abortIfStopRequested = async () => {
        if (!currentRunId) return;
        const [runState] = await db
          .select({
            cancelRequested: schema.syncRuns.cancelRequested,
            abortReason: schema.syncRuns.abortReason,
          })
          .from(schema.syncRuns)
          .where(eq(schema.syncRuns.id, currentRunId))
          .limit(1);

        if (!runState?.cancelRequested) return;

        const reason = runState.abortReason?.trim() || "Остановлено вручную оператором";
        throw new Error(`Синхронизация остановлена вручную: ${reason}`);
      };

      try {
        const lock = await acquireSyncLock();
        if (!lock.acquired) {
          const waitUntil = lock.expiresAt ? new Date(lock.expiresAt).toLocaleString("ru-RU") : "";
          throw new Error(
            waitUntil
              ? `Синхронизация уже запущена. Повторите после ${waitUntil}.`
              : "Синхронизация уже запущена."
          );
        }
        lockOwner = lock.owner;

        const [logRes] = await db.insert(schema.syncLogs).values({
            type: 'moysklad',
            status: 'running',
            message: 'Синхронизация запущена',
            details: logDetails
        });
        currentLogId = logRes.insertId;
        const [runRes] = await db.insert(schema.syncRuns).values({
          profileId: activeProfile?.id ?? null,
          runType: "full",
          status: "running",
          message: "Синхронизация запущена",
          phase: "starting",
          configSnapshot: {
            selectedStores,
            selectedCategories,
            syncProducts,
            syncStocks,
            syncPrices,
          },
          progressJson: buildSyncProgressSnapshot(
            "starting",
            "Синхронизация запущена",
            logDetails.stats,
            {
              selectedStoresCount: selectedStores?.length ?? 0,
              selectedCategoriesCount: selectedCategories?.length ?? 0,
            }
          ),
          heartbeatAt: new Date(),
          lockOwner,
          workerId,
        });
        currentRunId = runRes.insertId;
        nextHeartbeatAt = Date.now() + 10_000;

        const updateLog = async (status: string, message: string) => {
            if (currentLogId) {
                await db.update(schema.syncLogs).set({ status, message, details: logDetails }).where(eq(schema.syncLogs.id, currentLogId));
            }
        };

        await abortIfStopRequested();

        // 1. Категории
        const categoryMap = new Map<string, number>();
        if (syncProducts && selectedCategories && selectedCategories.length > 0) {
          logDetails.steps.push("Синхронизация категорий");
          await updateLog('running', 'Синхронизация категорий...');
          await updateRunStatus({
            phase: "categories",
            message: "Синхронизация категорий...",
            progress: {
              phase: "categories",
              message: "Синхронизация категорий...",
              selectedCategoriesCount: selectedCategories.length,
            },
            forceHeartbeat: true,
          });
          writeLog("Fetching folders...");
          
          const msFolders = (await fetchAllRows(
            "/entity/productfolder",
            authHeader
          )) as MsFolderRow[];
          writeLog(`Found ${msFolders.length} folders in MoySklad`);

          for (const msFolder of msFolders) {
            await abortIfStopRequested();
            if (!selectedCategories.includes(msFolder.id)) continue;
            const existing = await db.select().from(schema.categories).where(eq(schema.categories.msId, msFolder.id)).limit(1);
            if (existing.length > 0) {
              await db.update(schema.categories).set({ name: msFolder.name }).where(eq(schema.categories.id, existing[0].id));
              categoryMap.set(msFolder.id, existing[0].id);
            } else {
              const baseSlug = slugify(msFolder.name).substring(0, 200);
              let slug = baseSlug;
              let counter = 1;
              while ((await db.select().from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1)).length > 0) {
                slug = `${baseSlug}-${counter++}`;
              }
              const [res] = await db.insert(schema.categories).values({
                msId: msFolder.id,
                slug,
                name: msFolder.name,
              } as typeof schema.categories.$inferInsert);
              categoryMap.set(msFolder.id, res.insertId);
            }
            logDetails.stats.categories++;
            if (shouldHeartbeat()) {
              await abortIfStopRequested();
              await updateRunStatus({
                progress: {
                  phase: "categories",
                  message: "Синхронизация категорий...",
                  selectedCategoriesCount: selectedCategories.length,
                },
              });
            }
          }

          for (const msFolder of msFolders) {
            if (!selectedCategories.includes(msFolder.id)) continue;
            if (msFolder.productFolder?.meta?.href) {
              const msParentId = getMsIdFromHref(msFolder.productFolder.meta.href);
              if (!msParentId) continue;
              const dbParentId = categoryMap.get(msParentId);
              const dbChildId = categoryMap.get(msFolder.id);
              if (dbParentId && dbChildId) {
                await db.update(schema.categories).set({ parentId: dbParentId }).where(eq(schema.categories.id, dbChildId));
              }
            }
          }
        }

        const allCategories = await db.select().from(schema.categories);

        // 2. Склады (Магазины)
        logDetails.steps.push("Синхронизация складов");
        await updateLog('running', 'Синхронизация складов...');
        await updateRunStatus({
          phase: "stores",
          message: "Синхронизация складов...",
          progress: {
            phase: "stores",
            message: "Синхронизация складов...",
            selectedStoresCount: selectedStores?.length ?? 0,
          },
          forceHeartbeat: true,
        });
        writeLog("Fetching stores...");
        
        let localStores = await db.select().from(schema.stores);
        const msStoreIdToLocalId = new Map<string, number>();
        const allMsStores = await fetchAllRows("/entity/store", authHeader);
        writeLog(`Found ${allMsStores.length} stores in MoySklad`);

        if (selectedStores && selectedStores.length > 0) {
          const selectedMsStores = allMsStores.filter(
            s => selectedStores.includes(String(s.id ?? ""))
          );
          for (const msStore of selectedMsStores) {
            const typedMsStore: MsStoreRow = {
              id: String(msStore.id ?? ""),
              name: String(msStore.name ?? ""),
              address:
                typeof msStore.address === "string" ? msStore.address : null,
            };
            let existing = findMatchingLocalStore(typedMsStore, localStores);
            if (!existing) {
              const [insertRes] = await db.insert(schema.stores).values({
                msId: typedMsStore.id,
                name: typedMsStore.name,
                address: typedMsStore.address || typedMsStore.name,
                hours: "Ежедневно", phone: "+7 (000) 000-00-00", image: "/images/store-placeholder.jpg",
              });
              existing = { id: insertRes.insertId } as typeof schema.stores.$inferSelect;
            } else if (!existing.msId || existing.msId !== msStore.id) {
              await db
                .update(schema.stores)
                .set({ msId: typedMsStore.id })
                .where(eq(schema.stores.id, existing.id));
            }
          }
          localStores = await db.select().from(schema.stores);
        }

        for (const msStore of allMsStores) {
          await abortIfStopRequested();
          const typedMsStore: MsStoreRow = {
            id: String(msStore.id ?? ""),
            name: String(msStore.name ?? ""),
            address:
              typeof msStore.address === "string" ? msStore.address : null,
          };
          const matched = findMatchingLocalStore(typedMsStore, localStores);
          if (matched) {
            msStoreIdToLocalId.set(typedMsStore.id, matched.id);
            if (!matched.msId || matched.msId !== typedMsStore.id) {
              await db
                .update(schema.stores)
                .set({ msId: typedMsStore.id })
                .where(eq(schema.stores.id, matched.id));
            }
          }
        }
        writeLog(`Mapped MS stores to local DB stores: ${Array.from(msStoreIdToLocalId.entries()).map(([k,v]) => `${k}=>${v}`).join(', ')}`);

        // 3. Товары
        logDetails.steps.push("Синхронизация товаров");
        await updateLog('running', 'Синхронизация товаров...');
        await updateRunStatus({
          phase: "products",
          message: "Синхронизация товаров...",
          progress: {
            phase: "products",
            message: "Синхронизация товаров...",
            selectedCategoriesCount: selectedCategories?.length ?? 0,
          },
          forceHeartbeat: true,
        });
        
        let offset = 0;
        const limit = 500;
        let hasMore = true;
        const msProductIdToLocalId = new Map<string, number>();

        const fetchAssortmentWithRetry = async (
          currentOffset: number,
          retries = 5
        ): Promise<AxiosResponse> => {
          try {
            return await moyskladApi.get(`/entity/assortment?offset=${currentOffset}&limit=${limit}`, { headers: { Authorization: authHeader } });
          } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 429 && retries > 0) {
               writeLog(`[Rate Limit] 429 hitting assortment fetch. Retrying in 5 seconds... (${retries} left)`);
               await delay(5000);
               return fetchAssortmentWithRetry(currentOffset, retries - 1);
            }
            throw err;
          }
        };

        while (hasMore) {
          await abortIfStopRequested();
          writeLog(`Fetching assortment offset ${offset}...`);
          const assortmentRes = await fetchAssortmentWithRetry(offset);
          const items = assortmentRes.data.rows;
          await updateRunStatus({
            progress: {
              phase: "products",
              message: "Синхронизация товаров...",
              assortmentOffset: offset,
              assortmentBatchSize: items.length,
              selectedCategoriesCount: selectedCategories?.length ?? 0,
            },
            forceHeartbeat: true,
          });
          if (items.length < limit) hasMore = false;
          offset += limit;

          for (const item of items) {
            await abortIfStopRequested();
            // Respect API rate limits (approx 3 req/sec max)
            await delay(333);

            if (item.meta.type !== "product") continue;
            const msId = item.id;
            const folderIdRaw = item.productFolder?.meta?.href ? item.productFolder.meta.href.split("/").pop() : null;
            const folderId = folderIdRaw ? folderIdRaw.split("?")[0] : null;

            if (selectedCategories && folderId && !selectedCategories.includes(folderId)) continue;

            let categoryId: number | null = null;
            let folderSlug = "general";

            if (folderId) {
                const dbCategory = allCategories.find(c => c.msId === folderId);
                if (dbCategory) {
                    categoryId = dbCategory.id;
                    folderSlug = dbCategory.slug;
                }
            }

            if (!categoryId && allCategories.length > 0) categoryId = allCategories[0].id;

            const price = syncPrices && item.salePrices?.length > 0 ? Math.round(item.salePrices[0].value / 100) : 0;
            const inStock = syncStocks ? (item.stock || 0) > 0 : true;

            const specs: Record<string, string> = {};
            if (item.attributes) {
              for (const attr of item.attributes) {
                let val = attr.value;
                if (typeof val === "object" && val !== null && val.name) val = val.name;
                specs[attr.name] = String(val);
              }
            }

            let imagePath = "/images/nofoto.jpg";
            let imagePaths: string[] = [];
            if (item.images?.meta?.href) {
              try {
                // Must use moyskladApi to get the 429 retry protection
                const imagesRes = await moyskladApi.get(item.images.meta.href, { headers: { Authorization: authHeader } });
                if (imagesRes.data.rows?.length > 0) {
                  imagePaths = await downloadProductImages(
                    imagesRes.data.rows as MsImageRow[],
                    authHeader,
                    msId,
                    folderSlug
                  );
                  if (imagePaths.length > 0) {
                    imagePath = imagePaths[0];
                  }
                }
              } catch (err: unknown) {
                writeLog(
                  `Error fetching image meta for product ${msId}: ${getErrorMessage(err, "unknown error")}`
                );
              }
            }

            const existingProd = await db.select().from(schema.products).where(eq(schema.products.msId, msId)).limit(1);
            let dbProductId: number;

            if (existingProd.length > 0) {
              dbProductId = existingProd[0].id;
              const normalizedLog = await db
                .select({ id: schema.productNormalizationLogs.id })
                .from(schema.productNormalizationLogs)
                .where(sql`${schema.productNormalizationLogs.productId} = ${dbProductId} AND ${schema.productNormalizationLogs.status} = 'applied'`)
                .limit(1);
              const wasNormalized = normalizedLog.length > 0;
              const incomingDescription = item.description || "";
              const localSpecs = asSpecRecord(existingProd[0].specs);
              const updateData: Partial<typeof schema.products.$inferInsert> = { name: item.name };

              if (wasNormalized) {
                const preview = previewProductNormalization(incomingDescription, {
                  ...localSpecs,
                  ...specs,
                });
                updateData.description = existingProd[0].description;
                updateData.specs = preview.mergedSpecs;
                logDetails.stats.preservedDescriptions = (logDetails.stats.preservedDescriptions || 0) + 1;
              } else {
                updateData.description = incomingDescription;
                updateData.specs = specs;
              }

              if (syncPrices) updateData.price = price;
              if (syncPrices) {
                Object.assign(
                  updateData,
                  applyProductAutoBlockState({
                    price,
                    isAutoBlocked: existingProd[0].isAutoBlocked ?? false,
                    autoBlockReason: existingProd[0].autoBlockReason ?? null,
                  })
                );
              }
              if (syncStocks) updateData.inStock = inStock;
              if (categoryId) updateData.categoryId = categoryId;
              if (imagePath !== "/images/nofoto.jpg") updateData.image = imagePath;
              if (imagePaths.length > 0) updateData.images = imagePaths;
              await db.update(schema.products).set(updateData).where(eq(schema.products.id, dbProductId));
            } else {
              const baseSlug = slugify(item.name).substring(0, 200);
              let slug = baseSlug;
              let counter = 1;
              while ((await db.select().from(schema.products).where(eq(schema.products.slug, slug)).limit(1)).length > 0) {
                slug = `${baseSlug}-${counter++}`;
              }

              const [res] = await db.insert(schema.products).values(
                applyProductAutoBlockState({
                  msId,
                  slug,
                  name: item.name,
                  categoryId: categoryId || 1,
                  price,
                  description: item.description || "",
                  image: imagePath,
                  images: imagePaths,
                  specs,
                  inStock,
                  isActive: true,
                })
              );
              dbProductId = res.insertId;
            }
            msProductIdToLocalId.set(msId, dbProductId);
            logDetails.stats.products++;
            if (shouldHeartbeat()) {
              await abortIfStopRequested();
              await updateRunStatus({
                progress: {
                  phase: "products",
                  message: "Синхронизация товаров...",
                  assortmentOffset: offset,
                  assortmentBatchSize: items.length,
                  selectedCategoriesCount: selectedCategories?.length ?? 0,
                },
              });
            }
          }
        }

        // 4. Остатки
        if (syncStocks) {
          const existingProducts = await db
            .select({ id: schema.products.id, msId: schema.products.msId })
            .from(schema.products);
          for (const product of existingProducts) {
            if (product.msId && !msProductIdToLocalId.has(product.msId)) {
              msProductIdToLocalId.set(product.msId, product.id);
            }
          }

          logDetails.steps.push("Синхронизация остатков");
          await updateLog('running', 'Синхронизация остатков...');
          await updateRunStatus({
            phase: "stocks",
            message: "Синхронизация остатков...",
            progress: {
              phase: "stocks",
              message: "Синхронизация остатков...",
              selectedStoresCount: selectedStores?.length ?? 0,
            },
            forceHeartbeat: true,
          });
          writeLog("Fetching detailed stock report by store...");
          await db.execute(sql`DELETE FROM product_stocks`);
          
          let stockOffset = 0;
          let stockHasMore = true;

          const fetchStockWithRetry = async (
            currentOffset: number,
            retries = 5
          ): Promise<AxiosResponse> => {
            try {
              return await moyskladApi.get(`/report/stock/bystore?offset=${currentOffset}&limit=1000`, { headers: { Authorization: authHeader } });
            } catch (err: unknown) {
              if (axios.isAxiosError(err) && err.response?.status === 429 && retries > 0) {
                 writeLog(`[Rate Limit] 429 hitting stock fetch. Retrying in 5 seconds... (${retries} left)`);
                 await delay(5000);
                 return fetchStockWithRetry(currentOffset, retries - 1);
              }
              throw err;
            }
          };

          while (stockHasMore) {
            await abortIfStopRequested();
            writeLog(`Fetching stocks offset ${stockOffset}...`);
            const stockRes = await fetchStockWithRetry(stockOffset);
            const stockItems = stockRes.data.rows;
            writeLog(`Got ${stockItems.length} stock items from API.`);
            await updateRunStatus({
              progress: {
                phase: "stocks",
                message: "Синхронизация остатков...",
                stockOffset,
                stockBatchSize: stockItems.length,
                selectedStoresCount: selectedStores?.length ?? 0,
              },
              forceHeartbeat: true,
            });
            if (stockItems.length < 1000) stockHasMore = false;
            stockOffset += 1000;

            for (const item of stockItems) {
              await abortIfStopRequested();
              // meta.href might look like "https://.../entity/product/cbfcce03-9560-11f0-0a80-10030006c3a6?expand=supplier"
              const msProductId = getMsIdFromHref(item.meta?.href);
              if (!msProductId) {
                writeLog(`[DEBUG SKIP] stock item has no product href: ${JSON.stringify(item.meta)}`);
                continue;
              }

              const localProductId = msProductIdToLocalId.get(msProductId);
              if (!localProductId || !item.stockByStore) {
                 if (!localProductId) writeLog(`[DEBUG SKIP] msProductId ${msProductId} has no mapping to localProductId.`);
                 if (!item.stockByStore) writeLog(`[DEBUG SKIP] item ${msProductId} has no stockByStore array.`);
                 continue;
              }

              for (const storeStock of item.stockByStore) {
                await abortIfStopRequested();
                const quantity = storeStock.stock || 0;
                if (quantity <= 0) continue;
                
                let msStoreId = "";
                let localStoreId: number | undefined;
                if (storeStock.meta?.href) {
                  msStoreId = getMsIdFromHref(storeStock.meta.href) || "";
                }

                if (msStoreId) {
                  localStoreId = msStoreIdToLocalId.get(msStoreId);
                } else {
                  const fallbackMatch = findMatchingLocalStore(
                    { id: "", name: storeStock.name || "", address: storeStock.address || "" },
                    localStores
                  );
                  if (fallbackMatch) {
                    localStoreId = fallbackMatch.id;
                    writeLog(
                      `[DEBUG STOCK] Fallback matched by name/address: "${storeStock.name}" => localStoreId=${localStoreId}`
                    );
                  } else {
                    writeLog(`[DEBUG STOCK] No msStoreId and no fallback match for storeStock: ${JSON.stringify(storeStock)}`);
                    continue;
                  }
                }

                if (
                  msStoreId &&
                  selectedStores &&
                  selectedStores.length > 0 &&
                  !selectedStores.includes(msStoreId)
                ) {
                   writeLog(`[DEBUG STOCK] Store ${msStoreId} has stock but was skipped because it's not in selectedStores.`);
                   continue;
                }
                if (localStoreId) {
                  writeLog(`[DEBUG STOCK] Inserting stock: product=${localProductId}, store=${localStoreId}, qty=${quantity}`);
                  await db.insert(schema.productStocks).values({ productId: localProductId, storeId: localStoreId, quantity });
                  logDetails.stats.stocks++;
                  if (shouldHeartbeat()) {
                    await abortIfStopRequested();
                    await updateRunStatus({
                      progress: {
                        phase: "stocks",
                        message: "Синхронизация остатков...",
                        stockOffset,
                        stockBatchSize: stockItems.length,
                        selectedStoresCount: selectedStores?.length ?? 0,
                      },
                    });
                  }
                } else {
                  writeLog(`[DEBUG STOCK] Missed match: msStoreId=${msStoreId}, storeName=${storeStock.name}. Cannot link to local DB.`);
                }
              }
            }
          }
        }

        if (syncProducts) {
          logDetails.steps.push("Нормализация характеристик");
          await updateLog('running', 'Нормализация характеристик...');
          await updateRunStatus({
            phase: "normalization",
            message: "Нормализация характеристик...",
            progress: {
              phase: "normalization",
              message: "Нормализация характеристик...",
            },
            forceHeartbeat: true,
          });
          writeLog("Normalizing description specs after MoySklad sync...");
          const normalization = await normalizeProductDescriptions({
            limit: 10000,
            examplesLimit: 5,
            source: "moysklad",
            apply: true,
            skipConflicts: true,
            rebuildIndex: true,
          });
          logDetails.stats.normalizedProducts = normalization.appliedProducts;
          logDetails.stats.normalizedSpecs = normalization.movedSpecs;
          logDetails.stats.normalizationConflicts = normalization.conflictCount;
          writeLog(
            `Normalization completed. Applied products: ${normalization.appliedProducts}, moved specs: ${normalization.movedSpecs}, conflicts: ${normalization.conflictCount}`
          );
        } else {
          logDetails.steps.push("Переиндексация характеристик");
          await updateLog('running', 'Переиндексация характеристик...');
          await updateRunStatus({
            phase: "reindex",
            message: "Переиндексация характеристик...",
            progress: {
              phase: "reindex",
              message: "Переиндексация характеристик...",
            },
            forceHeartbeat: true,
          });
          const indexResult = await rebuildProductSpecIndex(10000);
          logDetails.stats.indexedSpecValues = indexResult.indexedValues;
          writeLog(`Spec index rebuilt. Products: ${indexResult.indexedProducts}, values: ${indexResult.indexedValues}`);
        }

        writeLog(`Sync completed successfully. Categories: ${logDetails.stats.categories}, Products: ${logDetails.stats.products}, Stocks: ${logDetails.stats.stocks}`);
        saveLogFile();
        await updateLog('success', 'Синхронизация успешно завершена');
        await updateRunStatus({
          status: "success",
          message: "Синхронизация успешно завершена",
          phase: "completed",
          progress: {
            phase: "completed",
            message: "Синхронизация успешно завершена",
          },
          statsJson: logDetails.stats,
          finishedAt: new Date(),
          forceHeartbeat: true,
        });
        return { success: true, message: "Синхронизация успешно завершена" };
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error, "Ошибка синхронизации");
        writeLog(`[ERROR] ${errorMessage}`);
        if (axios.isAxiosError(error) && error.response?.data) {
          writeLog(`[ERROR DATA] ${JSON.stringify(error.response.data)}`);
        }
        
        saveLogFile();
        logDetails.errors.push(errorMessage);
        if (currentLogId) {
          await db.update(schema.syncLogs).set({
            status: 'error', message: 'Ошибка: ' + errorMessage, details: logDetails
          }).where(eq(schema.syncLogs.id, currentLogId));
        } else {
          await db.insert(schema.syncLogs).values({
            type: 'moysklad', status: 'error', message: 'Ошибка: ' + errorMessage, details: logDetails
          });
        }
        await updateRunStatus({
          status: "error",
          message: errorMessage,
          phase: "error",
          progress: {
            phase: "error",
            message: errorMessage,
          },
          statsJson: logDetails.stats,
          abortReason: errorMessage,
          finishedAt: new Date(),
          forceHeartbeat: true,
        });
        throw new Error(getErrorMessage(error, "Ошибка синхронизации"));
      } finally {
        await releaseSyncLock(lockOwner);
      }
    }),
});

export async function runScheduledFullSync() {
  const db = getDb();
  const [systemUser] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.role, "super_admin"), eq(schema.users.status, "active")))
    .limit(1);

  if (!systemUser) {
    throw new Error("Нет активного super_admin для ночной синхронизации");
  }

  const caller = syncRouter.createCaller({
    req: new Request("http://localhost/internal/nightly-sync"),
    resHeaders: new Headers(),
    user: systemUser,
    ability: defineAbilityFor({ id: systemUser.id, role: systemUser.role }),
  });

  return caller.runSync({
    syncProducts: true,
    syncStocks: true,
    syncPrices: true,
    selectedStores: [],
    selectedCategories: [],
  });
}

