import { z } from "zod";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
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
import {
  getLoyaltyAdminSettings,
  saveLoyaltyAdminSettings,
} from "../lib/moysklad-loyalty";
import { listAdminAuditLogs, writeAdminAuditLog } from "../lib/admin-audit";
import {
  buildVkFeed,
  buildYandexYmlFeed,
  getFeedCatalogOverview,
  getVkFeedSettings,
  getYandexYmlFeedSettings,
  saveVkFeedSettings,
  saveYandexYmlFeedSettings,
  validateYandexYmlFeed,
  validateVkFeed,
  vkFeedSettingsInputSchema,
  yandexYmlFeedSettingsInputSchema,
} from "../lib/feeds";
import {
  getHomepageHeroAdminSettings,
  homepageHeroAdminSettingsSchema,
  saveHomepageHeroAdminSettings,
} from "../lib/homepage-hero";
import {
  buildHomepagePromoShowcaseData,
  homepagePromoShowcaseSettingsSchema,
} from "../lib/homepage-promo-showcase";
import { refreshHomepageSnapshot } from "../lib/homepage-snapshot";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { buildPublicProductVisibilityCondition } from "../lib/product-visibility";
import { getManufacturerNameFromProductSpecs } from "../lib/manufacturers";

const siteProfileSettingsSchema = z.object({
  contacts: z.object({
    primaryPhone: z.string().trim().min(3).max(60),
    primaryPhoneDisplay: z.string().trim().min(3).max(80),
    secondaryPhone: z.string().trim().max(80).default(""),
    email: z.string().trim().email(),
    workingHours: z.string().trim().min(2).max(120),
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

const homepageHeroVariantSchema = z.enum([
  "classic",
  "interactive",
  "promo_showcase",
  "promo_showcase_3d",
]);
const loyaltySettingsInputSchema = z.object({
  enabled: z.boolean(),
  groupName: z.string().trim().min(2).max(120).default("техакс"),
  participantTag: z.string().trim().min(2).max(120).default("техакс"),
  defaultMaxWriteoffPercent: z.number().int().min(1).max(100).default(30),
  posCashierUid: z.string().trim().max(255).optional().default(""),
  posStoreUid: z.string().trim().max(255).optional().default(""),
});

const publicProductVisibilityCondition = buildPublicProductVisibilityCondition();
const SEO_AUDIT_BASE_URL =
  process.env.NODE_ENV === "production" ? "https://techaks.ru" : "http://127.0.0.1:3000";

type StorefrontAuditExpectation = {
  label: string;
  path: string;
  expectedCanonical?: string;
  expectedNoindex?: boolean;
};

type StorefrontAuditResult = {
  label: string;
  path: string;
  url: string;
  status: number | null;
  title: string | null;
  canonical: string | null;
  robots: string | null;
  h1: string | null;
  ok: boolean;
  issues: string[];
};

type StorefrontPerformanceExpectation = {
  label: string;
  path: string;
};

type StorefrontPerformanceResult = {
  label: string;
  path: string;
  url: string;
  status: number | null;
  responseMs: number | null;
  htmlBytes: number | null;
  ok: boolean;
  issues: string[];
};

function stripSeoHtml(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadTagValue(html: string, tagName: string) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return stripSeoHtml(match?.[1] ?? "");
}

function extractCanonicalHref(html: string) {
  const match =
    html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ??
    html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return match?.[1]?.trim() ?? "";
}

function extractRobotsContent(html: string) {
  const match =
    html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']robots["'][^>]*>/i);
  return match?.[1]?.trim() ?? "";
}

async function runStorefrontSeoAudit(checks: StorefrontAuditExpectation[]) {
  const results = await Promise.all(
    checks.map(async check => {
      const url = `${SEO_AUDIT_BASE_URL}${check.path}`;

      try {
        const response = await fetch(url, {
          headers: { "user-agent": "techaks-seo-audit/1.0" },
          signal: AbortSignal.timeout(6_000),
        });

        const html = await response.text();
        const title = extractHeadTagValue(html, "title");
        const canonical = extractCanonicalHref(html);
        const robots = extractRobotsContent(html);
        const h1 = extractHeadTagValue(html, "h1");
        const issues: string[] = [];

        if (!response.ok) {
          issues.push(`HTTP ${response.status}`);
        }
        if (!title) {
          issues.push("Нет <title>");
        }
        if (!canonical) {
          issues.push("Нет canonical");
        } else if (check.expectedCanonical && canonical !== check.expectedCanonical) {
          issues.push(`Canonical отличается: ${canonical}`);
        }

        const robotsLower = robots.toLowerCase();
        if (check.expectedNoindex) {
          if (!robotsLower.includes("noindex")) {
            issues.push("Ожидали noindex");
          }
        } else if (robotsLower.includes("noindex")) {
          issues.push("Неожиданный noindex");
        }

        if (!h1) {
          issues.push("Нет H1 в HTML");
        }

        return {
          label: check.label,
          path: check.path,
          url,
          status: response.status,
          title: title || null,
          canonical: canonical || null,
          robots: robots || null,
          h1: h1 || null,
          ok: issues.length === 0,
          issues,
        } satisfies StorefrontAuditResult;
      } catch (error) {
        return {
          label: check.label,
          path: check.path,
          url,
          status: null,
          title: null,
          canonical: null,
          robots: null,
          h1: null,
          ok: false,
          issues: [error instanceof Error ? error.message : "Не удалось выполнить запрос"],
        } satisfies StorefrontAuditResult;
      }
    })
  );

  return {
    checkedAt: new Date().toISOString(),
    baseUrl: SEO_AUDIT_BASE_URL,
    okCount: results.filter(item => item.ok).length,
    issueCount: results.filter(item => !item.ok).length,
    results,
  };
}

async function runStorefrontPerformanceAudit(checks: StorefrontPerformanceExpectation[]) {
  const results = await Promise.all(
    checks.map(async check => {
      const url = `${SEO_AUDIT_BASE_URL}${check.path}`;
      const startedAt = Date.now();

      try {
        const response = await fetch(url, {
          headers: { "user-agent": "techaks-seo-performance-audit/1.0" },
          signal: AbortSignal.timeout(6_000),
        });
        const html = await response.text();
        const responseMs = Date.now() - startedAt;
        const headerBytes = Number(response.headers.get("content-length") ?? 0) || null;
        const htmlBytes = headerBytes ?? Buffer.byteLength(html, "utf8");
        const issues: string[] = [];

        if (!response.ok) {
          issues.push(`HTTP ${response.status}`);
        }
        if (responseMs > 1_500) {
          issues.push(`Медленный HTML-ответ: ${responseMs} мс`);
        }
        if (htmlBytes > 250_000) {
          issues.push(`Тяжёлый HTML: ${(htmlBytes / 1024).toFixed(1)} KB`);
        }

        return {
          label: check.label,
          path: check.path,
          url,
          status: response.status,
          responseMs,
          htmlBytes,
          ok: issues.length === 0,
          issues,
        } satisfies StorefrontPerformanceResult;
      } catch (error) {
        return {
          label: check.label,
          path: check.path,
          url,
          status: null,
          responseMs: null,
          htmlBytes: null,
          ok: false,
          issues: [error instanceof Error ? error.message : "Не удалось измерить storefront"],
        } satisfies StorefrontPerformanceResult;
      }
    })
  );

  return {
    checkedAt: new Date().toISOString(),
    baseUrl: SEO_AUDIT_BASE_URL,
    okCount: results.filter(item => item.ok).length,
    issueCount: results.filter(item => !item.ok).length,
    slowestResponseMs: results.reduce((max, item) => Math.max(max, item.responseMs ?? 0), 0),
    heaviestHtmlBytes: results.reduce((max, item) => Math.max(max, item.htmlBytes ?? 0), 0),
    results,
  };
}

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

  getHomepageHeroSettings: publicQuery.query(async () => {
    const settings = await getHomepageHeroAdminSettings();

    return {
      variant: settings.variant,
      isDefault: settings.variant === "classic",
      options: [
        {
          value: "classic" as const,
          label: "Классический hero",
          description:
            "Текущая версия главного экрана, которая сейчас стоит на сайте. Это безопасный базовый вариант, к нему всегда можно вернуться.",
        },
        {
          value: "interactive" as const,
          label: "Визуальный promo-hero",
          description:
            "Слайдовая hero-витрина: товары, категории, бренды и промо-сюжеты в одном управляемом сценарии. Классический hero при этом остаётся безопасным запасным вариантом.",
        },
        {
          value: "promo_showcase" as const,
          label: "Умная промо-витрина",
          description:
            "Автоматическая premium-витрина скидочных товаров: вкладки сценариев, чемпионы скидок, выбор ТЕХАКС и быстрый переход в промо-каталог.",
        },
        {
          value: "promo_showcase_3d" as const,
          label: "3D промо-витрина",
          description:
            "Объёмная hero-сцена с плавающими карточками скидочных товаров, ручным переключением табов и акцентом на вау-эффект без тяжёлого текстового блока.",
        },
      ],
    };
  }),

  getHomepageHeroAdminSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    return getHomepageHeroAdminSettings();
  }),

  getHomepagePromoShowcasePreview: protectedProcedure
    .input(homepagePromoShowcaseSettingsSchema)
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      return buildHomepagePromoShowcaseData(input);
    }),

  saveHomepageHeroSettings: protectedProcedure
    .input(
      z.object({
        variant: homepageHeroVariantSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getAppSettings(["homepage_hero_variant"]);
      await setAppSetting("homepage_hero_variant", input.variant);
      await refreshHomepageSnapshot();
      await writeAdminAuditLog({
        ctx,
        action: "settings.homepage_hero.update",
        entityType: "settings",
        entityLabel: "Hero главной страницы",
        before,
        after: input,
      });
      return { success: true };
    }),

  saveHomepageHeroAdminSettings: protectedProcedure
    .input(homepageHeroAdminSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getHomepageHeroAdminSettings();
      const result = await saveHomepageHeroAdminSettings(input);
      await refreshHomepageSnapshot();
      await writeAdminAuditLog({
        ctx,
        action: "settings.homepage_hero_content.update",
        entityType: "settings",
        entityLabel: "Контент hero главной страницы",
        before,
        after: result,
      });
      return { success: true };
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

  getLoyaltySettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    return getLoyaltyAdminSettings();
  }),

  saveLoyaltySettings: protectedProcedure
    .input(loyaltySettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getLoyaltyAdminSettings();
      const result = await saveLoyaltyAdminSettings(input);
      const after = await getLoyaltyAdminSettings();
      await writeAdminAuditLog({
        ctx,
        action: "settings.loyalty.update",
        entityType: "settings",
        entityLabel: "Бонусная программа МойСклад",
        before,
        after,
      });
      return result;
    }),

  getFeedCatalog: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return getFeedCatalogOverview();
  }),

  getSeoHealth: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    const db = getDb();

    const [
      totalProductsRow,
      visibleProductsRow,
      manualHiddenProductsRow,
      autoBlockedProductsRow,
      zeroPriceProductsRow,
      noDescriptionProductsRow,
      noImageProductsRow,
      noArticleProductsRow,
      noBarcodeProductsRow,
      totalManufacturersRow,
      visibleManufacturersRow,
      manufacturersMissingDescriptionRow,
      manufacturersMissingMetaTitleRow,
      manufacturersMissingMetaDescriptionRow,
      manufacturersMissingLogoRow,
      totalCategoriesRow,
      categoryNoDescriptionRow,
      categoryNoMetaTitleRow,
      categoryNoMetaDescriptionRow,
      totalStoresRow,
      storesMissingMapRow,
      storesMissingPhoneRow,
      storesMissingHoursRow,
      storesMissingImageRow,
      totalPostsRow,
      publishedPostsRow,
      postsMissingMetaTitleRow,
      postsMissingMetaDescriptionRow,
      postsMissingImageRow,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.products),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(publicProductVisibilityCondition),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(eq(schema.products.isActive, false)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(eq(schema.products.isAutoBlocked, true)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(sql`${schema.products.price} <= 0`),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(or(isNull(schema.products.description), eq(schema.products.description, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(or(isNull(schema.products.image), eq(schema.products.image, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(or(isNull(schema.products.article), eq(schema.products.article, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(or(isNull(schema.products.barcode), eq(schema.products.barcode, ""))),
      db.select({ count: sql<number>`count(*)` }).from(schema.manufacturers),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.manufacturers)
        .where(eq(schema.manufacturers.isVisible, true)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.manufacturers)
        .where(or(isNull(schema.manufacturers.description), eq(schema.manufacturers.description, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.manufacturers)
        .where(or(isNull(schema.manufacturers.metaTitle), eq(schema.manufacturers.metaTitle, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.manufacturers)
        .where(
          or(
            isNull(schema.manufacturers.metaDescription),
            eq(schema.manufacturers.metaDescription, "")
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.manufacturers)
        .where(or(isNull(schema.manufacturers.logoUrl), eq(schema.manufacturers.logoUrl, ""))),
      db.select({ count: sql<number>`count(*)` }).from(schema.categories),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.categories)
        .where(or(isNull(schema.categories.description), eq(schema.categories.description, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.categories)
        .where(or(isNull(schema.categories.metaTitle), eq(schema.categories.metaTitle, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.categories)
        .where(or(isNull(schema.categories.metaDescription), eq(schema.categories.metaDescription, ""))),
      db.select({ count: sql<number>`count(*)` }).from(schema.stores),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.stores)
        .where(or(isNull(schema.stores.mapUrl), eq(schema.stores.mapUrl, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.stores)
        .where(or(isNull(schema.stores.phone), eq(schema.stores.phone, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.stores)
        .where(or(isNull(schema.stores.hours), eq(schema.stores.hours, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.stores)
        .where(or(isNull(schema.stores.image), eq(schema.stores.image, ""))),
      db.select({ count: sql<number>`count(*)` }).from(schema.posts),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.posts)
        .where(
          or(
            eq(schema.posts.status, "published"),
            and(eq(schema.posts.status, "scheduled"), sql`${schema.posts.publishedAt} <= NOW()`)
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.posts)
        .where(or(isNull(schema.posts.metaTitle), eq(schema.posts.metaTitle, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.posts)
        .where(or(isNull(schema.posts.metaDescription), eq(schema.posts.metaDescription, ""))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.posts)
        .where(or(isNull(schema.posts.image), eq(schema.posts.image, ""))),
    ]);

    const categoryRows = await db.select().from(schema.categories);
    const childCounts = new Map<number, number>();
    for (const category of categoryRows) {
      if (!category.parentId) continue;
      childCounts.set(category.parentId, (childCounts.get(category.parentId) ?? 0) + 1);
    }

    const visibleProductCategoryRows = await db
      .select({
        categoryId: schema.products.categoryId,
        count: sql<number>`count(*)`,
      })
      .from(schema.products)
      .where(publicProductVisibilityCondition)
      .groupBy(schema.products.categoryId);
    const visibleProductCountByCategoryId = new Map(
      visibleProductCategoryRows.map(row => [row.categoryId, Number(row.count)] as const)
    );

    const emptyLeafCategories = categoryRows.filter(category => {
      const hasChildren = (childCounts.get(category.id) ?? 0) > 0;
      if (hasChildren) return false;
      return (visibleProductCountByCategoryId.get(category.id) ?? 0) === 0;
    });
    const duplicateCategoryNamesCount = (() => {
      const counts = new Map<string, number>();
      for (const category of categoryRows) {
        const key = category.name.trim().toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.values()).filter(value => value > 1).length;
    })();

    const productRows = await db
      .select({
        id: schema.products.id,
        slug: schema.products.slug,
        name: schema.products.name,
        article: schema.products.article,
        barcode: schema.products.barcode,
        image: schema.products.image,
        description: schema.products.description,
        specs: schema.products.specs,
        price: schema.products.price,
        isActive: schema.products.isActive,
        isAutoBlocked: schema.products.isAutoBlocked,
      })
      .from(schema.products)
      .orderBy(schema.products.id)
      .limit(500);

    const productsMissingBrand = productRows.filter(
      product => !getManufacturerNameFromProductSpecs(product.specs)
    ).length;

    const sampleProducts = productRows
      .filter(product => {
        const flags = [
          !product.description,
          !product.image,
          !product.article,
          !product.barcode,
          !getManufacturerNameFromProductSpecs(product.specs),
          product.price <= 0,
        ];
        return flags.some(Boolean);
      })
      .slice(0, 12)
      .map(product => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        issues: [
          !product.description ? "Нет описания" : null,
          !product.image ? "Нет изображения" : null,
          !product.article ? "Нет артикула" : null,
          !product.barcode ? "Нет штрихкода" : null,
          !getManufacturerNameFromProductSpecs(product.specs) ? "Не определён бренд" : null,
          product.price <= 0 ? "Нулевая цена" : null,
        ].filter((item): item is string => Boolean(item)),
      }));

    const sampleCategories = categoryRows
      .filter(category => !category.description || (visibleProductCountByCategoryId.get(category.id) ?? 0) === 0)
      .filter(category =>
        !category.description ||
        !category.metaTitle ||
        !category.metaDescription ||
        (visibleProductCountByCategoryId.get(category.id) ?? 0) === 0
      )
      .slice(0, 10)
      .map(category => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        issues: [
          !category.description ? "Нет описания" : null,
          !category.metaTitle ? "Нет SEO title" : null,
          !category.metaDescription ? "Нет SEO description" : null,
          (visibleProductCountByCategoryId.get(category.id) ?? 0) === 0 &&
          (childCounts.get(category.id) ?? 0) === 0
            ? "Пустая конечная категория"
            : null,
        ].filter((item): item is string => Boolean(item)),
      }));

    const samplePosts = await db
      .select({
        id: schema.posts.id,
        slug: schema.posts.slug,
        title: schema.posts.title,
        metaTitle: schema.posts.metaTitle,
        metaDescription: schema.posts.metaDescription,
        image: schema.posts.image,
      })
      .from(schema.posts)
      .where(
        or(
          isNull(schema.posts.metaTitle),
          eq(schema.posts.metaTitle, ""),
          isNull(schema.posts.metaDescription),
          eq(schema.posts.metaDescription, ""),
          isNull(schema.posts.image),
          eq(schema.posts.image, "")
        )
      )
      .limit(10);

    const feedSettings = await getYandexYmlFeedSettings();
    const profile = await getPublicSiteProfile();
    const storeRows = await db.select().from(schema.stores).orderBy(asc(schema.stores.sortOrder));
    const manufacturerRows = await db
      .select({
        id: schema.manufacturers.id,
        slug: schema.manufacturers.slug,
        name: schema.manufacturers.name,
        description: schema.manufacturers.description,
        metaTitle: schema.manufacturers.metaTitle,
        metaDescription: schema.manufacturers.metaDescription,
        logoUrl: schema.manufacturers.logoUrl,
        isVisible: schema.manufacturers.isVisible,
        productCount: schema.manufacturers.productCount,
      })
      .from(schema.manufacturers)
      .orderBy(desc(schema.manufacturers.productCount), asc(schema.manufacturers.name))
      .limit(200);

    const [samplePublicProduct] = await db
      .select({
        slug: schema.products.slug,
      })
      .from(schema.products)
      .where(publicProductVisibilityCondition)
      .orderBy(desc(schema.products.createdAt), desc(schema.products.id))
      .limit(1);

    const [samplePromotion] = await db
      .select({
        slug: schema.banners.slug,
      })
      .from(schema.banners)
      .where(eq(schema.banners.active, true))
      .orderBy(desc(schema.banners.createdAt), desc(schema.banners.id))
      .limit(1);

    const [samplePublishedPost] = await db
      .select({
        slug: schema.posts.slug,
      })
      .from(schema.posts)
      .where(
        or(
          eq(schema.posts.status, "published"),
          and(eq(schema.posts.status, "scheduled"), sql`${schema.posts.publishedAt} <= NOW()`)
        )
      )
      .orderBy(desc(schema.posts.publishedAt), desc(schema.posts.id))
      .limit(1);
    const yandexFeedPreview = await buildYandexYmlFeed({
      ignoreEnabled: true,
      previewOnly: true,
      skipCache: true,
    });

    const sampleManufacturers = manufacturerRows
      .filter(item => {
        const flags = [
          !item.description,
          !item.metaTitle,
          !item.metaDescription,
          !item.logoUrl,
        ];
        return flags.some(Boolean);
      })
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        issues: [
          !item.description ? "Нет описания бренда" : null,
          !item.metaTitle ? "Нет SEO title" : null,
          !item.metaDescription ? "Нет SEO description" : null,
          !item.logoUrl ? "Нет логотипа" : null,
        ].filter((value): value is string => Boolean(value)),
      }));

    const legalTexts = profile.legalTexts;
    const legalDocuments = [
      {
        key: "offer",
        title: legalTexts.offerTitle,
        content: legalTexts.offerContent,
        path: "/offer",
      },
      {
        key: "privacy",
        title: legalTexts.privacyPolicyTitle,
        content: legalTexts.privacyPolicyContent,
        path: "/privacy-policy",
      },
      {
        key: "payment-delivery",
        title: legalTexts.paymentDeliveryTitle,
        content: legalTexts.paymentDeliveryContent,
        path: "/payment-delivery",
      },
      {
        key: "returns",
        title: legalTexts.returnsPolicyTitle,
        content: legalTexts.returnsPolicyContent,
        path: "/returns",
      },
    ];
    const legalIssues = legalDocuments
      .filter(doc => !doc.title?.trim() || !doc.content?.trim())
      .map(doc => ({
        key: doc.key,
        path: doc.path,
        issues: [
          !doc.title?.trim() ? "Нет заголовка" : null,
          !doc.content?.trim() ? "Нет текста документа" : null,
        ].filter((value): value is string => Boolean(value)),
      }));
    const contactIssues = [
      !profile.contacts.primaryPhoneDisplay?.trim() ? "Нет основного телефона" : null,
      !profile.contacts.email?.trim() ? "Нет e-mail" : null,
      !profile.contacts.workingHours?.trim() ? "Нет часов работы" : null,
      !profile.contacts.shortAddress?.trim() ? "Нет короткого адреса" : null,
      !profile.contacts.fullAddress?.trim() ? "Нет полного адреса" : null,
    ].filter((value): value is string => Boolean(value));
    const regionMentionsText = [
      profile.contacts.shortAddress,
      profile.contacts.fullAddress,
      ...storeRows.map(store => `${store.name} ${store.address}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const hasPenzaMention =
      regionMentionsText.includes("пенз") || regionMentionsText.includes("зареч");
    const readyStores = storeRows.filter(
      store =>
        Boolean(store.phone?.trim()) &&
        Boolean(store.hours?.trim()) &&
        Boolean(store.mapUrl?.trim()) &&
        Boolean(store.image?.trim())
    ).length;

    const representativeCategory = categoryRows.find(
      category =>
        (visibleProductCountByCategoryId.get(category.id) ?? 0) > 0 ||
        (childCounts.get(category.id) ?? 0) > 0
    );
    const representativeBrand = manufacturerRows.find(item => item.isVisible);

    const storefrontAuditChecks: StorefrontAuditExpectation[] = [
      {
        label: "Главная",
        path: "/",
        expectedCanonical: "https://techaks.ru/",
      },
      {
        label: "Каталог",
        path: "/catalog",
        expectedCanonical: "https://techaks.ru/catalog",
      },
      {
        label: "Бренды",
        path: "/catalog?view=brands",
        expectedCanonical: "https://techaks.ru/catalog?view=brands",
      },
      {
        label: "Магазины",
        path: "/stores",
        expectedCanonical: "https://techaks.ru/stores",
      },
      {
        label: "Контакты",
        path: "/contacts",
        expectedCanonical: "https://techaks.ru/contacts",
      },
      {
        label: "О компании",
        path: "/about",
        expectedCanonical: "https://techaks.ru/about",
      },
      {
        label: "Оплата и доставка",
        path: "/payment-delivery",
        expectedCanonical: "https://techaks.ru/payment-delivery",
      },
      {
        label: "Возврат и обмен",
        path: "/returns",
        expectedCanonical: "https://techaks.ru/returns",
      },
      {
        label: "Оферта",
        path: "/offer",
        expectedCanonical: "https://techaks.ru/offer",
      },
      {
        label: "Политика ПДн",
        path: "/privacy-policy",
        expectedCanonical: "https://techaks.ru/privacy-policy",
      },
      {
        label: "Checkout",
        path: "/checkout",
        expectedCanonical: "https://techaks.ru/checkout",
        expectedNoindex: true,
      },
      {
        label: "Поиск",
        path: "/search?q=router",
        expectedCanonical: "https://techaks.ru/search?q=router",
        expectedNoindex: true,
      },
      {
        label: "Логин",
        path: "/login",
        expectedCanonical: "https://techaks.ru/login",
        expectedNoindex: true,
      },
    ];

    if (representativeCategory) {
      storefrontAuditChecks.push(
        {
          label: "Категория",
          path: `/catalog?cat=${encodeURIComponent(representativeCategory.slug)}`,
          expectedCanonical: `https://techaks.ru/catalog?cat=${encodeURIComponent(representativeCategory.slug)}`,
        },
        {
          label: "Категория с фильтром",
          path: `/catalog?cat=${encodeURIComponent(representativeCategory.slug)}&sort=price-asc`,
          expectedCanonical: `https://techaks.ru/catalog?cat=${encodeURIComponent(representativeCategory.slug)}`,
          expectedNoindex: true,
        }
      );
    }

    if (representativeBrand) {
      storefrontAuditChecks.push({
        label: "Страница бренда",
        path: `/catalog?view=brands&brand=${encodeURIComponent(representativeBrand.slug)}`,
        expectedCanonical: `https://techaks.ru/catalog?view=brands&brand=${encodeURIComponent(representativeBrand.slug)}`,
      });
    }

    if (samplePublicProduct) {
      storefrontAuditChecks.push({
        label: "Карточка товара",
        path: `/product/${encodeURIComponent(samplePublicProduct.slug)}`,
        expectedCanonical: `https://techaks.ru/product/${encodeURIComponent(samplePublicProduct.slug)}`,
      });
    }

    if (samplePromotion?.slug) {
      storefrontAuditChecks.push({
        label: "Страница акции",
        path: `/promotions/${encodeURIComponent(samplePromotion.slug)}`,
        expectedCanonical: `https://techaks.ru/promotions/${encodeURIComponent(samplePromotion.slug)}`,
      });
    }

    if (samplePublishedPost?.slug) {
      storefrontAuditChecks.push({
        label: "Статья блога",
        path: `/blog/${encodeURIComponent(samplePublishedPost.slug)}`,
        expectedCanonical: `https://techaks.ru/blog/${encodeURIComponent(samplePublishedPost.slug)}`,
      });
    }

    const storefrontAudit = await runStorefrontSeoAudit(storefrontAuditChecks);
    const storefrontPerformanceChecks: StorefrontPerformanceExpectation[] = [
      { label: "Главная", path: "/" },
      {
        label: "Каталог",
        path: representativeCategory
          ? `/catalog?cat=${encodeURIComponent(representativeCategory.slug)}`
          : "/catalog",
      },
    ];

    if (samplePublicProduct) {
      storefrontPerformanceChecks.push({
        label: "Карточка товара",
        path: `/product/${encodeURIComponent(samplePublicProduct.slug)}`,
      });
    }

    const storefrontPerformance = await runStorefrontPerformanceAudit(
      storefrontPerformanceChecks
    );

    return {
      generatedAt: new Date().toISOString(),
      feed: {
        enabled: feedSettings.enabled,
        baseUrl: feedSettings.baseUrl,
      },
      metrika: {
        enabledViaConsent: true,
        goals: {
          viewItem: true,
          addToCart: true,
          beginCheckout: true,
          reserveItem: true,
          purchase: true,
          leadSubmit: true,
          orderMessage: true,
        },
      },
      products: {
        total: Number(totalProductsRow[0]?.count ?? 0),
        visible: Number(visibleProductsRow[0]?.count ?? 0),
        manuallyHidden: Number(manualHiddenProductsRow[0]?.count ?? 0),
        autoBlocked: Number(autoBlockedProductsRow[0]?.count ?? 0),
        zeroPrice: Number(zeroPriceProductsRow[0]?.count ?? 0),
        withoutDescription: Number(noDescriptionProductsRow[0]?.count ?? 0),
        withoutImage: Number(noImageProductsRow[0]?.count ?? 0),
        withoutArticle: Number(noArticleProductsRow[0]?.count ?? 0),
        withoutBarcode: Number(noBarcodeProductsRow[0]?.count ?? 0),
        withoutBrand: productsMissingBrand,
        samples: sampleProducts,
      },
      manufacturers: {
        total: Number(totalManufacturersRow[0]?.count ?? 0),
        visible: Number(visibleManufacturersRow[0]?.count ?? 0),
        withoutDescription: Number(manufacturersMissingDescriptionRow[0]?.count ?? 0),
        withoutMetaTitle: Number(manufacturersMissingMetaTitleRow[0]?.count ?? 0),
        withoutMetaDescription: Number(
          manufacturersMissingMetaDescriptionRow[0]?.count ?? 0
        ),
        withoutLogo: Number(manufacturersMissingLogoRow[0]?.count ?? 0),
        samples: sampleManufacturers,
      },
      categories: {
        total: Number(totalCategoriesRow[0]?.count ?? 0),
        withoutDescription: Number(categoryNoDescriptionRow[0]?.count ?? 0),
        withoutMetaTitle: Number(categoryNoMetaTitleRow[0]?.count ?? 0),
        withoutMetaDescription: Number(categoryNoMetaDescriptionRow[0]?.count ?? 0),
        duplicateNames: duplicateCategoryNamesCount,
        emptyLeafCount: emptyLeafCategories.length,
        samples: sampleCategories,
      },
      blog: {
        total: Number(totalPostsRow[0]?.count ?? 0),
        published: Number(publishedPostsRow[0]?.count ?? 0),
        withoutMetaTitle: Number(postsMissingMetaTitleRow[0]?.count ?? 0),
        withoutMetaDescription: Number(postsMissingMetaDescriptionRow[0]?.count ?? 0),
        withoutImage: Number(postsMissingImageRow[0]?.count ?? 0),
        samples: samplePosts.map(post => ({
          id: post.id,
          slug: post.slug,
          title: post.title,
          issues: [
            !post.metaTitle ? "Нет meta title" : null,
            !post.metaDescription ? "Нет meta description" : null,
            !post.image ? "Нет изображения" : null,
          ].filter((item): item is string => Boolean(item)),
        })),
      },
      stores: {
        total: Number(totalStoresRow[0]?.count ?? 0),
        withoutMapUrl: Number(storesMissingMapRow[0]?.count ?? 0),
        withoutPhone: Number(storesMissingPhoneRow[0]?.count ?? 0),
        withoutHours: Number(storesMissingHoursRow[0]?.count ?? 0),
        withoutImage: Number(storesMissingImageRow[0]?.count ?? 0),
      },
      commercial: {
        hasPenzaMention,
        contactIssues,
        legalDocumentsMissing: legalIssues.length,
        legalIssues,
        legalDocumentsReady: legalDocuments.length - legalIssues.length,
        storesReady: readyStores,
      },
      yandexFeed: {
        generatedAt: yandexFeedPreview.generatedAt,
        totalOffers: yandexFeedPreview.stats.totalOffers,
        categoriesIncluded: yandexFeedPreview.stats.categoriesIncluded,
        warnings: yandexFeedPreview.stats.warnings,
        skippedOutOfStock: yandexFeedPreview.stats.skippedOutOfStock,
        skippedWithoutPrice: yandexFeedPreview.stats.skippedWithoutPrice,
        skippedWithoutPicture: yandexFeedPreview.stats.skippedWithoutPicture,
        skippedWithoutCategory: yandexFeedPreview.stats.skippedWithoutCategory,
        skippedWithoutName: yandexFeedPreview.stats.skippedWithoutName,
        vendorMissingCount: yandexFeedPreview.stats.vendorMissingCount,
        picturesMissingCount: yandexFeedPreview.stats.picturesMissingCount,
        descriptionsSanitized: yandexFeedPreview.stats.descriptionsSanitized,
      },
      storefrontAudit,
      performance: {
        storefront: storefrontPerformance,
        implementation: {
          homeSecondaryDeferred: true,
          responsiveProductImages: true,
          productGalleryPriorityImage: true,
          ymlFeedChunking: true,
          sitemapChunking: true,
        },
        bottlenecks: [
          "Следить за весом home secondary bundle и below-the-fold секций",
          "Не допускать тяжёлого HTML на категориях с длинными листингами",
          "Держать CLS под контролем через width/height и стабильные image shells",
          "Не раздувать storefront новыми eager-картинками вне первого экрана",
        ],
        nextActions: [
          "Проверять главную, категорию и товар после релизов через storefront performance audit",
          "Держать вторичные блоки главной в deferred-режиме до приближения к viewport",
          "Пересматривать размеры hero/media и lazy-loading при добавлении новых витринных секций",
        ],
      },
    };
  }),

  getYandexYmlFeedSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return getYandexYmlFeedSettings();
  }),

  getVkFeedSettings: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return getVkFeedSettings();
  }),

  saveYandexYmlFeedSettings: protectedProcedure
    .input(yandexYmlFeedSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getYandexYmlFeedSettings();
      const result = await saveYandexYmlFeedSettings(input);
      const after = await getYandexYmlFeedSettings();
      await writeAdminAuditLog({
        ctx,
        action: "settings.feed.yandex_yml.update",
        entityType: "settings",
        entityLabel: "Yandex YML feed",
        before,
        after,
      });
      return result;
    }),

  previewYandexYmlFeed: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return buildYandexYmlFeed({ ignoreEnabled: true, previewOnly: true });
  }),

  validateYandexYmlFeed: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return validateYandexYmlFeed();
  }),

  saveVkFeedSettings: protectedProcedure
    .input(vkFeedSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "configure", "Settings");
      const before = await getVkFeedSettings();
      const result = await saveVkFeedSettings(input);
      const after = await getVkFeedSettings();
      await writeAdminAuditLog({
        ctx,
        action: "settings.feed.vk.update",
        entityType: "settings",
        entityLabel: "VK feed",
        before,
        after,
      });
      return result;
    }),

  previewVkFeed: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return buildVkFeed({ ignoreEnabled: true, previewOnly: true });
  }),

  validateVkFeed: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return validateVkFeed();
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
