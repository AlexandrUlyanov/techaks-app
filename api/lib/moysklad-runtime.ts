import { randomUUID } from "node:crypto";
import { getAppSetting, setAppSetting } from "./app-settings";

const FULL_SYNC_LOCK_KEY = "moysklad_full_sync_lock";
const ORDER_SYNC_WORKER_LOCK_KEY = "moysklad_order_sync_worker_lock";
const RECONCILE_WORKER_LOCK_KEY = "moysklad_reconcile_worker_lock";
const WEBHOOK_WORKER_LOCK_KEY = "moysklad_webhook_worker_lock";
const PRESSURE_SNAPSHOT_KEY = "moysklad_runtime_pressure_json";
const ORDER_METADATA_CACHE_KEY = "moysklad_order_metadata_cache_json";

const DEFAULT_WORKER_LOCK_TTL_MS = 10 * 60_000;

type WorkerLockPayload = {
  owner: string;
  startedAt: number;
  expiresAt: number;
};

type PressureLevel = "normal" | "elevated" | "high";
type PressureErrorKind = "rate_limit" | "timeout" | "network" | "server" | "unknown";

export type MoyskladPressureSnapshot = {
  level: PressureLevel;
  fullSyncActive: boolean;
  orderSyncSlowed: boolean;
  backoffUntil: string | null;
  lastErrorKind: PressureErrorKind | null;
  lastEndpoint: string | null;
  lastMessage: string | null;
  lastRequestId: string | null;
  lastSeenAt: string | null;
  retryCount: number;
  rateLimitCount: number;
  timeoutCount: number;
  networkCount: number;
  serverCount: number;
};

type PressureEvent = {
  kind: PressureErrorKind;
  endpoint?: string | null;
  message?: string | null;
  requestId?: string | null;
  retry?: boolean;
  backoffMs?: number | null;
  fullSyncActive?: boolean;
  orderSyncSlowed?: boolean;
};

type CachedValue<T> = {
  cachedAt: number;
  ttlMs: number;
  value: T;
};

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseWorkerLock(raw: string | null) {
  const payload = parseJson<WorkerLockPayload>(raw);
  if (!payload?.owner || !payload?.expiresAt) return null;
  return payload;
}

function getBasePressureSnapshot(): MoyskladPressureSnapshot {
  return {
    level: "normal",
    fullSyncActive: false,
    orderSyncSlowed: false,
    backoffUntil: null,
    lastErrorKind: null,
    lastEndpoint: null,
    lastMessage: null,
    lastRequestId: null,
    lastSeenAt: null,
    retryCount: 0,
    rateLimitCount: 0,
    timeoutCount: 0,
    networkCount: 0,
    serverCount: 0,
  };
}

function computePressureLevel(snapshot: Omit<MoyskladPressureSnapshot, "level">): PressureLevel {
  if (snapshot.rateLimitCount > 0 || snapshot.timeoutCount >= 3 || snapshot.serverCount >= 3) {
    return "high";
  }
  if (snapshot.networkCount > 0 || snapshot.timeoutCount > 0 || snapshot.retryCount > 0) {
    return "elevated";
  }
  return "normal";
}

export async function isFullSyncActive() {
  const payload = parseWorkerLock(await getAppSetting(FULL_SYNC_LOCK_KEY));
  return Boolean(payload && payload.expiresAt > Date.now());
}

export async function acquireMoyskladWorkerLock(
  key:
    | "order_sync"
    | "reconcile"
    | "webhook",
  ttlMs = DEFAULT_WORKER_LOCK_TTL_MS
) {
  const settingKey =
    key === "order_sync"
      ? ORDER_SYNC_WORKER_LOCK_KEY
      : key === "reconcile"
        ? RECONCILE_WORKER_LOCK_KEY
        : WEBHOOK_WORKER_LOCK_KEY;
  const existing = parseWorkerLock(await getAppSetting(settingKey));
  if (existing && existing.expiresAt > Date.now()) {
    return null;
  }

  const payload: WorkerLockPayload = {
    owner: randomUUID(),
    startedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  await setAppSetting(settingKey, JSON.stringify(payload));
  return payload;
}

export async function releaseMoyskladWorkerLock(
  key: "order_sync" | "reconcile" | "webhook",
  owner: string | null | undefined
) {
  if (!owner) return;
  const settingKey =
    key === "order_sync"
      ? ORDER_SYNC_WORKER_LOCK_KEY
      : key === "reconcile"
        ? RECONCILE_WORKER_LOCK_KEY
        : WEBHOOK_WORKER_LOCK_KEY;
  const existing = parseWorkerLock(await getAppSetting(settingKey));
  if (existing?.owner !== owner) return;
  await setAppSetting(settingKey, null);
}

export async function getMoyskladPressureSnapshot(): Promise<MoyskladPressureSnapshot> {
  const snapshot =
    parseJson<MoyskladPressureSnapshot>(await getAppSetting(PRESSURE_SNAPSHOT_KEY)) ??
    getBasePressureSnapshot();
  const fullSyncActive = await isFullSyncActive();

  return {
    ...snapshot,
    fullSyncActive,
    orderSyncSlowed: snapshot.orderSyncSlowed && fullSyncActive,
    level: computePressureLevel({
      ...snapshot,
      fullSyncActive,
      orderSyncSlowed: snapshot.orderSyncSlowed && fullSyncActive,
    }),
  };
}

export async function reportMoyskladPressure(event: PressureEvent) {
  const current = await getMoyskladPressureSnapshot();
  const fullSyncActive =
    typeof event.fullSyncActive === "boolean" ? event.fullSyncActive : current.fullSyncActive;
  const orderSyncSlowed =
    typeof event.orderSyncSlowed === "boolean" ? event.orderSyncSlowed : current.orderSyncSlowed;

  const next: Omit<MoyskladPressureSnapshot, "level"> = {
    fullSyncActive,
    orderSyncSlowed,
    backoffUntil:
      typeof event.backoffMs === "number" && event.backoffMs > 0
        ? new Date(Date.now() + event.backoffMs).toISOString()
        : current.backoffUntil,
    lastErrorKind: event.kind,
    lastEndpoint: event.endpoint?.trim() || current.lastEndpoint,
    lastMessage: event.message?.trim() || current.lastMessage,
    lastRequestId: event.requestId?.trim() || current.lastRequestId,
    lastSeenAt: new Date().toISOString(),
    retryCount: current.retryCount + (event.retry ? 1 : 0),
    rateLimitCount: current.rateLimitCount + (event.kind === "rate_limit" ? 1 : 0),
    timeoutCount: current.timeoutCount + (event.kind === "timeout" ? 1 : 0),
    networkCount: current.networkCount + (event.kind === "network" ? 1 : 0),
    serverCount: current.serverCount + (event.kind === "server" ? 1 : 0),
  };

  const snapshot: MoyskladPressureSnapshot = {
    ...next,
    level: computePressureLevel(next),
  };
  await setAppSetting(PRESSURE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function updateMoyskladRuntimeFlags(input: {
  fullSyncActive?: boolean;
  orderSyncSlowed?: boolean;
}) {
  const current = await getMoyskladPressureSnapshot();
  const next: Omit<MoyskladPressureSnapshot, "level"> = {
    ...current,
    fullSyncActive:
      typeof input.fullSyncActive === "boolean" ? input.fullSyncActive : current.fullSyncActive,
    orderSyncSlowed:
      typeof input.orderSyncSlowed === "boolean" ? input.orderSyncSlowed : current.orderSyncSlowed,
  };

  await setAppSetting(
    PRESSURE_SNAPSHOT_KEY,
    JSON.stringify({
      ...next,
      level: computePressureLevel(next),
    } satisfies MoyskladPressureSnapshot)
  );
}

export async function getCachedMoyskladOrderMetadata<T>() {
  const payload = parseJson<CachedValue<T>>(await getAppSetting(ORDER_METADATA_CACHE_KEY));
  if (!payload?.cachedAt || !payload?.ttlMs) return null;
  if (Date.now() - payload.cachedAt > payload.ttlMs) return null;
  return payload.value;
}

export async function setCachedMoyskladOrderMetadata<T>(value: T, ttlMs: number) {
  const payload: CachedValue<T> = {
    cachedAt: Date.now(),
    ttlMs,
    value,
  };
  await setAppSetting(ORDER_METADATA_CACHE_KEY, JSON.stringify(payload));
}
