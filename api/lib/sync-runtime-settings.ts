import { z } from "zod";
import { getAppSettings, setAppSetting } from "./app-settings";

export const syncRuntimeSettingKeys = [
  "moysklad_webhook_worker_enabled",
  "moysklad_webhook_worker_interval_seconds",
  "moysklad_reconcile_enabled",
  "moysklad_reconcile_interval_minutes",
  "moysklad_full_sync_enabled",
  "moysklad_full_sync_time",
  "moysklad_full_sync_timezone",
  "moysklad_full_sync_max_duration_minutes",
  "moysklad_full_sync_heartbeat_timeout_minutes",
  "moysklad_scheduler_last_full_sync_key",
] as const;

const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/u, "Используйте формат ЧЧ:ММ");

export const syncRuntimeSettingsInputSchema = z.object({
  webhookWorkerEnabled: z.boolean(),
  webhookWorkerIntervalSeconds: z.number().int().min(10).max(3600),
  reconcileEnabled: z.boolean(),
  reconcileIntervalMinutes: z.number().int().min(5).max(1440),
  fullSyncEnabled: z.boolean(),
  fullSyncTime: hhmmSchema,
  fullSyncTimezone: z.string().trim().min(1).max(120),
  fullSyncMaxDurationMinutes: z.number().int().min(15).max(24 * 60),
  fullSyncHeartbeatTimeoutMinutes: z.number().int().min(5).max(24 * 60),
});

export type SyncRuntimeSettings = z.infer<
  typeof syncRuntimeSettingsInputSchema
> & {
  schedulerLastFullSyncKey: string | null;
};

export const defaultSyncRuntimeSettings: SyncRuntimeSettings = {
  webhookWorkerEnabled: true,
  webhookWorkerIntervalSeconds: 60,
  reconcileEnabled: true,
  reconcileIntervalMinutes: 30,
  fullSyncEnabled: true,
  fullSyncTime: "03:00",
  fullSyncTimezone: "UTC",
  fullSyncMaxDurationMinutes: 120,
  fullSyncHeartbeatTimeoutMinutes: 15,
  schedulerLastFullSyncKey: null,
};

function parseBooleanSetting(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseIntSetting(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringSetting(value: string | null, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export async function getSyncRuntimeSettings(): Promise<SyncRuntimeSettings> {
  const values = await getAppSettings([...syncRuntimeSettingKeys]);

  return {
    webhookWorkerEnabled: parseBooleanSetting(
      values.moysklad_webhook_worker_enabled,
      defaultSyncRuntimeSettings.webhookWorkerEnabled
    ),
    webhookWorkerIntervalSeconds: parseIntSetting(
      values.moysklad_webhook_worker_interval_seconds,
      defaultSyncRuntimeSettings.webhookWorkerIntervalSeconds
    ),
    reconcileEnabled: parseBooleanSetting(
      values.moysklad_reconcile_enabled,
      defaultSyncRuntimeSettings.reconcileEnabled
    ),
    reconcileIntervalMinutes: parseIntSetting(
      values.moysklad_reconcile_interval_minutes,
      defaultSyncRuntimeSettings.reconcileIntervalMinutes
    ),
    fullSyncEnabled: parseBooleanSetting(
      values.moysklad_full_sync_enabled,
      defaultSyncRuntimeSettings.fullSyncEnabled
    ),
    fullSyncTime: parseStringSetting(
      values.moysklad_full_sync_time,
      defaultSyncRuntimeSettings.fullSyncTime
    ),
    fullSyncTimezone: parseStringSetting(
      values.moysklad_full_sync_timezone,
      defaultSyncRuntimeSettings.fullSyncTimezone
    ),
    fullSyncMaxDurationMinutes: parseIntSetting(
      values.moysklad_full_sync_max_duration_minutes,
      defaultSyncRuntimeSettings.fullSyncMaxDurationMinutes
    ),
    fullSyncHeartbeatTimeoutMinutes: parseIntSetting(
      values.moysklad_full_sync_heartbeat_timeout_minutes,
      defaultSyncRuntimeSettings.fullSyncHeartbeatTimeoutMinutes
    ),
    schedulerLastFullSyncKey:
      values.moysklad_scheduler_last_full_sync_key?.trim() || null,
  };
}

export async function saveSyncRuntimeSettings(
  input: z.infer<typeof syncRuntimeSettingsInputSchema>
) {
  const normalized = syncRuntimeSettingsInputSchema.parse(input);

  const writes: Array<Promise<unknown>> = [
    setAppSetting(
      "moysklad_webhook_worker_enabled",
      normalized.webhookWorkerEnabled ? "true" : "false"
    ),
    setAppSetting(
      "moysklad_webhook_worker_interval_seconds",
      String(normalized.webhookWorkerIntervalSeconds)
    ),
    setAppSetting(
      "moysklad_reconcile_enabled",
      normalized.reconcileEnabled ? "true" : "false"
    ),
    setAppSetting(
      "moysklad_reconcile_interval_minutes",
      String(normalized.reconcileIntervalMinutes)
    ),
    setAppSetting(
      "moysklad_full_sync_enabled",
      normalized.fullSyncEnabled ? "true" : "false"
    ),
    setAppSetting("moysklad_full_sync_time", normalized.fullSyncTime),
    setAppSetting("moysklad_full_sync_timezone", normalized.fullSyncTimezone),
    setAppSetting(
      "moysklad_full_sync_max_duration_minutes",
      String(normalized.fullSyncMaxDurationMinutes)
    ),
    setAppSetting(
      "moysklad_full_sync_heartbeat_timeout_minutes",
      String(normalized.fullSyncHeartbeatTimeoutMinutes)
    ),
  ];

  await Promise.all(writes);

  return normalized;
}

export async function setSyncSchedulerLastFullSyncKey(value: string | null) {
  await setAppSetting("moysklad_scheduler_last_full_sync_key", value);
}

function getDateTimeParts(now: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "";

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

export function normalizeSyncTimeZone(input: string | null | undefined) {
  const candidate = input?.trim() || defaultSyncRuntimeSettings.fullSyncTimezone;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return defaultSyncRuntimeSettings.fullSyncTimezone;
  }
}

export function getSyncSchedulerSlot(
  now: Date,
  fullSyncTime: string,
  timeZone: string
) {
  const normalizedTimeZone = normalizeSyncTimeZone(timeZone);
  const [scheduledHour, scheduledMinute] = fullSyncTime.split(":");
  const parts = getDateTimeParts(now, normalizedTimeZone);
  const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
  const slotKey = `${dayKey}@${fullSyncTime}`;

  return {
    timeZone: normalizedTimeZone,
    dayKey,
    slotKey,
    matches:
      parts.hour === scheduledHour &&
      parts.minute === scheduledMinute,
    hour: parts.hour,
    minute: parts.minute,
  };
}
