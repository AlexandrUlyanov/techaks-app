import { z } from "zod";
import { asc, desc, inArray } from "drizzle-orm";
import {
  categories,
  manufacturers,
  productVariants,
  products,
} from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import { publicAvailableStockQtySql, publicProductVisibilityCondition } from "./public-products";
import { getSiteProfileSettings } from "./site-profile-settings";

const DEFAULT_SITE_URL = "https://techaks.ru";
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;

export const YANDEX_YML_PUBLIC_PATH = "/feeds/yandex-business.yml";
export const VK_XML_PUBLIC_PATH = "/feeds/vk.xml";

const yandexYmlFeedSettingKeys = {
  enabled: "feed_yandex_yml_enabled",
  feedName: "feed_yandex_yml_name",
  companyName: "feed_yandex_yml_company_name",
  shopUrl: "feed_yandex_yml_shop_url",
  currencyId: "feed_yandex_yml_currency_id",
  includeOutOfStock: "feed_yandex_yml_include_out_of_stock",
  pickup: "feed_yandex_yml_pickup",
  delivery: "feed_yandex_yml_delivery",
  salesNotes: "feed_yandex_yml_sales_notes",
} as const;

const vkFeedSettingKeys = {
  enabled: "feed_vk_enabled",
  feedName: "feed_vk_name",
  companyName: "feed_vk_company_name",
  shopUrl: "feed_vk_shop_url",
  utmEnabled: "feed_vk_utm_enabled",
  utmSource: "feed_vk_utm_source",
  utmMedium: "feed_vk_utm_medium",
  utmCampaign: "feed_vk_utm_campaign",
  onlyInStock: "feed_vk_only_in_stock",
  includeOutOfStockAsUnavailable: "feed_vk_include_out_of_stock_as_unavailable",
  maxItems: "feed_vk_max_items",
} as const;

const allYandexYmlFeedSettingKeys = Object.values(yandexYmlFeedSettingKeys);
const allVkFeedSettingKeys = Object.values(vkFeedSettingKeys);

export const yandexYmlFeedSettingsInputSchema = z.object({
  enabled: z.boolean().default(false),
  feedName: z.string().trim().min(2).max(255),
  companyName: z.string().trim().min(2).max(255),
  shopUrl: z.string().trim().url(),
  currencyId: z.enum(["RUR", "RUB"]).default("RUR"),
  includeOutOfStock: z.boolean().default(false),
  pickup: z.boolean().default(true),
  delivery: z.boolean().default(true),
  salesNotes: z.string().trim().max(255).default(""),
});

export const vkFeedSettingsInputSchema = z.object({
  enabled: z.boolean().default(false),
  feedName: z.string().trim().min(2).max(255),
  companyName: z.string().trim().min(2).max(255),
  shopUrl: z.string().trim().url(),
  utmEnabled: z.boolean().default(true),
  utmSource: z.string().trim().min(1).max(80).default("vk"),
  utmMedium: z.string().trim().min(1).max(80).default("cpc"),
  utmCampaign: z.string().trim().min(1).max(120).default("product_feed"),
  onlyInStock: z.boolean().default(true),
  includeOutOfStockAsUnavailable: z.boolean().default(false),
  maxItems: z.number().int().min(1).max(100000).nullable().default(null),
});

export type YandexYmlFeedSettingsInput = z.infer<typeof yandexYmlFeedSettingsInputSchema>;
export type VkFeedSettingsInput = z.infer<typeof vkFeedSettingsInputSchema>;

type YandexYmlFeedSettings = YandexYmlFeedSettingsInput & {
  publicUrl: string;
  publicPath: string;
  baseUrl: string;
};

type VkFeedSettings = VkFeedSettingsInput & {
  publicUrl: string;
  publicPath: string;
  baseUrl: string;
};

type FeedStats = {
  productOffers: number;
  variantOffers: number;
  totalOffers: number;
  skippedOutOfStock: number;
  skippedWithoutPrice: number;
  skippedWithoutPicture: number;
  skippedWithoutCategory: number;
  skippedWithoutName: number;
  categoriesIncluded: number;
  warnings: string[];
  productsSource: number;
  vendorMissingCount: number;
  vendorCodeMissingCount: number;
  barcodeMissingCount: number;
  descriptionMissingCount: number;
  picturesMissingCount: number;
  descriptionsSanitized: number;
};

type FeedValidationDiagnostics = {
  pictureProbeChecked: number;
  pictureProbeFailed: number;
  brokenPictureSamples: string[];
  checklist: string[];
};

type FeedOffer = {
  id: string;
  url: string;
  price: number;
  oldPrice: number | null;
  currencyId: "RUR" | "RUB";
  categoryId: number;
  pictures: string[];
  vendor: string;
  name: string;
  description: string;
  vendorCode: string | null;
  barcode: string | null;
  available: boolean;
  pickup: boolean;
  delivery: boolean;
  salesNotes: string | null;
  params: Array<{ name: string; value: string }>;
};

type FeedSourceProduct = {
  id: number;
  slug: string;
  name: string;
  categoryId: number;
  price: number;
  oldPrice: number | null;
  article: string | null;
  externalCode: string | null;
  barcode: string | null;
  image: string | null;
  imageVariants: unknown;
  images: unknown;
  description: string | null;
  specs: unknown;
  availableQty: number;
};

type FeedSourceVariant = {
  id: number;
  productId: number;
  name: string | null;
  article: string | null;
  externalCode: string | null;
  image: string | null;
  imageVariants: unknown;
  price: number;
  stock: number;
  attributesJson: unknown;
  isActive: boolean;
};

type FeedSourceCategory = {
  id: number;
  parentId: number | null;
  name: string;
};

type FeedSourceData = {
  productRows: FeedSourceProduct[];
  variantRows: FeedSourceVariant[];
  categoryRows: FeedSourceCategory[];
  knownManufacturers: Array<{ normalizedName: string; name: string }>;
};

type FeedBuildOptions = {
  ignoreEnabled?: boolean;
  previewOnly?: boolean;
  skipCache?: boolean;
};

type FeedBuildResult<TSettings> = {
  xml: string;
  stats: FeedStats;
  generatedAt: string;
  settings: TSettings;
  preview: string;
  validation?: FeedValidationDiagnostics;
};

const feedCache = new Map<string, { expiresAt: number; value: unknown }>();

function getFeedCacheKey(name: string, previewOnly?: boolean) {
  return `${name}:${previewOnly ? "preview" : "full"}`;
}

function readFeedCache<T>(key: string): T | null {
  const cached = feedCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    feedCache.delete(key);
    return null;
  }
  return cached.value as T;
}

function writeFeedCache<T>(key: string, value: T) {
  feedCache.set(key, {
    value,
    expiresAt: Date.now() + FEED_CACHE_TTL_MS,
  });
}

export function invalidateFeedCache(scope?: "yandex" | "vk") {
  if (!scope) {
    feedCache.clear();
    return;
  }
  const prefix = `${scope}:`;
  for (const key of feedCache.keys()) {
    if (key.startsWith(prefix)) {
      feedCache.delete(key);
    }
  }
}

function normalizeSettingText(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeBooleanSetting(value: string | null | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  return value.trim().toLowerCase() === "true";
}

function normalizeNullableNumberSetting(
  value: string | null | undefined,
  fallback: number | null
) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cdata(value: string) {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function sanitizeDescription(value: unknown) {
  const raw = String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  const sanitized = stripHtml(raw).replace(/\s+/g, " ").trim();
  return {
    value: sanitized,
    wasSanitized: raw !== sanitized,
  };
}

function normalizeSpecToken(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhraseBoundaryMatch(haystack: string, needle: string) {
  if (!haystack || !needle) return false;
  let fromIndex = 0;
  while (fromIndex < haystack.length) {
    const index = haystack.indexOf(needle, fromIndex);
    if (index < 0) return false;
    const prev = index === 0 ? " " : haystack[index - 1];
    const next =
      index + needle.length >= haystack.length
        ? " "
        : haystack[index + needle.length];
    if (prev === " " && next === " ") return true;
    fromIndex = index + 1;
  }
  return false;
}

function resolveAbsoluteUrl(url: string, siteUrl: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${siteUrl.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
}

function appendUtmParams(url: string, params: Record<string, string>) {
  const normalizedUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    normalizedUrl.searchParams.set(key, value);
  }
  return normalizedUrl.toString();
}

function normalizeVariantAttributes(
  value: unknown
): Array<{ name: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([name, rawValue]) => ({
      name: String(name || "").trim(),
      value:
        rawValue == null
          ? ""
          : typeof rawValue === "string"
            ? rawValue.trim()
            : String(rawValue).trim(),
    }))
    .filter(item => item.name && item.value);
}

function normalizeProductSpecs(
  value: unknown
): Array<{ name: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([name, rawValue]) => ({
      name: String(name || "").trim(),
      value:
        rawValue == null
          ? ""
          : typeof rawValue === "string"
            ? rawValue.trim()
            : String(rawValue).trim(),
    }))
    .filter(item => item.name && item.value);
}

function normalizeImageCollection(
  image: string | null,
  imageVariants: unknown,
  gallery: unknown
) {
  const urls = new Set<string>();

  const tryPush = (candidate: unknown) => {
    if (typeof candidate === "string" && candidate.trim()) {
      urls.add(candidate.trim());
    }
  };

  tryPush(image);

  if (imageVariants && typeof imageVariants === "object" && !Array.isArray(imageVariants)) {
    const variantObject = imageVariants as Record<string, unknown>;
    tryPush(
      variantObject.original ||
        variantObject.medium ||
        variantObject.card ||
        variantObject.thumb
    );
  }

  if (Array.isArray(gallery)) {
    for (const item of gallery) {
      if (typeof item === "string") {
        tryPush(item);
        continue;
      }

      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        tryPush(record.original || record.medium || record.card || record.thumb);
      }
    }
  }

  return Array.from(urls);
}

function createEmptyFeedStats(productsSource: number): FeedStats {
  return {
    productOffers: 0,
    variantOffers: 0,
    totalOffers: 0,
    skippedOutOfStock: 0,
    skippedWithoutPrice: 0,
    skippedWithoutPicture: 0,
    skippedWithoutCategory: 0,
    skippedWithoutName: 0,
    categoriesIncluded: 0,
    warnings: [],
    productsSource,
    vendorMissingCount: 0,
    vendorCodeMissingCount: 0,
    barcodeMissingCount: 0,
    descriptionMissingCount: 0,
    picturesMissingCount: 0,
    descriptionsSanitized: 0,
  };
}

async function probeFeedPictures(urls: string[], sampleSize = 10) {
  const samples = Array.from(new Set(urls)).slice(0, sampleSize);
  const brokenPictureSamples: string[] = [];

  for (const url of samples) {
    try {
      let response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(4_000),
        headers: { "user-agent": "techaks-feed-validator/1.0" },
      });

      if (response.status === 405 || response.status === 403) {
        response = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(4_000),
          headers: {
            Range: "bytes=0-0",
            "user-agent": "techaks-feed-validator/1.0",
          },
        });
      }

      if (!response.ok) {
        brokenPictureSamples.push(`${url} (HTTP ${response.status})`);
      }
    } catch (error) {
      brokenPictureSamples.push(
        `${url} (${error instanceof Error ? error.message : "request failed"})`
      );
    }
  }

  return {
    pictureProbeChecked: samples.length,
    pictureProbeFailed: brokenPictureSamples.length,
    brokenPictureSamples,
  };
}

async function loadFeedSourceData(): Promise<FeedSourceData> {
  const db = getDb();

  const productRows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      categoryId: products.categoryId,
      price: products.price,
      oldPrice: products.oldPrice,
      article: products.article,
      externalCode: products.externalCode,
      barcode: products.barcode,
      image: products.image,
      imageVariants: products.imageVariants,
      images: products.images,
      description: products.description,
      specs: products.specs,
      availableQty: publicAvailableStockQtySql,
    })
    .from(products)
    .where(publicProductVisibilityCondition)
    .orderBy(desc(products.id));

  const productIds = productRows.map(row => row.id);
  const variantRows =
    productIds.length > 0
      ? await db
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
            name: productVariants.name,
            article: productVariants.article,
            externalCode: productVariants.externalCode,
            image: productVariants.image,
            imageVariants: productVariants.imageVariants,
            price: productVariants.price,
            stock: productVariants.stock,
            attributesJson: productVariants.attributesJson,
            isActive: productVariants.isActive,
          })
          .from(productVariants)
          .where(inArray(productVariants.productId, productIds))
          .orderBy(asc(productVariants.productId), asc(productVariants.id))
      : [];

  const categoryRows = await db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      name: categories.name,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id));

  const manufacturerRows = await db
    .select({
      normalizedName: manufacturers.normalizedName,
      name: manufacturers.name,
    })
    .from(manufacturers)
    .orderBy(desc(manufacturers.productCount), asc(manufacturers.name));

  const knownManufacturers = manufacturerRows
    .map(item => ({
      normalizedName: normalizeSpecToken(item.normalizedName),
      name: item.name,
    }))
    .filter(item => item.normalizedName);

  return {
    productRows,
    variantRows,
    categoryRows,
    knownManufacturers,
  };
}

function resolveVendorFactory(
  knownManufacturers: Array<{ normalizedName: string; name: string }>
) {
  return (productName: string, specs: unknown) => {
    const specEntries = normalizeProductSpecs(specs);
    const directManufacturer = specEntries.find(entry => {
      const normalized = normalizeSpecToken(entry.name);
      return normalized === "производитель" || normalized === "бренд";
    });
    if (directManufacturer?.value) return directManufacturer.value;

    const normalizedTitle = normalizeSpecToken(productName);
    const byTitle = knownManufacturers.find(candidate =>
      hasPhraseBoundaryMatch(normalizedTitle, candidate.normalizedName)
    );
    return byTitle?.name || "Без бренда";
  };
}

function expandCategoryIdsWithParents(
  directCategoryIds: Set<number>,
  categoryRows: FeedSourceCategory[]
) {
  const byId = new Map(categoryRows.map(category => [category.id, category] as const));
  const included = new Set<number>();

  for (const categoryId of directCategoryIds) {
    let currentId: number | null | undefined = categoryId;
    while (currentId) {
      if (included.has(currentId)) break;
      included.add(currentId);
      currentId = byId.get(currentId)?.parentId ?? null;
    }
  }

  return included;
}

function buildCategoryXmlRows(
  categoryRows: FeedSourceCategory[],
  includedCategoryIds: Set<number>
) {
  return categoryRows
    .filter(category => includedCategoryIds.has(category.id))
    .map(category => {
      const parentAttribute =
        category.parentId && includedCategoryIds.has(category.parentId)
          ? ` parentId="${category.parentId}"`
          : "";
      return `    <category id="${category.id}"${parentAttribute}>${xmlEscape(
        category.name
      )}</category>`;
    })
    .join("\n");
}

function collectFeedOffers(
  source: FeedSourceData,
  options: {
    siteUrl: string;
    currencyId: "RUR" | "RUB";
    includeOutOfStock: boolean;
    pictureMode: "single" | "multiple";
    maxPictures?: number;
    pickup: boolean;
    delivery: boolean;
    salesNotes?: string | null;
    utm?: {
      enabled: boolean;
      source: string;
      medium: string;
      campaign: string;
    };
    maxItems?: number | null;
  }
) {
  const variantsByProductId = new Map<number, FeedSourceVariant[]>();
  for (const variant of source.variantRows) {
    const bucket = variantsByProductId.get(variant.productId) ?? [];
    bucket.push(variant);
    variantsByProductId.set(variant.productId, bucket);
  }

  const stats = createEmptyFeedStats(source.productRows.length);
  const categoryIds = new Set(source.categoryRows.map(category => category.id));
  const resolveVendor = resolveVendorFactory(source.knownManufacturers);
  const offers: FeedOffer[] = [];

  const buildProductUrl = (slug: string, variantId?: number) => {
    const baseUrl = `${options.siteUrl}/product/${encodeURIComponent(slug)}${
      variantId ? `?variant=${variantId}` : ""
    }`;
    if (!options.utm?.enabled) return baseUrl;
    return appendUtmParams(baseUrl, {
      utm_source: options.utm.source,
      utm_medium: options.utm.medium,
      utm_campaign: options.utm.campaign,
    });
  };

  const normalizePictures = (
    image: string | null,
    imageVariants: unknown,
    gallery: unknown
  ) => {
    const limit = options.maxPictures ?? (options.pictureMode === "single" ? 1 : 8);
    return normalizeImageCollection(image, imageVariants, gallery)
      .map(imageUrl => resolveAbsoluteUrl(imageUrl, options.siteUrl))
      .filter(Boolean)
      .slice(0, options.pictureMode === "single" ? 1 : limit);
  };

  const pushOffer = (offer: FeedOffer) => {
    offers.push(offer);
    stats.totalOffers = offers.length;
  };

  for (const product of source.productRows) {
    const categoryId = Number(product.categoryId);
    const productPrice = Number(product.price ?? 0);
    const productOldPrice = product.oldPrice ? Number(product.oldPrice) : null;
    const availableQty = Number(product.availableQty ?? 0);
    const productAvailable = availableQty > 0;
    const vendor = resolveVendor(product.name, product.specs);
    const descriptionMeta = sanitizeDescription(product.description);
    const specParams = normalizeProductSpecs(product.specs);
    const variants = (variantsByProductId.get(product.id) ?? []).filter(variant => variant.isActive);
    const activeVariants = variants.filter(variant => Number(variant.price ?? 0) > 0);

    const appendOffer = (input: {
      id: string;
      name: string;
      price: number;
      oldPrice: number | null;
      available: boolean;
      vendorCode: string | null;
      barcode: string | null;
      image: string | null;
      imageVariants: unknown;
      images: unknown;
      description: string;
      categoryId: number;
      vendor: string;
      params: Array<{ name: string; value: string }>;
      url: string;
    }) => {
      if (!input.name.trim()) {
        stats.skippedWithoutName += 1;
        return;
      }
      if (input.price <= 0) {
        stats.skippedWithoutPrice += 1;
        return;
      }
      if (!categoryIds.has(input.categoryId)) {
        stats.skippedWithoutCategory += 1;
        return;
      }
      if (!options.includeOutOfStock && !input.available) {
        stats.skippedOutOfStock += 1;
        return;
      }

      const pictures = normalizePictures(input.image, input.imageVariants, input.images);
      if (pictures.length === 0) {
        stats.skippedWithoutPicture += 1;
        stats.picturesMissingCount += 1;
        return;
      }
      if (!input.vendor || input.vendor === "Без бренда") {
        stats.vendorMissingCount += 1;
      }
      if (!input.vendorCode?.trim()) {
        stats.vendorCodeMissingCount += 1;
      }
      if (!input.barcode?.trim()) {
        stats.barcodeMissingCount += 1;
      }
      if (!input.description.trim()) {
        stats.descriptionMissingCount += 1;
      }
      if (descriptionMeta.wasSanitized) {
        stats.descriptionsSanitized += 1;
      }

      pushOffer({
        id: input.id,
        url: input.url,
        price: input.price,
        oldPrice: input.oldPrice,
        currencyId: options.currencyId,
        categoryId: input.categoryId,
        pictures,
        vendor: input.vendor || "Без бренда",
        name: input.name.trim(),
        description: input.description,
        vendorCode: input.vendorCode,
        barcode: input.barcode,
        available: input.available,
        pickup: options.pickup,
        delivery: options.delivery,
        salesNotes: options.salesNotes?.trim() || null,
        params: input.params.slice(0, 12),
      });
    };

    if (activeVariants.length > 0) {
      for (const variant of activeVariants) {
        const variantPrice = Number(variant.price ?? 0);
        const variantAvailable = Number(variant.stock ?? 0) > 0;
        const variantAttributes = normalizeVariantAttributes(variant.attributesJson);
        const variantTitle =
          variant.name?.trim() && variant.name.trim() !== product.name.trim()
            ? `${product.name} — ${variant.name.trim()}`
            : product.name;

        appendOffer({
          id: `variant-${variant.id}`,
          name: variantTitle,
          price: variantPrice,
          oldPrice: productOldPrice && productOldPrice > variantPrice ? productOldPrice : null,
          available: variantAvailable,
          vendorCode:
            variant.article?.trim() ||
            variant.externalCode?.trim() ||
            product.article?.trim() ||
            product.externalCode?.trim() ||
            product.barcode?.trim() ||
            null,
          barcode: product.barcode?.trim() || null,
          image: variant.image?.trim() || product.image,
          imageVariants: variant.imageVariants ?? product.imageVariants,
          images: product.images,
          description: descriptionMeta.value,
          categoryId,
          vendor,
          params: [...variantAttributes, ...specParams],
          url: buildProductUrl(product.slug, variant.id),
        });
        stats.variantOffers += 1;
        if (options.maxItems && offers.length >= options.maxItems) break;
      }
      if (options.maxItems && offers.length >= options.maxItems) break;
      continue;
    }

    appendOffer({
      id: `product-${product.id}`,
      name: product.name,
      price: productPrice,
      oldPrice: productOldPrice && productOldPrice > productPrice ? productOldPrice : null,
      available: productAvailable,
      vendorCode:
        product.article?.trim() || product.externalCode?.trim() || product.barcode?.trim() || null,
      barcode: product.barcode?.trim() || null,
      image: product.image,
      imageVariants: product.imageVariants,
      images: product.images,
      description: descriptionMeta.value,
      categoryId,
      vendor,
      params: specParams,
      url: buildProductUrl(product.slug),
    });
    stats.productOffers += 1;
    if (options.maxItems && offers.length >= options.maxItems) break;
  }

  const directCategoryIds = new Set(offers.map(offer => offer.categoryId));
  const includedCategoryIds = expandCategoryIdsWithParents(directCategoryIds, source.categoryRows);
  stats.categoriesIncluded = includedCategoryIds.size;
  stats.totalOffers = offers.length;

  if (stats.vendorMissingCount > 0) {
    stats.warnings.push(
      `У ${stats.vendorMissingCount} офферов бренд определить не удалось — используется значение «Без бренда».`
    );
  }
  if (stats.vendorCodeMissingCount > 0) {
    stats.warnings.push(
      `У ${stats.vendorCodeMissingCount} офферов не заполнен vendorCode. Для Яндекс Товаров это желательно исправить.`
    );
  }
  if (stats.barcodeMissingCount > 0) {
    stats.warnings.push(
      `У ${stats.barcodeMissingCount} офферов нет barcode. Это снижает качество товарной идентификации.`
    );
  }
  if (stats.descriptionMissingCount > 0) {
    stats.warnings.push(
      `У ${stats.descriptionMissingCount} офферов пустое описание. Их стоит обогатить перед загрузкой в Яндекс.`
    );
  }
  if (stats.skippedWithoutPicture > 0) {
    stats.warnings.push(
      `${stats.skippedWithoutPicture} позиций пропущено, потому что у товара нет изображения.`
    );
  }
  if (stats.skippedWithoutPrice > 0) {
    stats.warnings.push(
      `${stats.skippedWithoutPrice} позиций пропущено из-за нулевой или отсутствующей цены.`
    );
  }
  if (stats.skippedWithoutCategory > 0) {
    stats.warnings.push(
      `${stats.skippedWithoutCategory} позиций пропущено, потому что не удалось сопоставить категорию.`
    );
  }
  if (!options.includeOutOfStock && stats.skippedOutOfStock > 0) {
    stats.warnings.push(
      `${stats.skippedOutOfStock} позиций не попали в выгрузку, потому что выключен экспорт товаров без наличия.`
    );
  }
  if (stats.skippedWithoutName > 0) {
    stats.warnings.push(
      `${stats.skippedWithoutName} позиций пропущено, потому что у товара не заполнено название.`
    );
  }
  if (stats.descriptionsSanitized > 0) {
    stats.warnings.push(
      `У ${stats.descriptionsSanitized} офферов описание было очищено от HTML и лишних пробелов.`
    );
  }
  if (options.maxItems && offers.length >= options.maxItems) {
    stats.warnings.push(
      `Достигнут лимит выгрузки: ${options.maxItems} офферов. Остальные товары не включены в XML.`
    );
  }

  return {
    offers,
    stats,
    includedCategoryIds,
  };
}

function buildFeedPreview(xml: string, previewOnly?: boolean) {
  return xml.split("\n").slice(0, previewOnly ? 90 : 120).join("\n");
}

function renderYandexXml(settings: YandexYmlFeedSettings, categoryRowsXml: string, offers: FeedOffer[]) {
  const generatedAt = new Date();
  const feedDate = generatedAt.toISOString().slice(0, 19).replace("T", " ");
  const offersXml = offers
    .map(offer => {
      const paramsXml = offer.params
        .map(param => `      <param name="${xmlEscape(param.name)}">${xmlEscape(param.value)}</param>`)
        .join("\n");
      const picturesXml = offer.pictures
        .map(picture => `      <picture>${xmlEscape(picture)}</picture>`)
        .join("\n");

      return [
        `    <offer id="${xmlEscape(offer.id)}" available="${offer.available ? "true" : "false"}">`,
        `      <url>${xmlEscape(offer.url)}</url>`,
        `      <price>${offer.price.toFixed(2)}</price>`,
        offer.oldPrice ? `      <oldprice>${offer.oldPrice.toFixed(2)}</oldprice>` : null,
        `      <currencyId>${offer.currencyId}</currencyId>`,
        `      <categoryId>${offer.categoryId}</categoryId>`,
        picturesXml || null,
        `      <name>${xmlEscape(offer.name)}</name>`,
        `      <vendor>${xmlEscape(offer.vendor)}</vendor>`,
        offer.vendorCode ? `      <vendorCode>${xmlEscape(offer.vendorCode)}</vendorCode>` : null,
        offer.barcode ? `      <barcode>${xmlEscape(offer.barcode)}</barcode>` : null,
        `      <pickup>${offer.pickup ? "true" : "false"}</pickup>`,
        `      <delivery>${offer.delivery ? "true" : "false"}</delivery>`,
        offer.salesNotes ? `      <sales_notes>${xmlEscape(offer.salesNotes)}</sales_notes>` : null,
        offer.description ? `      <description>${cdata(offer.description)}</description>` : null,
        paramsXml || null,
        `    </offer>`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return {
    generatedAt: generatedAt.toISOString(),
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${feedDate}">
  <shop>
    <name>${xmlEscape(settings.feedName)}</name>
    <company>${xmlEscape(settings.companyName)}</company>
    <url>${xmlEscape(settings.shopUrl)}</url>
    <currencies>
      <currency id="${settings.currencyId}" rate="1"/>
    </currencies>
    <categories>
${categoryRowsXml}
    </categories>
    <offers>
${offersXml}
    </offers>
  </shop>
</yml_catalog>`,
  };
}

function renderVkXml(settings: VkFeedSettings, categoryRowsXml: string, offers: FeedOffer[]) {
  const generatedAt = new Date();
  const feedDate = generatedAt.toISOString().slice(0, 16).replace("T", " ");
  const offersXml = offers
    .map(offer => {
      const picturesXml = offer.pictures
        .map(picture => `      <picture>${xmlEscape(picture)}</picture>`)
        .join("\n");
      return [
        `    <offer id="${xmlEscape(offer.id)}" available="${offer.available ? "true" : "false"}">`,
        `      <url>${xmlEscape(offer.url)}</url>`,
        `      <price>${offer.price.toFixed(2)}</price>`,
        `      <currencyId>RUB</currencyId>`,
        `      <categoryId>${offer.categoryId}</categoryId>`,
        picturesXml || null,
        `      <name>${xmlEscape(offer.name)}</name>`,
        offer.description ? `      <description>${cdata(offer.description)}</description>` : null,
        offer.vendor ? `      <vendor>${xmlEscape(offer.vendor)}</vendor>` : null,
        `    </offer>`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return {
    generatedAt: generatedAt.toISOString(),
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${feedDate}">
  <shop>
    <name>${xmlEscape(settings.feedName)}</name>
    <company>${xmlEscape(settings.companyName)}</company>
    <url>${xmlEscape(settings.shopUrl)}</url>
    <currencies>
      <currency id="RUB" rate="1"/>
    </currencies>
    <categories>
${categoryRowsXml}
    </categories>
    <offers>
${offersXml}
    </offers>
  </shop>
</yml_catalog>`,
  };
}

async function buildDefaultYandexYmlSettings(): Promise<YandexYmlFeedSettings> {
  const profile = await getSiteProfileSettings();
  const sellerName =
    profile.seller.shortName?.trim() ||
    profile.seller.fullName?.trim() ||
    "ТЕХАКС";

  return {
    enabled: false,
    feedName: sellerName,
    companyName: sellerName,
    shopUrl: DEFAULT_SITE_URL,
    currencyId: "RUR",
    includeOutOfStock: false,
    pickup: true,
    delivery: true,
    salesNotes: "",
    publicUrl: `${DEFAULT_SITE_URL}${YANDEX_YML_PUBLIC_PATH}`,
    publicPath: YANDEX_YML_PUBLIC_PATH,
    baseUrl: DEFAULT_SITE_URL,
  };
}

async function buildDefaultVkFeedSettings(): Promise<VkFeedSettings> {
  const profile = await getSiteProfileSettings();
  const sellerName =
    profile.seller.shortName?.trim() ||
    profile.seller.fullName?.trim() ||
    "ТЕХАКС";

  return {
    enabled: false,
    feedName: sellerName,
    companyName: sellerName,
    shopUrl: DEFAULT_SITE_URL,
    utmEnabled: true,
    utmSource: "vk",
    utmMedium: "cpc",
    utmCampaign: "product_feed",
    onlyInStock: true,
    includeOutOfStockAsUnavailable: false,
    maxItems: null,
    publicUrl: `${DEFAULT_SITE_URL}${VK_XML_PUBLIC_PATH}`,
    publicPath: VK_XML_PUBLIC_PATH,
    baseUrl: DEFAULT_SITE_URL,
  };
}

export async function getYandexYmlFeedSettings(): Promise<YandexYmlFeedSettings> {
  const defaults = await buildDefaultYandexYmlSettings();
  const values = await getAppSettings([...allYandexYmlFeedSettingKeys]);

  const shopUrl = normalizeSettingText(
    values[yandexYmlFeedSettingKeys.shopUrl],
    defaults.shopUrl
  ).replace(/\/+$/, "");

  return {
    enabled: normalizeBooleanSetting(values[yandexYmlFeedSettingKeys.enabled], defaults.enabled),
    feedName: normalizeSettingText(values[yandexYmlFeedSettingKeys.feedName], defaults.feedName),
    companyName: normalizeSettingText(
      values[yandexYmlFeedSettingKeys.companyName],
      defaults.companyName
    ),
    shopUrl,
    currencyId:
      values[yandexYmlFeedSettingKeys.currencyId]?.trim() === "RUB" ? "RUB" : "RUR",
    includeOutOfStock: normalizeBooleanSetting(
      values[yandexYmlFeedSettingKeys.includeOutOfStock],
      defaults.includeOutOfStock
    ),
    pickup: normalizeBooleanSetting(values[yandexYmlFeedSettingKeys.pickup], defaults.pickup),
    delivery: normalizeBooleanSetting(
      values[yandexYmlFeedSettingKeys.delivery],
      defaults.delivery
    ),
    salesNotes: normalizeSettingText(
      values[yandexYmlFeedSettingKeys.salesNotes],
      defaults.salesNotes
    ),
    publicUrl: `${DEFAULT_SITE_URL}${YANDEX_YML_PUBLIC_PATH}`,
    publicPath: YANDEX_YML_PUBLIC_PATH,
    baseUrl: shopUrl,
  };
}

export async function getVkFeedSettings(): Promise<VkFeedSettings> {
  const defaults = await buildDefaultVkFeedSettings();
  const values = await getAppSettings([...allVkFeedSettingKeys]);

  const shopUrl = normalizeSettingText(values[vkFeedSettingKeys.shopUrl], defaults.shopUrl).replace(
    /\/+$/,
    ""
  );

  return {
    enabled: normalizeBooleanSetting(values[vkFeedSettingKeys.enabled], defaults.enabled),
    feedName: normalizeSettingText(values[vkFeedSettingKeys.feedName], defaults.feedName),
    companyName: normalizeSettingText(values[vkFeedSettingKeys.companyName], defaults.companyName),
    shopUrl,
    utmEnabled: normalizeBooleanSetting(values[vkFeedSettingKeys.utmEnabled], defaults.utmEnabled),
    utmSource: normalizeSettingText(values[vkFeedSettingKeys.utmSource], defaults.utmSource),
    utmMedium: normalizeSettingText(values[vkFeedSettingKeys.utmMedium], defaults.utmMedium),
    utmCampaign: normalizeSettingText(values[vkFeedSettingKeys.utmCampaign], defaults.utmCampaign),
    onlyInStock: normalizeBooleanSetting(values[vkFeedSettingKeys.onlyInStock], defaults.onlyInStock),
    includeOutOfStockAsUnavailable: normalizeBooleanSetting(
      values[vkFeedSettingKeys.includeOutOfStockAsUnavailable],
      defaults.includeOutOfStockAsUnavailable
    ),
    maxItems: normalizeNullableNumberSetting(values[vkFeedSettingKeys.maxItems], defaults.maxItems),
    publicUrl: `${DEFAULT_SITE_URL}${VK_XML_PUBLIC_PATH}`,
    publicPath: VK_XML_PUBLIC_PATH,
    baseUrl: shopUrl,
  };
}

export async function saveYandexYmlFeedSettings(input: YandexYmlFeedSettingsInput) {
  const payload = yandexYmlFeedSettingsInputSchema.parse(input);

  await setAppSetting(yandexYmlFeedSettingKeys.enabled, payload.enabled ? "true" : "false");
  await setAppSetting(yandexYmlFeedSettingKeys.feedName, payload.feedName);
  await setAppSetting(yandexYmlFeedSettingKeys.companyName, payload.companyName);
  await setAppSetting(yandexYmlFeedSettingKeys.shopUrl, payload.shopUrl);
  await setAppSetting(yandexYmlFeedSettingKeys.currencyId, payload.currencyId);
  await setAppSetting(
    yandexYmlFeedSettingKeys.includeOutOfStock,
    payload.includeOutOfStock ? "true" : "false"
  );
  await setAppSetting(yandexYmlFeedSettingKeys.pickup, payload.pickup ? "true" : "false");
  await setAppSetting(yandexYmlFeedSettingKeys.delivery, payload.delivery ? "true" : "false");
  await setAppSetting(yandexYmlFeedSettingKeys.salesNotes, payload.salesNotes || "");
  invalidateFeedCache("yandex");

  return { success: true };
}

export async function saveVkFeedSettings(input: VkFeedSettingsInput) {
  const payload = vkFeedSettingsInputSchema.parse(input);

  await setAppSetting(vkFeedSettingKeys.enabled, payload.enabled ? "true" : "false");
  await setAppSetting(vkFeedSettingKeys.feedName, payload.feedName);
  await setAppSetting(vkFeedSettingKeys.companyName, payload.companyName);
  await setAppSetting(vkFeedSettingKeys.shopUrl, payload.shopUrl);
  await setAppSetting(vkFeedSettingKeys.utmEnabled, payload.utmEnabled ? "true" : "false");
  await setAppSetting(vkFeedSettingKeys.utmSource, payload.utmSource);
  await setAppSetting(vkFeedSettingKeys.utmMedium, payload.utmMedium);
  await setAppSetting(vkFeedSettingKeys.utmCampaign, payload.utmCampaign);
  await setAppSetting(vkFeedSettingKeys.onlyInStock, payload.onlyInStock ? "true" : "false");
  await setAppSetting(
    vkFeedSettingKeys.includeOutOfStockAsUnavailable,
    payload.includeOutOfStockAsUnavailable ? "true" : "false"
  );
  await setAppSetting(vkFeedSettingKeys.maxItems, payload.maxItems ? String(payload.maxItems) : "");
  invalidateFeedCache("vk");

  return { success: true };
}

export async function getFeedCatalogOverview() {
  const [yandexSettings, vkSettings, yandexPreview, vkPreview] = await Promise.all([
    getYandexYmlFeedSettings(),
    getVkFeedSettings(),
    buildYandexYmlFeed({ ignoreEnabled: true, previewOnly: true, skipCache: true }),
    buildVkFeed({ ignoreEnabled: true, previewOnly: true, skipCache: true }),
  ]);

  return [
    {
      key: "yandex_yml",
      title: "Yandex YML",
      description:
        "YML-фид для загрузки товарного каталога в Яндекс Бизнес / Приоритетное размещение.",
      enabled: yandexSettings.enabled,
      publicUrl: yandexSettings.publicUrl,
      publicPath: yandexSettings.publicPath,
      offersCount: yandexPreview.stats.totalOffers,
      warningsCount: yandexPreview.stats.warnings.length,
      mode: "xml",
    },
    {
      key: "vk_xml",
      title: "VK XML",
      description:
        "Отдельный канал выгрузки товаров для VK Рекламы и каталога VK со своими UTM и фильтрами.",
      enabled: vkSettings.enabled,
      publicUrl: vkSettings.publicUrl,
      publicPath: vkSettings.publicPath,
      offersCount: vkPreview.stats.totalOffers,
      warningsCount: vkPreview.stats.warnings.length,
      mode: "xml",
    },
  ];
}

export async function buildYandexYmlFeed(
  options?: FeedBuildOptions
): Promise<FeedBuildResult<YandexYmlFeedSettings>> {
  const cacheKey = getFeedCacheKey("yandex", options?.previewOnly);
  if (!options?.skipCache) {
    const cached = readFeedCache<FeedBuildResult<YandexYmlFeedSettings>>(cacheKey);
    if (cached) return cached;
  }

  const settings = await getYandexYmlFeedSettings();
  if (!options?.ignoreEnabled && !settings.enabled) {
    throw new Error("Yandex YML feed disabled");
  }

  const source = await loadFeedSourceData();
  const collected = collectFeedOffers(source, {
    siteUrl: settings.shopUrl,
    currencyId: settings.currencyId,
    includeOutOfStock: settings.includeOutOfStock,
    pictureMode: "single",
    maxPictures: 1,
    pickup: settings.pickup,
    delivery: settings.delivery,
    salesNotes: settings.salesNotes || null,
  });

  const categoryRowsXml = buildCategoryXmlRows(source.categoryRows, collected.includedCategoryIds);
  const rendered = renderYandexXml(settings, categoryRowsXml, collected.offers);

  const result = {
    xml: rendered.xml,
    stats: collected.stats,
    generatedAt: rendered.generatedAt,
    settings,
    preview: buildFeedPreview(rendered.xml, options?.previewOnly),
  };

  if (!options?.skipCache) {
    writeFeedCache(cacheKey, result);
  }
  return result;
}

export async function validateYandexYmlFeed() {
  const result = await buildYandexYmlFeed({
    ignoreEnabled: true,
    previewOnly: true,
    skipCache: true,
  });

  const source = await loadFeedSourceData();
  const collected = collectFeedOffers(source, {
    siteUrl: result.settings.shopUrl,
    currencyId: result.settings.currencyId,
    includeOutOfStock: result.settings.includeOutOfStock,
    pictureMode: "single",
    maxPictures: 1,
    pickup: result.settings.pickup,
    delivery: result.settings.delivery,
    salesNotes: result.settings.salesNotes || null,
  });

  const pictureProbe = await probeFeedPictures(
    collected.offers.flatMap(offer => offer.pictures),
    12
  );

  const checklist = [
    result.stats.totalOffers > 0
      ? `Офферы есть: ${result.stats.totalOffers}`
      : "Офферы отсутствуют — проверьте видимость товаров и настройки выгрузки",
    result.stats.skippedWithoutPrice === 0
      ? "Нет пропусков по нулевой цене"
      : `Есть пропуски по цене: ${result.stats.skippedWithoutPrice}`,
    result.stats.skippedWithoutPicture === 0
      ? "Нет пропусков по изображениям"
      : `Есть пропуски по изображениям: ${result.stats.skippedWithoutPicture}`,
    result.stats.skippedWithoutCategory === 0
      ? "Нет пропусков по категориям"
      : `Есть пропуски по категориям: ${result.stats.skippedWithoutCategory}`,
    result.stats.vendorCodeMissingCount === 0
      ? "Все офферы имеют vendorCode"
      : `Без vendorCode: ${result.stats.vendorCodeMissingCount}`,
    result.stats.descriptionMissingCount === 0
      ? "Все офферы имеют description"
      : `С пустым description: ${result.stats.descriptionMissingCount}`,
    pictureProbe.pictureProbeFailed === 0
      ? `Проверенные картинки доступны (${pictureProbe.pictureProbeChecked}/${pictureProbe.pictureProbeChecked})`
      : `Есть битые картинки в выборке: ${pictureProbe.pictureProbeFailed}/${pictureProbe.pictureProbeChecked}`,
  ];

  return {
    enabled: result.settings.enabled,
    publicUrl: result.settings.publicUrl,
    stats: result.stats,
    generatedAt: result.generatedAt,
    preview: result.preview,
    validation: {
      pictureProbeChecked: pictureProbe.pictureProbeChecked,
      pictureProbeFailed: pictureProbe.pictureProbeFailed,
      brokenPictureSamples: pictureProbe.brokenPictureSamples,
      checklist,
    } satisfies FeedValidationDiagnostics,
  };
}

export async function buildVkFeed(
  options?: FeedBuildOptions
): Promise<FeedBuildResult<VkFeedSettings>> {
  const cacheKey = getFeedCacheKey("vk", options?.previewOnly);
  if (!options?.skipCache) {
    const cached = readFeedCache<FeedBuildResult<VkFeedSettings>>(cacheKey);
    if (cached) return cached;
  }

  const settings = await getVkFeedSettings();
  if (!options?.ignoreEnabled && !settings.enabled) {
    throw new Error("VK feed disabled");
  }

  const source = await loadFeedSourceData();
  const collected = collectFeedOffers(source, {
    siteUrl: settings.shopUrl,
    currencyId: "RUB",
    includeOutOfStock: settings.onlyInStock
      ? false
      : settings.includeOutOfStockAsUnavailable,
    pictureMode: "multiple",
    maxPictures: 8,
    pickup: true,
    delivery: true,
    utm: {
      enabled: settings.utmEnabled,
      source: settings.utmSource,
      medium: settings.utmMedium,
      campaign: settings.utmCampaign,
    },
    maxItems: settings.maxItems,
  });

  if (settings.onlyInStock) {
    collected.stats.warnings = collected.stats.warnings.filter(
      warning => !warning.includes("без наличия")
    );
  }
  if (collected.stats.totalOffers < 6) {
    collected.stats.warnings.push(
      "Активных офферов меньше 6. Для VK это может быть слишком маленький каталог."
    );
  }

  const categoryRowsXml = buildCategoryXmlRows(source.categoryRows, collected.includedCategoryIds);
  const rendered = renderVkXml(settings, categoryRowsXml, collected.offers);

  const result = {
    xml: rendered.xml,
    stats: collected.stats,
    generatedAt: rendered.generatedAt,
    settings,
    preview: buildFeedPreview(rendered.xml, options?.previewOnly),
  };

  if (!options?.skipCache) {
    writeFeedCache(cacheKey, result);
  }
  return result;
}

export async function validateVkFeed() {
  const result = await buildVkFeed({
    ignoreEnabled: true,
    previewOnly: true,
    skipCache: true,
  });
  return {
    enabled: result.settings.enabled,
    publicUrl: result.settings.publicUrl,
    stats: result.stats,
    generatedAt: result.generatedAt,
    preview: result.preview,
  };
}
