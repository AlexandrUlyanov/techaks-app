import { z } from "zod";
import { createRouter, protectedProcedure, publicQuery, requireAbility } from "../middleware";
import { getAppSettings, setAppSetting } from "../lib/app-settings";
import { env } from "../lib/env";
import { getGeminiConfig, testGeminiConnection } from "../lib/gemini-spec-standardization";
import {
  defaultSiteProfileSettings,
  getPublicSiteProfile,
  getSiteProfileSettings,
  saveSiteProfileSettings,
} from "../lib/site-profile-settings";
import { enqueueSearchReindexJob, rebuildSearchDocumentsForPages } from "../lib/search";
import {
  getYooKassaAdminSettings,
  getYooKassaRuntimeSettings,
  saveYooKassaAdminSettings,
  testYooKassaConnection,
  yookassaSettingsInputSchema,
} from "../lib/payment-settings";
import { listAdminAuditLogs, writeAdminAuditLog } from "../lib/admin-audit";

const siteProfileSettingsSchema = z.object({
  contacts: z.object({
    primaryPhone: z.string().trim().min(3).max(60),
    primaryPhoneDisplay: z.string().trim().min(3).max(80),
    secondaryPhone: z.string().trim().max(80).default(""),
    email: z.string().trim().email(),
    workingHours: z.string().trim().min(2).max(120),
    whatsappUrl: z.string().trim().max(255).default(""),
    telegramUrl: z.string().trim().max(255).default(""),
    telegramHandle: z.string().trim().max(120).default(""),
    shortAddress: z.string().trim().min(2).max(255),
    fullAddress: z.string().trim().min(2).max(500),
  }),
  seller: z.object({
    legalForm: z.enum(["ip", "ooo"]),
    fullName: z.string().trim().min(2).max(255),
    shortName: z.string().trim().min(2).max(255),
    signatoryName: z.string().trim().min(2).max(255),
    signatoryLabel: z.string().trim().min(2).max(255),
    signatoryBasis: z.string().trim().min(2).max(255),
    legalAddress: z.string().trim().min(2).max(500),
    actualAddress: z.string().trim().min(2).max(500),
    inn: z.string().trim().min(3).max(40),
    ogrnip: z.string().trim().min(3).max(40),
    kpp: z.string().trim().max(40).default(""),
    okpo: z.string().trim().max(40).default(""),
    email: z.string().trim().email(),
    phone: z.string().trim().min(3).max(60),
  }),
  bank: z.object({
    bankName: z.string().trim().min(2).max(255),
    account: z.string().trim().min(3).max(80),
    corrAccount: z.string().trim().min(3).max(80),
    bik: z.string().trim().min(3).max(40),
    inn: z.string().trim().min(3).max(40),
    kpp: z.string().trim().max(40).default(""),
  }),
  legalTexts: z.object({
    offerTitle: z.string().trim().min(2).max(255),
    offerContent: z.string().trim().min(2),
    privacyPolicyTitle: z.string().trim().min(2).max(255),
    privacyPolicyContent: z.string().trim().min(2),
    paymentDeliveryTitle: z.string().trim().min(2).max(255),
    paymentDeliveryContent: z.string().trim().min(2),
    returnsPolicyTitle: z.string().trim().min(2).max(255),
    returnsPolicyContent: z.string().trim().min(2),
  }),
  documents: z.object({
    signatureName: z.string().trim().min(2).max(255),
    signatureLabel: z.string().trim().min(2).max(255),
    requisitesFooter: z.string().trim().min(2).max(500),
  }),
});

export const settingsRouter = createRouter({
  getAdminAuditLogs: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
          entityType: z.string().trim().optional(),
          action: z.string().trim().optional(),
          limit: z.number().int().min(1).max(250).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      return listAdminAuditLogs(input);
    }),

  getPublicSiteProfile: publicQuery.query(async () => {
    return getPublicSiteProfile();
  }),

  getSiteProfileSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return getSiteProfileSettings();
  }),

  saveSiteProfileSettings: protectedProcedure
    .input(siteProfileSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getSiteProfileSettings();
      await saveSiteProfileSettings(input);
      await enqueueSearchReindexJob({
        entityType: "page",
        entityId: null,
        reason: "site_profile_updated",
      });
      await rebuildSearchDocumentsForPages();
      await writeAdminAuditLog({
        ctx,
        action: "settings.site_profile.update",
        entityType: "settings",
        entityLabel: "Профиль сайта",
        before,
        after: input,
      });
      return { success: true };
    }),

  getGemini: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    const settings = await getAppSettings([
      "gemini_api_key",
      "gemini_model",
      "ai_proxy_base_url",
      "ai_proxy_token",
      "manufacturer_logo_provider",
      "manufacturer_logo_logo_dev_token",
    ]);
    const config = await getGeminiConfig();
    const storedKey = settings.gemini_api_key?.trim() || "";
    const storedProxyToken = settings.ai_proxy_token?.trim() || "";

    return {
      provider: "gemini",
      model: settings.gemini_model?.trim() || env.geminiModel,
      hasApiKey: Boolean(config.apiKey),
      isConfigured: Boolean(config.proxyBaseUrl || config.apiKey),
      proxyBaseUrl: settings.ai_proxy_base_url?.trim() || env.aiProxyBaseUrl || "",
      hasProxy: Boolean(config.proxyBaseUrl),
      proxyTokenMasked: storedProxyToken
        ? `${storedProxyToken.slice(0, 4)}••••••••${storedProxyToken.slice(-4)}`
        : config.proxySource === "env" && env.aiProxyToken
          ? "Используется токен из .env"
          : "",
      apiKeyMasked: storedKey
        ? `${storedKey.slice(0, 4)}••••••••${storedKey.slice(-4)}`
        : config.source === "env" && env.geminiApiKey
          ? "Используется ключ из .env"
          : "",
      source: config.source,
      proxySource: config.proxySource,
      manufacturerLogoProvider:
        settings.manufacturer_logo_provider?.trim() || "logo_dev",
      manufacturerLogoLogoDevTokenMasked: settings.manufacturer_logo_logo_dev_token
        ?.trim()
        ? `${settings.manufacturer_logo_logo_dev_token.trim().slice(0, 4)}••••••••${settings.manufacturer_logo_logo_dev_token.trim().slice(-4)}`
        : "",
    };
  }),

  getMaintenanceStatus: publicQuery.query(async () => {
    const settings = await getAppSettings([
      "maintenance_mode",
      "maintenance_reopen_date",
    ]);
    return {
      isEnabled: settings.maintenance_mode === "true",
      reopenDate: settings.maintenance_reopen_date || null,
    };
  }),

  saveMaintenanceSettings: protectedProcedure
    .input(
      z.object({
        isEnabled: z.boolean(),
        reopenDate: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getAppSettings([
        "maintenance_mode",
        "maintenance_reopen_date",
      ]);
      await setAppSetting("maintenance_mode", input.isEnabled ? "true" : "false");
      await setAppSetting("maintenance_reopen_date", input.reopenDate);
      await writeAdminAuditLog({
        ctx,
        action: "settings.maintenance.update",
        entityType: "settings",
        entityLabel: "Режим техобслуживания",
        before,
        after: input,
      });
      return { success: true };
    }),

  getReservationSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    const settings = await getAppSettings(["reservation_duration_minutes"]);
    const stored = Number(settings.reservation_duration_minutes || 180);
    return {
      durationMinutes: Number.isFinite(stored) && stored >= 15 ? stored : 180,
    };
  }),

  saveReservationSettings: protectedProcedure
    .input(
      z.object({
        durationMinutes: z.number().int().min(15).max(7 * 24 * 60),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getAppSettings(["reservation_duration_minutes"]);
      await setAppSetting(
        "reservation_duration_minutes",
        String(input.durationMinutes)
      );
      await writeAdminAuditLog({
        ctx,
        action: "settings.reservations.update",
        entityType: "settings",
        entityLabel: "Настройки резервов",
        before,
        after: input,
      });
      return { success: true };
    }),

  saveGemini: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().trim().optional().default(""),
        model: z.string().trim().min(1).max(120).default("gemini-2.5-flash"),
        proxyBaseUrl: z.string().trim().optional().default(""),
        proxyToken: z.string().trim().optional().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getAppSettings([
        "gemini_api_key",
        "gemini_model",
        "ai_proxy_base_url",
        "ai_proxy_token",
      ]);
      if (input.apiKey) {
        await setAppSetting("gemini_api_key", input.apiKey);
      }
      await setAppSetting("gemini_model", input.model);
      await setAppSetting("ai_proxy_base_url", input.proxyBaseUrl || "");
      if (input.proxyToken) {
        await setAppSetting("ai_proxy_token", input.proxyToken);
      }

      await writeAdminAuditLog({
        ctx,
        action: "settings.ai.update",
        entityType: "settings",
        entityLabel: "AI и Gemini",
        before,
        after: input,
      });
      return { success: true };
    }),

  saveManufacturerLogoSettings: protectedProcedure
    .input(
      z.object({
        provider: z.string().trim().min(1).max(60).default("logo_dev"),
        logoDevToken: z.string().trim().optional().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getAppSettings([
        "manufacturer_logo_provider",
        "manufacturer_logo_logo_dev_token",
      ]);
      await setAppSetting("manufacturer_logo_provider", input.provider);
      if (input.logoDevToken) {
        await setAppSetting(
          "manufacturer_logo_logo_dev_token",
          input.logoDevToken
        );
      }
      await writeAdminAuditLog({
        ctx,
        action: "settings.logo_provider.update",
        entityType: "settings",
        entityLabel: "Логотипы брендов",
        before,
        after: input,
      });
      return { success: true };
    }),

  clearManufacturerLogoToken: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    const before = await getAppSettings(["manufacturer_logo_logo_dev_token"]);
    await setAppSetting("manufacturer_logo_logo_dev_token", "");
    await writeAdminAuditLog({
      ctx,
      action: "settings.logo_provider.clear_token",
      entityType: "settings",
      entityLabel: "Логотипы брендов",
      before,
      after: { manufacturer_logo_logo_dev_token: "" },
    });
    return { success: true };
  }),

  clearGeminiApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    const before = await getAppSettings(["gemini_api_key"]);
    await setAppSetting("gemini_api_key", "");
    await writeAdminAuditLog({
      ctx,
      action: "settings.ai.clear_api_key",
      entityType: "settings",
      entityLabel: "AI и Gemini",
      before,
      after: { gemini_api_key: "" },
    });
    return { success: true };
  }),

  clearAiProxyToken: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    const before = await getAppSettings(["ai_proxy_token"]);
    await setAppSetting("ai_proxy_token", "");
    await writeAdminAuditLog({
      ctx,
      action: "settings.ai.clear_proxy_token",
      entityType: "settings",
      entityLabel: "AI и Gemini",
      before,
      after: { ai_proxy_token: "" },
    });
    return { success: true };
  }),

  getMoySklad: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    const settings = await getAppSettings([
      "moysklad_token",
      "moysklad_webhook_secret",
    ]);
    const token = settings.moysklad_token?.trim() || "";
    const webhookSecret = settings.moysklad_webhook_secret?.trim() || "";
    return {
      hasToken: Boolean(token),
      tokenMasked: token
        ? `${token.slice(0, 4)}••••••••${token.slice(-4)}`
        : "",
      hasWebhookSecret: Boolean(webhookSecret),
      webhookSecretMasked: webhookSecret
        ? `${webhookSecret.slice(0, 4)}••••••••${webhookSecret.slice(-4)}`
        : "",
    };
  }),

  saveMoySklad: protectedProcedure
    .input(
      z.object({
        token: z.string().trim().optional().default(""),
        webhookSecret: z.string().trim().optional().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getAppSettings([
        "moysklad_token",
        "moysklad_webhook_secret",
      ]);
      if (input.token) {
        await setAppSetting("moysklad_token", input.token);
      }
      if (input.webhookSecret) {
        await setAppSetting("moysklad_webhook_secret", input.webhookSecret);
      }
      await writeAdminAuditLog({
        ctx,
        action: "settings.moysklad.update",
        entityType: "settings",
        entityLabel: "Интеграция МойСклад",
        before,
        after: input,
      });
      return { success: true };
    }),

  clearMoySkladToken: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    const before = await getAppSettings(["moysklad_token"]);
    await setAppSetting("moysklad_token", "");
    await writeAdminAuditLog({
      ctx,
      action: "settings.moysklad.clear_token",
      entityType: "settings",
      entityLabel: "Интеграция МойСклад",
      before,
      after: { moysklad_token: "" },
    });
    return { success: true };
  }),

  clearMoySkladWebhookSecret: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    const before = await getAppSettings(["moysklad_webhook_secret"]);
    await setAppSetting("moysklad_webhook_secret", "");
    await writeAdminAuditLog({
      ctx,
      action: "settings.moysklad.clear_webhook_secret",
      entityType: "settings",
      entityLabel: "Интеграция МойСклад",
      before,
      after: { moysklad_webhook_secret: "" },
    });
    return { success: true };
  }),

  getYooKassaSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "manage_payment_settings", "Settings");
    return getYooKassaAdminSettings();
  }),

  getPublicYooKassaStatus: publicQuery.query(async () => {
    const settings = await getYooKassaRuntimeSettings();
    return {
      enabled: settings.isConfigured,
      confirmationType: settings.confirmationType,
      testMode: settings.testMode,
    };
  }),

  saveYooKassaSettings: protectedProcedure
    .input(yookassaSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "manage_payment_settings", "Settings");
      const before = await getYooKassaAdminSettings();
      const result = await saveYooKassaAdminSettings(input, ctx.user?.id ?? null);
      const after = await getYooKassaAdminSettings();
      await writeAdminAuditLog({
        ctx,
        action: "settings.yookassa.update",
        entityType: "settings",
        entityLabel: "YooKassa",
        before,
        after,
        meta: {
          requestedMode: input.testMode ? "test" : "live",
        },
      });
      return result;
    }),

  testYooKassaConnection: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "manage_payment_settings", "Settings");
    const result = await testYooKassaConnection(ctx.user?.id ?? null);
    await writeAdminAuditLog({
      ctx,
      action: "settings.yookassa.test_connection",
      entityType: "settings",
      entityLabel: "YooKassa",
      meta: result,
    });
    return result;
  }),

  getAuthSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    const settings = await getAppSettings([
      "vapid_public_key",
      "vapid_private_key",
      "vapid_subject",
      "smtp_host",
      "smtp_port",
      "smtp_user",
      "smtp_pass",
      "smtp_from",
    ]);

    const mask = (val: string | null) =>
      val ? `${val.slice(0, 4)}••••••••${val.slice(-4)}` : "";

    return {
      vapidPublicKey: settings.vapid_public_key || env.vapidPublicKey || "",
      hasVapidPrivateKey: Boolean(settings.vapid_private_key || env.vapidPrivateKey),
      vapidPrivateKeyMasked: mask(settings.vapid_private_key || env.vapidPrivateKey),
      vapidSubject: settings.vapid_subject || env.vapidSubject || "mailto:admin@techaks.ru",
      
      smtpHost: settings.smtp_host || env.smtpHost || "",
      smtpPort: settings.smtp_port || env.smtpPort.toString() || "465",
      smtpUser: settings.smtp_user || env.smtpUser || "",
      hasSmtpPass: Boolean(settings.smtp_pass || env.smtpPass),
      smtpPassMasked: mask(settings.smtp_pass || env.smtpPass),
      smtpFrom: settings.smtp_from || env.smtpFrom || "TechAks <no-reply@techaks.ru>",
      
      source: {
        vapid: settings.vapid_public_key ? "database" : "env",
        smtp: settings.smtp_host ? "database" : "env",
      }
    };
  }),

  saveAuthSettings: protectedProcedure
    .input(z.object({
      vapidPublicKey: z.string().optional(),
      vapidPrivateKey: z.string().optional(),
      vapidSubject: z.string().optional(),
      smtpHost: z.string().optional(),
      smtpPort: z.string().optional(),
      smtpUser: z.string().optional(),
      smtpPass: z.string().optional(),
      smtpFrom: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getAppSettings([
        "vapid_public_key",
        "vapid_private_key",
        "vapid_subject",
        "smtp_host",
        "smtp_port",
        "smtp_user",
        "smtp_pass",
        "smtp_from",
      ]);
      
      if (input.vapidPublicKey !== undefined) await setAppSetting("vapid_public_key", input.vapidPublicKey);
      if (input.vapidPrivateKey) await setAppSetting("vapid_private_key", input.vapidPrivateKey);
      if (input.vapidSubject !== undefined) await setAppSetting("vapid_subject", input.vapidSubject);
      
      if (input.smtpHost !== undefined) await setAppSetting("smtp_host", input.smtpHost);
      if (input.smtpPort !== undefined) await setAppSetting("smtp_port", input.smtpPort);
      if (input.smtpUser !== undefined) await setAppSetting("smtp_user", input.smtpUser);
      if (input.smtpPass) await setAppSetting("smtp_pass", input.smtpPass);
      if (input.smtpFrom !== undefined) await setAppSetting("smtp_from", input.smtpFrom);

      await writeAdminAuditLog({
        ctx,
        action: "settings.auth.update",
        entityType: "settings",
        entityLabel: "Авторизация и уведомления",
        before,
        after: input,
      });
      return { success: true };
    }),

  testGemini: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().trim().optional(),
        model: z.string().trim().optional(),
        proxyBaseUrl: z.string().trim().optional(),
        proxyToken: z.string().trim().optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      return testGeminiConnection(input);
    }),

  getSiteProfileDefaults: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return defaultSiteProfileSettings;
  }),
});
