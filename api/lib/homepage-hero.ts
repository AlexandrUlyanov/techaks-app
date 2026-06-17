import { z } from "zod";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
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
import { getVisibleManufacturerCatalogEntries } from "./manufacturers";

const HERO_CONTENT_KEY = "homepage_hero_content";

const heroVariantSchema = z.enum(["classic", "interactive"]);
const heroSlideTypeSchema = z.enum(["products", "promo", "categories", "brands"]);
const heroSlideThemeSchema = z.enum(["light", "soft-cyan", "mesh", "dark"]);

const legacyHomepageHeroAdminSettingsSchema = z.object({
  variant: heroVariantSchema.default("classic"),
  mode: z.enum(["manual", "automatic"]).default("automatic"),
  eyebrow: z.string().trim().max(120).default("ТЕХАКС в Пензе"),
  title: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .default("Техника и аксессуары на каждый день"),
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

export const homepageHeroSlideSchema = z.object({
  id: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  type: heroSlideTypeSchema.default("products"),
  theme: heroSlideThemeSchema.default("soft-cyan"),
  eyebrow: z.string().trim().max(120).default(""),
  title: z.string().trim().max(180).default(""),
  subtitle: z.string().trim().max(240).default(""),
  description: z.string().trim().max(500).default(""),
  accent: z.string().trim().max(80).default(""),
  primaryCtaLabel: z.string().trim().max(60).default(""),
  primaryCtaHref: z.string().trim().max(255).default(""),
  secondaryCtaLabel: z.string().trim().max(60).default(""),
  secondaryCtaHref: z.string().trim().max(255).default(""),
  productSource: z.enum(["manual", "automatic"]).default("automatic"),
  autoSource: z.enum(["recommended", "latest", "fallback"]).default("recommended"),
  itemsLimit: z.number().int().min(2).max(8).default(4),
  manualProductIds: z.array(z.number().int().positive()).max(8).default([]),
  categorySlugs: z.array(z.string().trim().min(1).max(255)).max(8).default([]),
  manufacturerSlugs: z.array(z.string().trim().min(1).max(255)).max(8).default([]),
  activeFrom: z.string().trim().max(32).nullable().optional().default(null),
  activeTo: z.string().trim().max(32).nullable().optional().default(null),
});

export const homepageHeroAdminSettingsSchema = z.object({
  variant: heroVariantSchema.default("classic"),
  slides: z.array(homepageHeroSlideSchema).max(8).default([]),
});

export type HomepageHeroSlideSettings = z.infer<typeof homepageHeroSlideSchema>;
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

export type HomepageHeroCategoryCard = {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  icon: string | null;
  productCount: number;
  href: string;
};

export type HomepageHeroBrandCard = {
  id: number;
  slug: string;
  title: string;
  logo: string;
  productCount: number;
  href: string;
};

type HomepageHeroStorefrontSlideBase = {
  id: string;
  type: HomepageHeroSlideSettings["type"];
  theme: HomepageHeroSlideSettings["theme"];
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
};

export type HomepageHeroStorefrontSlide =
  | (HomepageHeroStorefrontSlideBase & {
      type: "products";
      cards: HomepageHeroCard[];
    })
  | (HomepageHeroStorefrontSlideBase & {
      type: "promo";
    })
  | (HomepageHeroStorefrontSlideBase & {
      type: "categories";
      categories: HomepageHeroCategoryCard[];
    })
  | (HomepageHeroStorefrontSlideBase & {
      type: "brands";
      brands: HomepageHeroBrandCard[];
    });

export type HomepageHeroStorefrontData = {
  variant: "classic" | "interactive";
  slides: HomepageHeroStorefrontSlide[];
  diagnostics: {
    activeSlides: number;
    totalSlides: number;
    resolvedTypes: string[];
  };
};

function sanitizeHref(value: string, fallback: string) {
  const href = value.trim();
  if (!href) return fallback;
  if (href.startsWith("/")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return fallback;
}

function normalizeOptionalDate(value?: string | null) {
  const candidate = String(value ?? "").trim();
  return candidate.length > 0 ? candidate.slice(0, 32) : null;
}

function buildDefaultInteractiveSlides(): HomepageHeroSlideSettings[] {
  return [
    homepageHeroSlideSchema.parse({
      id: "hero-products",
      enabled: true,
      type: "products",
      theme: "soft-cyan",
      eyebrow: "ТЕХАКС в Пензе",
      title: "Техника и аксессуары на каждый день",
      subtitle: "Полезная электроника и гаджеты без лишней сложности.",
      description:
        "Актуальные товары с ценой, фото и наличием. Подборки можно обновлять автоматически или руками через админку.",
      accent: "в наличии",
      primaryCtaLabel: "Перейти в каталог",
      primaryCtaHref: "/catalog",
      secondaryCtaLabel: "Связаться с нами",
      secondaryCtaHref: "/contacts",
      productSource: "automatic",
      autoSource: "recommended",
      itemsLimit: 4,
    }),
    homepageHeroSlideSchema.parse({
      id: "hero-categories",
      enabled: true,
      type: "categories",
      theme: "light",
      eyebrow: "Быстрый выбор",
      title: "Открывайте разделы без лишних переходов",
      subtitle: "Собрали крупные категории прямо в hero, чтобы путь до товара был короче.",
      description: "",
      primaryCtaLabel: "Смотреть разделы",
      primaryCtaHref: "/catalog",
      itemsLimit: 6,
    }),
  ];
}

function migrateLegacySettingsToSlides(
  legacy: z.infer<typeof legacyHomepageHeroAdminSettingsSchema>
): HomepageHeroSlideSettings[] {
  return [
    homepageHeroSlideSchema.parse({
      id: "hero-products-migrated",
      enabled: true,
      type: "products",
      theme: "soft-cyan",
      eyebrow: legacy.eyebrow,
      title: legacy.title,
      subtitle: legacy.subtitle,
      description: legacy.description,
      accent: legacy.benefits[0] ?? "",
      primaryCtaLabel: legacy.primaryCtaLabel,
      primaryCtaHref: legacy.primaryCtaHref,
      secondaryCtaLabel: legacy.secondaryCtaLabel,
      secondaryCtaHref: legacy.secondaryCtaHref,
      productSource: legacy.mode,
      autoSource: legacy.autoSource,
      itemsLimit: legacy.itemsLimit,
      manualProductIds: legacy.manualProductIds,
    }),
  ];
}

function normalizeSlides(slides: HomepageHeroSlideSettings[]) {
  const seen = new Set<string>();
  return slides
    .map((slide, index) => {
      const parsed = homepageHeroSlideSchema.parse({
        ...slide,
        activeFrom: normalizeOptionalDate(slide.activeFrom),
        activeTo: normalizeOptionalDate(slide.activeTo),
      });
      let id = parsed.id.trim() || `hero-slide-${index + 1}`;
      let counter = 2;
      while (seen.has(id)) {
        id = `${parsed.id || `hero-slide-${index + 1}`}-${counter}`;
        counter += 1;
      }
      seen.add(id);
      return { ...parsed, id };
    })
    .slice(0, 8);
}

function normalizeAdminSettings(input: HomepageHeroAdminSettings): HomepageHeroAdminSettings {
  const slides = normalizeSlides(input.slides);
  return {
    variant: input.variant,
    slides: slides.length > 0 ? slides : buildDefaultInteractiveSlides(),
  };
}

function parseStoredHeroSettings(raw: string | null): HomepageHeroAdminSettings {
  if (!raw) {
    return homepageHeroAdminSettingsSchema.parse({
      variant: "classic",
      slides: buildDefaultInteractiveSlides(),
    });
  }

  try {
    const parsed = homepageHeroAdminSettingsSchema.parse(JSON.parse(raw));
    return normalizeAdminSettings(parsed);
  } catch {
    try {
      const legacy = legacyHomepageHeroAdminSettingsSchema.parse(JSON.parse(raw));
      return {
        variant: legacy.variant,
        slides: migrateLegacySettingsToSlides(legacy),
      };
    } catch {
      return homepageHeroAdminSettingsSchema.parse({
        variant: "classic",
        slides: buildDefaultInteractiveSlides(),
      });
    }
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
  const payload = normalizeAdminSettings(homepageHeroAdminSettingsSchema.parse(input));
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

async function buildProductsSlideCards(
  slide: HomepageHeroSlideSettings
): Promise<HomepageHeroCard[]> {
  const limit = slide.itemsLimit;

  if (slide.productSource === "manual" && slide.manualProductIds.length > 0) {
    const db = getDb();
    const manualRows = await db
      .select(publicProductSelectFields)
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(
        schema.productMerchandising,
        eq(schema.productMerchandising.productId, products.id)
      )
      .where(and(inArray(products.id, slide.manualProductIds), publicProductVisibilityCondition));
    const withBadges = await attachVisibleMerchandisingBadges(manualRows);
    const byId = new Map(withBadges.map(row => [row.id, row]));
    const manualCards = normalizeHeroCardRows(
      slide.manualProductIds.map(productId => byId.get(productId)).filter(Boolean)
    ).slice(0, limit);
    if (manualCards.length > 0) {
      return manualCards;
    }
  }

  if (slide.autoSource === "recommended") {
    const cards = normalizeHeroCardRows(await getRecommendedProducts({ limit }));
    if (cards.length > 0) return cards;
  }

  return normalizeHeroCardRows(await listHomepageFallbackProducts(limit));
}

async function buildCategoriesSlideCards(
  slide: HomepageHeroSlideSettings
): Promise<HomepageHeroCategoryCard[]> {
  const db = getDb();
  const limit = slide.itemsLimit;
  const candidateRows = slide.categorySlugs.length
    ? await db
        .select({
          id: categories.id,
          slug: categories.slug,
          name: categories.name,
          imageUrl: categories.imageUrl,
          icon: categories.icon,
          sortOrder: categories.sortOrder,
        })
        .from(categories)
        .where(inArray(categories.slug, slide.categorySlugs))
    : await db
        .select({
          id: categories.id,
          slug: categories.slug,
          name: categories.name,
          imageUrl: categories.imageUrl,
          icon: categories.icon,
          sortOrder: categories.sortOrder,
        })
        .from(categories)
        .where(isNull(categories.parentId))
        .orderBy(asc(categories.sortOrder), asc(categories.name))
        .limit(limit);

  if (candidateRows.length === 0) return [];

  const countRows = await db
    .select({
      categoryId: products.categoryId,
      productCount: sql<number>`count(*)`,
    })
    .from(products)
    .where(
      and(
        publicProductVisibilityCondition,
        inArray(
          products.categoryId,
          candidateRows.map(row => row.id)
        )
      )
    )
    .groupBy(products.categoryId);

  const countsByCategoryId = new Map(
    countRows.map(row => [row.categoryId, Number(row.productCount || 0)] as const)
  );

  const orderMap = new Map(slide.categorySlugs.map((slug, index) => [slug, index]));

  return candidateRows
    .map(row => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      imageUrl: row.imageUrl ?? null,
      icon: row.icon ?? null,
      productCount: countsByCategoryId.get(row.id) ?? 0,
      href: `/catalog?cat=${row.slug}`,
      sortOrder: row.sortOrder ?? 0,
    }))
    .sort((a, b) => {
      const customA = orderMap.get(a.slug);
      const customB = orderMap.get(b.slug);
      if (customA != null || customB != null) {
        return (customA ?? Number.MAX_SAFE_INTEGER) - (customB ?? Number.MAX_SAFE_INTEGER);
      }
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru");
    })
    .slice(0, limit)
    .map(({ sortOrder: _sortOrder, ...item }) => item);
}

async function buildBrandsSlideCards(
  slide: HomepageHeroSlideSettings
): Promise<HomepageHeroBrandCard[]> {
  const items = await getVisibleManufacturerCatalogEntries(slide.itemsLimit * 2);
  const filtered = slide.manufacturerSlugs.length
    ? items.filter(item => slide.manufacturerSlugs.includes(item.slug))
    : items;

  return filtered.slice(0, slide.itemsLimit).map(item => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    logo: item.logo,
    productCount: item.productCount,
    href: item.href,
  }));
}

function isSlideActive(slide: HomepageHeroSlideSettings, now: Date) {
  if (!slide.enabled) return false;

  const from = slide.activeFrom ? new Date(slide.activeFrom) : null;
  const to = slide.activeTo ? new Date(slide.activeTo) : null;

  if (from && Number.isFinite(from.getTime()) && from > now) return false;
  if (to && Number.isFinite(to.getTime()) && to < now) return false;

  return true;
}

function buildSlideBase(slide: HomepageHeroSlideSettings): HomepageHeroStorefrontSlideBase {
  return {
    id: slide.id,
    type: slide.type,
    theme: slide.theme,
    eyebrow: slide.eyebrow,
    title: slide.title,
    subtitle: slide.subtitle,
    description: slide.description,
    accent: slide.accent,
    primaryCtaLabel: slide.primaryCtaLabel,
    primaryCtaHref: sanitizeHref(slide.primaryCtaHref, "/catalog"),
    secondaryCtaLabel: slide.secondaryCtaLabel,
    secondaryCtaHref: sanitizeHref(slide.secondaryCtaHref, "/contacts"),
  };
}

async function resolveSlide(
  slide: HomepageHeroSlideSettings
): Promise<HomepageHeroStorefrontSlide | null> {
  const base = buildSlideBase(slide);

  if (slide.type === "products") {
    const cards = await buildProductsSlideCards(slide);
    if (cards.length === 0) return null;
    return {
      ...base,
      type: "products",
      cards,
    };
  }

  if (slide.type === "categories") {
    const categoryCards = await buildCategoriesSlideCards(slide);
    if (categoryCards.length === 0) return null;
    return {
      ...base,
      type: "categories",
      categories: categoryCards,
    };
  }

  if (slide.type === "brands") {
    const brands = await buildBrandsSlideCards(slide);
    if (brands.length === 0) return null;
    return {
      ...base,
      type: "brands",
      brands,
    };
  }

  return {
    ...base,
    type: "promo",
  };
}

export async function buildHomepageHeroStorefrontData(): Promise<HomepageHeroStorefrontData> {
  const settings = await getHomepageHeroAdminSettings();
  const now = new Date();
  const activeSlides = settings.slides.filter(slide => isSlideActive(slide, now));
  const candidateSlides = activeSlides.length > 0 ? activeSlides : buildDefaultInteractiveSlides();
  const resolvedSlides = (
    await Promise.all(candidateSlides.map(slide => resolveSlide(slide)))
  ).filter((slide): slide is HomepageHeroStorefrontSlide => Boolean(slide));

  if (settings.variant !== "interactive" || resolvedSlides.length === 0) {
    return {
      variant: "classic",
      slides: [],
      diagnostics: {
        activeSlides: resolvedSlides.length,
        totalSlides: settings.slides.length,
        resolvedTypes: resolvedSlides.map(slide => slide.type),
      },
    };
  }

  return {
    variant: "interactive",
    slides: resolvedSlides,
    diagnostics: {
      activeSlides: resolvedSlides.length,
      totalSlides: settings.slides.length,
      resolvedTypes: resolvedSlides.map(slide => slide.type),
    },
  };
}
