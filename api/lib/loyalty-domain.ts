export const LOYALTY_STATE_MAX_AGE_MS = 12 * 60 * 60_000;

export type LoyaltyAvailabilityInput = {
  enabled: boolean;
  participant: boolean;
  status: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
};

export type LoyaltyAvailability = {
  dataFresh: boolean;
  canSpend: boolean;
  reason: string | null;
};

export function getLoyaltyAvailability(
  state: LoyaltyAvailabilityInput,
  now = Date.now()
): LoyaltyAvailability {
  if (!state.enabled) {
    return { dataFresh: false, canSpend: false, reason: "Бонусная программа выключена." };
  }
  if (!state.participant) {
    return {
      dataFresh: false,
      canSpend: false,
      reason: "Покупатель пока не участвует в бонусной программе.",
    };
  }
  if (state.status !== "active" || state.lastError) {
    return {
      dataFresh: false,
      canSpend: false,
      reason: "Не удалось подтвердить актуальный бонусный баланс. Заказ можно оформить без бонусов.",
    };
  }
  const syncedAt = state.lastSyncedAt?.getTime() ?? 0;
  if (!syncedAt || now - syncedAt > LOYALTY_STATE_MAX_AGE_MS) {
    return {
      dataFresh: false,
      canSpend: false,
      reason: "Бонусный баланс обновляется. Заказ можно оформить без бонусов.",
    };
  }
  return { dataFresh: true, canSpend: true, reason: null };
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function readScopedNumber(
  payload: Record<string, unknown> | null,
  keys: string[],
  containers = ["loyalty", "bonus", "bonusProgram", "bonusInfo", "result"]
) {
  if (!payload) return null;
  for (const key of keys) {
    const value = toFiniteNumber(payload[key]);
    if (value !== null) return value;
  }
  for (const container of containers) {
    const nested = payload[container];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const record = nested as Record<string, unknown>;
    for (const key of keys) {
      const value = toFiniteNumber(record[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

export function buildLoyaltyJobActiveKey(input: {
  jobType: string;
  userId?: number | null;
  orderId?: number | null;
}) {
  return `${input.jobType}:u${input.userId ?? 0}:o${input.orderId ?? 0}`;
}
