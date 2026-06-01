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
  "yookassa_return_url",
  "yookassa_webhook_url",
  "yookassa_confirmation_type",
  "yookassa_capture",
] as const;

export const yookassaSettingsInputSchema = z.object({
  enabled: z.boolean(),
  testMode: z.boolean(),
  shopId: z.string().trim().max(80).default(""),
  secretKey: z.string().trim().max(255).optional().default(""),
  returnUrl: z.string().trim().url().default(DEFAULT_RETURN_URL),
  webhookUrl: z.string().trim().url().default(DEFAULT_WEBHOOK_URL),
  confirmationType: z.enum(["embedded", "redirect"]).default("redirect"),
  capture: z.boolean().default(true),
});

export type YooKassaRuntimeSettings = {
  enabled: boolean;
  testMode: boolean;
  shopId: string;
  secretKey: string;
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
  const storedShopId = settings.yookassa_shop_id?.trim() || "";
  const storedEncryptedSecret =
    settings.yookassa_secret_key_encrypted?.trim() || "";
  const envShopId = env.yookassaShopId.trim();
  const envSecretKey = env.yookassaSecretKey.trim();
  const hasDatabaseSettings = Boolean(storedShopId || storedEncryptedSecret);
  const secretConfigured = Boolean(storedEncryptedSecret || envSecretKey);
  const secretLast4 =
    settings.yookassa_secret_key_last4?.trim() ||
    (envSecretKey ? last4(envSecretKey) : "");

  return {
    enabled: hasDatabaseSettings
      ? parseBoolean(settings.yookassa_enabled, false)
      : Boolean(envShopId && envSecretKey),
    testMode: parseBoolean(settings.yookassa_test_mode, false),
    shopId: storedShopId || envShopId,
    secretKeyConfigured: secretConfigured,
    secretKeyLast4: secretLast4,
    secretKeySetAt: settings.yookassa_secret_key_set_at || null,
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
    source: hasDatabaseSettings ? "database" : envShopId || envSecretKey ? "env" : "none",
    encryptionConfigured: Boolean(env.appEncryptionKey.trim()),
  };
}

export async function saveYooKassaAdminSettings(
  input: z.infer<typeof yookassaSettingsInputSchema>,
  userId: number | null
) {
  const normalized = yookassaSettingsInputSchema.parse(input);
  const secretKey = normalized.secretKey.trim();
  const changedFields = [
    "enabled",
    "testMode",
    "shopId",
    "returnUrl",
    "webhookUrl",
    "confirmationType",
    "capture",
  ];

  if (secretKey && !env.appEncryptionKey.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "APP_ENCRYPTION_KEY не задан. Нельзя сохранить Secret Key YooKassa.",
    });
  }

  await setAppSetting("yookassa_enabled", normalized.enabled ? "true" : "false");
  await setAppSetting("yookassa_test_mode", normalized.testMode ? "true" : "false");
  await setAppSetting("yookassa_shop_id", normalized.shopId);
  await setAppSetting("yookassa_return_url", normalized.returnUrl);
  await setAppSetting("yookassa_webhook_url", normalized.webhookUrl);
  await setAppSetting("yookassa_confirmation_type", normalized.confirmationType);
  await setAppSetting("yookassa_capture", normalized.capture ? "true" : "false");

  if (secretKey) {
    await setAppSetting(
      "yookassa_secret_key_encrypted",
      encryptSecret(secretKey, env.appEncryptionKey)
    );
    await setAppSetting("yookassa_secret_key_last4", last4(secretKey));
    await setAppSetting("yookassa_secret_key_set_at", new Date().toISOString());
    changedFields.push("secretKey");
  }

  await logPaymentSettingsAudit("YooKassa settings updated", userId, {
    changedFields,
    secretKeyChanged: Boolean(secretKey),
    secretKeyValueLogged: false,
  });

  return getYooKassaAdminSettings();
}

export async function getYooKassaRuntimeSettings(): Promise<YooKassaRuntimeSettings> {
  const settings = await getAppSettings([...SETTING_KEYS]);
  const storedShopId = settings.yookassa_shop_id?.trim() || "";
  const encryptedSecret = settings.yookassa_secret_key_encrypted?.trim() || "";
  const hasDatabaseSettings = Boolean(storedShopId || encryptedSecret);

  if (hasDatabaseSettings) {
    let secretKey = "";
    if (encryptedSecret && env.appEncryptionKey.trim()) {
      secretKey = decryptSecret(encryptedSecret, env.appEncryptionKey);
    }

    const runtime = {
      enabled: parseBoolean(settings.yookassa_enabled, false),
      testMode: parseBoolean(settings.yookassa_test_mode, false),
      shopId: storedShopId,
      secretKey,
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
      source: "database" as const,
    };

    return {
      ...runtime,
      isConfigured: Boolean(runtime.enabled && runtime.shopId && runtime.secretKey),
    };
  }

  const shopId = env.yookassaShopId.trim();
  const secretKey = env.yookassaSecretKey.trim();

  return {
    enabled: Boolean(shopId && secretKey),
    testMode: false,
    shopId,
    secretKey,
    returnUrl: env.yookassaReturnUrl || DEFAULT_RETURN_URL,
    webhookUrl: env.yookassaWebhookUrl || DEFAULT_WEBHOOK_URL,
    confirmationType: "redirect",
    capture: true,
    source: shopId || secretKey ? "env" : "none",
    isConfigured: Boolean(shopId && secretKey),
  };
}

export async function testYooKassaConnection(userId: number | null) {
  const runtime = await getYooKassaRuntimeSettings();

  if (!runtime.shopId || !runtime.secretKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "YooKassa не настроена: укажите Shop ID и Secret Key.",
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

  await logPaymentSettingsAudit("YooKassa connection tested", userId, {
    source: runtime.source,
    ok: response.ok,
    status: response.status,
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `YooKassa вернула ошибку подключения: HTTP ${response.status}.`,
    });
  }

  return {
    success: true,
    source: runtime.source,
    status: response.status,
    message: "Подключение к YooKassa успешно проверено.",
  };
}

export const PaymentSettingsService = {
  getYooKassaAdminSettings,
  saveYooKassaAdminSettings,
  getYooKassaRuntimeSettings,
  testYooKassaConnection,
};
