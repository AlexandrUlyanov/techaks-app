import { z } from "zod";
import { and, inArray, eq } from "drizzle-orm";
import { categories, products } from "@db/schema";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import { getRecommendedProducts } from "./merchandising-score";
import {
  attachVisibleMerchandisingBadges,
  listHomepageFallbackProducts,
  publicProductSelectFields,
  publicProductVisibilityCondition,
} from "./public-products";

const HERO_CONTENT_KEY = "homepage_hero_content";

export const homepageHeroAdminSettingsSchema = z.object({
  variant: z.enum(["classic", "interactive"]).default("classic"),
  mode: z.enum(["manual", "automatic"]).default("automatic"),
  eyebrow: z.string().trim().max(120).default("ТЕХАКС в Пензе"),
  title: z.string().trim().min(2).max(180).default("Техника и аксессуары на каждый день"),
  subtitle: z
    .string()
    .trim()
    .max(240)
    .default("Полезная электроника, аксессуары и гаджеты без лишней сложности."),
  description: z
    .string()
    .trim()
    .max(500)
    .default(
      "Подбираем удобные устройства для дома, работы, автомобиля и повседневной жизни. Показываем только актуальные товары с ценой, фото и наличием."
    ),
  primaryCtaLabel: z.string().trim().max(60).default("Перейти в каталог"),
  primaryCtaHref: z.string().trim().max(255).default("/catalog"),
  secondaryCtaLabel: z.string().trim().max(60).default("Связаться с нами"),
  secondaryCtaHref: z.string().trim().max(255).default("/contacts"),
  benefits: z
    .array(z.string().trim().min(2).max(80))
    .max(6)
    .default([
      "Официальные партнёры брендов",
      "Товары без лишних наценок",
      "Гарантия и поддержка",
      "Консультация перед покупкой",
    ]),
  autoSource: z.enum(["recommended", "latest", "fallback"]).default("recommended"),
  itemsLimit: z.number().int().min(2).max(6).default(4),
  manualProductIds: z.array(z.number().int().positive()).max(6).default([]),
});

export type HomepageHeroAdminSettings = z.infer<
  typeof homepageHeroAdminSettingsSchema
>;

export type HomepageHeroCard = {
  id: number;
  slug: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string;
  badge: string | null;
  inStock: boolean;
  categoryName?: string | null;
};

export type HomepageHeroStorefrontData = {
  variant: "classic" | "interactive";
  mode: "manual" | "automatic";
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  benefits: string[];
  cards: HomepageHeroCard[];
  diagnostics: {
    source: "manual" | "automatic" | "fallback";
    requestedManualCount: number;
    resolvedCardCount: number;
  };
};

function sanitizeHref(value: string, fallback: string) {
  const href = value.trim();
  if (!href) return fallback;
  if (href.startsWith("/")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return fallback;
}

function parseStoredHeroSettings(raw: string | null) {
  if (!raw) return homepageHeroAdminSettingsSchema.parse({});
  try {
    return homepageHeroAdminSettingsSchema.parse(JSON.parse(raw));
  } catch {
    return homepageHeroAdminSettingsSchema.parse({});
  }
}

export async function getHomepageHeroAdminSettings(): Promise<HomepageHeroAdminSettings> {
  const settings = await getAppSettings(["homepage_hero_variant", HERO_CONTENT_KEY]);
  const parsed = parseStoredHeroSettings(settings[HERO_CONTENT_KEY]);
  const storedVariant = settings.homepage_hero_variant?.trim();
  return {
    ...parsed,
    variant:
      storedVariant === "interactive" || storedVariant === "classic"
        ? storedVariant
        : parsed.variant,
  };
}

export async function saveHomepageHeroAdminSettings(
  input: HomepageHeroAdminSettings
) {
  const payload = homepageHeroAdminSettingsSchema.parse(input);
  await setAppSetting("homepage_hero_variant", payload.variant);
  await setAppSetting(HERO_CONTENT_KEY, JSON.stringify(payload));
  return payload;
}

function normalizeHeroCardRows(rows: any[]): HomepageHeroCard[] {
  return rows
    .filter(
      row =>
        typeof row?.id === "number" &&
        typeof row?.slug === "string" &&
        typeof row?.name === "string" &&
        typeof row?.price === "number" &&
        typeof row?.image === "string" &&
        row.image.trim().length > 0
    )
    .map(row => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      price: row.price,
      oldPrice: row.oldPrice ?? null,
      image: row.image,
      badge: row.badge ?? null,
      inStock: Boolean(row.inStock),
      categoryName: row.categoryName ?? null,
    }));
}

export async function buildHomepageHeroStorefrontData(): Promise<HomepageHeroStorefrontData> {
  const settings = await getHomepageHeroAdminSettings();
  const limit = settings.itemsLimit;

  let cards: HomepageHeroCard[] = [];
  let source: HomepageHeroStorefrontData["diagnostics"]["source"] = "fallback";

  if (settings.mode === "manual" && settings.manualProductIds.length > 0) {
    const db = getDb();
    const manualRows = await db
      .select(publicProductSelectFields)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(
        schema.productMerchandising,
        eq(schema.productMerchandising.productId, products.id)
      )
      .where(and(inArray(products.id, settings.manualProductIds), publicProductVisibilityCondition));
    const withBadges = await attachVisibleMerchandisingBadges(manualRows);
    const byId = new Map(withBadges.map(row => [row.id, row]));
    cards = normalizeHeroCardRows(
      settings.manualProductIds.map(productId => byId.get(productId)).filter(Boolean)
    ).slice(0, limit);
    if (cards.length > 0) {
      source = "manual";
    }
  }

  if (cards.length === 0) {
    if (settings.autoSource === "recommended") {
      cards = normalizeHeroCardRows(await getRecommendedProducts({ limit }));
    } else if (settings.autoSource === "latest") {
      cards = normalizeHeroCardRows(await listHomepageFallbackProducts(limit));
    } else {
      cards = normalizeHeroCardRows(await listHomepageFallbackProducts(limit));
    }
    source = "automatic";
  }

  if (cards.length === 0) {
    cards = normalizeHeroCardRows(await listHomepageFallbackProducts(limit));
    source = "fallback";
  }

  return {
    variant: settings.variant,
    mode: settings.mode,
    eyebrow: settings.eyebrow,
    title: settings.title,
    subtitle: settings.subtitle,
    description: settings.description,
    primaryCtaLabel: settings.primaryCtaLabel,
    primaryCtaHref: sanitizeHref(settings.primaryCtaHref, "/catalog"),
    secondaryCtaLabel: settings.secondaryCtaLabel,
    secondaryCtaHref: sanitizeHref(settings.secondaryCtaHref, "/contacts"),
    benefits: settings.benefits.filter(Boolean).slice(0, 6),
    cards: cards.slice(0, limit),
    diagnostics: {
      source,
      requestedManualCount: settings.manualProductIds.length,
      resolvedCardCount: cards.slice(0, limit).length,
    },
  };
}
