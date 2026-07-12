import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  bonusTransactions,
  loyaltyBonusHolds,
  loyaltySyncJobs,
  loyaltySyncLogs,
  orders,
  users,
} from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import { env } from "./env";
import { decryptSecret, encryptSecret } from "./secret-crypto";
import { getMoyskladClient, MoyskladApiError } from "./moysklad-client";
import {
  buildLoyaltyJobActiveKey,
  buildLoyaltyPosAuthHeaders,
  getLoyaltyAvailability,
  readScopedNumber,
} from "./loyalty-domain";

const LOYALTY_SETTING_KEYS = [
  "loyalty_enabled",
  "loyalty_group_name",
  "loyalty_participant_tag",
  "loyalty_default_max_writeoff_percent",
  "loyalty_sync_mode",
  "loyalty_pos_cashier_uid",
  "loyalty_pos_store_uid",
  "loyalty_pos_token_encrypted",
  "loyalty_pos_token_last4",
  "loyalty_pos_token_set_at",
  "loyalty_pos_last_check_ok",
  "loyalty_pos_last_check_at",
  "loyalty_pos_last_check_message",
] as const;

const DEFAULT_LOYALTY_GROUP_NAME = "техакс";
const DEFAULT_MAX_WRITEOFF_PERCENT = 30;
const POS_API_BASE_URL = "https://online.moysklad.ru/api/posap/1.0";
const LOYALTY_JOB_LOCK_KEY = "loyalty_sync_worker_lock";
const LOYALTY_JOB_LOCK_TTL_MS = 10 * 60_000;
const LOYALTY_STALE_SYNC_MS = 6 * 60 * 60_000;
const MAX_LOYALTY_JOB_ATTEMPTS = 6;

type LoyaltySyncStatus = "success" | "error" | "skipped";
type LoyaltyJobStatus = "pending" | "processing" | "success" | "error";
type LoyaltyJobType =
  | "customer_loyalty_sync"
  | "order_loyalty_sync"
  | "loyalty_retry_failed"
  | "loyalty_balance_refresh";

type CounterpartyRecord = {
  id?: string;
  version?: number;
  externalCode?: string | null;
  name?: string;
  phone?: string;
  email?: string;
  tags?: string[];
  companyType?: string;
  updated?: string;
  meta?: {
    href?: string;
  };
};

type BonusPreviewResult = {
  enabled: boolean;
  participant: boolean;
  source: "moysklad" | "fallback" | "disabled";
  balance: number;
  availableToSpend: number;
  pendingAccrual: number;
  maxWriteoffPercent: number;
  maxWriteoffAmount: number;
  requestedAmount: number;
  appliedAmount: number;
  expectedAccrualAmount: number;
  subtotal: number;
  totalAfterWriteoff: number;
  warning: string | null;
  dataFresh: boolean;
  canSpend: boolean;
  groupName: string;
  programName: string | null;
  rawPayload?: Record<string, unknown> | null;
  rulesSnapshot?: Record<string, unknown> | null;
};

type LoyaltyState = {
  enabled: boolean;
  participant: boolean;
  status: string | null;
  groupName: string;
  participantTag: string;
  balance: number;
  availableToSpend: number;
  pendingAccrual: number;
  programName: string | null;
  maxWriteoffPercent: number;
  expectedAccrualPercent: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
  counterpartyId: string | null;
  counterpartyHref: string | null;
  rawPayload?: Record<string, unknown> | null;
  rulesSnapshot?: Record<string, unknown> | null;
  dataFresh?: boolean;
  canSpend?: boolean;
  availabilityReason?: string | null;
};

type LoyaltyRuntimeSettings = {
  enabled: boolean;
  groupName: string;
  participantTag: string;
  fallbackMaxWriteoffPercent: number;
  syncMode: "tag";
  posCashierUid: string;
  posStoreUid: string;
  posToken: string;
};

type LoyaltyOrderSnapshot = {
  balanceBefore: number;
  requestedAmount: number;
  appliedAmount: number;
  expectedAccrualAmount: number;
  percentApplied: number;
  programSnapshot: Record<string, unknown> | null;
  previewPayload: Record<string, unknown> | null;
  rulesSnapshot: Record<string, unknown> | null;
};

type LoyaltyOrderRecord = {
  id: number;
  userId: number | null;
  orderNumber: string | null;
  status: string;
  paymentStatus: string;
  subtotal: number;
  totalPrice: number;
  loyaltyBalanceBefore: number;
  loyaltyBonusRequested: number;
  loyaltyBonusSpent: number;
  loyaltyBonusAccrued: number;
  loyaltyBonusExpectedAccrued: number;
  loyaltyActualSpent: number;
  loyaltyActualAccrued: number;
  loyaltySyncStatus: string;
  loyaltyProgramSnapshotJson: Record<string, unknown> | null;
  loyaltyPreviewPayloadJson: Record<string, unknown> | null;
  loyaltyRulesSnapshotJson: Record<string, unknown> | null;
  moyskladOrderHref: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type LoyaltySyncOutcome = {
  actualSpent: number;
  actualAccrued: number;
  syncStatus: "pending" | "synced" | "cancelled" | "rolled_back" | "error";
  syncError: string | null;
  rawPayload: Record<string, unknown> | null;
  stateAfter: LoyaltyState | null;
  debitStatus: "pending" | "applied" | "cancelled" | "error";
  accrualStatus: "pending" | "applied" | "cancelled" | "error";
  needsRefundTransaction: boolean;
  needsAccrualRollback: boolean;
};

type WorkerLockPayload = {
  owner: string;
  startedAt: number;
  expiresAt: number;
};

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parsePositiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value?.trim() || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function sanitizePhoneForSearch(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits || value.trim();
}

function normalizeTagList(input: string[] | undefined, requiredTag: string) {
  const set = new Set(
    (input ?? [])
      .map(item => item.trim())
      .filter(Boolean)
  );
  set.add(requiredTag);
  return Array.from(set);
}

function toMoyskladApiPath(href: string) {
  const normalizedHref = href.trim();
  if (!normalizedHref) return "";
  const apiPrefix = "https://api.moysklad.ru/api/remap/1.2";
  if (normalizedHref.startsWith(apiPrefix)) {
    return normalizedHref.slice(apiPrefix.length) || "";
  }
  try {
    const url = new URL(normalizedHref);
    return `${url.pathname}${url.search}`;
  } catch {
    return normalizedHref;
  }
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractNumberByKnownKeys(input: unknown, keys: string[]): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string") {
    const normalized = input.replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const nested = extractNumberByKnownKeys(item, keys);
      if (nested !== null) return nested;
    }
    return null;
  }
  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    for (const key of keys) {
      if (key in record) {
        const nested = extractNumberByKnownKeys(record[key], keys);
        if (nested !== null) return nested;
      }
    }
    for (const value of Object.values(record)) {
      const nested = extractNumberByKnownKeys(value, keys);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function buildExpectedAccrual(subtotal: number, rawPayload: Record<string, unknown> | null) {
  const explicitAmount = readScopedNumber(rawPayload, [
    "expectedAccrualAmount",
    "bonusAccrualAmount",
    "expectedBonusAmount",
    "bonusPointsToAccrue",
  ]);

  if (explicitAmount !== null) {
    return clampInt(explicitAmount, 0, 10_000_000);
  }

  const percent = readScopedNumber(rawPayload, [
    "accrualPercent",
    "bonusAccrualPercent",
    "bonusPercent",
    "cashbackPercent",
    "rewardPercent",
  ]);

  if (percent !== null && subtotal > 0) {
    return clampInt((subtotal * percent) / 100, 0, 10_000_000);
  }

  return 0;
}

function buildRulesSnapshot(
  rawPayload: Record<string, unknown> | null,
  fallbackMaxWriteoffPercent: number,
  subtotal: number
) {
  const maxWriteoffPercent = clampInt(
    readScopedNumber(rawPayload, [
      "maxSalePaymentPercent",
      "maxPaymentPercent",
      "maxPayPercent",
      "payBonusPercent",
      "bonusPayPercent",
      "writeOffPercent",
    ]) ?? fallbackMaxWriteoffPercent,
    1,
    100
  );

  const expectedAccrualAmount = buildExpectedAccrual(subtotal, rawPayload);
  const expectedAccrualPercent = clampInt(
    readScopedNumber(rawPayload, [
      "accrualPercent",
      "bonusAccrualPercent",
      "bonusPercent",
      "cashbackPercent",
      "rewardPercent",
    ]) ?? 0,
    0,
    100
  );

  return {
    source: rawPayload ? "moysklad" : "fallback",
    maxWriteoffPercent,
    expectedAccrualAmount,
    expectedAccrualPercent,
  };
}

function parseWorkerLock(raw: string | null) {
  const payload = parseJson<WorkerLockPayload>(raw);
  if (!payload?.owner || !payload.expiresAt) return null;
  return payload;
}

async function tryAcquireWorkerLock(settingKey: string, payload: WorkerLockPayload) {
  const db = getDb();
  const rawPayload = JSON.stringify(payload);
  const now = Date.now();

  await db.execute(sql`
    INSERT INTO app_settings (\`key\`, \`value\`, \`updated_at\`)
    VALUES (${settingKey}, ${rawPayload}, NOW())
    ON DUPLICATE KEY UPDATE
      \`value\` = IF(
        \`value\` IS NULL
        OR JSON_EXTRACT(\`value\`, '$.expiresAt') IS NULL
        OR CAST(JSON_UNQUOTE(JSON_EXTRACT(\`value\`, '$.expiresAt')) AS UNSIGNED) <= ${now},
        VALUES(\`value\`),
        \`value\`
      ),
      \`updated_at\` = IF(
        \`value\` IS NULL
        OR JSON_EXTRACT(\`value\`, '$.expiresAt') IS NULL
        OR CAST(JSON_UNQUOTE(JSON_EXTRACT(\`value\`, '$.expiresAt')) AS UNSIGNED) <= ${now},
        VALUES(\`updated_at\`),
        \`updated_at\`
      )
  `);

  const current = parseWorkerLock((await getAppSettings([LOYALTY_JOB_LOCK_KEY]))[LOYALTY_JOB_LOCK_KEY]);
  return current?.owner === payload.owner ? payload : null;
}

async function acquireLoyaltyWorkerLock(ttlMs = LOYALTY_JOB_LOCK_TTL_MS) {
  const payload: WorkerLockPayload = {
    owner: randomUUID(),
    startedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  return tryAcquireWorkerLock(LOYALTY_JOB_LOCK_KEY, payload);
}

async function releaseLoyaltyWorkerLock(owner: string | null | undefined) {
  if (!owner) return;
  const current = parseWorkerLock((await getAppSettings([LOYALTY_JOB_LOCK_KEY]))[LOYALTY_JOB_LOCK_KEY]);
  if (current?.owner !== owner) return;
  await setAppSetting(LOYALTY_JOB_LOCK_KEY, null);
}

async function writeLoyaltySyncLog(input: {
  userId?: number | null;
  orderId?: number | null;
  direction?: "pull" | "push";
  status: LoyaltySyncStatus;
  message: string;
  details?: Record<string, unknown> | null;
}) {
  if (input.status === "error") {
    const recentBoundary = new Date(Date.now() - 60 * 60_000);
    const conditions = [
      eq(loyaltySyncLogs.status, "error"),
      eq(loyaltySyncLogs.message, input.message),
      sql`${loyaltySyncLogs.createdAt} >= ${recentBoundary}`,
      input.userId ? eq(loyaltySyncLogs.userId, input.userId) : isNull(loyaltySyncLogs.userId),
      input.orderId ? eq(loyaltySyncLogs.orderId, input.orderId) : isNull(loyaltySyncLogs.orderId),
    ];
    const [duplicate] = await getDb()
      .select({ id: loyaltySyncLogs.id })
      .from(loyaltySyncLogs)
      .where(and(...conditions))
      .limit(1);
    if (duplicate) return;
  }
  await getDb().insert(loyaltySyncLogs).values({
    userId: input.userId ?? null,
    orderId: input.orderId ?? null,
    direction: input.direction ?? "pull",
    status: input.status,
    message: input.message,
    detailsJson: input.details ?? null,
  });
}

async function getMoyskladOrderPayload(orderHref: string | null) {
  if (!orderHref?.trim()) return null;
  const client = await getMoyskladClient();
  try {
    return await client.get<Record<string, unknown>>(toMoyskladApiPath(orderHref));
  } catch (error) {
    await writeLoyaltySyncLog({
      status: "error",
      message: "Не удалось получить customerorder из МойСклад для бонусной синхронизации.",
      details: {
        orderHref,
        error: error instanceof Error ? error.message : "unknown",
      },
    });
    return null;
  }
}

async function upsertBonusTransaction(input: {
  userId: number;
  orderId: number;
  direction: "debit" | "credit" | "rollback" | "sync";
  externalType: string;
  externalId: string;
  status: "pending" | "applied" | "cancelled" | "error";
  amount: number;
  balanceAfter?: number | null;
  source?: string;
  note?: string;
  payloadJson?: Record<string, unknown> | null;
}) {
  const db = getDb();
  const [existing] = await db
    .select({ id: bonusTransactions.id })
    .from(bonusTransactions)
    .where(
      and(
        eq(bonusTransactions.externalType, input.externalType),
        eq(bonusTransactions.externalId, input.externalId)
      )
    )
    .limit(1);

  const payload = {
    userId: input.userId,
    orderId: input.orderId,
    direction: input.direction,
    status: input.status,
    amount: clampInt(input.amount, 0, 10_000_000),
    balanceAfter: input.balanceAfter ?? null,
    source: input.source ?? "moysklad",
    externalId: input.externalId,
    externalType: input.externalType,
    note: input.note ?? null,
    payloadJson: input.payloadJson ?? null,
    updatedAt: new Date(),
  };

  if (existing?.id) {
    await db
      .update(bonusTransactions)
      .set(payload)
      .where(eq(bonusTransactions.id, existing.id));
    return existing.id;
  }

  const inserted = await db.insert(bonusTransactions).values({
    ...payload,
    createdAt: new Date(),
  });
  return Number((inserted as { insertId?: number })?.insertId ?? 0);
}

function buildLoyaltyStateFromPayload(args: {
  rawPayload: Record<string, unknown> | null;
  runtime: LoyaltyRuntimeSettings;
  user: typeof users.$inferSelect;
}) {
  const { rawPayload, runtime, user } = args;

  const bonusPoints =
    readScopedNumber(rawPayload, [
      "bonusPoints",
      "availableBonusPoints",
      "availableBonuses",
      "bonuses",
      "balance",
      "bonusBalance",
    ]) ?? user.loyaltyBalance ?? 0;
  const pendingAccrual =
    readScopedNumber(rawPayload, [
      "pendingBonusPoints",
      "pendingBonuses",
      "awaitingBonuses",
      "bonusPointsToAccrue",
    ]) ?? user.loyaltyPendingAccrual ?? 0;

  const rulesSnapshot = buildRulesSnapshot(rawPayload, runtime.fallbackMaxWriteoffPercent, 0);
  const rawProgram =
    (rawPayload?.bonusProgram as Record<string, unknown> | undefined) ?? null;

  return {
    balance: clampInt(bonusPoints, 0, 10_000_000),
    availableToSpend: clampInt(bonusPoints, 0, 10_000_000),
    pendingAccrual: clampInt(pendingAccrual, 0, 10_000_000),
    maxWriteoffPercent: clampInt(rulesSnapshot.maxWriteoffPercent, 1, 100),
    expectedAccrualPercent: clampInt(rulesSnapshot.expectedAccrualPercent, 0, 100),
    programName:
      typeof rawProgram?.name === "string" ? rawProgram.name.trim() : user.loyaltyProgramName,
    programMetaHref:
      typeof rawProgram?.meta === "object" &&
      rawProgram.meta &&
      typeof (rawProgram.meta as Record<string, unknown>).href === "string"
        ? ((rawProgram.meta as Record<string, unknown>).href as string).trim()
        : user.loyaltyProgramMetaHref,
    rulesSnapshot,
  };
}

export function buildOrderLoyaltySyncOutcome(args: {
  order: Pick<
    LoyaltyOrderRecord,
    | "status"
    | "paymentStatus"
    | "loyaltyBonusSpent"
    | "loyaltyBonusExpectedAccrued"
    | "loyaltyActualSpent"
    | "loyaltyActualAccrued"
  >;
  rawPayload: Record<string, unknown> | null;
  stateAfter: LoyaltyState | null;
}): LoyaltySyncOutcome {
  const paidOrCompleted =
    args.order.paymentStatus === "paid" || args.order.status === "completed";
  const cancelled =
    args.order.status === "cancelled" &&
    args.order.paymentStatus !== "refund" &&
    args.order.paymentStatus !== "partial_refund";
  const refunded =
    args.order.paymentStatus === "refund" ||
    args.order.paymentStatus === "partial_refund" ||
    args.order.status === "return_requested";

  const actualSpent = clampInt(
    readScopedNumber(args.rawPayload, [
      "bonusPayment",
      "bonusWriteoff",
      "bonusWriteOff",
      "bonusSpent",
      "paidByBonuses",
      "bonusesSpent",
    ]) ??
      (paidOrCompleted || refunded ? args.order.loyaltyBonusSpent : args.order.loyaltyActualSpent),
    0,
    10_000_000
  );

  const actualAccrued = clampInt(
    readScopedNumber(args.rawPayload, [
      "bonusAccrual",
      "bonusAccrued",
      "bonusAdded",
      "bonusesAdded",
      "bonusEarned",
    ]) ??
      (paidOrCompleted ? args.order.loyaltyBonusExpectedAccrued : 0),
    0,
    10_000_000
  );

  if (cancelled) {
    return {
      actualSpent: 0,
      actualAccrued: 0,
      syncStatus: "cancelled" as const,
      syncError: null,
      rawPayload: args.rawPayload,
      stateAfter: args.stateAfter,
      debitStatus: "cancelled" as const,
      accrualStatus: "cancelled" as const,
      needsRefundTransaction: false,
      needsAccrualRollback: false,
    };
  }

  if (refunded) {
    return {
      actualSpent,
      actualAccrued: 0,
      syncStatus: "rolled_back" as const,
      syncError: null,
      rawPayload: args.rawPayload,
      stateAfter: args.stateAfter,
      debitStatus: "applied" as const,
      accrualStatus: "cancelled" as const,
      needsRefundTransaction: actualSpent > 0,
      needsAccrualRollback: actualAccrued > 0 || args.order.loyaltyActualAccrued > 0,
    };
  }

  if (paidOrCompleted) {
    return {
      actualSpent,
      actualAccrued,
      syncStatus: "synced" as const,
      syncError: null,
      rawPayload: args.rawPayload,
      stateAfter: args.stateAfter,
      debitStatus: "applied" as const,
      accrualStatus: actualAccrued > 0 ? "applied" : "pending",
      needsRefundTransaction: false,
      needsAccrualRollback: false,
    };
  }

  return {
    actualSpent: args.order.loyaltyActualSpent,
    actualAccrued: args.order.loyaltyActualAccrued,
    syncStatus: "pending" as const,
    syncError: null,
    rawPayload: args.rawPayload,
    stateAfter: args.stateAfter,
    debitStatus: args.order.loyaltyBonusSpent > 0 ? "pending" : "cancelled",
    accrualStatus: "pending" as const,
    needsRefundTransaction: false,
    needsAccrualRollback: false,
  };
}

export async function getLoyaltyRuntimeSettings(): Promise<LoyaltyRuntimeSettings> {
  const settings = await getAppSettings([...LOYALTY_SETTING_KEYS]);
  const encryptedPosToken = settings.loyalty_pos_token_encrypted?.trim() || "";
  let storedPosToken = "";
  if (encryptedPosToken && env.appEncryptionKey.trim()) {
    try {
      storedPosToken = decryptSecret(encryptedPosToken, env.appEncryptionKey);
    } catch {
      storedPosToken = "";
    }
  }
  return {
    enabled: parseBoolean(settings.loyalty_enabled, false),
    groupName:
      settings.loyalty_group_name?.trim() || DEFAULT_LOYALTY_GROUP_NAME,
    participantTag:
      settings.loyalty_participant_tag?.trim() || DEFAULT_LOYALTY_GROUP_NAME,
    fallbackMaxWriteoffPercent: clampInt(
      parsePositiveInt(
        settings.loyalty_default_max_writeoff_percent,
        DEFAULT_MAX_WRITEOFF_PERCENT
      ),
      1,
      100
    ),
    syncMode: "tag",
    posCashierUid:
      settings.loyalty_pos_cashier_uid?.trim() ||
      env.moyskladLoyaltyCashierUid.trim(),
    posStoreUid:
      settings.loyalty_pos_store_uid?.trim() ||
      env.moyskladLoyaltyStoreUid.trim(),
    posToken: storedPosToken || env.moyskladLoyaltyPosToken.trim(),
  };
}

export async function getLoyaltyAdminSettings() {
  const settings = await getAppSettings([...LOYALTY_SETTING_KEYS]);
  const runtime = await getLoyaltyRuntimeSettings();
  return {
    enabled: runtime.enabled,
    groupName: runtime.groupName,
    participantTag: runtime.participantTag,
    defaultMaxWriteoffPercent: runtime.fallbackMaxWriteoffPercent,
    syncMode: runtime.syncMode,
    posCashierUid: runtime.posCashierUid,
    posStoreUid: runtime.posStoreUid,
    posTokenConfigured: Boolean(runtime.posToken.trim()),
    posTokenLast4:
      settings.loyalty_pos_token_last4?.trim() ||
      env.moyskladLoyaltyPosToken.trim().slice(-4),
    posTokenSetAt: settings.loyalty_pos_token_set_at || null,
    posDetailConfigured: Boolean(
      runtime.posCashierUid.trim() && runtime.posToken.trim()
    ),
    lastCheck: {
      ok: parseBoolean(settings.loyalty_pos_last_check_ok, false),
      at: settings.loyalty_pos_last_check_at || null,
      message: settings.loyalty_pos_last_check_message || null,
    },
  };
}

export async function saveLoyaltyAdminSettings(input: {
  enabled: boolean;
  groupName?: string;
  participantTag?: string;
  defaultMaxWriteoffPercent?: number;
  posCashierUid?: string;
  posStoreUid?: string;
  posToken?: string;
}) {
  const currentRuntime = await getLoyaltyRuntimeSettings();
  const groupName = input.groupName?.trim() || DEFAULT_LOYALTY_GROUP_NAME;
  const participantTag = input.participantTag?.trim() || groupName;
  const defaultMaxWriteoffPercent = clampInt(
    input.defaultMaxWriteoffPercent ?? DEFAULT_MAX_WRITEOFF_PERCENT,
    1,
    100
  );
  const posCashierUid = input.posCashierUid?.trim() || "";
  const posStoreUid = input.posStoreUid?.trim() || "";
  const posToken = input.posToken?.trim() || "";
  if (input.enabled && (!posCashierUid || !(posToken || currentRuntime.posToken))) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Перед включением программы укажите UID кассира и отдельный POS-токен точки продаж.",
    });
  }
  if (posToken && !env.appEncryptionKey.trim()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "APP_ENCRYPTION_KEY не настроен: POS-токен нельзя сохранить безопасно.",
    });
  }

  const secretUpdates = posToken
    ? [
        setAppSetting(
          "loyalty_pos_token_encrypted",
          encryptSecret(posToken, env.appEncryptionKey)
        ),
        setAppSetting("loyalty_pos_token_last4", posToken.slice(-4)),
        setAppSetting("loyalty_pos_token_set_at", new Date().toISOString()),
        setAppSetting("loyalty_pos_last_check_ok", "false"),
        setAppSetting("loyalty_pos_last_check_at", null),
        setAppSetting("loyalty_pos_last_check_message", null),
      ]
    : [];

  await Promise.all([
    setAppSetting("loyalty_enabled", input.enabled ? "true" : "false"),
    setAppSetting("loyalty_group_name", groupName),
    setAppSetting("loyalty_participant_tag", participantTag),
    setAppSetting(
      "loyalty_default_max_writeoff_percent",
      String(defaultMaxWriteoffPercent)
    ),
    setAppSetting("loyalty_sync_mode", "tag"),
    setAppSetting("loyalty_pos_cashier_uid", posCashierUid || null),
    setAppSetting("loyalty_pos_store_uid", posStoreUid || null),
    ...secretUpdates,
  ]);

  return getLoyaltyAdminSettings();
}

async function loadUserRecord(userId: number) {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Пользователь не найден.",
    });
  }

  return user;
}

async function findCounterpartyForUser(user: typeof users.$inferSelect) {
  const client = await getMoyskladClient();
  const storedHref = user.moyskladCounterpartyHref?.trim();

  if (storedHref) {
    try {
      const existing = await client.get<CounterpartyRecord>(toMoyskladApiPath(storedHref));
      if (existing?.meta?.href?.trim()) {
        return existing;
      }
    } catch {
      // ignore and continue to search/create
    }
  }

  const searchFilters: string[] = [];
  if (user.phone?.trim()) {
    searchFilters.push(`phone=${sanitizePhoneForSearch(user.phone)}`);
  }
  if (user.email?.trim()) {
    searchFilters.push(`email=${user.email.trim().toLowerCase()}`);
  }

  for (const filter of searchFilters) {
    const data = await client.get<{ rows?: CounterpartyRecord[] }>("/entity/counterparty", {
      filter,
      limit: 1,
    });
    const found = data.rows?.[0];
    if (found?.meta?.href?.trim()) {
      return found;
    }
  }

  return null;
}

async function createCounterpartyForUser(
  user: typeof users.$inferSelect,
  runtime: LoyaltyRuntimeSettings
) {
  const client = await getMoyskladClient();
  return client.post<CounterpartyRecord>("/entity/counterparty", {
    name: user.fullName?.trim() || user.phone?.trim() || user.email.trim(),
    phone: user.phone?.trim() || undefined,
    email: user.email.trim().toLowerCase(),
    description:
      "Создано из интернет-магазина Techaks для участия в бонусной программе.",
    tags: normalizeTagList(undefined, runtime.participantTag),
  });
}

async function ensureCounterpartyMembership(
  counterparty: CounterpartyRecord,
  runtime: LoyaltyRuntimeSettings
) {
  const href = counterparty.meta?.href?.trim();
  if (!href) {
    throw new Error("Контрагент МойСклад не содержит href.");
  }

  const tags = normalizeTagList(counterparty.tags, runtime.participantTag);
  if ((counterparty.tags ?? []).includes(runtime.participantTag)) {
    return {
      ...counterparty,
      tags,
    };
  }

  const client = await getMoyskladClient();
  return client.put<CounterpartyRecord>(toMoyskladApiPath(href), {
    tags,
  });
}

async function saveUserCounterpartySnapshot(
  userId: number,
  counterparty: CounterpartyRecord,
  runtime: LoyaltyRuntimeSettings
) {
  const href = counterparty.meta?.href?.trim() || null;
  const id = counterparty.id?.trim() || null;
  await getDb()
    .update(users)
    .set({
      moyskladCounterpartyId: id,
      moyskladCounterpartyHref: href,
      moyskladCounterpartyVersion: counterparty.version ?? null,
      moyskladCounterpartyExternalCode: counterparty.externalCode?.trim() || null,
      loyaltyParticipantGroup: runtime.groupName,
      loyaltyParticipantTag: runtime.participantTag,
      loyaltyParticipantAssignedAt: new Date(),
      loyaltyStatus: "linked",
      loyaltyLastError: null,
    })
    .where(eq(users.id, userId));
}

async function loadCounterpartyForPosDetail(counterpartyHref: string) {
  const client = await getMoyskladClient();
  const counterparty = await client.get<CounterpartyRecord>(toMoyskladApiPath(counterpartyHref));
  return {
    id: counterparty.id,
    version: counterparty.version,
    updated: counterparty.updated,
    externalCode: counterparty.externalCode,
    name: counterparty.name,
    phone: counterparty.phone,
    email: counterparty.email,
    companyType: counterparty.companyType,
    tags: counterparty.tags ?? [],
    meta: counterparty.meta,
  };
}

function getPosAuthHeaders(runtime: LoyaltyRuntimeSettings) {
  return buildLoyaltyPosAuthHeaders(runtime.posToken, runtime.posCashierUid);
}

export async function testLoyaltyPosConnection() {
  const runtime = await getLoyaltyRuntimeSettings();
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(
      `${POS_API_BASE_URL}/entity/counterparty?limit=1`,
      { headers: getPosAuthHeaders(runtime) }
    );
    const body = await response.text();
    if (!response.ok) {
      throw new Error(
        `POS API вернул HTTP ${response.status}${body ? ` — ${body}` : ""}`
      );
    }
    await Promise.all([
      setAppSetting("loyalty_pos_last_check_ok", "true"),
      setAppSetting("loyalty_pos_last_check_at", checkedAt),
      setAppSetting(
        "loyalty_pos_last_check_message",
        "Подключение к POS API МойСклад успешно проверено."
      ),
    ]);
    return {
      ok: true,
      checkedAt,
      message: "Подключение к POS API МойСклад успешно проверено.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка POS API";
    await Promise.all([
      setAppSetting("loyalty_pos_last_check_ok", "false"),
      setAppSetting("loyalty_pos_last_check_at", checkedAt),
      setAppSetting("loyalty_pos_last_check_message", message),
    ]);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }
}

async function fetchPosCounterpartyDetail(counterpartyHref: string) {
  const runtime = await getLoyaltyRuntimeSettings();

  const payload = await loadCounterpartyForPosDetail(counterpartyHref);
  const response = await fetch(`${POS_API_BASE_URL}/entity/counterparty/detail`, {
    method: "POST",
    headers: getPosAuthHeaders(runtime),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `POS API bonus detail failed: HTTP ${response.status}${body ? ` — ${body}` : ""}`
    );
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function ensureUserLoyaltyCounterparty(userId: number) {
  const runtime = await getLoyaltyRuntimeSettings();
  const user = await loadUserRecord(userId);
  const existing = await findCounterpartyForUser(user);
  const counterparty = existing ?? (await createCounterpartyForUser(user, runtime));
  const member = await ensureCounterpartyMembership(counterparty, runtime);
  await saveUserCounterpartySnapshot(userId, member, runtime);
  return {
    counterpartyId: member.id?.trim() || null,
    counterpartyHref: member.meta?.href?.trim() || null,
    participantTag: runtime.participantTag,
    groupName: runtime.groupName,
  };
}

export async function refreshUserLoyaltyState(userId: number): Promise<LoyaltyState> {
  const runtime = await getLoyaltyRuntimeSettings();
  const user = await loadUserRecord(userId);

  try {
    const link = await ensureUserLoyaltyCounterparty(userId);
    const rawPayload = link.counterpartyHref
      ? await fetchPosCounterpartyDetail(link.counterpartyHref)
      : null;

    const next = buildLoyaltyStateFromPayload({
      rawPayload,
      runtime,
      user,
    });

    await getDb()
      .update(users)
      .set({
        loyaltyStatus: "active",
        loyaltyBalance: next.balance,
        loyaltyAvailableToSpend: next.availableToSpend,
        loyaltyPendingAccrual: next.pendingAccrual,
        loyaltyProgramName: next.programName ?? null,
        loyaltyProgramMetaHref: next.programMetaHref ?? null,
        loyaltyProfileJson: rawPayload,
        loyaltyRulesJson: next.rulesSnapshot,
        loyaltyLastSyncedAt: new Date(),
        loyaltyLastError: null,
      })
      .where(eq(users.id, userId));

    await writeLoyaltySyncLog({
      userId,
      status: "success",
      message: "Лояльность пользователя синхронизирована с МойСклад.",
      details: {
        source: rawPayload ? "moysklad" : "fallback",
        balance: next.balance,
        availableToSpend: next.availableToSpend,
        maxWriteoffPercent: next.maxWriteoffPercent,
        expectedAccrualPercent: next.expectedAccrualPercent,
        response: rawPayload,
      },
    });

    return getUserLoyaltyState(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    await getDb()
      .update(users)
      .set({
        loyaltyStatus: "error",
        loyaltyLastError: message,
        loyaltyLastSyncedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await writeLoyaltySyncLog({
      userId,
      status: "error",
      message: "Синхронизация бонусного профиля завершилась ошибкой.",
      details: { error: message },
    });

    return getUserLoyaltyState(userId);
  }
}

export async function getUserLoyaltyState(
  userId: number,
  options?: { refresh?: boolean }
): Promise<LoyaltyState> {
  if (options?.refresh) {
    return refreshUserLoyaltyState(userId);
  }

  const runtime = await getLoyaltyRuntimeSettings();
  const user = await loadUserRecord(userId);
  const rules =
    (user.loyaltyRulesJson as Record<string, unknown> | null) ?? null;
  const maxWriteoffPercent = clampInt(
    extractNumberByKnownKeys(rules, ["maxWriteoffPercent"]) ??
      runtime.fallbackMaxWriteoffPercent,
    1,
    100
  );
  const expectedAccrualPercent = clampInt(
    extractNumberByKnownKeys(rules, ["expectedAccrualPercent"]) ?? 0,
    0,
    100
  );

  const [holdSummary] = await getDb()
    .select({ amount: sql<number>`COALESCE(SUM(${loyaltyBonusHolds.amount}), 0)` })
    .from(loyaltyBonusHolds)
    .where(
      and(
        eq(loyaltyBonusHolds.userId, userId),
        eq(loyaltyBonusHolds.status, "active"),
        sql`${loyaltyBonusHolds.expiresAt} > NOW()`
      )
    );
  const heldAmount = Number(holdSummary?.amount ?? 0);
  const baseState = {
    enabled: runtime.enabled,
    participant: Boolean(
      user.loyaltyParticipantTag?.trim() &&
        user.loyaltyParticipantTag.trim().toLowerCase() ===
          runtime.participantTag.toLowerCase()
    ),
    status: user.loyaltyStatus,
    groupName: runtime.groupName,
    participantTag: runtime.participantTag,
    balance: user.loyaltyBalance ?? 0,
    availableToSpend: Math.max(0, (user.loyaltyAvailableToSpend ?? 0) - heldAmount),
    pendingAccrual: user.loyaltyPendingAccrual ?? 0,
    programName: user.loyaltyProgramName ?? null,
    maxWriteoffPercent,
    expectedAccrualPercent,
    lastSyncedAt: user.loyaltyLastSyncedAt,
    lastError: user.loyaltyLastError ?? null,
    counterpartyId: user.moyskladCounterpartyId ?? null,
    counterpartyHref: user.moyskladCounterpartyHref ?? null,
    rawPayload: (user.loyaltyProfileJson as Record<string, unknown> | null) ?? null,
    rulesSnapshot: rules,
  };
  const availability = getLoyaltyAvailability(baseState);
  return {
    ...baseState,
    dataFresh: availability.dataFresh,
    canSpend: availability.canSpend,
    availabilityReason: availability.reason,
  };
}

export function buildBonusPreviewFromState(args: {
  state: LoyaltyState;
  subtotal: number;
  requestedAmount?: number | null;
}): BonusPreviewResult {
  const subtotal = clampInt(args.subtotal, 0, 10_000_000);
  const requestedAmount = clampInt(args.requestedAmount ?? 0, 0, 10_000_000);
  const availability = getLoyaltyAvailability(args.state);

  if (!args.state.enabled) {
    return {
      enabled: false,
      participant: false,
      source: "disabled",
      balance: args.state.balance,
      availableToSpend: args.state.availableToSpend,
      pendingAccrual: args.state.pendingAccrual,
      maxWriteoffPercent: args.state.maxWriteoffPercent,
      maxWriteoffAmount: 0,
      requestedAmount,
      appliedAmount: 0,
      expectedAccrualAmount: 0,
      subtotal,
      totalAfterWriteoff: subtotal,
      warning: "Бонусная программа выключена.",
      dataFresh: false,
      canSpend: false,
      groupName: args.state.groupName,
      programName: args.state.programName,
      rawPayload: args.state.rawPayload ?? null,
      rulesSnapshot: args.state.rulesSnapshot ?? null,
    };
  }

  if (!args.state.participant) {
    return {
      enabled: true,
      participant: false,
      source: "fallback",
      balance: args.state.balance,
      availableToSpend: args.state.availableToSpend,
      pendingAccrual: args.state.pendingAccrual,
      maxWriteoffPercent: args.state.maxWriteoffPercent,
      maxWriteoffAmount: 0,
      requestedAmount,
      appliedAmount: 0,
      expectedAccrualAmount: 0,
      subtotal,
      totalAfterWriteoff: subtotal,
      warning: `Покупатель не участвует в группе «${args.state.groupName}».`,
      dataFresh: false,
      canSpend: false,
      groupName: args.state.groupName,
      programName: args.state.programName,
      rawPayload: args.state.rawPayload ?? null,
      rulesSnapshot: args.state.rulesSnapshot ?? null,
    };
  }

  if (!availability.canSpend) {
    return {
      enabled: true,
      participant: true,
      source: "fallback",
      balance: args.state.balance,
      availableToSpend: 0,
      pendingAccrual: args.state.pendingAccrual,
      maxWriteoffPercent: args.state.maxWriteoffPercent,
      maxWriteoffAmount: 0,
      requestedAmount,
      appliedAmount: 0,
      expectedAccrualAmount: 0,
      subtotal,
      totalAfterWriteoff: subtotal,
      warning: availability.reason,
      dataFresh: availability.dataFresh,
      canSpend: false,
      groupName: args.state.groupName,
      programName: args.state.programName,
      rawPayload: args.state.rawPayload ?? null,
      rulesSnapshot: args.state.rulesSnapshot ?? null,
    };
  }

  const maxWriteoffAmount = Math.min(
    args.state.availableToSpend,
    clampInt((subtotal * args.state.maxWriteoffPercent) / 100, 0, subtotal)
  );
  const appliedAmount = clampInt(
    requestedAmount > 0 ? Math.min(requestedAmount, maxWriteoffAmount) : 0,
    0,
    maxWriteoffAmount
  );
  const expectedAccrualAmount = clampInt(
    (subtotal - appliedAmount) * (args.state.expectedAccrualPercent / 100),
    0,
    10_000_000
  );

  return {
    enabled: true,
    participant: true,
    source: args.state.lastSyncedAt ? "moysklad" : "fallback",
    balance: args.state.balance,
    availableToSpend: args.state.availableToSpend,
    pendingAccrual: args.state.pendingAccrual,
    maxWriteoffPercent: args.state.maxWriteoffPercent,
    maxWriteoffAmount,
    requestedAmount,
    appliedAmount,
    expectedAccrualAmount,
    subtotal,
    totalAfterWriteoff: Math.max(0, subtotal - appliedAmount),
    warning: null,
    dataFresh: availability.dataFresh,
    canSpend: availability.canSpend,
    groupName: args.state.groupName,
    programName: args.state.programName,
    rawPayload: args.state.rawPayload ?? null,
    rulesSnapshot: args.state.rulesSnapshot ?? null,
  };
}

export async function previewBonusWriteoff(args: {
  userId: number;
  subtotal: number;
  requestedAmount?: number | null;
}): Promise<BonusPreviewResult> {
  const state = await getUserLoyaltyState(args.userId);
  return buildBonusPreviewFromState({
    state,
    subtotal: args.subtotal,
    requestedAmount: args.requestedAmount,
  });
}

function buildOrderLoyaltySnapshot(args: {
  preview: BonusPreviewResult | null;
  spent: number;
}): LoyaltyOrderSnapshot {
  return {
    balanceBefore: args.preview?.balance ?? 0,
    requestedAmount: args.preview?.requestedAmount ?? args.spent,
    appliedAmount: args.spent,
    expectedAccrualAmount: args.preview?.expectedAccrualAmount ?? 0,
    percentApplied: args.preview?.maxWriteoffPercent ?? 0,
    programSnapshot: args.preview
      ? {
          groupName: args.preview.groupName,
          programName: args.preview.programName,
          source: args.preview.source,
          balance: args.preview.balance,
          availableToSpend: args.preview.availableToSpend,
          pendingAccrual: args.preview.pendingAccrual,
          maxWriteoffPercent: args.preview.maxWriteoffPercent,
          subtotal: args.preview.subtotal,
          totalAfterWriteoff: args.preview.totalAfterWriteoff,
        }
      : null,
    previewPayload: args.preview?.rawPayload ?? null,
    rulesSnapshot: args.preview?.rulesSnapshot ?? null,
  };
}

export async function attachLoyaltyToOrder(args: {
  orderId: number;
  userId: number | null;
  subtotal: number;
  spent: number;
  preview: BonusPreviewResult | null;
}) {
  if (!args.userId) return;

  const spent = clampInt(args.spent, 0, args.subtotal);
  const snapshot = buildOrderLoyaltySnapshot({
    preview: args.preview,
    spent,
  });

  await getDb()
    .update(orders)
    .set({
      loyaltyBalanceBefore: snapshot.balanceBefore,
      loyaltyBonusRequested: snapshot.requestedAmount,
      loyaltyBonusSpent: spent,
      loyaltyBonusAccrued: 0,
      loyaltyBonusExpectedAccrued: snapshot.expectedAccrualAmount,
      loyaltyWriteoffPercentApplied: snapshot.percentApplied,
      loyaltyPreviewPayloadJson: snapshot.previewPayload,
      loyaltyRulesSnapshotJson: snapshot.rulesSnapshot,
      loyaltyProgramSnapshotJson: snapshot.programSnapshot,
      loyaltyActualSpent: 0,
      loyaltyActualAccrued: 0,
      loyaltySyncStatus: spent > 0 || snapshot.expectedAccrualAmount > 0 ? "pending" : "synced",
      loyaltyLastSyncError: null,
      loyaltyLastSyncedAt: null,
      loyaltyRawResultJson: null,
    })
    .where(eq(orders.id, args.orderId));

  if (spent > 0) {
    await upsertBonusTransaction({
      userId: args.userId,
      orderId: args.orderId,
      direction: "debit",
      externalType: "loyalty_debit",
      externalId: `order:${args.orderId}:debit`,
      status: "pending",
      amount: spent,
      source: "site",
      note: "Бонусы применены при оформлении заказа и ожидают подтверждения из МоегоСклада.",
      payloadJson: snapshot.programSnapshot,
    });
  }

  await enqueueLoyaltySyncJob({
    jobType: "order_loyalty_sync",
    userId: args.userId,
    orderId: args.orderId,
    payloadJson: {
      reason: "order_created",
      expectedAccrualAmount: snapshot.expectedAccrualAmount,
    },
  });

  await writeLoyaltySyncLog({
    userId: args.userId,
    orderId: args.orderId,
    direction: "push",
    status: "success",
    message:
      spent > 0
        ? "В заказ сохранено списание бонусов."
        : "Заказ оформлен без списания бонусов.",
    details: snapshot.programSnapshot,
  });
}

export async function listUserBonusTransactions(userId: number) {
  return getDb()
    .select()
    .from(bonusTransactions)
    .where(eq(bonusTransactions.userId, userId))
    .orderBy(desc(bonusTransactions.createdAt));
}

export async function listOrderBonusTransactions(orderId: number) {
  return getDb()
    .select()
    .from(bonusTransactions)
    .where(eq(bonusTransactions.orderId, orderId))
    .orderBy(desc(bonusTransactions.createdAt));
}

async function loadOrderLoyaltyRecord(orderId: number): Promise<LoyaltyOrderRecord | null> {
  const [order] = await getDb()
    .select({
      id: orders.id,
      userId: orders.userId,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      subtotal: orders.subtotal,
      totalPrice: orders.totalPrice,
      loyaltyBalanceBefore: orders.loyaltyBalanceBefore,
      loyaltyBonusRequested: orders.loyaltyBonusRequested,
      loyaltyBonusSpent: orders.loyaltyBonusSpent,
      loyaltyBonusAccrued: orders.loyaltyBonusAccrued,
      loyaltyBonusExpectedAccrued: orders.loyaltyBonusExpectedAccrued,
      loyaltyActualSpent: orders.loyaltyActualSpent,
      loyaltyActualAccrued: orders.loyaltyActualAccrued,
      loyaltySyncStatus: orders.loyaltySyncStatus,
      loyaltyProgramSnapshotJson: orders.loyaltyProgramSnapshotJson,
      loyaltyPreviewPayloadJson: orders.loyaltyPreviewPayloadJson,
      loyaltyRulesSnapshotJson: orders.loyaltyRulesSnapshotJson,
      moyskladOrderHref: orders.moyskladOrderHref,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  return (order as LoyaltyOrderRecord | undefined) ?? null;
}

async function applyOrderLoyaltyOutcome(
  order: LoyaltyOrderRecord,
  outcome: LoyaltySyncOutcome
) {
  const db = getDb();
  await db
    .update(orders)
    .set({
      loyaltyBonusAccrued: outcome.actualAccrued,
      loyaltyActualSpent: outcome.actualSpent,
      loyaltyActualAccrued: outcome.actualAccrued,
      loyaltySyncStatus: outcome.syncStatus,
      loyaltyLastSyncError: outcome.syncError,
      loyaltyLastSyncedAt: new Date(),
      loyaltyRawResultJson: outcome.rawPayload,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await db
    .update(loyaltyBonusHolds)
    .set({
      status:
        outcome.syncStatus === "synced"
          ? "captured"
          : outcome.syncStatus === "pending"
            ? "active"
            : "released",
      updatedAt: new Date(),
    })
    .where(eq(loyaltyBonusHolds.orderId, order.id));

  if (!order.userId) return;

  if (order.loyaltyBonusSpent > 0) {
    await upsertBonusTransaction({
      userId: order.userId,
      orderId: order.id,
      direction: "debit",
      externalType: "loyalty_debit",
      externalId: `order:${order.id}:debit`,
      status: outcome.debitStatus,
      amount: outcome.actualSpent || order.loyaltyBonusSpent,
      balanceAfter: outcome.stateAfter?.balance ?? null,
      note:
        outcome.debitStatus === "cancelled"
          ? "Списание бонусов отменено после отмены заказа."
          : outcome.debitStatus === "applied"
            ? "Списание бонусов подтверждено по заказу."
            : "Списание бонусов ожидает подтверждения.",
      payloadJson: outcome.rawPayload,
    });
  }

  if (outcome.actualAccrued > 0) {
    await upsertBonusTransaction({
      userId: order.userId,
      orderId: order.id,
      direction: "credit",
      externalType: "loyalty_accrual",
      externalId: `order:${order.id}:accrual`,
      status: outcome.accrualStatus,
      amount: outcome.actualAccrued,
      balanceAfter: outcome.stateAfter?.balance ?? null,
      note:
        outcome.accrualStatus === "applied"
          ? "Бонусы начислены по заказу."
          : "Бонусы по заказу ожидают окончательного подтверждения.",
      payloadJson: outcome.rawPayload,
    });
  } else {
    const [existingAccrual] = await db
      .select({ id: bonusTransactions.id })
      .from(bonusTransactions)
      .where(
        and(
          eq(bonusTransactions.externalType, "loyalty_accrual"),
          eq(bonusTransactions.externalId, `order:${order.id}:accrual`)
        )
      )
      .limit(1);
    if (existingAccrual?.id) {
      await db
        .update(bonusTransactions)
        .set({
          status: outcome.accrualStatus,
          updatedAt: new Date(),
          payloadJson: outcome.rawPayload,
        })
        .where(eq(bonusTransactions.id, existingAccrual.id));
    }
  }

  if (outcome.needsRefundTransaction && order.loyaltyBonusSpent > 0) {
    await upsertBonusTransaction({
      userId: order.userId,
      orderId: order.id,
      direction: "rollback",
      externalType: "loyalty_refund",
      externalId: `order:${order.id}:refund`,
      status: "applied",
      amount: order.loyaltyBonusSpent,
      balanceAfter: outcome.stateAfter?.balance ?? null,
      note: "Ранее списанные бонусы возвращены после отмены/возврата заказа.",
      payloadJson: outcome.rawPayload,
    });
  }

  if (outcome.needsAccrualRollback) {
    const rollbackAmount = Math.max(
      0,
      order.loyaltyActualAccrued || order.loyaltyBonusExpectedAccrued
    );
    if (rollbackAmount > 0) {
      await upsertBonusTransaction({
        userId: order.userId,
        orderId: order.id,
        direction: "rollback",
        externalType: "loyalty_accrual_rollback",
        externalId: `order:${order.id}:accrual_rollback`,
        status: "applied",
        amount: rollbackAmount,
        balanceAfter: outcome.stateAfter?.balance ?? null,
        note: "Начисленные бонусы сторнированы после возврата заказа.",
        payloadJson: outcome.rawPayload,
      });
    }
  }
}

export async function syncOrderLoyaltyFromMoysklad(orderId: number) {
  const order = await loadOrderLoyaltyRecord(orderId);
  if (!order || !order.userId) {
    return null;
  }

  try {
    const stateAfter = await refreshUserLoyaltyState(order.userId);
    const rawOrderPayload = await getMoyskladOrderPayload(order.moyskladOrderHref);
    const outcome = buildOrderLoyaltySyncOutcome({
      order,
      rawPayload: rawOrderPayload,
      stateAfter,
    });

    await applyOrderLoyaltyOutcome(order, outcome);

    await writeLoyaltySyncLog({
      userId: order.userId,
      orderId,
      status: "success",
      message: "Бонусная синхронизация заказа завершена.",
      details: {
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        actualSpent: outcome.actualSpent,
        actualAccrued: outcome.actualAccrued,
        syncStatus: outcome.syncStatus,
        response: rawOrderPayload,
      },
    });

    return outcome.stateAfter;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка бонусной синхронизации заказа";
    await getDb()
      .update(orders)
      .set({
        loyaltySyncStatus: "error",
        loyaltyLastSyncError: message,
        loyaltyLastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    await writeLoyaltySyncLog({
      userId: order.userId,
      orderId,
      status: "error",
      message: "Бонусная синхронизация заказа завершилась ошибкой.",
      details: {
        error: message,
      },
    });

    throw error;
  }
}

function getRetryDelayMs(attempts: number, error: unknown) {
  const nextAttempt = attempts + 1;
  if (error instanceof MoyskladApiError && error.status === 429) {
    return Math.min(60 * 60_000, nextAttempt * 5 * 60_000);
  }
  if (error instanceof MoyskladApiError && error.retriable) {
    return Math.min(60 * 60_000, nextAttempt * 2 * 60_000);
  }
  if (
    error instanceof Error &&
    /timeout|etimedout|econnreset|socket hang up|network/i.test(error.message)
  ) {
    return Math.min(60 * 60_000, nextAttempt * 2 * 60_000);
  }
  return 0;
}

export async function enqueueLoyaltySyncJob(input: {
  jobType: LoyaltyJobType;
  userId?: number | null;
  orderId?: number | null;
  payloadJson?: Record<string, unknown> | null;
}) {
  const db = getDb();
  const activeKey = buildLoyaltyJobActiveKey(input);
  const pendingStatuses: LoyaltyJobStatus[] = ["pending", "processing", "error"];
  const userCondition = input.userId
    ? eq(loyaltySyncJobs.userId, input.userId)
    : isNull(loyaltySyncJobs.userId);
  const orderCondition = input.orderId
    ? eq(loyaltySyncJobs.orderId, input.orderId)
    : isNull(loyaltySyncJobs.orderId);
  const [existing] = await db
    .select({ id: loyaltySyncJobs.id })
    .from(loyaltySyncJobs)
    .where(
      and(
        eq(loyaltySyncJobs.jobType, input.jobType),
        userCondition,
        orderCondition,
        inArray(loyaltySyncJobs.status, pendingStatuses)
      )
    )
    .limit(1);

  if (existing?.id) {
    return existing.id;
  }

  const inserted = await db.insert(loyaltySyncJobs).values({
    jobType: input.jobType,
    userId: input.userId ?? null,
    orderId: input.orderId ?? null,
      payloadJson: input.payloadJson ?? null,
      activeKey,
    status: "pending",
    attempts: 0,
    nextRunAt: new Date(),
    lockedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return Number((inserted as { insertId?: number })?.insertId ?? 0);
}

type ClaimedLoyaltyJobRow = {
  id: number;
  job_type: string;
  user_id: number | null;
  order_id: number | null;
  attempts: number;
  payload_json: Record<string, unknown> | null;
};

async function claimNextLoyaltyJob(db: ReturnType<typeof getDb>) {
  return db.transaction(async tx => {
    const now = new Date();
    const staleBefore = new Date(Date.now() - LOYALTY_JOB_LOCK_TTL_MS);
    const result = await tx.execute(sql`
      SELECT *
      FROM ${loyaltySyncJobs}
      WHERE (${loyaltySyncJobs.status} = 'pending'
        OR ${loyaltySyncJobs.status} = 'error'
        OR (${loyaltySyncJobs.status} = 'processing' AND ${loyaltySyncJobs.lockedAt} < ${staleBefore}))
        AND ${loyaltySyncJobs.nextRunAt} <= ${now}
        AND (${loyaltySyncJobs.lockedAt} IS NULL OR ${loyaltySyncJobs.lockedAt} < ${staleBefore})
      ORDER BY ${loyaltySyncJobs.createdAt} ASC
      LIMIT 1
      FOR UPDATE
    `);

    const wrapped = result as unknown as ClaimedLoyaltyJobRow[] | { 0?: ClaimedLoyaltyJobRow[] };
    const rows = Array.isArray((wrapped as { 0?: ClaimedLoyaltyJobRow[] })?.[0])
      ? ((wrapped as { 0?: ClaimedLoyaltyJobRow[] })[0] ?? [])
      : (wrapped as ClaimedLoyaltyJobRow[]);
    const row = rows?.[0];
    if (!row?.id) return null;

    await tx
      .update(loyaltySyncJobs)
      .set({
        status: "processing",
        lockedAt: now,
        updatedAt: now,
      })
      .where(eq(loyaltySyncJobs.id, Number(row.id)));

    return {
      id: Number(row.id),
      jobType: String(row.job_type) as LoyaltyJobType,
      userId: row.user_id ? Number(row.user_id) : null,
      orderId: row.order_id ? Number(row.order_id) : null,
      attempts: Number(row.attempts ?? 0),
      payloadJson: (row.payload_json ?? null) as Record<string, unknown> | null,
    };
  });
}

async function completeLoyaltyJob(jobId: number) {
  await getDb()
    .update(loyaltySyncJobs)
    .set({
      status: "success",
      activeKey: null,
      lockedAt: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(loyaltySyncJobs.id, jobId));
}

async function failLoyaltyJob(
  job: {
    id: number;
    jobType: LoyaltyJobType;
    userId: number | null;
    orderId: number | null;
    attempts: number;
  },
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Ошибка бонусной джобы";
  const retryDelayMs = getRetryDelayMs(job.attempts, error);
  const shouldRetry = retryDelayMs > 0 && job.attempts + 1 < MAX_LOYALTY_JOB_ATTEMPTS;
  const nextRunAt = shouldRetry
    ? new Date(Date.now() + retryDelayMs)
    : new Date(Date.now() + 365 * 24 * 60 * 60_000);

  await getDb()
    .update(loyaltySyncJobs)
    .set({
      status: "error",
      attempts: job.attempts + 1,
      lastError: message,
      nextRunAt,
      lockedAt: null,
      activeKey: shouldRetry ? buildLoyaltyJobActiveKey(job) : null,
      updatedAt: new Date(),
    })
    .where(eq(loyaltySyncJobs.id, job.id));

  await writeLoyaltySyncLog({
    userId: job.userId,
    orderId: job.orderId,
    status: "error",
    message: `Ошибка loyalty job #${job.id}: ${message}`,
    details: {
      jobType: job.jobType,
      attempts: job.attempts + 1,
      nextRunAt: nextRunAt.toISOString(),
      retriable: shouldRetry,
    },
  });
}

async function processLoyaltyJob(job: {
  id: number;
  jobType: LoyaltyJobType;
  userId: number | null;
  orderId: number | null;
  attempts: number;
  payloadJson: Record<string, unknown> | null;
}) {
  if (job.jobType === "customer_loyalty_sync" || job.jobType === "loyalty_balance_refresh") {
    if (!job.userId) return;
    await refreshUserLoyaltyState(job.userId);
    await writeLoyaltySyncLog({
      userId: job.userId,
      status: "success",
      message:
        job.jobType === "loyalty_balance_refresh"
          ? "Фоновое обновление бонусного баланса завершено."
          : "Фоновая синхронизация клиента завершена.",
      details: {
        jobType: job.jobType,
      },
    });
    return;
  }

  if (job.jobType === "order_loyalty_sync") {
    if (!job.orderId) return;
    await syncOrderLoyaltyFromMoysklad(job.orderId);
    return;
  }

  if (job.payloadJson?.orderId) {
    await syncOrderLoyaltyFromMoysklad(Number(job.payloadJson.orderId));
    return;
  }

  if (job.payloadJson?.userId) {
    await refreshUserLoyaltyState(Number(job.payloadJson.userId));
  }
}

export async function processLoyaltySyncJobs(limit = 5) {
  const runtime = await getLoyaltyRuntimeSettings();
  if (!runtime.enabled) {
    return { processed: 0, skipped: true, reason: "disabled" as const };
  }
  const lock = await acquireLoyaltyWorkerLock();
  if (!lock) {
    return { processed: 0, skipped: true };
  }

  let processed = 0;

  try {
    for (let index = 0; index < limit; index += 1) {
      const job = await claimNextLoyaltyJob(getDb());
      if (!job) break;
      try {
        await processLoyaltyJob(job);
        await completeLoyaltyJob(job.id);
        processed += 1;
      } catch (error) {
        await failLoyaltyJob(job, error);
      }
    }

    return { processed, skipped: false };
  } finally {
    await releaseLoyaltyWorkerLock(lock.owner);
  }
}

export async function scheduleLoyaltyMaintenanceJobs(limit = 25) {
  const db = getDb();
  const runtime = await getLoyaltyRuntimeSettings();
  if (!runtime.enabled) {
    return { usersQueued: 0, ordersQueued: 0, retryQueued: 0, skipped: true };
  }
  const staleBefore = new Date(Date.now() - LOYALTY_STALE_SYNC_MS);

  const candidateUsers = await db
    .select({
      id: users.id,
      loyaltyStatus: users.loyaltyStatus,
      loyaltyLastSyncedAt: users.loyaltyLastSyncedAt,
      loyaltyParticipantTag: users.loyaltyParticipantTag,
    })
    .from(users)
    .where(
      or(
        eq(users.loyaltyStatus, "pending"),
        and(
          eq(users.loyaltyStatus, "error"),
          sql`${users.loyaltyLastSyncedAt} < ${staleBefore}`
        ),
        sql`${users.loyaltyLastSyncedAt} IS NULL`,
        sql`${users.loyaltyLastSyncedAt} < ${staleBefore}`
      )
    )
    .orderBy(asc(users.loyaltyLastSyncedAt))
    .limit(limit);

  for (const user of candidateUsers) {
    const jobType: LoyaltyJobType =
      user.loyaltyStatus === "active" ? "loyalty_balance_refresh" : "customer_loyalty_sync";
    await enqueueLoyaltySyncJob({
      jobType,
      userId: user.id,
      payloadJson: {
        reason: "scheduled_maintenance",
      },
    });
  }

  const candidateOrders = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      loyaltySyncStatus: orders.loyaltySyncStatus,
      loyaltyBonusSpent: orders.loyaltyBonusSpent,
      loyaltyBonusExpectedAccrued: orders.loyaltyBonusExpectedAccrued,
      paymentStatus: orders.paymentStatus,
      status: orders.status,
      loyaltyLastSyncedAt: orders.loyaltyLastSyncedAt,
    })
    .from(orders)
    .where(
      and(
        sql`(${orders.loyaltyBonusSpent} > 0 OR ${orders.loyaltyBonusExpectedAccrued} > 0)`,
        or(
          eq(orders.loyaltySyncStatus, "pending"),
          eq(orders.loyaltySyncStatus, "error"),
          sql`${orders.loyaltyLastSyncedAt} IS NULL`,
          sql`${orders.loyaltyLastSyncedAt} < ${staleBefore}`
        )
      )
    )
    .orderBy(asc(orders.loyaltyLastSyncedAt))
    .limit(limit);

  for (const order of candidateOrders) {
    await enqueueLoyaltySyncJob({
      jobType: "order_loyalty_sync",
      userId: order.userId,
      orderId: order.id,
      payloadJson: {
        reason: "scheduled_maintenance",
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
      },
    });
  }

  return {
    usersQueued: candidateUsers.length,
    ordersQueued: candidateOrders.length,
    retryQueued: 0,
    skipped: false,
  };
}

export async function getLoyaltyAdminOverview() {
  const db = getDb();
  const runtime = await getLoyaltyRuntimeSettings();
  const [userSummary] = await db
    .select({
      participants: sql<number>`SUM(CASE WHEN ${users.loyaltyParticipantTag} IS NOT NULL THEN 1 ELSE 0 END)`,
      activeParticipants: sql<number>`SUM(CASE WHEN ${users.loyaltyStatus} = 'active' THEN 1 ELSE 0 END)`,
      errors: sql<number>`SUM(CASE WHEN ${users.loyaltyStatus} = 'error' THEN 1 ELSE 0 END)`,
      lastUserSync: sql<Date | null>`MAX(${users.loyaltyLastSyncedAt})`,
    })
    .from(users);
  const [orderSummary] = await db
    .select({
      ordersWithBonuses: sql<number>`SUM(CASE WHEN ${orders.loyaltyBonusSpent} > 0 OR ${orders.loyaltyBonusExpectedAccrued} > 0 THEN 1 ELSE 0 END)`,
      bonusSpent: sql<number>`COALESCE(SUM(${orders.loyaltyBonusSpent}), 0)`,
      bonusAccrued: sql<number>`COALESCE(SUM(${orders.loyaltyBonusAccrued}), 0)`,
      lastOrderSync: sql<Date | null>`MAX(${orders.loyaltyLastSyncedAt})`,
    })
    .from(orders);
  const [jobSummary] = await db
    .select({
      queuedJobs: sql<number>`SUM(CASE WHEN ${loyaltySyncJobs.status} IN ('pending','processing') THEN 1 ELSE 0 END)`,
      failedJobs: sql<number>`SUM(CASE WHEN ${loyaltySyncJobs.status} = 'error' THEN 1 ELSE 0 END)`,
      staleProcessingJobs: sql<number>`SUM(CASE WHEN ${loyaltySyncJobs.status} = 'processing' AND ${loyaltySyncJobs.lockedAt} < DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 1 ELSE 0 END)`,
      oldestQueuedAt: sql<Date | null>`MIN(CASE WHEN ${loyaltySyncJobs.status} IN ('pending','processing') THEN ${loyaltySyncJobs.createdAt} ELSE NULL END)`,
    })
    .from(loyaltySyncJobs);

  const [lastLog] = await db
    .select({
      id: loyaltySyncLogs.id,
      status: loyaltySyncLogs.status,
      message: loyaltySyncLogs.message,
      createdAt: loyaltySyncLogs.createdAt,
    })
    .from(loyaltySyncLogs)
    .orderBy(desc(loyaltySyncLogs.createdAt))
    .limit(1);

  return {
    settings: {
      enabled: runtime.enabled,
      groupName: runtime.groupName,
      participantTag: runtime.participantTag,
      fallbackMaxWriteoffPercent: runtime.fallbackMaxWriteoffPercent,
      syncMode: runtime.syncMode,
      posCashierUid: runtime.posCashierUid,
      posStoreUid: runtime.posStoreUid,
      posTokenConfigured: Boolean(runtime.posToken),
    },
    summary: {
      participants: Number(userSummary?.participants ?? 0),
      activeParticipants: Number(userSummary?.activeParticipants ?? 0),
      errors: Number(userSummary?.errors ?? 0),
      ordersWithBonuses: Number(orderSummary?.ordersWithBonuses ?? 0),
      bonusSpent: Number(orderSummary?.bonusSpent ?? 0),
      bonusAccrued: Number(orderSummary?.bonusAccrued ?? 0),
      queuedJobs: Number(jobSummary?.queuedJobs ?? 0),
      failedJobs: Number(jobSummary?.failedJobs ?? 0),
      staleProcessingJobs: Number(jobSummary?.staleProcessingJobs ?? 0),
      oldestQueuedAt: jobSummary?.oldestQueuedAt ?? null,
      lastUserSync: userSummary?.lastUserSync ?? null,
      lastOrderSync: orderSummary?.lastOrderSync ?? null,
      lastLog: lastLog ?? null,
    },
    health: {
      enabled: runtime.enabled,
      configured: Boolean(runtime.posCashierUid && runtime.posToken),
      healthy:
        runtime.enabled &&
        Boolean(runtime.posCashierUid && runtime.posToken) &&
        Number(userSummary?.errors ?? 0) === 0 &&
        Number(jobSummary?.staleProcessingJobs ?? 0) === 0,
    },
  };
}

export async function listLoyaltyCustomersAdmin(input?: {
  search?: string;
  status?: string;
  limit?: number;
}) {
  const db = getDb();
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 250);
  const search = input?.search?.trim() || "";
  const conditions = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(users.fullName, pattern),
        like(users.email, pattern),
        like(users.phone, pattern),
        like(users.moyskladCounterpartyId, pattern)
      )
    );
  }

  if (input?.status?.trim()) {
    conditions.push(eq(users.loyaltyStatus, input.status.trim()));
  }

  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      loyaltyStatus: users.loyaltyStatus,
      loyaltyBalance: users.loyaltyBalance,
      loyaltyAvailableToSpend: users.loyaltyAvailableToSpend,
      loyaltyPendingAccrual: users.loyaltyPendingAccrual,
      loyaltyParticipantGroup: users.loyaltyParticipantGroup,
      loyaltyParticipantTag: users.loyaltyParticipantTag,
      moyskladCounterpartyId: users.moyskladCounterpartyId,
      moyskladCounterpartyHref: users.moyskladCounterpartyHref,
      loyaltyLastSyncedAt: users.loyaltyLastSyncedAt,
      loyaltyLastError: users.loyaltyLastError,
    })
    .from(users)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(users.loyaltyLastSyncedAt), desc(users.id))
    .limit(limit);
}

export async function listLoyaltyOrdersAdmin(input?: {
  search?: string;
  syncStatus?: string;
  limit?: number;
}) {
  const db = getDb();
  const limit = Math.min(Math.max(input?.limit ?? 120, 1), 300);
  const search = input?.search?.trim() || "";
  const conditions = [
    sql`(${orders.loyaltyBonusSpent} > 0 OR ${orders.loyaltyBonusExpectedAccrued} > 0 OR ${orders.loyaltyActualAccrued} > 0)`,
  ];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(orders.orderNumber, pattern),
        like(users.fullName, pattern),
        like(users.email, pattern),
        like(users.phone, pattern)
      )!
    );
  }

  if (input?.syncStatus?.trim()) {
    conditions.push(eq(orders.loyaltySyncStatus, input.syncStatus.trim()));
  }

  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalPrice: orders.totalPrice,
      loyaltyBonusSpent: orders.loyaltyBonusSpent,
      loyaltyBonusAccrued: orders.loyaltyBonusAccrued,
      loyaltyBonusExpectedAccrued: orders.loyaltyBonusExpectedAccrued,
      loyaltyActualSpent: orders.loyaltyActualSpent,
      loyaltyActualAccrued: orders.loyaltyActualAccrued,
      loyaltySyncStatus: orders.loyaltySyncStatus,
      loyaltyLastSyncError: orders.loyaltyLastSyncError,
      loyaltyLastSyncedAt: orders.loyaltyLastSyncedAt,
      customerName: sql<string | null>`COALESCE(${orders.customerName}, ${users.fullName})`,
      customerEmail: sql<string | null>`COALESCE(${orders.customerEmail}, ${users.email})`,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function listLoyaltySyncJournal(input?: {
  search?: string;
  status?: string;
  limit?: number;
}) {
  const db = getDb();
  const limit = Math.min(Math.max(input?.limit ?? 120, 1), 250);
  const search = input?.search?.trim() || "";
  const conditions = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(loyaltySyncLogs.message, pattern),
        like(users.fullName, pattern),
        like(users.email, pattern),
        like(orders.orderNumber, pattern)
      )
    );
  }

  if (input?.status?.trim()) {
    conditions.push(eq(loyaltySyncLogs.status, input.status.trim()));
  }

  return db
    .select({
      id: loyaltySyncLogs.id,
      status: loyaltySyncLogs.status,
      direction: loyaltySyncLogs.direction,
      message: loyaltySyncLogs.message,
      detailsJson: loyaltySyncLogs.detailsJson,
      createdAt: loyaltySyncLogs.createdAt,
      userId: loyaltySyncLogs.userId,
      orderId: loyaltySyncLogs.orderId,
      userName: users.fullName,
      userEmail: users.email,
      orderNumber: orders.orderNumber,
    })
    .from(loyaltySyncLogs)
    .leftJoin(users, eq(loyaltySyncLogs.userId, users.id))
    .leftJoin(orders, eq(loyaltySyncLogs.orderId, orders.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(loyaltySyncLogs.createdAt))
    .limit(limit);
}

export async function listLoyaltyJobsAdmin(limit = 120) {
  return getDb()
    .select()
    .from(loyaltySyncJobs)
    .orderBy(desc(loyaltySyncJobs.createdAt))
    .limit(limit);
}

export async function resyncLoyaltyCustomer(userId: number) {
  await enqueueLoyaltySyncJob({
    jobType: "customer_loyalty_sync",
    userId,
    payloadJson: { reason: "manual_resync" },
  });
  return refreshUserLoyaltyState(userId);
}

export async function assignLoyaltyCustomerGroup(userId: number) {
  await ensureUserLoyaltyCounterparty(userId);
  await enqueueLoyaltySyncJob({
    jobType: "customer_loyalty_sync",
    userId,
    payloadJson: { reason: "manual_group_assign" },
  });
  return getUserLoyaltyState(userId, { refresh: true });
}

export async function resyncLoyaltyOrder(orderId: number) {
  await enqueueLoyaltySyncJob({
    jobType: "order_loyalty_sync",
    orderId,
    payloadJson: { reason: "manual_resync" },
  });
  return syncOrderLoyaltyFromMoysklad(orderId);
}
