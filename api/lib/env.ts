import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function optional(name: string): string {
  return process.env[name] ?? "";
}

export const env = {
  appId: optional("APP_ID"),
  appSecret: optional("APP_SECRET"),
  aiProxyBaseUrl: optional("AI_PROXY_BASE_URL"),
  aiProxyToken: optional("AI_PROXY_TOKEN"),
  geminiApiKey: optional("GEMINI_API_KEY"),
  geminiModel: optional("GEMINI_MODEL") || "gemini-2.5-flash",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  
  // Web Push
  vapidPublicKey: optional("VAPID_PUBLIC_KEY"),
  vapidPrivateKey: optional("VAPID_PRIVATE_KEY"),
  vapidSubject: optional("VAPID_SUBJECT") || "mailto:admin@techaks.ru",

  // SMTP (fallback for dev)
  smtpHost: optional("SMTP_HOST"),
  smtpPort: parseInt(optional("SMTP_PORT") || "587"),
  smtpUser: optional("SMTP_USER"),
  smtpPass: optional("SMTP_PASS"),
  smtpFrom: optional("SMTP_FROM") || "TechAks <no-reply@techaks.ru>",
  moyskladToken: optional("MOYSKLAD_TOKEN"),
  moyskladWebhookToken: optional("MOYSKLAD_WEBHOOK_TOKEN"),
  moyskladDefaultCounterpartyHref: optional("MOYSKLAD_DEFAULT_COUNTERPARTY_HREF"),
  moyskladLoyaltyCashierUid: optional("MOYSKLAD_LOYALTY_CASHIER_UID"),
  moyskladLoyaltyStoreUid: optional("MOYSKLAD_LOYALTY_STORE_UID"),
  moyskladReserveOnOrder:
    optional("MOYSKLAD_RESERVE_ON_ORDER").toLowerCase() === "true",
  appEncryptionKey: optional("APP_ENCRYPTION_KEY"),
  yookassaShopId: optional("YOOKASSA_SHOP_ID"),
  yookassaSecretKey: optional("YOOKASSA_SECRET_KEY"),
  yookassaTestShopId: optional("YOOKASSA_TEST_SHOP_ID"),
  yookassaTestSecretKey: optional("YOOKASSA_TEST_SECRET_KEY"),
  yookassaLiveShopId: optional("YOOKASSA_LIVE_SHOP_ID"),
  yookassaLiveSecretKey: optional("YOOKASSA_LIVE_SECRET_KEY"),
  yookassaReturnUrl:
    optional("YOOKASSA_RETURN_URL") || "https://techaks.ru/payment/result",
  yookassaWebhookUrl:
    optional("YOOKASSA_WEBHOOK_URL") || "https://techaks.ru/api/yookassa/webhook",
  yandexDeliveryEnabled:
    optional("YANDEX_DELIVERY_ENABLED").toLowerCase() === "true",
  yandexDeliveryAccessToken: optional("YANDEX_DELIVERY_ACCESS_TOKEN"),
  yandexDeliverySelectedCorpClientId: optional(
    "YANDEX_DELIVERY_SELECTED_CORP_CLIENT_ID"
  ),
  yandexDeliveryApiBaseUrl:
    optional("YANDEX_DELIVERY_API_BASE_URL") ||
    "https://business.taxi.yandex.ru",
};
