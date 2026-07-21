import { and, asc, desc, eq, isNull, like, lt, or } from "drizzle-orm";
import {
  demandClusterQueries,
  listingDemandClusters,
  listingPages,
  products,
  wordstatSyncRuns,
} from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import { decryptSecret, encryptSecret } from "./secret-crypto";
import { env } from "./env";
import { buildPublicProductVisibilityCondition } from "./product-visibility";

const WORDSTAT_ENDPOINT =
  "https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests";

const SETTING_KEYS = {
  config: "wordstat_config",
  apiKeyEncrypted: "wordstat_api_key_encrypted",
  apiKeyLast4: "wordstat_api_key_last4",
  apiKeySetAt: "wordstat_api_key_set_at",
  lastCheck: "wordstat_last_check",
} as const;

export const wordstatTargetTypes = ["product", "listing"] as const;
export const wordstatQueryDecisions = [
  "suggested",
  "accepted",
  "rejected",
  "needs_review",
] as const;

export type WordstatTargetType = (typeof wordstatTargetTypes)[number];
export type WordstatQueryDecision = (typeof wordstatQueryDecisions)[number];

export type WordstatConfig = {
  enabled: boolean;
  folderId: string;
  regionIds: string[];
  numPhrases: number;
  refreshDays: number;
  maxTargetsPerRun: number;
};

const DEFAULT_CONFIG: WordstatConfig = {
  enabled: false,
  folderId: "",
  regionIds: [],
  numPhrases: 50,
  refreshDays: 30,
  maxTargetsPerRun: 20,
};

type WordstatPhrase = { phrase: string; count: number };

export type MergedWordstatPhrase = WordstatPhrase & {
  kind: "result" | "association";
  rank: number;
};

type WordstatResponse = {
  totalCount?: number;
  results?: Array<{ phrase?: unknown; count?: unknown }>;
  associations?: Array<{ phrase?: unknown; count?: unknown }>;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.trunc(parsed)))
    : fallback;
}

function normalizeConfig(value: Partial<WordstatConfig> | null): WordstatConfig {
  return {
    enabled: value?.enabled ?? DEFAULT_CONFIG.enabled,
    folderId: String(value?.folderId ?? DEFAULT_CONFIG.folderId).trim(),
    regionIds: Array.from(
      new Set(
        (Array.isArray(value?.regionIds) ? value.regionIds : [])
          .map(item => String(item).trim())
          .filter(Boolean)
      )
    ),
    numPhrases: clampInt(value?.numPhrases, 1, 2000, DEFAULT_CONFIG.numPhrases),
    refreshDays: clampInt(value?.refreshDays, 1, 365, DEFAULT_CONFIG.refreshDays),
    maxTargetsPerRun: clampInt(
      value?.maxTargetsPerRun,
      1,
      100,
      DEFAULT_CONFIG.maxTargetsPerRun
    ),
  };
}

export function normalizeWordstatQuery(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeWordstatPhrases(
  results: WordstatPhrase[],
  associations: WordstatPhrase[]
): MergedWordstatPhrase[] {
  const merged = new Map<string, MergedWordstatPhrase>();

  const add = (
    items: WordstatPhrase[],
    kind: MergedWordstatPhrase["kind"]
  ) => {
    items.forEach((item, rank) => {
      const normalized = normalizeWordstatQuery(item.phrase);
      if (!normalized) return;

      const current = merged.get(normalized);
      if (!current) {
        merged.set(normalized, { ...item, kind, rank });
        return;
      }

      merged.set(normalized, {
        phrase:
          current.kind === "result" || kind !== "result"
            ? current.phrase
            : item.phrase,
        count: Math.max(current.count, item.count),
        kind: current.kind === "result" || kind === "result" ? "result" : kind,
        rank:
          current.kind === "result"
            ? current.rank
            : kind === "result"
              ? rank
              : Math.min(current.rank, rank),
      });
    });
  };

  add(results, "result");
  add(associations, "association");
  return Array.from(merged.values());
}

function mapPhrases(value: WordstatResponse["results"]): WordstatPhrase[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => ({
      phrase: String(item?.phrase ?? "").trim(),
      count: Math.max(0, Math.trunc(Number(item?.count ?? 0))),
    }))
    .filter(item => item.phrase && Number.isFinite(item.count));
}

async function getStoredSettings() {
  return getAppSettings(Object.values(SETTING_KEYS));
}

export async function getWordstatAdminSettings() {
  const settings = await getStoredSettings();
  const config = normalizeConfig(
    parseJson<Partial<WordstatConfig>>(settings[SETTING_KEYS.config], {})
  );
  return {
    ...config,
    apiKeyConfigured: Boolean(settings[SETTING_KEYS.apiKeyEncrypted]),
    apiKeyLast4: settings[SETTING_KEYS.apiKeyLast4] ?? null,
    apiKeySetAt: settings[SETTING_KEYS.apiKeySetAt] ?? null,
    encryptionConfigured: Boolean(env.appEncryptionKey.trim()),
    lastCheck: parseJson<Record<string, unknown> | null>(
      settings[SETTING_KEYS.lastCheck],
      null
    ),
  };
}

export async function saveWordstatSettings(input: {
  config: Partial<WordstatConfig>;
  apiKey?: string | null;
}) {
  const current = await getStoredSettings();
  const config = normalizeConfig(input.config);
  await setAppSetting(SETTING_KEYS.config, JSON.stringify(config));

  const apiKey = input.apiKey?.trim();
  if (apiKey) {
    if (!env.appEncryptionKey.trim()) {
      throw new Error(
        "APP_ENCRYPTION_KEY не настроен: сохранить API-ключ безопасно невозможно"
      );
    }
    await Promise.all([
      setAppSetting(
        SETTING_KEYS.apiKeyEncrypted,
        encryptSecret(apiKey, env.appEncryptionKey)
      ),
      setAppSetting(SETTING_KEYS.apiKeyLast4, apiKey.slice(-4)),
      setAppSetting(SETTING_KEYS.apiKeySetAt, new Date().toISOString()),
    ]);
  } else if (!current[SETTING_KEYS.apiKeyEncrypted]) {
    await setAppSetting(SETTING_KEYS.apiKeyLast4, null);
  }

  return getWordstatAdminSettings();
}

async function resolveWordstatCredentials() {
  const settings = await getStoredSettings();
  const config = normalizeConfig(
    parseJson<Partial<WordstatConfig>>(settings[SETTING_KEYS.config], {})
  );
  const encrypted = settings[SETTING_KEYS.apiKeyEncrypted];
  if (!encrypted) throw new Error("API-ключ Wordstat не настроен");
  if (!env.appEncryptionKey.trim()) {
    throw new Error("APP_ENCRYPTION_KEY не настроен");
  }
  if (!config.folderId) throw new Error("Folder ID не настроен");
  return {
    config,
    apiKey: decryptSecret(encrypted, env.appEncryptionKey),
  };
}

async function requestTopQueries(seedQuery: string) {
  const { config, apiKey } = await resolveWordstatCredentials();
  const response = await fetch(WORDSTAT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Api-key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phrase: seedQuery,
      numPhrases: config.numPhrases,
      ...(config.regionIds.length ? { regions: config.regionIds } : {}),
      devices: ["DEVICE_ALL"],
      folderId: config.folderId,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Wordstat HTTP ${response.status}: ${raw.slice(0, 600)}`);
  }
  const payload = parseJson<WordstatResponse>(raw, {});
  return {
    totalCount: Math.max(0, Number(payload.totalCount ?? 0)),
    results: mapPhrases(payload.results),
    associations: mapPhrases(payload.associations),
  };
}

export async function testWordstatConnection(seedQuery = "техника") {
  try {
    const response = await requestTopQueries(seedQuery);
    const result = {
      ok: true,
      checkedAt: new Date().toISOString(),
      message: `Подключение работает, получено фраз: ${response.results.length}`,
      resultCount: response.results.length,
    };
    await setAppSetting(SETTING_KEYS.lastCheck, JSON.stringify(result));
    return result;
  } catch (error) {
    const result = {
      ok: false,
      checkedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      resultCount: 0,
    };
    await setAppSetting(SETTING_KEYS.lastCheck, JSON.stringify(result));
    throw new Error(result.message);
  }
}

async function getTarget(targetType: WordstatTargetType, targetId: number) {
  const db = getDb();
  if (targetType === "product") {
    const [row] = await db
      .select({ id: products.id, name: products.name, slug: products.slug })
      .from(products)
      .where(eq(products.id, targetId))
      .limit(1);
    if (!row) throw new Error("Товар не найден");
    return { ...row, label: row.name, seedQuery: row.name };
  }

  const [row] = await db
    .select({
      id: listingPages.id,
      h1: listingPages.h1,
      title: listingPages.title,
      url: listingPages.url,
    })
    .from(listingPages)
    .where(eq(listingPages.id, targetId))
    .limit(1);
  if (!row) throw new Error("Листинг не найден");
  const seedQuery = (row.h1 || row.title || "").trim();
  if (!seedQuery) throw new Error("У листинга нет H1 или title для исходного запроса");
  return { ...row, label: seedQuery, slug: row.url, seedQuery };
}

async function ensureCluster(
  targetType: WordstatTargetType,
  targetId: number,
  seedQuery: string,
  userId?: number | null
) {
  const db = getDb();
  const targetCondition =
    targetType === "product"
      ? eq(listingDemandClusters.productId, targetId)
      : eq(listingDemandClusters.listingPageId, targetId);
  const [existing] = await db
    .select()
    .from(listingDemandClusters)
    .where(targetCondition)
    .limit(1);
  if (existing) return existing;

  const result = await db.insert(listingDemandClusters).values({
    targetType,
    listingPageId: targetType === "listing" ? targetId : null,
    productId: targetType === "product" ? targetId : null,
    primaryQuery: seedQuery.slice(0, 255),
    source: "yandex_wordstat",
    sourceLabel: "Yandex Wordstat",
    intent: "commercial",
    createdBy: userId ?? null,
    updatedBy: userId ?? null,
  });
  const [created] = await db
    .select()
    .from(listingDemandClusters)
    .where(eq(listingDemandClusters.id, Number(result[0].insertId)))
    .limit(1);
  if (!created) throw new Error("Не удалось создать кластер");
  return created;
}

export async function syncWordstatTarget(args: {
  targetType: WordstatTargetType;
  targetId: number;
  seedQuery?: string | null;
  userId?: number | null;
}) {
  const db = getDb();
  const adminSettings = await getWordstatAdminSettings();
  if (!adminSettings.enabled) {
    throw new Error("Интеграция Wordstat выключена в настройках");
  }
  const target = await getTarget(args.targetType, args.targetId);
  const seedQuery = (args.seedQuery?.trim() || target.seedQuery).slice(0, 512);
  const cluster = await ensureCluster(
    args.targetType,
    args.targetId,
    seedQuery,
    args.userId
  );
  const startedAt = new Date();
  const runInsert = await db.insert(wordstatSyncRuns).values({
    clusterId: cluster.id,
    seedQuery,
    status: "running",
    startedAt,
  });
  const runId = Number(runInsert[0].insertId);

  try {
    const response = await requestTopQueries(seedQuery);
    const fetchedAt = new Date();
    const phrases = mergeWordstatPhrases(
      response.results,
      response.associations
    );
    const settings = await getWordstatAdminSettings();
    for (const phrase of phrases) {
      const normalizedQuery = normalizeWordstatQuery(phrase.phrase);
      if (!normalizedQuery) continue;
      await db
        .insert(demandClusterQueries)
        .values({
          clusterId: cluster.id,
          query: phrase.phrase.slice(0, 512),
          normalizedQuery: normalizedQuery.slice(0, 512),
          kind: phrase.kind,
          count30d: phrase.count,
          decision: "suggested",
          source: "yandex_wordstat",
          rank: phrase.rank,
          regionIdsJson: settings.regionIds,
          fetchedAt,
          updatedAt: fetchedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            query: phrase.phrase.slice(0, 512),
            kind: phrase.kind,
            count30d: phrase.count,
            rank: phrase.rank,
            regionIdsJson: settings.regionIds,
            fetchedAt,
            updatedAt: fetchedAt,
          },
        });
    }

    await Promise.all([
      db
        .update(listingDemandClusters)
        .set({
          targetType: args.targetType,
          primaryQuery: seedQuery.slice(0, 255),
          source: "yandex_wordstat",
          sourceLabel: "Yandex Wordstat",
          impressions: response.totalCount,
          lastImportedAt: fetchedAt,
          lastSyncedAt: fetchedAt,
          updatedBy: args.userId ?? null,
          updatedAt: fetchedAt,
        })
        .where(eq(listingDemandClusters.id, cluster.id)),
      db
        .update(wordstatSyncRuns)
        .set({
          status: "completed",
          resultCount: response.results.length,
          associationCount: response.associations.length,
          finishedAt: fetchedAt,
        })
        .where(eq(wordstatSyncRuns.id, runId)),
    ]);
    return {
      clusterId: cluster.id,
      seedQuery,
      resultCount: response.results.length,
      associationCount: response.associations.length,
      totalCount: response.totalCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(wordstatSyncRuns)
      .set({ status: "failed", errorMessage: message, finishedAt: new Date() })
      .where(eq(wordstatSyncRuns.id, runId));
    throw error;
  }
}

export async function listWordstatTargets(args: {
  targetType: WordstatTargetType;
  search?: string;
  limit?: number;
  staleBefore?: Date;
}) {
  const db = getDb();
  const limit = clampInt(args.limit, 1, 100, 30);
  const search = args.search?.trim();
  if (args.targetType === "product") {
    return db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        clusterId: listingDemandClusters.id,
        primaryQuery: listingDemandClusters.primaryQuery,
        lastSyncedAt: listingDemandClusters.lastSyncedAt,
      })
      .from(products)
      .leftJoin(
        listingDemandClusters,
        and(
          eq(listingDemandClusters.targetType, "product"),
          eq(listingDemandClusters.productId, products.id)
        )
      )
      .where(
        and(
          buildPublicProductVisibilityCondition(),
          args.staleBefore
            ? or(
                isNull(listingDemandClusters.lastSyncedAt),
                lt(listingDemandClusters.lastSyncedAt, args.staleBefore)
              )
            : undefined,
          search
            ? or(like(products.name, `%${search}%`), like(products.slug, `%${search}%`))
            : undefined
        )
      )
      .orderBy(asc(listingDemandClusters.lastSyncedAt), asc(products.name))
      .limit(limit);
  }

  return db
    .select({
      id: listingPages.id,
      name: listingPages.h1,
      slug: listingPages.url,
      clusterId: listingDemandClusters.id,
      primaryQuery: listingDemandClusters.primaryQuery,
      lastSyncedAt: listingDemandClusters.lastSyncedAt,
    })
    .from(listingPages)
    .leftJoin(
      listingDemandClusters,
      and(
        eq(listingDemandClusters.targetType, "listing"),
        eq(listingDemandClusters.listingPageId, listingPages.id)
      )
    )
    .where(
      and(
        eq(listingPages.isPublished, true),
        args.staleBefore
          ? or(
              isNull(listingDemandClusters.lastSyncedAt),
              lt(listingDemandClusters.lastSyncedAt, args.staleBefore)
            )
          : undefined,
        search
          ? or(like(listingPages.h1, `%${search}%`), like(listingPages.url, `%${search}%`))
          : undefined
      )
    )
    .orderBy(asc(listingDemandClusters.lastSyncedAt), asc(listingPages.h1))
    .limit(limit);
}

export async function getWordstatCluster(args: {
  targetType: WordstatTargetType;
  targetId: number;
}) {
  const db = getDb();
  const target = await getTarget(args.targetType, args.targetId);
  const condition =
    args.targetType === "product"
      ? eq(listingDemandClusters.productId, args.targetId)
      : eq(listingDemandClusters.listingPageId, args.targetId);
  const [cluster] = await db
    .select()
    .from(listingDemandClusters)
    .where(condition)
    .limit(1);
  if (!cluster) return { target, cluster: null, queries: [], runs: [] };
  const [queries, runs] = await Promise.all([
    db
      .select()
      .from(demandClusterQueries)
      .where(eq(demandClusterQueries.clusterId, cluster.id))
      .orderBy(desc(demandClusterQueries.count30d), asc(demandClusterQueries.rank)),
    db
      .select()
      .from(wordstatSyncRuns)
      .where(eq(wordstatSyncRuns.clusterId, cluster.id))
      .orderBy(desc(wordstatSyncRuns.startedAt))
      .limit(10),
  ]);
  return { target, cluster, queries, runs };
}

export async function setWordstatQueryDecision(args: {
  queryId: number;
  decision: WordstatQueryDecision;
}) {
  const db = getDb();
  await db
    .update(demandClusterQueries)
    .set({ decision: args.decision, updatedAt: new Date() })
    .where(eq(demandClusterQueries.id, args.queryId));
  return { success: true };
}

export async function syncWordstatBatch(args: {
  targetType: WordstatTargetType;
  userId?: number | null;
}) {
  const settings = await getWordstatAdminSettings();
  if (!settings.enabled) {
    throw new Error("Интеграция Wordstat выключена в настройках");
  }

  const targets = await listWordstatTargets({
    targetType: args.targetType,
    limit: settings.maxTargetsPerRun,
    staleBefore: new Date(
      Date.now() - settings.refreshDays * 24 * 60 * 60 * 1000
    ),
  });
  const results: Array<{
    targetId: number;
    label: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const target of targets) {
    const label = target.name || target.slug || `#${target.id}`;
    try {
      await syncWordstatTarget({
        targetType: args.targetType,
        targetId: target.id,
        userId: args.userId,
      });
      results.push({ targetId: target.id, label, ok: true });
    } catch (error) {
      results.push({
        targetId: target.id,
        label,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter(item => item.ok).length,
    failed: results.filter(item => !item.ok).length,
    results,
  };
}

let maintenanceCycleRunning = false;

export async function runWordstatMaintenanceCycle() {
  if (maintenanceCycleRunning) {
    return { skipped: true, reason: "already_running" as const };
  }

  maintenanceCycleRunning = true;
  try {
    const settings = await getWordstatAdminSettings();
    if (!settings.enabled) {
      return { skipped: true, reason: "disabled" as const };
    }

    const productsResult = await syncWordstatBatch({ targetType: "product" });
    const listingsResult = await syncWordstatBatch({ targetType: "listing" });
    return {
      skipped: false,
      products: productsResult,
      listings: listingsResult,
    };
  } finally {
    maintenanceCycleRunning = false;
  }
}
