import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { syncLogs } from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import { env } from "./env";
import { decryptSecret, encryptSecret } from "./secret-crypto";

const DEFAULT_RETURN_URL = "https://techaks.ru/payment/result";
const DEFAULT_WEBHOOK_URL = "https://techaks.ru/api/yookassa/webhook";

const SETTING_KEYS = [
  "yookassa_enabled",
  "yookassa_test_mode",
  "yookassa_shop_id",
  "yookassa_secret_key_encrypted",
  "yookassa_secret_key_last4",
  "yookassa_secret_key_set_at",
  "yookassa_test_shop_id",
  "yookassa_test_secret_key_encrypted",
  "yookassa_test_secret_key_last4",
  "yookassa_test_secret_key_set_at",
  "yookassa_live_shop_id",
  "yookassa_live_secret_key_encrypted",
  "yookassa_live_secret_key_last4",
  "yookassa_live_secret_key_set_at",
  "yookassa_last_check_mode",
  "yookassa_last_check_shop_id",
  "yookassa_last_check_ok",
  "yookassa_last_check_status",
  "yookassa_last_check_at",
  "yookassa_last_check_message",
  "yookassa_return_url",
  "yookassa_webhook_url",
  "yookassa_confirmation_type",
  "yookassa_capture",
] as const;

export const yookassaSettingsInputSchema = z.object({
  enabled: z.boolean(),
  testMode: z.boolean(),
  testShopId: z.string().trim().max(80).default(""),
  testSecretKey: z.string().trim().max(255).optional().default(""),
  liveShopId: z.string().trim().max(80).default(""),
  liveSecretKey: z.string().trim().max(255).optional().default(""),
  returnUrl: z.string().trim().url().default(DEFAULT_RETURN_URL),
  webhookUrl: z.string().trim().url().default(DEFAULT_WEBHOOK_URL),
  confirmationType: z.enum(["embedded", "redirect"]).default("redirect"),
  capture: z.boolean().default(true),
});

export type YooKassaRuntimeSettings = {
  enabled: boolean;
  testMode: boolean;
  mode: "test" | "live";
  shopId: string;
  secretKey: string;
  secretKeyConfigured: boolean;
  returnUrl: string;
  webhookUrl: string;
  confirmationType: "embedded" | "redirect";
  capture: boolean;
  source: "database" | "env" | "none";
  isConfigured: boolean;
};

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normalizeConfirmationType(
  value: string | null | undefined
): "embedded" | "redirect" {
  return value === "embedded" ? "embedded" : "redirect";
}

function last4(value: string) {
  return value.slice(-4);
}

function decryptStoredSecret(value: string) {
  if (!value || !env.appEncryptionKey.trim()) return "";
  return decryptSecret(value, env.appEncryptionKey);
}

async function logPaymentSettingsAudit(
  action: string,
  userId: number | null,
  details: Record<string, unknown>
) {
  await getDb().insert(syncLogs).values({
    type: "payment_settings",
    status: "success",
    message: action,
    details: {
      provider: "yookassa",
      userId,
      ...details,
    },
  });
}

export async function getYooKassaAdminSettings() {
  const settings = await getAppSettings([...SETTING_KEYS]);
  const testMode = parseBoolean(settings.yookassa_test_mode, false);
  const legacyShopId = settings.yookassa_shop_id?.trim() || "";
  const legacyEncryptedSecret =
    settings.yookassa_secret_key_encrypted?.trim() || "";
  const legacyLast4 = settings.yookassa_secret_key_last4?.trim() || "";
  const dbTestShopId = settings.yookassa_test_shop_id?.trim() || "";
  const dbLiveShopId = settings.yookassa_live_shop_id?.trim() || "";
  const dbTestEncryptedSecret =
    settings.yookassa_test_secret_key_encrypted?.trim() || "";
  const dbLiveEncryptedSecret =
    settings.yookassa_live_secret_key_encrypted?.trim() || "";
  const hasDatabaseSettings = Boolean(
    dbTestShopId ||
      dbLiveShopId ||
      dbTestEncryptedSecret ||
      dbLiveEncryptedSecret ||
      legacyShopId ||
      legacyEncryptedSecret
  );
  const hasEnvSettings = Boolean(
    (env.yookassaTestShopId && env.yookassaTestSecretKey) ||
      (env.yookassaLiveShopId && env.yookassaLiveSecretKey) ||
      (env.yookassaShopId && env.yookassaSecretKey)
  );

  const testShopId =
    dbTestShopId ||
    env.yookassaTestShopId.trim() ||
    (testMode ? legacyShopId : "");
  const liveShopId =
    dbLiveShopId ||
    env.yookassaLiveShopId.trim() ||
    env.yookassaShopId.trim() ||
    (!testMode ? legacyShopId : "");

  const testSecretConfigured = Boolean(
    dbTestEncryptedSecret ||
      env.yookassaTestSecretKey.trim() ||
      (testMode && legacyEncryptedSecret)
  );
  const liveSecretConfigured = Boolean(
    dbLiveEncryptedSecret ||
      env.yookassaLiveSecretKey.trim() ||
      env.yookassaSecretKey.trim() ||
      (!testMode && legacyEncryptedSecret)
  );

  return {
    enabled: hasDatabaseSettings
      ? parseBoolean(settings.yookassa_enabled, false)
      : hasEnvSettings,
    testMode,
    testShopId,
    testSecretKeyConfigured: testSecretConfigured,
    testSecretKeyLast4:
      settings.yookassa_test_secret_key_last4?.trim() ||
      (env.yookassaTestSecretKey ? last4(env.yookassaTestSecretKey) : "") ||
      (testMode ? legacyLast4 : ""),
    testSecretKeySetAt: settings.yookassa_test_secret_key_set_at || null,
    liveShopId,
    liveSecretKeyConfigured: liveSecretConfigured,
    liveSecretKeyLast4:
      settings.yookassa_live_secret_key_last4?.trim() ||
      (env.yookassaLiveSecretKey ? last4(env.yookassaLiveSecretKey) : "") ||
      (env.yookassaSecretKey ? last4(env.yookassaSecretKey) : "") ||
      (!testMode ? legacyLast4 : ""),
    liveSecretKeySetAt: settings.yookassa_live_secret_key_set_at || null,
    returnUrl:
      settings.yookassa_return_url?.trim() ||
      env.yookassaReturnUrl ||
      DEFAULT_RETURN_URL,
    webhookUrl:
      settings.yookassa_webhook_url?.trim() ||
      env.yookassaWebhookUrl ||
      DEFAULT_WEBHOOK_URL,
    confirmationType: normalizeConfirmationType(
      settings.yookassa_confirmation_type
    ),
    capture: parseBoolean(settings.yookassa_capture, true),
    source: hasDatabaseSettings
      ? "database"
      : hasEnvSettings
        ? "env"
        : "none",
    activeMode: testMode ? "test" : "live",
    activeShopId: testMode ? testShopId : liveShopId,
    activeSecretKeyConfigured: testMode
      ? testSecretConfigured
      : liveSecretConfigured,
    lastCheck: {
      mode: settings.yookassa_last_check_mode || null,
      shopId: settings.yookassa_last_check_shop_id || null,
      ok:
        settings.yookassa_last_check_ok === "true"
          ? true
          : settings.yookassa_last_check_ok === "false"
            ? false
            : null,
      status: settings.yookassa_last_check_status || null,
      at: settings.yookassa_last_check_at || null,
      message: settings.yookassa_last_check_message || null,
    },
    encryptionConfigured: Boolean(env.appEncryptionKey.trim()),
  };
}

export async function saveYooKassaAdminSettings(
  input: z.infer<typeof yookassaSettingsInputSchema>,
  userId: number | null
) {
  const normalized = yookassaSettingsInputSchema.parse(input);
  const testSecretKey = normalized.testSecretKey.trim();
  const liveSecretKey = normalized.liveSecretKey.trim();
  const changedFields = [
    "enabled",
    "testMode",
    "testShopId",
    "liveShopId",
    "returnUrl",
    "webhookUrl",
    "confirmationType",
    "capture",
  ];

  if ((testSecretKey || liveSecretKey) && !env.appEncryptionKey.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "APP_ENCRYPTION_KEY не задан. Нельзя сохранить Secret Key YooKassa.",
    });
  }

  await setAppSetting("yookassa_enabled", normalized.enabled ? "true" : "false");
  await setAppSetting("yookassa_test_mode", normalized.testMode ? "true" : "false");
  await setAppSetting("yookassa_test_shop_id", normalized.testShopId);
  await setAppSetting("yookassa_live_shop_id", normalized.liveShopId);
  await setAppSetting("yookassa_return_url", normalized.returnUrl);
  await setAppSetting("yookassa_webhook_url", normalized.webhookUrl);
  await setAppSetting("yookassa_confirmation_type", normalized.confirmationType);
  await setAppSetting("yookassa_capture", normalized.capture ? "true" : "false");

  if (testSecretKey) {
    await setAppSetting(
      "yookassa_test_secret_key_encrypted",
      encryptSecret(testSecretKey, env.appEncryptionKey)
    );
    await setAppSetting("yookassa_test_secret_key_last4", last4(testSecretKey));
    await setAppSetting("yookassa_test_secret_key_set_at", new Date().toISOString());
    changedFields.push("testSecretKey");
  }

  if (liveSecretKey) {
    await setAppSetting(
      "yookassa_live_secret_key_encrypted",
      encryptSecret(liveSecretKey, env.appEncryptionKey)
    );
    await setAppSetting("yookassa_live_secret_key_last4", last4(liveSecretKey));
    await setAppSetting("yookassa_live_secret_key_set_at", new Date().toISOString());
    changedFields.push("liveSecretKey");
  }

  await logPaymentSettingsAudit("YooKassa settings updated", userId, {
    changedFields,
    testSecretKeyChanged: Boolean(testSecretKey),
    liveSecretKeyChanged: Boolean(liveSecretKey),
    secretKeyValueLogged: false,
  });

  return getYooKassaAdminSettings();
}

export async function getYooKassaRuntimeSettings(): Promise<YooKassaRuntimeSettings> {
  const settings = await getAppSettings([...SETTING_KEYS]);
  const testMode = parseBoolean(settings.yookassa_test_mode, false);
  const mode = testMode ? "test" : "live";
  const legacyShopId = settings.yookassa_shop_id?.trim() || "";
  const legacySecret = settings.yookassa_secret_key_encrypted?.trim() || "";
  const dbTestShopId = settings.yookassa_test_shop_id?.trim() || "";
  const dbLiveShopId = settings.yookassa_live_shop_id?.trim() || "";
  const dbTestEncryptedSecret =
    settings.yookassa_test_secret_key_encrypted?.trim() || "";
  const dbLiveEncryptedSecret =
    settings.yookassa_live_secret_key_encrypted?.trim() || "";

  const testShopId =
    dbTestShopId ||
    env.yookassaTestShopId.trim() ||
    (testMode ? legacyShopId : "");
  const liveShopId =
    dbLiveShopId ||
    env.yookassaLiveShopId.trim() ||
    env.yookassaShopId.trim() ||
    (!testMode ? legacyShopId : "");
  const encryptedTestSecret =
    dbTestEncryptedSecret || (testMode ? legacySecret : "");
  const encryptedLiveSecret =
    dbLiveEncryptedSecret || (!testMode ? legacySecret : "");
  const testSecretKey =
    decryptStoredSecret(encryptedTestSecret) || env.yookassaTestSecretKey.trim();
  const liveSecretKey =
    decryptStoredSecret(encryptedLiveSecret) ||
    env.yookassaLiveSecretKey.trim() ||
    env.yookassaSecretKey.trim();

  const shopId = mode === "test" ? testShopId : liveShopId;
  const secretKey = mode === "test" ? testSecretKey : liveSecretKey;
  const hasDatabaseSettings = Boolean(
    dbTestShopId ||
      dbLiveShopId ||
      dbTestEncryptedSecret ||
      dbLiveEncryptedSecret ||
      legacyShopId ||
      legacySecret
  );
  const enabled = hasDatabaseSettings
    ? parseBoolean(settings.yookassa_enabled, false)
    : Boolean(shopId && secretKey);

  return {
    enabled,
    testMode,
    mode,
    shopId,
    secretKey,
    secretKeyConfigured: Boolean(secretKey),
    returnUrl:
      settings.yookassa_return_url?.trim() ||
      env.yookassaReturnUrl ||
      DEFAULT_RETURN_URL,
    webhookUrl:
      settings.yookassa_webhook_url?.trim() ||
      env.yookassaWebhookUrl ||
      DEFAULT_WEBHOOK_URL,
    confirmationType: normalizeConfirmationType(
      settings.yookassa_confirmation_type
    ),
    capture: parseBoolean(settings.yookassa_capture, true),
    source: hasDatabaseSettings ? "database" : shopId || secretKey ? "env" : "none",
    isConfigured: Boolean(enabled && shopId && secretKey),
  };
}

export async function testYooKassaConnection(userId: number | null) {
  const runtime = await getYooKassaRuntimeSettings();

  if (!runtime.shopId || !runtime.secretKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `YooKassa (${runtime.mode}) не настроена: укажите Shop ID и Secret Key.`,
    });
  }

  const credentials = Buffer.from(
    `${runtime.shopId}:${runtime.secretKey}`,
    "utf8"
  ).toString("base64");
  const response = await fetch("https://api.yookassa.ru/v3/payments?limit=1", {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  });

  const message = response.ok
    ? "Подключение к YooKassa успешно проверено."
    : `YooKassa вернула ошибку подключения: HTTP ${response.status}.`;

  await setAppSetting("yookassa_last_check_mode", runtime.mode);
  await setAppSetting("yookassa_last_check_shop_id", runtime.shopId);
  await setAppSetting("yookassa_last_check_ok", response.ok ? "true" : "false");
  await setAppSetting("yookassa_last_check_status", String(response.status));
  await setAppSetting("yookassa_last_check_at", new Date().toISOString());
  await setAppSetting("yookassa_last_check_message", message);

  await logPaymentSettingsAudit("YooKassa connection tested", userId, {
    source: runtime.source,
    mode: runtime.mode,
    shopId: runtime.shopId,
    secretKeyConfigured: runtime.secretKeyConfigured,
    ok: response.ok,
    status: response.status,
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }

  return {
    success: true,
    source: runtime.source,
    mode: runtime.mode,
    shopId: runtime.shopId,
    secretKeyConfigured: runtime.secretKeyConfigured,
    status: response.status,
    message,
  };
}

export const PaymentSettingsService = {
  getYooKassaAdminSettings,
  saveYooKassaAdminSettings,
  getYooKassaRuntimeSettings,
  testYooKassaConnection,
};
