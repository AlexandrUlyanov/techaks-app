import { and, desc, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import { getAppSetting, setAppSetting } from "./app-settings";
import { getSyncRuntimeSettings } from "./sync-runtime-settings";

const SYNC_LOCK_KEY = "moysklad_full_sync_lock";

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

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStaleReason(args: {
  startedAt: Date | null;
  heartbeatAt: Date | null;
  maxDurationMinutes: number;
  heartbeatTimeoutMinutes: number;
}) {
  const now = Date.now();
  const startedAtMs = args.startedAt?.getTime() ?? null;
  const heartbeatAtMs = (args.heartbeatAt ?? args.startedAt)?.getTime() ?? null;

  if (
    startedAtMs !== null &&
    now - startedAtMs > args.maxDurationMinutes * 60_000
  ) {
    return `Превышено максимальное время синхронизации (${args.maxDurationMinutes} мин.)`;
  }

  if (
    heartbeatAtMs !== null &&
    now - heartbeatAtMs > args.heartbeatTimeoutMinutes * 60_000
  ) {
    return `Пропал heartbeat синхронизации (${args.heartbeatTimeoutMinutes} мин.)`;
  }

  return null;
}

export async function runMoyskladFullSyncWatchdog() {
  const db = getDb();
  const settings = await getSyncRuntimeSettings();
  const runningRuns = await db
    .select()
    .from(schema.syncRuns)
    .where(and(eq(schema.syncRuns.runType, "full"), eq(schema.syncRuns.status, "running")))
    .orderBy(desc(schema.syncRuns.startedAt));

  if (runningRuns.length === 0) {
    return {
      checkedRuns: 0,
      staleRuns: 0,
      recoveredRuns: [] as number[],
      releasedLockOwners: [] as string[],
    };
  }

  const currentLock = parseLockPayload(await getAppSetting(SYNC_LOCK_KEY));
  const recoveredRuns: number[] = [];
  const releasedLockOwners: string[] = [];

  for (const run of runningRuns) {
    const startedAt = toDate(run.startedAt);
    const heartbeatAt = toDate(run.heartbeatAt);
    const staleReason = getStaleReason({
      startedAt,
      heartbeatAt,
      maxDurationMinutes: settings.fullSyncMaxDurationMinutes,
      heartbeatTimeoutMinutes: settings.fullSyncHeartbeatTimeoutMinutes,
    });

    if (!staleReason) continue;

    const message = `Синхронизация остановлена watchdog: ${staleReason}`;
    await db
      .update(schema.syncRuns)
      .set({
        status: "error",
        phase: "watchdog_recovered",
        message,
        abortReason: message,
        finishedAt: new Date(),
        heartbeatAt: new Date(),
        progressJson: {
          phase: "watchdog_recovered",
          message,
          productsProcessed: Number((run.statsJson as Record<string, unknown> | null)?.products ?? 0),
          categoriesProcessed: Number((run.statsJson as Record<string, unknown> | null)?.categories ?? 0),
          stocksProcessed: Number((run.statsJson as Record<string, unknown> | null)?.stocks ?? 0),
        },
      })
      .where(eq(schema.syncRuns.id, run.id));

    const staleLogs = await db
      .select({ id: schema.syncLogs.id, details: schema.syncLogs.details })
      .from(schema.syncLogs)
      .where(
        and(
          eq(schema.syncLogs.type, "moysklad"),
          eq(schema.syncLogs.status, "running")
        )
      )
      .orderBy(desc(schema.syncLogs.createdAt));

    const staleLog = staleLogs[0] ?? null;
    if (staleLog) {
      const updatedDetails = {
        ...(staleLog.details && typeof staleLog.details === "object" && !Array.isArray(staleLog.details)
          ? (staleLog.details as Record<string, unknown>)
          : {}),
        runId: run.id,
        watchdogRecovered: true,
        watchdogReason: staleReason,
      };
      await db
        .update(schema.syncLogs)
        .set({
          status: "error",
          message,
          details: updatedDetails,
        })
        .where(eq(schema.syncLogs.id, staleLog.id));
    }

    await db.insert(schema.syncLogs).values({
      type: "moysklad_watchdog",
      status: "error",
      message,
      details: {
        runId: run.id,
        lockOwner: run.lockOwner ?? null,
        workerId: run.workerId ?? null,
        startedAt: startedAt?.toISOString() ?? null,
        heartbeatAt: heartbeatAt?.toISOString() ?? null,
      },
    });

    recoveredRuns.push(run.id);

    if (
      currentLock &&
      run.lockOwner &&
      currentLock.owner === run.lockOwner
    ) {
      await setAppSetting(SYNC_LOCK_KEY, null);
      releasedLockOwners.push(run.lockOwner);
    }
  }

  return {
    checkedRuns: runningRuns.length,
    staleRuns: recoveredRuns.length,
    recoveredRuns,
    releasedLockOwners,
  };
}
