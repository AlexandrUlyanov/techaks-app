import { z } from "zod";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { categories, products } from "@db/schema";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { getRecommendedProducts } from "./merchandising-score";
import {
  attachVisibleMerchandisingBadges,
  listHomepageFallbackProducts,
  publicAvailableStockQtySql,
  publicProductSelectFields,
  publicProductVisibilityCondition,
} from "./public-products";

export const homepagePromoShowcaseSettingsSchema = z.object({
  eyebrow: z.string().trim().max(120).default("Лимитированные предложения"),
  title: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .default("Скидки, которые хочется открыть прямо сейчас"),
  subtitle: z
    .string()
    .trim()
    .max(240)
    .default("Чемпионы по выгоде, выбор ТЕХАКС и свежие скидки в одной витрине."),
  description: z
    .string()
    .trim()
    .max(500)
    .default(
      "Показываем только реальные товары с ценой, старой ценой и наличием. Можно быстро переключаться между сценариями покупки без лишней навигации."
    ),
  accent: z.string().trim().max(80).default("успей купить"),
  primaryCtaLabel: z.string().trim().max(60).default("Смотреть все скидки"),
  primaryCtaHref: z.string().trim().max(255).default("/promotions"),
  secondaryCtaLabel: z.string().trim().max(60).default("Перейти в каталог"),
  secondaryCtaHref: z.string().trim().max(255).default("/catalog"),
  cardsPerTab: z.number().int().min(4).max(12).default(8),
  categoryLimit: z.number().int().min(4).max(10).default(7),
  pinnedProductIds: z.array(z.number().int().positive()).max(24).default([]),
  excludedProductIds: z.array(z.number().int().positive()).max(120).default([]),
});

export type HomepagePromoShowcaseSettings = z.infer<
  typeof homepagePromoShowcaseSettingsSchema
>;

export type PromoShowcaseHeroCard = {
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

export type HomepagePromoShowcaseCategoryRailItem = {
  slug: string;
  name: string;
  productCount: number;
  href: string;
};

export type HomepagePromoShowcaseTab = {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
  href: string;
  products: PromoShowcaseHeroCard[];
};

export type HomepagePromoShowcaseStorefrontData = {
  variant: "promo_showcase";
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  spotlight: PromoShowcaseHeroCard | null;
  categoryRail: HomepagePromoShowcaseCategoryRailItem[];
  tabs: HomepagePromoShowcaseTab[];
  diagnostics: {
    candidateCount: number;
    activeTabs: number;
    categoryRailCount: number;
  };
};

type DiscountCandidate = PromoShowcaseHeroCard & {
  categoryId: number;
  categorySlug: string;
  createdAt: Date | null;
  availableQty: number;
  discountValue: number;
  discountPercent: number;
};

type CandidateSourceRow = {
  id: number;
  slug: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string;
  badge: string | null;
  inStock: boolean;
  categoryName?: string | null;
  categoryId: number;
  categorySlug: string | null;
  createdAt: Date | null;
  availableQty: number | null;
};

function sanitizeHref(value: string, fallback: string) {
  const href = value.trim();
  if (!href) return fallback;
  if (href.startsWith("/")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return fallback;
}

function calculateDiscountPercent(price: number, oldPrice: number | null) {
  if (!oldPrice || oldPrice <= price || oldPrice <= 0) return 0;
  return Math.max(0, Math.round(((oldPrice - price) / oldPrice) * 100));
}

function normalizeHeroCardRows(rows: any[]): PromoShowcaseHeroCard[] {
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

async function listDiscountCandidates(limit = 160): Promise<DiscountCandidate[]> {
  const db = getDb();
  const rows = await db
    .select({
      ...publicProductSelectFields,
      categorySlug: categories.slug,
      availableQty: publicAvailableStockQtySql,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(
      schema.productMerchandising,
      eq(schema.productMerchandising.productId, products.id)
    )
    .where(
      and(
        publicProductVisibilityCondition,
        or(
          sql`${products.oldPrice} IS NOT NULL AND ${products.oldPrice} > ${products.price}`,
          sql`lower(coalesce(${products.badge}, '')) = 'акция'`
        )
      )
    )
    .orderBy(
      desc(sql<number>`coalesce(${products.oldPrice} - ${products.price}, 0)`),
      desc(products.createdAt),
      desc(products.id)
    )
    .limit(limit);

  const withBadges = await attachVisibleMerchandisingBadges(rows);
  return mapRowsToCandidates(withBadges);
}

function mapRowsToCandidates(rows: CandidateSourceRow[]): DiscountCandidate[] {
  return rows
    .map(row => {
      const oldPrice =
        typeof row.oldPrice === "number" && row.oldPrice > row.price ? row.oldPrice : null;
      const discountValue = oldPrice ? oldPrice - row.price : 0;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        price: row.price,
        oldPrice,
        image: row.image,
        badge: row.badge ?? null,
        inStock: Boolean(row.inStock),
        categoryName: row.categoryName ?? null,
        categoryId: row.categoryId,
        categorySlug: row.categorySlug,
        createdAt: row.createdAt ?? null,
        availableQty: Number(row.availableQty ?? 0),
        discountValue,
        discountPercent: calculateDiscountPercent(row.price, oldPrice),
      } satisfies DiscountCandidate;
    })
    .filter(
      candidate =>
        Boolean(candidate.categorySlug) && (candidate.discountValue > 0 || candidate.badge === "Акция")
    );
}

async function listPinnedCandidates(ids: number[]): Promise<DiscountCandidate[]> {
  if (ids.length === 0) return [];

  const db = getDb();
  const rows = await db
    .select({
      ...publicProductSelectFields,
      categorySlug: categories.slug,
      availableQty: publicAvailableStockQtySql,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(
      schema.productMerchandising,
      eq(schema.productMerchandising.productId, products.id)
    )
    .where(and(inArray(products.id, ids), publicProductVisibilityCondition));

  const withBadges = await attachVisibleMerchandisingBadges(rows);
  const candidates = mapRowsToCandidates(withBadges);
  const byId = new Map(candidates.map(item => [item.id, item]));
  return ids.map(id => byId.get(id)).filter((item): item is DiscountCandidate => Boolean(item));
}

function pickBalancedProducts(
  candidates: DiscountCandidate[],
  limit: number,
  score: (candidate: DiscountCandidate) => number,
  usedIds = new Set<number>()
) {
  const sorted = [...candidates]
    .filter(candidate => !usedIds.has(candidate.id))
    .sort((left, right) => {
      const diff = score(right) - score(left);
      if (diff !== 0) return diff;
      return right.id - left.id;
    });

  const picked: DiscountCandidate[] = [];
  const usedCategories = new Set<number>();

  for (const candidate of sorted) {
    if (picked.length >= limit) break;
    if (usedCategories.has(candidate.categoryId)) continue;
    picked.push(candidate);
    usedCategories.add(candidate.categoryId);
    usedIds.add(candidate.id);
  }

  for (const candidate of sorted) {
    if (picked.length >= limit) break;
    if (picked.some(item => item.id === candidate.id)) continue;
    picked.push(candidate);
    usedIds.add(candidate.id);
  }

  return picked;
}

function buildTab(
  id: string,
  label: string,
  eyebrow: string,
  description: string,
  href: string,
  products: DiscountCandidate[]
): HomepagePromoShowcaseTab | null {
  if (products.length === 0) return null;
  return {
    id,
    label,
    eyebrow,
    description,
    href,
    products: products.map(product => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      oldPrice: product.oldPrice,
      image: product.image,
      badge: product.badge ?? "Акция",
      inStock: product.inStock,
      categoryName: product.categoryName,
    })),
  };
}

function buildCategoryRail(
  candidates: DiscountCandidate[],
  limit: number
): HomepagePromoShowcaseCategoryRailItem[] {
  const counts = new Map<
    string,
    { slug: string; name: string; productCount: number }
  >();

  for (const candidate of candidates) {
    const slug = candidate.categorySlug?.trim();
    if (!slug) continue;
    const name = candidate.categoryName?.trim() || "Категория";
    const bucket = counts.get(slug) ?? { slug, name, productCount: 0 };
    bucket.productCount += 1;
    counts.set(slug, bucket);
  }

  return [...counts.values()]
    .sort(
      (left, right) =>
        right.productCount - left.productCount || left.name.localeCompare(right.name, "ru")
    )
    .slice(0, limit)
    .map(item => ({
      ...item,
      href: `/promotions?category=${encodeURIComponent(item.slug)}`,
    }));
}

export async function buildHomepagePromoShowcaseData(
  settings: HomepagePromoShowcaseSettings
): Promise<HomepagePromoShowcaseStorefrontData | null> {
  const normalizedSettings = homepagePromoShowcaseSettingsSchema.parse(settings);
  const cardsPerTab = normalizedSettings.cardsPerTab;
  const pinnedIds = Array.from(new Set(normalizedSettings.pinnedProductIds));
  const excludedIds = new Set(normalizedSettings.excludedProductIds);
  const [allCandidates, pinnedCandidates] = await Promise.all([
    listDiscountCandidates(),
    listPinnedCandidates(pinnedIds),
  ]);
  const pinnedCandidateIds = new Set(pinnedCandidates.map(item => item.id));
  const candidates = allCandidates.filter(
    candidate => !excludedIds.has(candidate.id) && !pinnedCandidateIds.has(candidate.id)
  );
  const filteredPinnedCandidates = pinnedCandidates.filter(candidate => !excludedIds.has(candidate.id));

  if (candidates.length === 0 && filteredPinnedCandidates.length === 0) {
    const fallbackRows = await listHomepageFallbackProducts(6);
    const fallbackCards = normalizeHeroCardRows(fallbackRows);
    if (fallbackCards.length === 0) return null;

    return {
      variant: "promo_showcase",
      eyebrow: normalizedSettings.eyebrow,
      title: normalizedSettings.title,
      subtitle: normalizedSettings.subtitle,
      description: normalizedSettings.description,
      accent: normalizedSettings.accent,
      primaryCtaLabel: normalizedSettings.primaryCtaLabel,
      primaryCtaHref: sanitizeHref(normalizedSettings.primaryCtaHref, "/promotions"),
      secondaryCtaLabel: normalizedSettings.secondaryCtaLabel,
      secondaryCtaHref: sanitizeHref(normalizedSettings.secondaryCtaHref, "/catalog"),
      spotlight: fallbackCards[0] ?? null,
      categoryRail: [],
      tabs: [
        {
          id: "fallback",
          label: "Выбор магазина",
          eyebrow: "Витрина",
          description: "Подобрали актуальные позиции, пока скидочная выборка обновляется.",
          href: "/catalog",
          products: fallbackCards,
        },
      ],
      diagnostics: {
        candidateCount: 0,
        activeTabs: 1,
        categoryRailCount: 0,
      },
    };
  }

  const recommended = normalizeHeroCardRows(await getRecommendedProducts({ limit: 24 }));
  const recommendedIds = new Set(recommended.map(item => item.id));
  const discountedRecommended = candidates.filter(candidate => recommendedIds.has(candidate.id));
  const usedIds = new Set<number>();

  const mergePinnedProducts = (
    base: DiscountCandidate[],
    limit: number,
    pinnedLimit = 2
  ) => {
    const preferredPinned = filteredPinnedCandidates.slice(0, Math.min(pinnedLimit, limit));
    const pinnedIdSet = new Set(preferredPinned.map(item => item.id));
    const merged = [...preferredPinned];
    for (const candidate of base) {
      if (merged.length >= limit) break;
      if (pinnedIdSet.has(candidate.id)) continue;
      merged.push(candidate);
    }
    return merged;
  };

  const bestOffersBase = pickBalancedProducts(
    candidates,
    cardsPerTab,
    candidate => candidate.discountPercent * 100 + candidate.discountValue + (candidate.inStock ? 120 : 0),
    usedIds
  );
  const bestOffers = mergePinnedProducts(bestOffersBase, cardsPerTab, 3);
  const champions = pickBalancedProducts(
    candidates,
    cardsPerTab,
    candidate => candidate.discountValue * 10 + candidate.discountPercent + (candidate.inStock ? 100 : 0),
    usedIds
  );
  const endingSoon = pickBalancedProducts(
    candidates.filter(candidate => candidate.availableQty > 0 && candidate.availableQty <= 3),
    cardsPerTab,
    candidate => (4 - Math.min(candidate.availableQty, 4)) * 1000 + candidate.discountPercent * 20 + candidate.discountValue,
    usedIds
  );
  const techaksChoiceBase = pickBalancedProducts(
    discountedRecommended.length > 0 ? discountedRecommended : candidates,
    cardsPerTab,
    candidate => candidate.discountPercent * 50 + candidate.discountValue + (recommendedIds.has(candidate.id) ? 200 : 0),
    usedIds
  );
  const techaksChoice = mergePinnedProducts(techaksChoiceBase, cardsPerTab, 2);
  const newSales = pickBalancedProducts(
    candidates,
    cardsPerTab,
    candidate => {
      const ageHours = candidate.createdAt
        ? Math.max(1, (Date.now() - new Date(candidate.createdAt).getTime()) / 3_600_000)
        : 999;
      return Math.max(0, 500 - ageHours) + candidate.discountPercent * 30 + candidate.discountValue;
    },
    usedIds
  );

  const tabs = [
    buildTab(
      "best-offers",
      "Лучшие предложения",
      "Выгода дня",
      "Максимум пользы на первом экране: сильные скидки, наличие и быстрый переход в карточку.",
      "/promotions",
      bestOffers
    ),
    buildTab(
      "champions",
      "Чемпионы скидок",
      "Лидеры по экономии",
      "Товары с самым заметным разрывом между старой и текущей ценой.",
      "/promotions",
      champions
    ),
    buildTab(
      "ending-soon",
      "Успей купить",
      "Остатки ограничены",
      "Позиции, которые уже заканчиваются и не любят долгих раздумий.",
      "/promotions",
      endingSoon
    ),
    buildTab(
      "techaks-choice",
      "Выбор ТЕХАКС",
      "Рекомендация магазина",
      "Собрали скидочные товары, которые выглядят сильнее остальных не только по цене.",
      "/promotions",
      techaksChoice
    ),
    buildTab(
      "new-sales",
      "Новые скидки",
      "Только появились",
      "Свежие предложения, которые недавно попали в витрину и ещё не примелькались.",
      "/promotions",
      newSales
    ),
  ].filter((tab): tab is HomepagePromoShowcaseTab => Boolean(tab));

  if (tabs.length === 0) {
    return null;
  }

  const spotlight =
    filteredPinnedCandidates[0] ??
    bestOffers[0] ??
    champions[0] ??
    techaksChoice[0] ??
    newSales[0] ??
    candidates[0] ??
    null;
  const categoryRail = buildCategoryRail(candidates, normalizedSettings.categoryLimit);

  return {
    variant: "promo_showcase",
    eyebrow: normalizedSettings.eyebrow,
    title: normalizedSettings.title,
    subtitle: normalizedSettings.subtitle,
    description: normalizedSettings.description,
    accent: normalizedSettings.accent,
    primaryCtaLabel: normalizedSettings.primaryCtaLabel,
    primaryCtaHref: sanitizeHref(normalizedSettings.primaryCtaHref, "/promotions"),
    secondaryCtaLabel: normalizedSettings.secondaryCtaLabel,
    secondaryCtaHref: sanitizeHref(normalizedSettings.secondaryCtaHref, "/catalog"),
    spotlight: spotlight
      ? {
          id: spotlight.id,
          slug: spotlight.slug,
          name: spotlight.name,
          price: spotlight.price,
          oldPrice: spotlight.oldPrice,
          image: spotlight.image,
          badge: spotlight.badge ?? "Акция",
          inStock: spotlight.inStock,
          categoryName: spotlight.categoryName,
        }
      : null,
    categoryRail,
    tabs,
    diagnostics: {
      candidateCount: candidates.length,
      activeTabs: tabs.length,
      categoryRailCount: categoryRail.length,
    },
  };
}
