import { z } from "zod";
import { createRouter, protectedProcedure, requireAbility } from "../middleware";
import { getAppSettings, setAppSetting } from "../lib/app-settings";
import { env } from "../lib/env";
import { getGeminiConfig, testGeminiConnection } from "../lib/gemini-spec-standardization";

export const settingsRouter = createRouter({
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
      await setAppSetting("maintenance_mode", input.isEnabled ? "true" : "false");
      await setAppSetting("maintenance_reopen_date", input.reopenDate);
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
      if (input.apiKey) {
        await setAppSetting("gemini_api_key", input.apiKey);
      }
      await setAppSetting("gemini_model", input.model);
      await setAppSetting("ai_proxy_base_url", input.proxyBaseUrl || "");
      if (input.proxyToken) {
        await setAppSetting("ai_proxy_token", input.proxyToken);
      }

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
      await setAppSetting("manufacturer_logo_provider", input.provider);
      if (input.logoDevToken) {
        await setAppSetting(
          "manufacturer_logo_logo_dev_token",
          input.logoDevToken
        );
      }
      return { success: true };
    }),

  clearManufacturerLogoToken: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    await setAppSetting("manufacturer_logo_logo_dev_token", "");
    return { success: true };
  }),

  clearGeminiApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    await setAppSetting("gemini_api_key", "");
    return { success: true };
  }),

  clearAiProxyToken: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    await setAppSetting("ai_proxy_token", "");
    return { success: true };
  }),

  getMoySklad: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    const settings = await getAppSettings(["moysklad_token"]);
    const token = settings.moysklad_token?.trim() || "";
    return {
      hasToken: Boolean(token),
      tokenMasked: token
        ? `${token.slice(0, 4)}••••••••${token.slice(-4)}`
        : "",
    };
  }),

  saveMoySklad: protectedProcedure
    .input(z.object({ token: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      await setAppSetting("moysklad_token", input.token);
      return { success: true };
    }),

  clearMoySkladToken: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    await setAppSetting("moysklad_token", "");
    return { success: true };
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
      
      if (input.vapidPublicKey !== undefined) await setAppSetting("vapid_public_key", input.vapidPublicKey);
      if (input.vapidPrivateKey) await setAppSetting("vapid_private_key", input.vapidPrivateKey);
      if (input.vapidSubject !== undefined) await setAppSetting("vapid_subject", input.vapidSubject);
      
      if (input.smtpHost !== undefined) await setAppSetting("smtp_host", input.smtpHost);
      if (input.smtpPort !== undefined) await setAppSetting("smtp_port", input.smtpPort);
      if (input.smtpUser !== undefined) await setAppSetting("smtp_user", input.smtpUser);
      if (input.smtpPass) await setAppSetting("smtp_pass", input.smtpPass);
      if (input.smtpFrom !== undefined) await setAppSetting("smtp_from", input.smtpFrom);

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
});
