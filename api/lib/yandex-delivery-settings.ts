import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { syncLogs } from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import { env } from "./env";
import { decryptSecret, encryptSecret } from "./secret-crypto";

const DEFAULT_API_BASE_URL = "https://b2b.taxi.yandex.net";

const SETTING_KEYS = [
  "yandex_delivery_enabled",
  "yandex_delivery_access_token_encrypted",
  "yandex_delivery_access_token_last4",
  "yandex_delivery_access_token_set_at",
  "yandex_delivery_selected_corp_client_id",
  "yandex_delivery_use_selected_corp_client_id",
  "yandex_delivery_api_base_url",
  "yandex_delivery_last_check_ok",
  "yandex_delivery_last_check_status",
  "yandex_delivery_last_check_at",
  "yandex_delivery_last_check_message",
  "yandex_geosuggest_enabled",
  "yandex_geosuggest_api_key_encrypted",
  "yandex_geosuggest_api_key_last4",
  "yandex_geosuggest_api_key_set_at",
  "yandex_geosuggest_last_check_ok",
  "yandex_geosuggest_last_check_status",
  "yandex_geosuggest_last_check_at",
  "yandex_geosuggest_last_check_message",
] as const;

export const yandexDeliverySettingsInputSchema = z.object({
  enabled: z.boolean().default(false),
  accessToken: z.string().trim().max(1024).optional().default(""),
  selectedCorpClientId: z.string().trim().max(255).default(""),
  useSelectedCorpClientId: z.boolean().default(false),
  apiBaseUrl: z.string().trim().url().default(DEFAULT_API_BASE_URL),
  geosuggestEnabled: z.boolean().default(false),
  geosuggestApiKey: z.string().trim().max(1024).optional().default(""),
});

const TEST_ROUTE_POINTS = [
  {
    id: 1,
    fullname: "Россия, Пенза, улица Ленина, 7",
    coordinates: [45.0183, 53.1959],
  },
  {
    id: 2,
    fullname: "Россия, Пенза, проспект Строителей, 50А",
    coordinates: [44.920956, 53.222379],
  },
] as const;

const TEST_ITEMS = [
  {
    quantity: 1,
    pickup_point: 1,
    dropoff_point: 2,
    title: "Тестовый заказ ТЕХАКС",
  },
] as const;

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function tail4(value: string) {
  return value.slice(-4);
}

function resolveGeoSuggestEnabled(
  settings: Partial<Record<(typeof SETTING_KEYS)[number], string>>,
  hasApiKey: boolean,
) {
  if (!hasApiKey) return false;

  const savedValue = settings.yandex_geosuggest_enabled;
  if (!savedValue) return true;

  // Старые настройки могли сохранить ключ, но оставить флаг выключенным.
  // Если подключение уже успешно проверяли, считаем GeoSuggest рабочим.
  if (
    savedValue === "false" &&
    settings.yandex_geosuggest_last_check_ok === "true"
  ) {
    return true;
  }

  return parseBoolean(savedValue, true);
}

function decryptStoredSecret(value: string) {
  if (!value || !env.appEncryptionKey.trim()) return "";
  return decryptSecret(value, env.appEncryptionKey);
}

function buildBaseUrl(value?: string | null) {
  const normalized = (value || "").trim().replace(/\/+$/, "");
  return normalized || DEFAULT_API_BASE_URL;
}

async function logYandexDeliverySettingsAudit(
  action: string,
  userId: number | null,
  details: Record<string, unknown>
) {
  await getDb().insert(syncLogs).values({
    type: "delivery_settings",
    status: "success",
    message: action,
    details: {
      provider: "yandex_delivery",
      userId,
      ...details,
    },
  });
}

export async function getYandexDeliveryAdminSettings(): Promise<{
  enabled: boolean;
  selectedCorpClientId: string;
  useSelectedCorpClientId: boolean;
  apiBaseUrl: string;
  accessTokenConfigured: boolean;
  accessTokenLast4: string;
  accessTokenSetAt: string | null;
  source: "database" | "env" | "none";
  lastCheck: {
    ok: boolean | null;
    status: string | null;
    at: string | null;
    message: string | null;
  };
  geosuggest: {
    enabled: boolean;
    apiKeyConfigured: boolean;
    apiKeyLast4: string;
    apiKeySetAt: string | null;
    source: "database" | "env" | "none";
    lastCheck: {
      ok: boolean | null;
      status: string | null;
      at: string | null;
      message: string | null;
    };
  };
  encryptionConfigured: boolean;
}> {
  const settings = await getAppSettings([...SETTING_KEYS]);
  const dbEncryptedToken =
    settings.yandex_delivery_access_token_encrypted?.trim() || "";
  const dbEncryptedGeosuggestKey =
    settings.yandex_geosuggest_api_key_encrypted?.trim() || "";
  const dbCorpClientId =
    settings.yandex_delivery_selected_corp_client_id?.trim() || "";
  const dbUseCorpClientId = parseBoolean(
    settings.yandex_delivery_use_selected_corp_client_id,
    false
  );
  const dbApiBaseUrl = buildBaseUrl(settings.yandex_delivery_api_base_url);
  const hasDatabaseSettings = Boolean(dbEncryptedToken || dbCorpClientId);
  const hasEnvSettings = Boolean(
    env.yandexDeliveryAccessToken.trim() ||
      env.yandexDeliverySelectedCorpClientId.trim()
  );
  const hasEnvGeosuggestSettings = Boolean(env.yandexGeosuggestApiKey.trim());
  const hasGeoSuggestApiKey = Boolean(
    dbEncryptedGeosuggestKey || hasEnvGeosuggestSettings
  );
  const geosuggestSource: "database" | "env" | "none" = dbEncryptedGeosuggestKey
    ? "database"
    : hasEnvGeosuggestSettings
      ? "env"
      : "none";

  return {
    enabled: hasDatabaseSettings
      ? parseBoolean(settings.yandex_delivery_enabled, false)
      : env.yandexDeliveryEnabled,
    selectedCorpClientId:
      dbCorpClientId || env.yandexDeliverySelectedCorpClientId.trim() || "",
    useSelectedCorpClientId:
      hasDatabaseSettings || dbUseCorpClientId
        ? dbUseCorpClientId
        : Boolean(env.yandexDeliverySelectedCorpClientId.trim()),
    apiBaseUrl: dbApiBaseUrl || buildBaseUrl(env.yandexDeliveryApiBaseUrl),
    accessTokenConfigured: Boolean(
      dbEncryptedToken || env.yandexDeliveryAccessToken.trim()
    ),
    accessTokenLast4:
      settings.yandex_delivery_access_token_last4?.trim() ||
      (env.yandexDeliveryAccessToken
        ? tail4(env.yandexDeliveryAccessToken)
        : "") ||
      "",
    accessTokenSetAt: settings.yandex_delivery_access_token_set_at || null,
    source: hasDatabaseSettings
      ? "database"
      : hasEnvSettings
        ? "env"
        : "none",
    lastCheck: {
      ok:
        settings.yandex_delivery_last_check_ok === "true"
          ? true
          : settings.yandex_delivery_last_check_ok === "false"
            ? false
            : null,
      status: settings.yandex_delivery_last_check_status || null,
      at: settings.yandex_delivery_last_check_at || null,
      message: settings.yandex_delivery_last_check_message || null,
    },
    geosuggest: {
      enabled: resolveGeoSuggestEnabled(settings, hasGeoSuggestApiKey),
      apiKeyConfigured: Boolean(
        dbEncryptedGeosuggestKey || env.yandexGeosuggestApiKey.trim()
      ),
      apiKeyLast4:
        settings.yandex_geosuggest_api_key_last4?.trim() ||
        (env.yandexGeosuggestApiKey
          ? tail4(env.yandexGeosuggestApiKey)
          : "") ||
        "",
      apiKeySetAt: settings.yandex_geosuggest_api_key_set_at || null,
      source: geosuggestSource,
      lastCheck: {
        ok:
          settings.yandex_geosuggest_last_check_ok === "true"
            ? true
            : settings.yandex_geosuggest_last_check_ok === "false"
              ? false
              : null,
        status: settings.yandex_geosuggest_last_check_status || null,
        at: settings.yandex_geosuggest_last_check_at || null,
        message: settings.yandex_geosuggest_last_check_message || null,
      },
    },
    encryptionConfigured: Boolean(env.appEncryptionKey.trim()),
  };
}

export async function saveYandexDeliveryAdminSettings(
  input: z.infer<typeof yandexDeliverySettingsInputSchema>,
  userId: number | null
) {
  const normalized = yandexDeliverySettingsInputSchema.parse(input);
  const accessToken = normalized.accessToken.trim();
  const geosuggestApiKey = normalized.geosuggestApiKey.trim();
  const nextGeoSuggestEnabled = geosuggestApiKey
    ? true
    : normalized.geosuggestEnabled;
  const changedFields = [
    "enabled",
    "selectedCorpClientId",
    "useSelectedCorpClientId",
    "apiBaseUrl",
    "geosuggestEnabled",
  ];

  if ((accessToken || geosuggestApiKey) && !env.appEncryptionKey.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "APP_ENCRYPTION_KEY не задан. Нельзя сохранить секретные ключи интеграций.",
    });
  }

  await setAppSetting(
    "yandex_delivery_enabled",
    normalized.enabled ? "true" : "false"
  );
  await setAppSetting(
    "yandex_delivery_selected_corp_client_id",
    normalized.selectedCorpClientId
  );
  await setAppSetting(
    "yandex_delivery_use_selected_corp_client_id",
    normalized.useSelectedCorpClientId ? "true" : "false"
  );
  await setAppSetting(
    "yandex_delivery_api_base_url",
    buildBaseUrl(normalized.apiBaseUrl)
  );
  await setAppSetting(
    "yandex_geosuggest_enabled",
    nextGeoSuggestEnabled ? "true" : "false"
  );

  if (accessToken) {
    await setAppSetting(
      "yandex_delivery_access_token_encrypted",
      encryptSecret(accessToken, env.appEncryptionKey)
    );
    await setAppSetting("yandex_delivery_access_token_last4", tail4(accessToken));
    await setAppSetting(
      "yandex_delivery_access_token_set_at",
      new Date().toISOString()
    );
    changedFields.push("accessToken");
  }
  if (geosuggestApiKey) {
    await setAppSetting(
      "yandex_geosuggest_api_key_encrypted",
      encryptSecret(geosuggestApiKey, env.appEncryptionKey)
    );
    await setAppSetting(
      "yandex_geosuggest_api_key_last4",
      tail4(geosuggestApiKey)
    );
    await setAppSetting(
      "yandex_geosuggest_api_key_set_at",
      new Date().toISOString()
    );
    changedFields.push("geosuggestApiKey");
  }

  await logYandexDeliverySettingsAudit("settings_saved", userId, {
    changedFields,
    enabled: normalized.enabled,
    hasCorpClientId: Boolean(normalized.selectedCorpClientId),
    useSelectedCorpClientId: normalized.useSelectedCorpClientId,
    apiBaseUrl: buildBaseUrl(normalized.apiBaseUrl),
    geosuggestEnabled: nextGeoSuggestEnabled,
    geosuggestApiKeyUpdated: Boolean(geosuggestApiKey),
  });

  return { success: true };
}

export async function getYandexDeliveryRuntimeSettings() {
  const settings = await getAppSettings([...SETTING_KEYS]);
  const dbEncryptedToken =
    settings.yandex_delivery_access_token_encrypted?.trim() || "";
  const dbToken = decryptStoredSecret(dbEncryptedToken);
  const dbCorpClientId =
    settings.yandex_delivery_selected_corp_client_id?.trim() || "";
  const dbUseCorpClientId = parseBoolean(
    settings.yandex_delivery_use_selected_corp_client_id,
    false
  );
  const dbApiBaseUrl = buildBaseUrl(settings.yandex_delivery_api_base_url);

  const token = dbToken || env.yandexDeliveryAccessToken.trim();
  const selectedCorpClientId =
    dbCorpClientId || env.yandexDeliverySelectedCorpClientId.trim() || "";
  const useSelectedCorpClientId =
    dbToken || dbCorpClientId || settings.yandex_delivery_use_selected_corp_client_id
      ? dbUseCorpClientId
      : Boolean(env.yandexDeliverySelectedCorpClientId.trim());
  const apiBaseUrl = dbApiBaseUrl || buildBaseUrl(env.yandexDeliveryApiBaseUrl);
  const source = dbToken || dbCorpClientId ? "database" : token ? "env" : "none";
  const enabled =
    source === "database"
      ? parseBoolean(settings.yandex_delivery_enabled, false)
      : env.yandexDeliveryEnabled;

  return {
    enabled,
    accessToken: token,
    selectedCorpClientId,
    useSelectedCorpClientId,
    apiBaseUrl,
    source,
    isConfigured: Boolean(enabled && token),
  };
}

export async function getYandexGeoSuggestRuntimeSettings() {
  const settings = await getAppSettings([...SETTING_KEYS]);
  const dbEncryptedKey =
    settings.yandex_geosuggest_api_key_encrypted?.trim() || "";
  const dbKey = decryptStoredSecret(dbEncryptedKey);
  const apiKey = dbKey || env.yandexGeosuggestApiKey.trim();
  const source = dbKey ? "database" : apiKey ? "env" : "none";
  const enabled = resolveGeoSuggestEnabled(settings, Boolean(apiKey));

  return {
    enabled,
    apiKey,
    source,
    isConfigured: Boolean(enabled && apiKey),
  };
}

export async function testYandexDeliveryConnection(userId: number | null) {
  const settings = await getYandexDeliveryRuntimeSettings();
  if (!settings.accessToken) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Токен Яндекс Доставки не задан. Сначала сохраните credentials.",
    });
  }

  const url = `${buildBaseUrl(settings.apiBaseUrl)}/b2b/cargo/integration/v2/offers/calculate`;
  let ok = false;
  let statusCode = 0;
  let message = "Подключение к Яндекс Доставке успешно проверено.";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: /^bearer\s+/i.test(settings.accessToken)
          ? settings.accessToken
          : `Bearer ${settings.accessToken}`,
        Accept: "application/json",
        "Accept-Language": "ru",
        "Content-Type": "application/json",
        ...(settings.useSelectedCorpClientId && settings.selectedCorpClientId
          ? {
              "X-YaTaxi-Selected-Corp-Client-Id":
                settings.selectedCorpClientId,
            }
          : {}),
      },
      body: JSON.stringify({
        route_points: TEST_ROUTE_POINTS,
        items: TEST_ITEMS,
        requirements: {
          taxi_classes: ["express"],
        },
      }),
    });

    statusCode = response.status;
    const responseText = await response.text();
    if (!response.ok) {
      message =
        responseText ||
        `HTTP ${response.status}. Яндекс Доставка отклонила проверку подключения.`;
      throw new TRPCError({
        code: "BAD_REQUEST",
        message,
      });
    }

    ok = true;
    message = `Подключение к Яндекс Доставке успешно проверено (HTTP ${response.status}).`;
  } catch (error) {
    if (!(error instanceof TRPCError)) {
      message =
        error instanceof Error
          ? error.message
          : "Не удалось проверить подключение к Яндекс Доставке.";
    }
    await setAppSetting("yandex_delivery_last_check_ok", "false");
    await setAppSetting(
      "yandex_delivery_last_check_status",
      String(statusCode || 0)
    );
    await setAppSetting("yandex_delivery_last_check_at", new Date().toISOString());
    await setAppSetting("yandex_delivery_last_check_message", message);
    await logYandexDeliverySettingsAudit("test_connection_failed", userId, {
      statusCode,
      message,
      apiBaseUrl: settings.apiBaseUrl,
      hasCorpClientId: Boolean(settings.selectedCorpClientId),
      useSelectedCorpClientId: settings.useSelectedCorpClientId,
    });
    throw error instanceof TRPCError
      ? error
      : new TRPCError({ code: "BAD_REQUEST", message });
  }

  await setAppSetting("yandex_delivery_last_check_ok", ok ? "true" : "false");
  await setAppSetting(
    "yandex_delivery_last_check_status",
    String(statusCode || 200)
  );
  await setAppSetting("yandex_delivery_last_check_at", new Date().toISOString());
  await setAppSetting("yandex_delivery_last_check_message", message);

  const result = {
    ok,
    status: String(statusCode || 200),
    at: new Date().toISOString(),
    message,
    apiBaseUrl: settings.apiBaseUrl,
    selectedCorpClientId: settings.selectedCorpClientId || null,
    useSelectedCorpClientId: settings.useSelectedCorpClientId,
  };

  await logYandexDeliverySettingsAudit("test_connection_ok", userId, result);
  return result;
}

export async function testYandexGeoSuggestConnection(userId: number | null) {
  const settings = await getYandexGeoSuggestRuntimeSettings();
  if (!settings.apiKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "API-ключ GeoSuggest не задан. Сначала сохраните ключ.",
    });
  }

  const url = new URL("https://suggest-maps.yandex.ru/v1/suggest");
  url.searchParams.set("apikey", settings.apiKey);
  url.searchParams.set("text", "Пенза, Ленина, 1");
  url.searchParams.set("types", "geo");
  url.searchParams.set("print_address", "1");
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("results", "5");
  url.searchParams.set("bbox", "44.75,53.10~45.15,53.32");
  url.searchParams.set("strict_bounds", "1");
  url.searchParams.set("countries", "ru");

  let ok = false;
  let statusCode = 0;
  let message = "Подключение к GeoSuggest успешно проверено.";

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "ru",
        "User-Agent": "TechaksCheckout/1.0",
      },
    });

    statusCode = response.status;
    const responseText = await response.text();
    if (!response.ok) {
      message =
        responseText ||
        `HTTP ${response.status}. GeoSuggest отклонил проверку подключения.`;
      throw new TRPCError({ code: "BAD_REQUEST", message });
    }

    const payload = JSON.parse(responseText || "{}") as { results?: unknown[] };
    const resultCount = Array.isArray(payload.results)
      ? payload.results.length
      : 0;
    ok = true;
    message = `GeoSuggest успешно отвечает (HTTP ${response.status}, подсказок: ${resultCount}).`;
  } catch (error) {
    if (!(error instanceof TRPCError)) {
      message =
        error instanceof Error
          ? error.message
          : "Не удалось проверить подключение к GeoSuggest.";
    }
    await setAppSetting("yandex_geosuggest_last_check_ok", "false");
    await setAppSetting(
      "yandex_geosuggest_last_check_status",
      String(statusCode || 0)
    );
    await setAppSetting("yandex_geosuggest_last_check_at", new Date().toISOString());
    await setAppSetting("yandex_geosuggest_last_check_message", message);
    await logYandexDeliverySettingsAudit("geosuggest_test_failed", userId, {
      statusCode,
      message,
      source: settings.source,
    });
    throw error instanceof TRPCError
      ? error
      : new TRPCError({ code: "BAD_REQUEST", message });
  }

  await setAppSetting("yandex_geosuggest_last_check_ok", ok ? "true" : "false");
  if (ok) {
    await setAppSetting("yandex_geosuggest_enabled", "true");
  }
  await setAppSetting(
    "yandex_geosuggest_last_check_status",
    String(statusCode || 200)
  );
  await setAppSetting("yandex_geosuggest_last_check_at", new Date().toISOString());
  await setAppSetting("yandex_geosuggest_last_check_message", message);

  const result = {
    ok,
    status: String(statusCode || 200),
    at: new Date().toISOString(),
    message,
    source: settings.source,
  };

  await logYandexDeliverySettingsAudit("geosuggest_test_ok", userId, result);
  return result;
}
