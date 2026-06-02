import { z } from "zod";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
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
export const YANDEX_YML_PUBLIC_PATH = "/feeds/yandex-business.yml";

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

const allYandexYmlFeedSettingKeys = Object.values(yandexYmlFeedSettingKeys);

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

export type YandexYmlFeedSettingsInput = z.infer<
  typeof yandexYmlFeedSettingsInputSchema
>;

type YandexYmlFeedSettings = YandexYmlFeedSettingsInput & {
  publicUrl: string;
  publicPath: string;
};

type FeedStats = {
  productOffers: number;
  variantOffers: number;
  totalOffers: number;
  skippedOutOfStock: number;
  skippedWithoutPrice: number;
  categoriesIncluded: number;
  warnings: string[];
  productsSource: number;
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

function normalizeSettingText(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeBooleanSetting(value: string | null | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  return value.trim().toLowerCase() === "true";
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

function sanitizeDescription(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
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
  };
}

export async function getYandexYmlFeedSettings(): Promise<YandexYmlFeedSettings> {
  const defaults = await buildDefaultYandexYmlSettings();
  const values = await getAppSettings([...allYandexYmlFeedSettingKeys]);

  return {
    enabled: normalizeBooleanSetting(
      values[yandexYmlFeedSettingKeys.enabled],
      defaults.enabled
    ),
    feedName: normalizeSettingText(
      values[yandexYmlFeedSettingKeys.feedName],
      defaults.feedName
    ),
    companyName: normalizeSettingText(
      values[yandexYmlFeedSettingKeys.companyName],
      defaults.companyName
    ),
    shopUrl: normalizeSettingText(
      values[yandexYmlFeedSettingKeys.shopUrl],
      defaults.shopUrl
    ).replace(/\/+$/, ""),
    currencyId:
      values[yandexYmlFeedSettingKeys.currencyId]?.trim() === "RUB" ? "RUB" : "RUR",
    includeOutOfStock: normalizeBooleanSetting(
      values[yandexYmlFeedSettingKeys.includeOutOfStock],
      defaults.includeOutOfStock
    ),
    pickup: normalizeBooleanSetting(
      values[yandexYmlFeedSettingKeys.pickup],
      defaults.pickup
    ),
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
  };
}

export async function saveYandexYmlFeedSettings(
  input: YandexYmlFeedSettingsInput
) {
  const payload = yandexYmlFeedSettingsInputSchema.parse(input);

  await setAppSetting(
    yandexYmlFeedSettingKeys.enabled,
    payload.enabled ? "true" : "false"
  );
  await setAppSetting(yandexYmlFeedSettingKeys.feedName, payload.feedName);
  await setAppSetting(
    yandexYmlFeedSettingKeys.companyName,
    payload.companyName
  );
  await setAppSetting(yandexYmlFeedSettingKeys.shopUrl, payload.shopUrl);
  await setAppSetting(yandexYmlFeedSettingKeys.currencyId, payload.currencyId);
  await setAppSetting(
    yandexYmlFeedSettingKeys.includeOutOfStock,
    payload.includeOutOfStock ? "true" : "false"
  );
  await setAppSetting(
    yandexYmlFeedSettingKeys.pickup,
    payload.pickup ? "true" : "false"
  );
  await setAppSetting(
    yandexYmlFeedSettingKeys.delivery,
    payload.delivery ? "true" : "false"
  );
  await setAppSetting(
    yandexYmlFeedSettingKeys.salesNotes,
    payload.salesNotes || ""
  );

  return { success: true };
}

export async function getFeedCatalogOverview() {
  const settings = await getYandexYmlFeedSettings();
  const preview = await buildYandexYmlFeed({ ignoreEnabled: true, previewOnly: true });

  return [
    {
      key: "yandex_yml",
      title: "Yandex YML",
      description:
        "YML-фид для загрузки товарного каталога в Яндекс Бизнес / Приоритетное размещение.",
      enabled: settings.enabled,
      publicUrl: settings.publicUrl,
      publicPath: settings.publicPath,
      offersCount: preview.stats.totalOffers,
      warningsCount: preview.stats.warnings.length,
      mode: "xml",
    },
  ];
}

export async function buildYandexYmlFeed(options?: {
  ignoreEnabled?: boolean;
  previewOnly?: boolean;
}) {
  const settings = await getYandexYmlFeedSettings();

  if (!options?.ignoreEnabled && !settings.enabled) {
    throw new Error("Yandex YML feed disabled");
  }

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

  const variantsByProductId = new Map<number, typeof variantRows>();
  for (const variant of variantRows) {
    const bucket = variantsByProductId.get(variant.productId) ?? [];
    bucket.push(variant);
    variantsByProductId.set(variant.productId, bucket);
  }

  const offers: FeedOffer[] = [];
  const stats: FeedStats = {
    productOffers: 0,
    variantOffers: 0,
    totalOffers: 0,
    skippedOutOfStock: 0,
    skippedWithoutPrice: 0,
    categoriesIncluded: 0,
    warnings: [],
    productsSource: productRows.length,
  };

  let vendorMissingCount = 0;
  let picturesMissingCount = 0;

  const resolveVendor = (productName: string, specs: unknown) => {
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

  const buildOffer = (args: {
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
    const pictures = normalizeImageCollection(
      args.image,
      args.imageVariants,
      args.images
    )
      .map(imageUrl => resolveAbsoluteUrl(imageUrl, settings.shopUrl))
      .slice(0, 1);

    if (pictures.length === 0) {
      picturesMissingCount += 1;
    }
    if (!args.vendor || args.vendor === "Без бренда") {
      vendorMissingCount += 1;
    }

    return {
      id: args.id,
      url: args.url,
      price: args.price,
      oldPrice: args.oldPrice,
      currencyId: settings.currencyId,
      categoryId: args.categoryId,
      pictures,
      vendor: args.vendor || "Без бренда",
      name: args.name,
      description: args.description,
      vendorCode: args.vendorCode,
      barcode: args.barcode,
      available: args.available,
      pickup: settings.pickup,
      delivery: settings.delivery,
      salesNotes: settings.salesNotes || null,
      params: args.params.slice(0, 12),
    } satisfies FeedOffer;
  };

  for (const product of productRows) {
    const categoryId = Number(product.categoryId);
    const productPrice = Number(product.price ?? 0);
    const productOldPrice = product.oldPrice ? Number(product.oldPrice) : null;
    const availableQty = Number(product.availableQty ?? 0);
    const productAvailable = availableQty > 0;
    const vendor = resolveVendor(product.name, product.specs);
    const baseDescription = sanitizeDescription(product.description);
    const specParams = normalizeProductSpecs(product.specs);
    const variants = (variantsByProductId.get(product.id) ?? []).filter(
      variant => variant.isActive
    );
    const activeVariants = variants.filter(variant => Number(variant.price ?? 0) > 0);

    if (activeVariants.length > 0) {
      for (const variant of activeVariants) {
        const variantPrice = Number(variant.price ?? 0);
        const variantAvailable = Number(variant.stock ?? 0) > 0;

        if (variantPrice <= 0) {
          stats.skippedWithoutPrice += 1;
          continue;
        }
        if (!settings.includeOutOfStock && !variantAvailable) {
          stats.skippedOutOfStock += 1;
          continue;
        }

        const variantAttributes = normalizeVariantAttributes(variant.attributesJson);
        const variantTitle =
          variant.name?.trim() && variant.name.trim() !== product.name.trim()
            ? `${product.name} — ${variant.name.trim()}`
            : product.name;

        offers.push(
          buildOffer({
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
            description: baseDescription,
            categoryId,
            vendor,
            params: [...variantAttributes, ...specParams],
            url: `${settings.shopUrl}/product/${encodeURIComponent(product.slug)}?variant=${variant.id}`,
          })
        );
        stats.variantOffers += 1;
      }
      continue;
    }

    if (productPrice <= 0) {
      stats.skippedWithoutPrice += 1;
      continue;
    }
    if (!settings.includeOutOfStock && !productAvailable) {
      stats.skippedOutOfStock += 1;
      continue;
    }

    offers.push(
      buildOffer({
        id: `product-${product.id}`,
        name: product.name,
        price: productPrice,
        oldPrice: productOldPrice && productOldPrice > productPrice ? productOldPrice : null,
        available: productAvailable,
        vendorCode:
          product.article?.trim() ||
          product.externalCode?.trim() ||
          product.barcode?.trim() ||
          null,
        barcode: product.barcode?.trim() || null,
        image: product.image,
        imageVariants: product.imageVariants,
        images: product.images,
        description: baseDescription,
        categoryId,
        vendor,
        params: specParams,
        url: `${settings.shopUrl}/product/${encodeURIComponent(product.slug)}`,
      })
    );
    stats.productOffers += 1;
  }

  stats.totalOffers = offers.length;

  const includedCategoryIds = new Set<number>(offers.map(offer => offer.categoryId));

  const categoriesXml = categoryRows
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

  stats.categoriesIncluded = includedCategoryIds.size;

  if (vendorMissingCount > 0) {
    stats.warnings.push(
      `У ${vendorMissingCount} офферов бренд не удалось определить точно, используется значение «Без бренда».`
    );
  }
  if (picturesMissingCount > 0) {
    stats.warnings.push(
      `У ${picturesMissingCount} офферов нет изображения. Проверьте карточки товаров перед загрузкой фида в Яндекс.`
    );
  }
  if (stats.skippedWithoutPrice > 0) {
    stats.warnings.push(
      `${stats.skippedWithoutPrice} позиций пропущено из-за нулевой или отсутствующей цены.`
    );
  }
  if (!settings.includeOutOfStock && stats.skippedOutOfStock > 0) {
    stats.warnings.push(
      `${stats.skippedOutOfStock} позиций не попали в фид, потому что выключен экспорт товаров без наличия.`
    );
  }

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
        offer.vendorCode
          ? `      <vendorCode>${xmlEscape(offer.vendorCode)}</vendorCode>`
          : null,
        offer.barcode ? `      <barcode>${xmlEscape(offer.barcode)}</barcode>` : null,
        `      <pickup>${offer.pickup ? "true" : "false"}</pickup>`,
        `      <delivery>${offer.delivery ? "true" : "false"}</delivery>`,
        offer.salesNotes
          ? `      <sales_notes>${xmlEscape(offer.salesNotes)}</sales_notes>`
          : null,
        offer.description ? `      <description>${cdata(offer.description)}</description>` : null,
        paramsXml || null,
        `    </offer>`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const generatedAt = new Date();
  const feedDate = generatedAt.toISOString().slice(0, 19).replace("T", " ");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${feedDate}">
  <shop>
    <name>${xmlEscape(settings.feedName)}</name>
    <company>${xmlEscape(settings.companyName)}</company>
    <url>${xmlEscape(settings.shopUrl)}</url>
    <currencies>
      <currency id="${settings.currencyId}" rate="1"/>
    </currencies>
    <categories>
${categoriesXml}
    </categories>
    <offers>
${offersXml}
    </offers>
  </shop>
</yml_catalog>`;

  const previewLines = xml.split("\n").slice(0, options?.previewOnly ? 90 : 120);

  return {
    xml,
    stats,
    generatedAt: generatedAt.toISOString(),
    settings,
    preview: previewLines.join("\n"),
  };
}
