import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { bonusTransactions, loyaltySyncLogs, orders, users } from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import { env } from "./env";
import { getMoyskladClient } from "./moysklad-client";

const LOYALTY_SETTING_KEYS = [
  "loyalty_enabled",
  "loyalty_group_name",
  "loyalty_participant_tag",
  "loyalty_default_max_writeoff_percent",
  "loyalty_sync_mode",
] as const;

const DEFAULT_LOYALTY_GROUP_NAME = "техакс";
const DEFAULT_MAX_WRITEOFF_PERCENT = 30;
const POS_API_BASE_URL = "https://online.moysklad.ru/api/posap/1.0";

type LoyaltySyncStatus = "success" | "error" | "skipped";

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
  subtotal: number;
  totalAfterWriteoff: number;
  warning: string | null;
  groupName: string;
  programName: string | null;
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
  lastSyncedAt: Date | null;
  lastError: string | null;
  counterpartyId: string | null;
  counterpartyHref: string | null;
};

type LoyaltyRuntimeSettings = {
  enabled: boolean;
  groupName: string;
  participantTag: string;
  fallbackMaxWriteoffPercent: number;
  syncMode: "tag";
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

function extractNumberByKnownKeys(
  input: unknown,
  keys: string[]
): number | null {
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

async function writeLoyaltySyncLog(input: {
  userId?: number | null;
  orderId?: number | null;
  direction?: "pull" | "push";
  status: LoyaltySyncStatus;
  message: string;
  details?: Record<string, unknown> | null;
}) {
  await getDb().insert(loyaltySyncLogs).values({
    userId: input.userId ?? null,
    orderId: input.orderId ?? null,
    direction: input.direction ?? "pull",
    status: input.status,
    message: input.message,
    detailsJson: input.details ?? null,
  });
}

async function getMoyskladToken() {
  const settings = await getAppSettings(["moysklad_token"]);
  return env.moyskladToken.trim() || settings.moysklad_token?.trim() || "";
}

export async function getLoyaltyRuntimeSettings(): Promise<LoyaltyRuntimeSettings> {
  const settings = await getAppSettings([...LOYALTY_SETTING_KEYS]);
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
  };
}

export async function getLoyaltyAdminSettings() {
  const runtime = await getLoyaltyRuntimeSettings();
  return {
    enabled: runtime.enabled,
    groupName: runtime.groupName,
    participantTag: runtime.participantTag,
    defaultMaxWriteoffPercent: runtime.fallbackMaxWriteoffPercent,
    syncMode: runtime.syncMode,
  };
}

export async function saveLoyaltyAdminSettings(input: {
  enabled: boolean;
  groupName?: string;
  participantTag?: string;
  defaultMaxWriteoffPercent?: number;
}) {
  const groupName = input.groupName?.trim() || DEFAULT_LOYALTY_GROUP_NAME;
  const participantTag = input.participantTag?.trim() || groupName;
  const defaultMaxWriteoffPercent = clampInt(
    input.defaultMaxWriteoffPercent ?? DEFAULT_MAX_WRITEOFF_PERCENT,
    1,
    100
  );

  await Promise.all([
    setAppSetting("loyalty_enabled", input.enabled ? "true" : "false"),
    setAppSetting("loyalty_group_name", groupName),
    setAppSetting("loyalty_participant_tag", participantTag),
    setAppSetting(
      "loyalty_default_max_writeoff_percent",
      String(defaultMaxWriteoffPercent)
    ),
    setAppSetting("loyalty_sync_mode", "tag"),
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

async function fetchPosCounterpartyDetail(counterpartyHref: string) {
  const token = await getMoyskladToken();
  if (!token) {
    throw new Error("Токен МойСклад не настроен.");
  }

  const payload = await loadCounterpartyForPosDetail(counterpartyHref);
  const response = await fetch(`${POS_API_BASE_URL}/entity/counterparty/detail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lognex-Pos-Auth-Token": token,
    },
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

function buildLoyaltyStateFromPayload(args: {
  rawPayload: Record<string, unknown> | null;
  runtime: LoyaltyRuntimeSettings;
  user: typeof users.$inferSelect;
}) {
  const { rawPayload, runtime, user } = args;

  const bonusPoints =
    extractNumberByKnownKeys(rawPayload, [
      "bonusPoints",
      "availableBonusPoints",
      "availableBonuses",
      "bonuses",
      "balance",
      "bonusBalance",
    ]) ?? user.loyaltyBalance ?? 0;
  const pendingAccrual =
    extractNumberByKnownKeys(rawPayload, [
      "pendingBonusPoints",
      "pendingBonuses",
      "awaitingBonuses",
      "bonusPointsToAccrue",
    ]) ?? user.loyaltyPendingAccrual ?? 0;

  const maxWriteoffPercent =
    extractNumberByKnownKeys(rawPayload, [
      "maxSalePaymentPercent",
      "maxPaymentPercent",
      "maxPayPercent",
      "payBonusPercent",
      "bonusPayPercent",
      "writeOffPercent",
    ]) ?? runtime.fallbackMaxWriteoffPercent;

  const rawProgram =
    (rawPayload?.bonusProgram as Record<string, unknown> | undefined) ?? null;

  return {
    balance: clampInt(bonusPoints, 0, 10_000_000),
    availableToSpend: clampInt(bonusPoints, 0, 10_000_000),
    pendingAccrual: clampInt(pendingAccrual, 0, 10_000_000),
    maxWriteoffPercent: clampInt(maxWriteoffPercent, 1, 100),
    programName:
      typeof rawProgram?.name === "string" ? rawProgram.name.trim() : user.loyaltyProgramName,
    programMetaHref:
      typeof rawProgram?.meta === "object" &&
      rawProgram.meta &&
      typeof (rawProgram.meta as Record<string, unknown>).href === "string"
        ? ((rawProgram.meta as Record<string, unknown>).href as string).trim()
        : user.loyaltyProgramMetaHref,
  };
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

export async function refreshUserLoyaltyState(
  userId: number
): Promise<LoyaltyState> {
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
        loyaltyRulesJson: {
          maxWriteoffPercent: next.maxWriteoffPercent,
          source: rawPayload ? "moysklad" : "fallback",
        },
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

  return {
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
    availableToSpend: user.loyaltyAvailableToSpend ?? 0,
    pendingAccrual: user.loyaltyPendingAccrual ?? 0,
    programName: user.loyaltyProgramName ?? null,
    maxWriteoffPercent,
    lastSyncedAt: user.loyaltyLastSyncedAt,
    lastError: user.loyaltyLastError ?? null,
    counterpartyId: user.moyskladCounterpartyId ?? null,
    counterpartyHref: user.moyskladCounterpartyHref ?? null,
  };
}

export async function previewBonusWriteoff(args: {
  userId: number;
  subtotal: number;
  requestedAmount?: number | null;
}): Promise<BonusPreviewResult> {
  const state = await getUserLoyaltyState(args.userId);
  const subtotal = clampInt(args.subtotal, 0, 10_000_000);
  const requestedAmount = clampInt(args.requestedAmount ?? 0, 0, 10_000_000);

  if (!state.enabled) {
    return {
      enabled: false,
      participant: false,
      source: "disabled",
      balance: state.balance,
      availableToSpend: state.availableToSpend,
      pendingAccrual: state.pendingAccrual,
      maxWriteoffPercent: state.maxWriteoffPercent,
      maxWriteoffAmount: 0,
      requestedAmount,
      appliedAmount: 0,
      subtotal,
      totalAfterWriteoff: subtotal,
      warning: "Бонусная программа выключена.",
      groupName: state.groupName,
      programName: state.programName,
    };
  }

  if (!state.participant) {
    return {
      enabled: true,
      participant: false,
      source: "fallback",
      balance: state.balance,
      availableToSpend: state.availableToSpend,
      pendingAccrual: state.pendingAccrual,
      maxWriteoffPercent: state.maxWriteoffPercent,
      maxWriteoffAmount: 0,
      requestedAmount,
      appliedAmount: 0,
      subtotal,
      totalAfterWriteoff: subtotal,
      warning: `Покупатель не участвует в группе «${state.groupName}».`,
      groupName: state.groupName,
      programName: state.programName,
    };
  }

  const maxWriteoffAmount = Math.min(
    state.availableToSpend,
    clampInt((subtotal * state.maxWriteoffPercent) / 100, 0, subtotal)
  );
  const appliedAmount = clampInt(
    requestedAmount > 0 ? Math.min(requestedAmount, maxWriteoffAmount) : 0,
    0,
    maxWriteoffAmount
  );

  return {
    enabled: true,
    participant: true,
    source: state.lastSyncedAt ? "moysklad" : "fallback",
    balance: state.balance,
    availableToSpend: state.availableToSpend,
    pendingAccrual: state.pendingAccrual,
    maxWriteoffPercent: state.maxWriteoffPercent,
    maxWriteoffAmount,
    requestedAmount,
    appliedAmount,
    subtotal,
    totalAfterWriteoff: Math.max(0, subtotal - appliedAmount),
    warning: null,
    groupName: state.groupName,
    programName: state.programName,
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
  const percentApplied = args.preview?.maxWriteoffPercent ?? 0;
  const snapshot = args.preview
    ? {
        groupName: args.preview.groupName,
        programName: args.preview.programName,
        source: args.preview.source,
        balance: args.preview.balance,
        availableToSpend: args.preview.availableToSpend,
        maxWriteoffPercent: args.preview.maxWriteoffPercent,
        subtotal: args.preview.subtotal,
        appliedAmount: spent,
      }
    : null;

  await getDb()
    .update(orders)
    .set({
      loyaltyBonusSpent: spent,
      loyaltyWriteoffPercentApplied: percentApplied,
      loyaltyProgramSnapshotJson: snapshot,
    })
    .where(eq(orders.id, args.orderId));

  if (spent > 0) {
    await getDb().insert(bonusTransactions).values({
      userId: args.userId,
      orderId: args.orderId,
      direction: "debit",
      status: "pending",
      amount: spent,
      source: "site",
      note: "Бонусы применены при оформлении заказа и ждут подтверждения внешней системой.",
      payloadJson: snapshot,
    });
  }

  await writeLoyaltySyncLog({
    userId: args.userId,
    orderId: args.orderId,
    direction: "push",
    status: "success",
    message:
      spent > 0
        ? "В заказ сохранено списание бонусов."
        : "Заказ оформлен без списания бонусов.",
    details: snapshot,
  });
}

export async function listUserBonusTransactions(userId: number) {
  return getDb()
    .select()
    .from(bonusTransactions)
    .where(eq(bonusTransactions.userId, userId));
}

export async function listOrderBonusTransactions(orderId: number) {
  return getDb()
    .select()
    .from(bonusTransactions)
    .where(eq(bonusTransactions.orderId, orderId));
}

export async function syncOrderLoyaltyFromMoysklad(orderId: number) {
  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      loyaltyBonusSpent: orders.loyaltyBonusSpent,
      totalPrice: orders.totalPrice,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || !order.userId) {
    return null;
  }

  const state = await refreshUserLoyaltyState(order.userId);
  if (order.loyaltyBonusSpent > 0) {
    await db
      .update(bonusTransactions)
      .set({
        status:
          order.paymentStatus === "paid" || order.status === "completed"
            ? "applied"
            : order.status === "cancelled"
              ? "cancelled"
              : "pending",
        balanceAfter: state.balance,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bonusTransactions.orderId, orderId),
          eq(bonusTransactions.direction, "debit")
        )
      );
  }

  return state;
}
