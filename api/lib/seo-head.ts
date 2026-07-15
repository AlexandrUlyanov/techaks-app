import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import * as schema from "@db/schema";
import { normalizeProductImageVariantSet } from "@contracts/product-images";
import { buildSeoBreadcrumbStructuredData } from "@contracts/seo-breadcrumbs";
import {
  buildBrandSeoCopy,
  buildCategorySeoCopy,
  buildProductSeoCopy,
  buildRootCatalogSeoCopy,
  toSeoReadableName,
} from "@contracts/seo-copy";
import { resolveCatalogIndexationPolicy } from "@contracts/listing-indexation";
import {
  buildBrandCatalogUrl,
  buildCatalogCategoryUrl,
  buildLocalLandingUrl,
  getLocalSeoLandingBySlug,
} from "@contracts/local-seo-landings";
import {
  getKnowledgeCenterPlanForPost,
  getKnowledgeFaqForPost,
  knowledgeCenterArticlePlan,
  knowledgeCenterClusters,
} from "@contracts/blog-knowledge-center";

import { getDb } from "../queries/connection";
import {
  resolveFilterListing,
} from "./listing-pages";
import { buildPublicProductVisibilityCondition } from "./product-visibility";
import { getPublicSiteProfile } from "./site-profile-settings";
import { getManufacturerNameFromProductSpecs } from "./manufacturers";
import {
  normalizeSpecKeyForDisplay,
  normalizeSpecToken,
} from "./product-normalization";

const SEO_HOST = "https://techaks.ru";
const SITE_NAME = "ТЕХАКС";
const DEFAULT_TITLE = "ТЕХАКС — техника и аксессуары в Пензе";
const DEFAULT_DESCRIPTION =
  "Техника и аксессуары: смартфоны, наушники, зарядные устройства, кабели, чехлы и гаджеты. Актуальные цены, наличие и доставка.";
const DEFAULT_IMAGE = `${SEO_HOST}/images/og-default.svg`;
const publicProductVisibilityCondition = buildPublicProductVisibilityCondition();

type SeoHeadData = {
  title: string;
  description: string;
  canonicalUrl: string;
  noindex?: boolean;
  image?: string | null;
  type?: "website" | "article";
  structuredData?: unknown[] | null;
  bodyHtml?: string | null;
};

type BreadcrumbItem = {
  name: string;
  url: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toAbsoluteUrl(value?: string | null) {
  if (!value) return DEFAULT_IMAGE;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${SEO_HOST}${value.startsWith("/") ? value : `/${value}`}`;
}

function normalizeDescription(value: string | null | undefined, fallback: string) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.slice(0, 320);
}

function stripHtml(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isInternalProductSpecKey(key: string) {
  const normalizedDisplayKey = normalizeSpecKeyForDisplay(String(key));
  const normalizedToken = normalizeSpecToken(normalizedDisplayKey);
  return /^kpi(?:\s|$|\d|_)/i.test(normalizedToken);
}

function truncateText(value: string | null | undefined, limit = 320) {
  const normalized = stripHtml(value);
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function guessAddressLocality(address?: string | null) {
  const normalized = address?.toLowerCase() ?? "";
  if (normalized.includes("пенз")) return "Пенза";
  if (normalized.includes("зареч")) return "Заречный";
  return undefined;
}

function buildBreadcrumbStructuredData(items: BreadcrumbItem[]) {
  return buildSeoBreadcrumbStructuredData(items, { siteOrigin: SEO_HOST });
}

function buildWebsiteStructuredData(input?: {
  name?: string;
  url?: string;
  searchPathTemplate?: string;
}) {
  const siteUrl = input?.url || SEO_HOST;
  const searchPathTemplate = input?.searchPathTemplate || "/search?q={search_term_string}";

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input?.name || SITE_NAME,
    url: siteUrl,
    inLanguage: "ru-RU",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}${searchPathTemplate}`,
      "query-input": "required name=search_term_string",
    },
  };
}

function buildItemListStructuredData(input: {
  name: string;
  url: string;
  items: Array<{ name: string; url: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    url: input.url,
    itemListElement: input.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

function buildFaqStructuredData(
  questions: Array<{ question: string; answer: string }>
) {
  const normalizedQuestions = questions
    .map(item => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter(item => item.question.length > 0 && item.answer.length > 0);

  if (normalizedQuestions.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: normalizedQuestions.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function buildOrganizationStructuredData(input: {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SEO_HOST,
    logo: `${SEO_HOST}/images/logo-light.svg`,
    email: input.email || undefined,
    telephone: input.phone || undefined,
    contactPoint:
      input.email || input.phone
        ? {
            "@type": "ContactPoint",
            contactType: "customer support",
            telephone: input.phone || undefined,
            email: input.email || undefined,
            availableLanguage: ["ru"],
            areaServed: ["RU", "Пенза"],
          }
        : undefined,
    areaServed: ["RU", "Пенза"],
    address: input.address
      ? {
          "@type": "PostalAddress",
          streetAddress: input.address,
          addressLocality: guessAddressLocality(input.address),
          addressCountry: "RU",
        }
      : undefined,
  };
}

function buildStoreStructuredData(store: typeof schema.stores.$inferSelect) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    url: `${SEO_HOST}/stores`,
    image: toAbsoluteUrl(store.image),
    telephone: store.phone || undefined,
    address: store.address
      ? {
          "@type": "PostalAddress",
          streetAddress: store.address,
          addressLocality: guessAddressLocality(store.address),
          addressCountry: "RU",
        }
      : undefined,
    openingHours: store.hours || undefined,
    areaServed: ["RU", "Пенза"],
  };
}

function collectProductImageUrls(
  primaryImage?: string | null,
  primaryImageVariants?: unknown,
  images?: unknown
) {
  const urls = new Set<string>();

  const pushUrl = (value?: string | null) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) return;
    urls.add(toAbsoluteUrl(normalized));
  };

  const addVariantSet = (value: unknown, fallbackOriginal?: string | null) => {
    const parsed = normalizeProductImageVariantSet(value, fallbackOriginal);
    if (!parsed) return;
    pushUrl(parsed.original);
    pushUrl(parsed.medium);
    pushUrl(parsed.card);
    pushUrl(parsed.thumb);
  };

  addVariantSet(primaryImageVariants, primaryImage);
  pushUrl(primaryImage);

  if (Array.isArray(images)) {
    for (const item of images) {
      if (typeof item === "string") {
        pushUrl(item);
        continue;
      }
      addVariantSet(item, primaryImage);
    }
  }

  if (urls.size === 0) {
    pushUrl(DEFAULT_IMAGE);
  }

  return Array.from(urls);
}

function buildBasePageData(
  path: string,
  overrides: Partial<SeoHeadData> = {}
): SeoHeadData {
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalUrl: `${SEO_HOST}${path}`,
    image: DEFAULT_IMAGE,
    type: "website",
    noindex: false,
    structuredData: null,
    bodyHtml: null,
    ...overrides,
  };
}

function renderSeoBodyStyles() {
  return `<style id="__seo-body-style">
    [data-seo-body] {
      max-width: 1120px;
      margin: 0 auto;
      padding: 40px 20px 56px;
      font-family: Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
    }
    [data-seo-body] a {
      color: #0891b2;
      text-decoration: none;
    }
    [data-seo-body] a:hover {
      text-decoration: underline;
    }
    [data-seo-body] nav {
      margin-bottom: 18px;
      font-size: 13px;
      line-height: 1.5;
      color: #64748b;
    }
    [data-seo-body] nav span {
      margin: 0 8px;
      color: #94a3b8;
    }
    [data-seo-body] .seo-eyebrow {
      margin-bottom: 14px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #0891b2;
    }
    [data-seo-body] h1 {
      margin: 0;
      font-size: clamp(32px, 5vw, 54px);
      line-height: 0.98;
      letter-spacing: -0.04em;
      color: #0f172a;
    }
    [data-seo-body] .seo-lead {
      max-width: 860px;
      margin-top: 18px;
      font-size: 18px;
      line-height: 1.7;
      color: #334155;
    }
    [data-seo-body] .seo-grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      margin-top: 28px;
    }
    [data-seo-body] .seo-card {
      padding: 20px 22px;
      border-radius: 24px;
      background: #f8fafc;
    }
    [data-seo-body] .seo-card h2,
    [data-seo-body] .seo-card h3 {
      margin: 0 0 10px;
      font-size: 18px;
      line-height: 1.35;
      color: #0f172a;
    }
    [data-seo-body] .seo-card p,
    [data-seo-body] .seo-card li {
      margin: 0;
      font-size: 15px;
      line-height: 1.7;
      color: #475569;
    }
    [data-seo-body] .seo-card ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
    }
    [data-seo-body] .seo-facts {
      display: grid;
      gap: 10px;
      margin-top: 28px;
    }
    [data-seo-body] .seo-fact {
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(140px, 220px) minmax(0, 1fr);
      padding: 12px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
      font-size: 15px;
      line-height: 1.6;
    }
    [data-seo-body] .seo-fact strong {
      color: #64748b;
      font-weight: 700;
    }
    [data-seo-body] .seo-inline-links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }
    [data-seo-body] .seo-pill {
      display: inline-flex;
      align-items: center;
      min-height: 42px;
      padding: 0 16px;
      border-radius: 999px;
      background: #eef9fb;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    [data-seo-body] .seo-section {
      margin-top: 34px;
    }
    [data-seo-body] .seo-section h2 {
      margin: 0 0 12px;
      font-size: 22px;
      line-height: 1.2;
      color: #0f172a;
    }
    [data-seo-body] .seo-section p {
      margin: 0;
      font-size: 15px;
      line-height: 1.75;
      color: #475569;
    }
    @media (max-width: 720px) {
      [data-seo-body] {
        padding: 24px 16px 40px;
      }
      [data-seo-body] .seo-lead {
        font-size: 16px;
      }
      [data-seo-body] .seo-fact {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }
  </style>`;
}

function renderBreadcrumbs(items: BreadcrumbItem[]) {
  if (items.length === 0) return "";
  return `<nav aria-label="breadcrumb">${items
    .map((item, index) => {
      const link = `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>`;
      return index === 0 ? link : `<span>/</span>${link}`;
    })
    .join("")}</nav>`;
}

function renderInlineLinks(
  items: Array<{
    href: string;
    label: string;
  }>
) {
  if (items.length === 0) return "";
  return `<div class="seo-inline-links">${items
    .map(
      item =>
        `<a class="seo-pill" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
    )
    .join("")}</div>`;
}

function renderFacts(
  items: Array<{
    label: string;
    value: string;
  }>
) {
  const rows = items.filter(item => item.value.trim().length > 0);
  if (rows.length === 0) return "";
  return `<div class="seo-facts">${rows
    .map(
      item =>
        `<div class="seo-fact"><strong>${escapeHtml(item.label)}</strong><div>${escapeHtml(
          item.value
        )}</div></div>`
    )
    .join("")}</div>`;
}

function renderCardList(
  items: Array<{
    title: string;
    text?: string;
    links?: Array<{ href: string; label: string }>;
  }>
) {
  const rows = items.filter(
    item => item.title.trim().length > 0 && ((item.text && item.text.trim()) || item.links?.length)
  );
  if (rows.length === 0) return "";
  return `<div class="seo-grid">${rows
    .map(item => {
      const text = item.text?.trim()
        ? `<p>${escapeHtml(item.text.trim())}</p>`
        : "";
      const links = item.links?.length
        ? `<ul>${item.links
            .map(
              link =>
                `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`
            )
            .join("")}</ul>`
        : "";
      return `<section class="seo-card"><h3>${escapeHtml(item.title)}</h3>${text}${links}</section>`;
    })
    .join("")}</div>`;
}

function renderFaqSection(
  title: string,
  items: Array<{
    question: string;
    answer: string;
  }>
) {
  const rows = items.filter(
    item => item.question.trim().length > 0 && item.answer.trim().length > 0
  );
  if (rows.length === 0) return "";

  return `
    <section class="seo-section">
      <h2>${escapeHtml(title)}</h2>
      ${renderCardList(
        rows.map(item => ({
          title: item.question,
          text: item.answer,
        }))
      )}
    </section>
  `;
}

function buildCategoryFaqItems(input: {
  categoryName: string;
  hasChildren: boolean;
  topBrands?: string[];
}) {
  const brandLine =
    input.topBrands && input.topBrands.length > 0
      ? `В разделе часто представлены бренды ${input.topBrands.slice(0, 3).join(", ")}.`
      : "В разделе собраны товары с актуальными ценами и наличием.";

  return [
    {
      question: `Что можно найти в категории «${input.categoryName}»?`,
      answer: input.hasChildren
        ? `В категории «${input.categoryName}» собраны подкатегории и быстрые переходы к нужным товарам. ${brandLine}`
        : `В категории «${input.categoryName}» доступны товары с актуальными ценами, наличием по магазинам ТЕХАКС и вариантами получения заказа. ${brandLine}`,
    },
    {
      question: `Можно ли забрать товары из раздела «${input.categoryName}» самовывозом?`,
      answer:
        "Да, если товар есть в наличии в нужном магазине. Точка самовывоза и доступность подтверждаются в карточке товара и на этапе оформления заказа.",
    },
    {
      question: `Как выбрать товары в разделе «${input.categoryName}»?`,
      answer: input.hasChildren
        ? "Сначала откройте нужную подкатегорию, затем сравните модели по цене, совместимости, характеристикам и наличию."
        : "Сравнивайте модели по характеристикам, совместимости, цене и наличию. Для точного выбора полезно смотреть карточку товара и условия получения.",
    },
    {
      question: `Доступна ли доставка по категории «${input.categoryName}»?`,
      answer:
        "Да, для части товаров доступна доставка по Пензе и России. Итоговые варианты зависят от конкретного товара, адреса и способа получения.",
    },
  ];
}

function buildBrandFaqItems(input: {
  brandName: string;
  topCategoryNames?: string[];
}) {
  const categoriesLine =
    input.topCategoryNames && input.topCategoryNames.length > 0
      ? `Чаще всего бренд представлен в разделах: ${input.topCategoryNames.slice(0, 4).join(", ")}.`
      : "Ассортимент бренда зависит от текущей поставки и видимых позиций в каталоге.";

  return [
    {
      question: `Какие товары бренда ${input.brandName} есть в ТЕХАКС?`,
      answer: `На странице бренда ${input.brandName} собраны актуальные товары с ценами, наличием и быстрым переходом в карточки. ${categoriesLine}`,
    },
    {
      question: `Можно ли купить товары ${input.brandName} с самовывозом?`,
      answer:
        "Да, если конкретный товар есть в магазине. Наличие по точкам самовывоза отображается в карточке товара и подтверждается при заказе.",
    },
    {
      question: `Как выбрать товар бренда ${input.brandName}?`,
      answer:
        "Сравните модели по назначению, совместимости, характеристикам, цене и наличию. Для аксессуаров особенно важно проверить совместимость с вашим устройством.",
    },
    {
      question: `Есть ли доставка для товаров ${input.brandName}?`,
      answer:
        "Да, доступность доставки зависит от конкретного товара и адреса получения. Итоговый вариант определяется на этапе оформления заказа.",
    },
  ];
}

function getSeoSpecValue(
  specs: Record<string, unknown> | null | undefined,
  candidates: string[]
) {
  if (!specs || typeof specs !== "object") return "";
  const entries = Object.entries(specs);

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.trim().toLowerCase();
    const exact = entries.find(([key, value]) => {
      if (String(value ?? "").trim().length === 0) return false;
      return key.trim().toLowerCase() === normalizedCandidate;
    });
    if (exact) return String(exact[1]).trim();
  }

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.trim().toLowerCase();
    const partial = entries.find(([key, value]) => {
      if (String(value ?? "").trim().length === 0) return false;
      return key.trim().toLowerCase().includes(normalizedCandidate);
    });
    if (partial) return String(partial[1]).trim();
  }

  return "";
}

function buildProductFactRows(input: {
  manufacturerName: string;
  product: {
    article?: string | null;
    categoryName?: string | null;
    specs?: unknown;
  };
  inStock: boolean;
  availableStoreCount: number;
}) {
  const specs =
    input.product.specs &&
    typeof input.product.specs === "object" &&
    !Array.isArray(input.product.specs)
      ? (input.product.specs as Record<string, unknown>)
      : null;

  const rows = [
    { label: "Бренд", value: input.manufacturerName || SITE_NAME },
    {
      label: "Тип",
      value: getSeoSpecValue(specs, ["Тип", "Вид", "Назначение"]),
    },
    {
      label: "Модель",
      value: getSeoSpecValue(specs, ["Модель", "Model", "#1"]),
    },
    {
      label: "Цвет",
      value: getSeoSpecValue(specs, ["Цвет", "Расцветка"]),
    },
    {
      label: "Совместимость",
      value: getSeoSpecValue(specs, [
        "Совместимость",
        "Поддержка",
        "Интерфейс",
        "Разъем",
        "Подключение",
      ]),
    },
    {
      label: "Категория",
      value: input.product.categoryName || "",
    },
    {
      label: "Артикул",
      value: input.product.article || "",
    },
    {
      label: "Наличие",
      value: input.inStock
        ? input.availableStoreCount > 0
          ? `Есть в наличии в Пензе (${input.availableStoreCount} ${input.availableStoreCount === 1 ? "магазин" : input.availableStoreCount < 5 ? "магазина" : "магазинов"})`
          : "Есть в наличии"
        : "Нет в наличии",
    },
  ];

  return rows.filter(row => row.value && String(row.value).trim().length > 0);
}

function buildProductFaqItems(input: {
  productName: string;
  manufacturerName: string;
  categoryName?: string | null;
  compatibility?: string;
  inStock: boolean;
  availableStoreCount: number;
}) {
  const readableCategoryName = toSeoReadableName(input.categoryName);
  const availabilitySentence = input.inStock
    ? input.availableStoreCount > 0
      ? `Сейчас товар доступен как минимум в ${input.availableStoreCount} магазинах ТЕХАКС в Пензе, а точное наличие лучше проверить в карточке и при оформлении заказа.`
      : "Сейчас товар доступен для заказа, а наличие по точкам самовывоза уточняется в карточке."
    : "Сейчас товара нет в наличии, но карточка сохранена для сравнения характеристик, цены и совместимости.";
  const compatibilitySentence = input.compatibility
    ? `В характеристиках указана совместимость: ${input.compatibility}.`
    : "Для аксессуаров и совместимых устройств обязательно сверяйте разъёмы, поддерживаемые стандарты и сценарий использования.";

  return [
    {
      question: `Что важно знать о товаре «${input.productName}» перед покупкой?`,
      answer: [
        input.manufacturerName ? `${input.productName} — товар бренда ${input.manufacturerName}.` : "",
        readableCategoryName ? `Раздел каталога: ${readableCategoryName}.` : "",
        compatibilitySentence,
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      question: `Есть ли «${input.productName}» в наличии в Пензе?`,
      answer: availabilitySentence,
    },
    {
      question: `Можно ли забрать «${input.productName}» самовывозом?`,
      answer:
        "Да, если товар есть на нужной точке. На странице товара и в корзине можно проверить магазины, где позиция доступна для самовывоза.",
    },
    {
      question: `Доступна ли доставка для «${input.productName}»?`,
      answer:
        "Да, для части товаров доступна доставка по Пензе и России. Итоговый вариант зависит от адреса, способа получения и текущей доступности товара.",
    },
  ];
}

function collectDescendantCategoryIds(
  rootCategoryId: number,
  categoryRows: Array<typeof schema.categories.$inferSelect>
) {
  const byParent = new Map<number | null, Array<typeof schema.categories.$inferSelect>>();
  for (const row of categoryRows) {
    const bucket = byParent.get(row.parentId ?? null) ?? [];
    bucket.push(row);
    byParent.set(row.parentId ?? null, bucket);
  }

  const result = new Set<number>();
  const queue = [rootCategoryId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || result.has(currentId)) continue;
    result.add(currentId);
    const children = byParent.get(currentId) ?? [];
    for (const child of children) {
      if (!result.has(child.id)) queue.push(child.id);
    }
  }

  return Array.from(result);
}

function renderSeoBodyShell(input: {
  breadcrumbs?: BreadcrumbItem[];
  eyebrow?: string;
  title: string;
  description: string;
  content: string;
}) {
  return `
    <div data-seo-body>
      ${input.breadcrumbs?.length ? renderBreadcrumbs(input.breadcrumbs) : ""}
      ${input.eyebrow ? `<div class="seo-eyebrow">${escapeHtml(input.eyebrow)}</div>` : ""}
      <h1>${escapeHtml(input.title)}</h1>
      <p class="seo-lead">${escapeHtml(input.description)}</p>
      ${input.content}
    </div>
  `;
}

function buildServerSeoHeadTags(meta: SeoHeadData) {
  const robots = meta.noindex ? "noindex, nofollow" : "index, follow";
  const image = toAbsoluteUrl(meta.image);
  const type = meta.type || "website";
  const ldJson = (meta.structuredData ?? [])
    .filter(Boolean)
    .map(
      (item, index) =>
        `<script data-seo-server="structured-data" data-seo-index="${index}" type="application/ld+json">${JSON.stringify(item)}</script>`
    )
    .join("\n");

  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    ldJson,
  ]
    .filter(Boolean)
    .join("\n");
}

function injectSeoHead(html: string, meta: SeoHeadData) {
  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/i, "")
    .replace(/<meta\s+name="robots"[\s\S]*?\/>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[\s\S]*?\/>\s*/i, "")
    .replace(/<meta\s+property="og:[^"]+"[\s\S]*?\/>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]+"[\s\S]*?\/>\s*/gi, "")
    .replace(/<script[^>]*(?:id="__seo-ldjson"|data-seo-server="structured-data")[^>]*>[\s\S]*?<\/script>\s*/gi, "");

  const withHead = cleaned.replace(
    "</head>",
    `${buildServerSeoHeadTags(meta)}\n${renderSeoBodyStyles()}\n</head>`
  );

  if (!meta.bodyHtml?.trim()) return withHead;

  return withHead.replace(
    /<div id="root"><\/div>/i,
    `<div id="root">${meta.bodyHtml}</div>`
  );
}

async function buildHomeSeoData() {
  const db = getDb();
  const [profile, featuredCategories] = await Promise.all([
    getPublicSiteProfile(),
    db
      .select({
        slug: schema.categories.slug,
        name: schema.categories.name,
        description: schema.categories.description,
      })
      .from(schema.categories)
      .where(isNull(schema.categories.parentId))
      .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id))
      .limit(6),
  ]);

  const breadcrumbs = [{ name: "Главная", url: SEO_HOST }];

  const bodyHtml = renderSeoBodyShell({
    breadcrumbs,
    eyebrow: "ТЕХАКС",
    title: "Техника и аксессуары в Пензе",
    description:
      "Интернет-магазин ТЕХАКС помогает быстро выбрать электронику, аксессуары, товары для дома, автомобиля, работы и повседневной жизни.",
    content: [
      renderInlineLinks([
        { href: `${SEO_HOST}/catalog`, label: "Перейти в каталог" },
        { href: `${SEO_HOST}/stores`, label: "Магазины ТЕХАКС" },
        { href: `${SEO_HOST}/contacts`, label: "Контакты и самовывоз" },
      ]),
      renderCardList(
        featuredCategories.map(category => ({
          title: category.name,
          text: truncateText(
            category.description,
            140
          ) || "Подборка товаров и аксессуаров в наличии.",
          links: [
            {
              href: `${SEO_HOST}/catalog?cat=${encodeURIComponent(category.slug)}`,
              label: `Открыть раздел «${category.name}»`,
            },
          ],
        }))
      ),
      `<section class="seo-section"><h2>Почему ТЕХАКС</h2><p>Мы держим в одном месте актуальные цены, наличие по магазинам, условия самовывоза и доставки, чтобы выбирать технику было проще и спокойнее.</p></section>`,
    ].join(""),
  });

  return buildBasePageData("/", {
    title: "ТЕХАКС — интернет-магазин техники и аксессуаров в Пензе",
    description:
      "Техника и аксессуары в Пензе: смартфоны, наушники, зарядные устройства, кабели, чехлы и гаджеты. Актуальные цены, самовывоз в Пензе и доставка по России.",
    canonicalUrl: SEO_HOST,
    structuredData: [
      buildWebsiteStructuredData(),
      buildOrganizationStructuredData({
        email: profile.contacts.email,
        phone: profile.contacts.primaryPhoneDisplay,
        address:
          profile.contacts.shortAddress ||
          profile.contacts.fullAddress ||
          profile.seller.legalAddress,
      }),
      buildBreadcrumbStructuredData(breadcrumbs),
    ],
    bodyHtml,
  });
}

async function buildCatalogSeoData(url: URL) {
  const db = getDb();
  const searchParams = url.searchParams;
  const catalogView = searchParams.get("view") === "brands" ? "brands" : "categories";
  const activeCategory = searchParams.get("cat") || "all";
  const activeBrand = searchParams.get("brand") || "";
  const activeFilters = searchParams
    .getAll("filter")
    .map(value => {
      const [filterKey, filterValue] = value.split(":");
      return filterKey && filterValue ? { filterKey, filterValue } : null;
    })
    .filter(Boolean) as { filterKey: string; filterValue: string }[];
  const singleFilter = activeFilters.length === 1 ? activeFilters[0] : null;
  const hasFilters = activeFilters.length > 0;
  const hasLayout = (searchParams.get("layout") || "grid") !== "grid";
  const hasSort = (searchParams.get("sort") || "default") !== "default";
  const forceProductsView = searchParams.get("show") === "products";
  const rootCatalogSeo = buildRootCatalogSeoCopy();

  if (catalogView === "brands") {
    if (!activeBrand) {
      const manufacturers = await db
        .select({
          slug: schema.manufacturers.slug,
          name: schema.manufacturers.name,
          description: schema.manufacturers.description,
        })
        .from(schema.manufacturers)
        .where(eq(schema.manufacturers.isVisible, true))
        .orderBy(desc(schema.manufacturers.productCount), asc(schema.manufacturers.name))
        .limit(12);

      const breadcrumbs = [
        { name: "Главная", url: SEO_HOST },
        { name: "Каталог", url: `${SEO_HOST}/catalog` },
        { name: "Производители", url: `${SEO_HOST}/catalog?view=brands` },
      ];

      return buildBasePageData("/catalog?view=brands", {
        title: "Производители в Пензе — бренды ТЕХАКС",
        description:
          "Производители техники и аксессуаров в каталоге ТЕХАКС: бренды с товарами в наличии, самовывозом в Пензе и доставкой по России.",
        canonicalUrl: `${SEO_HOST}/catalog?view=brands`,
        noindex: hasFilters || hasLayout || hasSort || forceProductsView,
        structuredData: [
          buildBreadcrumbStructuredData(breadcrumbs),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Производители ТЕХАКС",
            description:
              "Производители техники и аксессуаров в каталоге ТЕХАКС. Бренды с товарами в наличии, самовывозом и доставкой.",
            url: `${SEO_HOST}/catalog?view=brands`,
          },
          buildItemListStructuredData({
            name: "Производители ТЕХАКС",
            url: `${SEO_HOST}/catalog?view=brands`,
            items: manufacturers.map(item => ({
              name: item.name,
              url: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(item.slug)}`,
            })),
          }),
        ],
        bodyHtml: renderSeoBodyShell({
          breadcrumbs,
          eyebrow: "Каталог брендов",
          title: "Производители ТЕХАКС",
          description:
            "Выбирайте бренды техники и аксессуаров, которые уже представлены на витрине ТЕХАКС с актуальными ценами, наличием и доставкой.",
          content: renderCardList(
            manufacturers.map(item => ({
              title: item.name,
              text:
                truncateText(item.description, 150) ||
                "Товары бренда в каталоге ТЕХАКС.",
              links: [
                {
                  href: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(item.slug)}`,
                  label: `Открыть бренд ${item.name}`,
                },
              ],
            }))
          ),
        }),
      });
    }

    const [manufacturer] = await db
      .select()
      .from(schema.manufacturers)
      .where(eq(schema.manufacturers.slug, activeBrand))
      .limit(1);

    if (!manufacturer) {
      return buildBasePageData("/catalog", { noindex: true });
    }

    const brandSeo = buildBrandSeoCopy({
      brandName: manufacturer.name,
      description: manufacturer.metaDescription || manufacturer.description,
    });
    const description = normalizeDescription(
      manufacturer.metaDescription || brandSeo.description,
      brandSeo.description
    );
    const title = manufacturer.metaTitle?.trim() || brandSeo.title;
    const breadcrumbs = [
      { name: "Главная", url: SEO_HOST },
      { name: "Каталог", url: `${SEO_HOST}/catalog` },
      { name: "Производители", url: `${SEO_HOST}/catalog?view=brands` },
      {
        name: manufacturer.name,
        url: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`,
      },
    ];
    const relatedCategoryRows = await db
      .select({
        slug: schema.categories.slug,
        name: schema.categories.name,
        description: schema.categories.description,
        productCount: schema.manufacturerCategoryIndex.productCount,
      })
      .from(schema.manufacturerCategoryIndex)
      .innerJoin(
        schema.categories,
        eq(schema.categories.id, schema.manufacturerCategoryIndex.categoryId)
      )
      .where(eq(schema.manufacturerCategoryIndex.manufacturerId, manufacturer.id))
      .orderBy(
        desc(schema.manufacturerCategoryIndex.productCount),
        asc(schema.categories.sortOrder),
        asc(schema.categories.id)
      )
      .limit(6);
    const recentPosts = await db
      .select({
        slug: schema.posts.slug,
        title: schema.posts.title,
        excerpt: schema.posts.excerpt,
      })
      .from(schema.posts)
      .where(
        sql`(${schema.posts.status} = 'published' OR (${schema.posts.status} = 'scheduled' AND ${schema.posts.publishedAt} <= NOW()))`
      )
      .orderBy(desc(schema.posts.featured), desc(schema.posts.publishedAt), desc(schema.posts.createdAt))
      .limit(3);
    const brandFaqItems = buildBrandFaqItems({
      brandName: manufacturer.name,
      topCategoryNames: relatedCategoryRows.map(item => toSeoReadableName(item.name)),
    });

    return buildBasePageData(`/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`, {
      title,
      description,
      canonicalUrl: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`,
      noindex: hasFilters || hasLayout || hasSort || forceProductsView,
      image: manufacturer.logoUrl || DEFAULT_IMAGE,
      structuredData: [
        buildBreadcrumbStructuredData(breadcrumbs),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Товары бренда ${manufacturer.name}`,
          description,
          url: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`,
        },
        ...(buildFaqStructuredData(brandFaqItems) ? [buildFaqStructuredData(brandFaqItems)] : []),
      ],
      bodyHtml: renderSeoBodyShell({
        breadcrumbs,
        eyebrow: "Производитель",
        title: manufacturer.name,
        description,
        content: [
          renderInlineLinks([
            {
              href: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`,
              label: "Смотреть товары бренда",
            },
            { href: `${SEO_HOST}/catalog?view=brands`, label: "Все производители" },
            { href: `${SEO_HOST}/catalog`, label: "Каталог ТЕХАКС" },
          ]),
          manufacturer.description?.trim()
            ? `<section class="seo-section"><h2>О бренде</h2><p>${escapeHtml(
                truncateText(manufacturer.description, 800)
              )}</p></section>`
            : "",
          relatedCategoryRows.length > 0
            ? `<section class="seo-section"><h2>Где искать товары бренда</h2>${renderCardList(
                relatedCategoryRows.map(item => ({
                  title: toSeoReadableName(item.name),
                  text:
                    truncateText(item.description, 150) ||
                    `${manufacturer.name} и похожие товары в этой категории.`,
                  links: [
                    {
                      href: `${SEO_HOST}/catalog?cat=${encodeURIComponent(item.slug)}`,
                      label: `Открыть ${toSeoReadableName(item.name)}`,
                    },
                  ],
                }))
              )}</section>`
            : "",
          renderFaqSection(`Частые вопросы о бренде ${manufacturer.name}`, brandFaqItems),
          recentPosts.length > 0
            ? `<section class="seo-section"><h2>Полезные статьи и подборки</h2>${renderCardList(
                recentPosts.map(post => ({
                  title: post.title,
                  text: truncateText(post.excerpt, 150) || "Практическая статья из блога ТЕХАКС.",
                  links: [
                    {
                      href: `${SEO_HOST}/blog/${encodeURIComponent(post.slug)}`,
                      label: "Читать материал",
                    },
                  ],
                }))
              )}</section>`
            : "",
        ].join(""),
      }),
    });
  }

  if (!activeCategory || activeCategory === "all") {
    const categories = await db
      .select({
        slug: schema.categories.slug,
        name: schema.categories.name,
        description: schema.categories.description,
      })
      .from(schema.categories)
      .where(isNull(schema.categories.parentId))
      .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id))
      .limit(12);

    const breadcrumbs = [
      { name: "Главная", url: SEO_HOST },
      { name: "Каталог", url: `${SEO_HOST}/catalog` },
    ];

    return buildBasePageData("/catalog", {
      title: rootCatalogSeo.title,
      description: rootCatalogSeo.description,
      canonicalUrl: `${SEO_HOST}/catalog`,
      noindex: hasFilters || hasLayout || hasSort || forceProductsView,
      structuredData: [
        buildBreadcrumbStructuredData(breadcrumbs),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Каталог товаров ТЕХАКС",
          description: rootCatalogSeo.description,
          url: `${SEO_HOST}/catalog`,
        },
        buildItemListStructuredData({
          name: "Каталог товаров ТЕХАКС",
          url: `${SEO_HOST}/catalog`,
          items: categories.map(category => ({
            name: toSeoReadableName(category.name),
            url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(category.slug)}`,
          })),
        }),
      ],
      bodyHtml: renderSeoBodyShell({
        breadcrumbs,
        eyebrow: "Каталог",
        title: "Каталог товаров ТЕХАКС",
        description: rootCatalogSeo.description,
        content: renderCardList(
          categories.map(category => ({
            title: toSeoReadableName(category.name),
            text:
              truncateText(category.description, 160) ||
              "Раздел каталога с актуальными товарами и ценами.",
            links: [
              {
                href: `${SEO_HOST}/catalog?cat=${encodeURIComponent(category.slug)}`,
                label: `Перейти в раздел ${toSeoReadableName(category.name)}`,
              },
            ],
          }))
        ),
      }),
    });
  }

  const categoryRows = await db
    .select()
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id));
  const currentCategory = categoryRows.find(category => category.slug === activeCategory);

  if (!currentCategory) {
    return buildBasePageData("/catalog", { noindex: true });
  }

  const [categoryListing, filterListing] = await Promise.all([
    db
      .select()
      .from(schema.listingPages)
      .where(
        and(
          eq(schema.listingPages.type, "category"),
          eq(schema.listingPages.categoryId, currentCategory.id),
          eq(schema.listingPages.isPublished, true)
        )
      )
      .limit(1)
      .then(rows => rows[0]),
    singleFilter
      ? resolveFilterListing({
          categorySlug: currentCategory.slug,
          filterKey: singleFilter.filterKey,
          filterValue: singleFilter.filterValue,
        })
      : Promise.resolve(null),
  ]);

  const categoriesById = new Map(categoryRows.map(category => [category.id, category] as const));
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "Главная", url: SEO_HOST },
    { name: "Каталог", url: `${SEO_HOST}/catalog` },
  ];

  const trail: typeof categoryRows = [];
  let current: (typeof categoryRows)[number] | undefined = currentCategory;
  while (current) {
    trail.unshift(current);
    current = current.parentId ? categoriesById.get(current.parentId) : undefined;
  }
  for (const item of trail) {
    breadcrumbItems.push({
      name: toSeoReadableName(item.name),
      url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(item.slug)}`,
    });
  }

  const readableCategoryName = toSeoReadableName(currentCategory.name);
  const activeListing = singleFilter && filterListing ? filterListing : categoryListing;
  const childCategories = categoryRows
    .filter(category => category.parentId === currentCategory.id)
    .slice(0, 16);
  const siblingCategories = categoryRows
    .filter(
      category =>
        category.parentId === currentCategory.parentId && category.id !== currentCategory.id
    )
    .slice(0, 8);
  const relevantCategoryIds = collectDescendantCategoryIds(currentCategory.id, categoryRows);
  const topManufacturersInCategory =
    relevantCategoryIds.length > 0
      ? await db
          .select({
            slug: schema.manufacturers.slug,
            name: schema.manufacturers.name,
            description: schema.manufacturers.description,
            productCount: schema.manufacturerCategoryIndex.productCount,
          })
          .from(schema.manufacturerCategoryIndex)
          .innerJoin(
            schema.manufacturers,
            eq(schema.manufacturers.id, schema.manufacturerCategoryIndex.manufacturerId)
          )
          .where(
            and(
              inArray(schema.manufacturerCategoryIndex.categoryId, relevantCategoryIds),
              eq(schema.manufacturers.isVisible, true)
            )
          )
          .orderBy(
            desc(schema.manufacturerCategoryIndex.productCount),
            asc(schema.manufacturers.sortOrder),
            asc(schema.manufacturers.name)
          )
          .limit(6)
      : [];
  const relatedPosts = await db
    .select({
      slug: schema.posts.slug,
      title: schema.posts.title,
      excerpt: schema.posts.excerpt,
    })
    .from(schema.posts)
    .where(
      sql`(${schema.posts.status} = 'published' OR (${schema.posts.status} = 'scheduled' AND ${schema.posts.publishedAt} <= NOW()))`
    )
    .orderBy(desc(schema.posts.featured), desc(schema.posts.publishedAt), desc(schema.posts.createdAt))
    .limit(3);
  const categorySeo = buildCategorySeoCopy({
    categoryName: readableCategoryName,
    description: currentCategory.metaDescription || currentCategory.description,
    hasChildren: childCategories.length > 0,
  });
  const description = normalizeDescription(
    activeListing?.metaDescription ||
      currentCategory.metaDescription ||
      currentCategory.description,
    categorySeo.description
  );
  const title =
    activeListing?.title?.trim() ||
    currentCategory.metaTitle?.trim() ||
    categorySeo.title;
  const bodyDescription = normalizeDescription(
    activeListing?.introText || currentCategory.description || description,
    description
  );
  const categoryFaqItems = buildCategoryFaqItems({
    categoryName: readableCategoryName,
    hasChildren: childCategories.length > 0,
    topBrands: topManufacturersInCategory.map(item => item.name),
  });
  const content = [
    renderInlineLinks([
      {
        href: `${SEO_HOST}/catalog?cat=${encodeURIComponent(activeCategory)}`,
        label: `Товары раздела ${readableCategoryName}`,
      },
      { href: `${SEO_HOST}/catalog`, label: "Весь каталог" },
      ...(topManufacturersInCategory[0]
        ? [
            {
              href: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(topManufacturersInCategory[0].slug)}`,
              label: `Бренд ${topManufacturersInCategory[0].name}`,
            },
          ]
        : []),
    ]),
    childCategories.length > 0
      ? `<section class="seo-section"><h2>Популярные подкатегории</h2>${renderCardList(
          childCategories.map(category => ({
            title: toSeoReadableName(category.name),
            text:
              truncateText(category.description, 150) ||
              "Подкатегория с товарами, ценами и наличием.",
            links: [
              {
                href: `${SEO_HOST}/catalog?cat=${encodeURIComponent(category.slug)}`,
                label: `Открыть ${toSeoReadableName(category.name)}`,
              },
            ],
          }))
        )}</section>`
      : "",
    `<section class="seo-section"><h2>${childCategories.length > 0 ? "Как выбрать раздел" : "Покупка и получение"}</h2><p>${
      childCategories.length > 0
        ? "Выбирайте нужную подкатегорию или сразу переходите к товарам с актуальными ценами, наличием по магазинам ТЕХАКС и самовывозом в Пензе."
        : "В разделе доступны актуальные цены, наличие по магазинам ТЕХАКС, самовывоз в Пензе и доставка по России."
    }</p></section>`,
    siblingCategories.length > 0
      ? `<section class="seo-section"><h2>Похожие разделы</h2>${renderCardList(
          siblingCategories.map(category => ({
            title: toSeoReadableName(category.name),
            text:
              truncateText(category.description, 140) ||
              "Соседний раздел каталога с похожими товарами.",
            links: [
              {
                href: `${SEO_HOST}/catalog?cat=${encodeURIComponent(category.slug)}`,
                label: `Перейти в ${toSeoReadableName(category.name)}`,
              },
            ],
          }))
        )}</section>`
      : "",
    topManufacturersInCategory.length > 0
      ? `<section class="seo-section"><h2>Популярные бренды в разделе</h2>${renderCardList(
          topManufacturersInCategory.map(item => ({
            title: item.name,
            text:
              truncateText(item.description, 140) ||
              `${item.name} — один из брендов, представленных в разделе ${readableCategoryName}.`,
            links: [
              {
                href: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(item.slug)}`,
                label: `Открыть бренд ${item.name}`,
              },
            ],
          }))
        )}</section>`
      : "",
    renderFaqSection(`Частые вопросы по категории «${readableCategoryName}»`, categoryFaqItems),
    relatedPosts.length > 0
      ? `<section class="seo-section"><h2>Статьи и подборки по теме</h2>${renderCardList(
          relatedPosts.map(post => ({
            title: post.title,
            text: truncateText(post.excerpt, 150) || "Материал из блога ТЕХАКС по выбору и использованию техники.",
            links: [
              {
                href: `${SEO_HOST}/blog/${encodeURIComponent(post.slug)}`,
                label: "Читать статью",
              },
            ],
          }))
        )}</section>`
      : "",
    activeListing?.bottomText?.trim()
      ? `<section class="seo-section"><h2>Дополнительно</h2><p>${escapeHtml(
          activeListing.bottomText.trim()
        )}</p></section>`
      : "",
  ].join("");

  const listingIndexationPolicy = resolveCatalogIndexationPolicy({
    catalogView,
    activeCategory,
    activeBrand,
    selectedFiltersCount: activeFilters.length,
    singleFilter,
    approvedSingleFilter: Boolean(filterListing),
    sortBy: searchParams.get("sort") || "default",
    viewMode: searchParams.get("layout") || "grid",
    forceProductsView,
    listingIndexationMode: activeListing?.indexationMode ?? null,
    listingCanonicalUrl: activeListing?.canonicalUrl ?? null,
    hasProducts: true,
  });
  const canonicalUrl = listingIndexationPolicy.canonicalUrl
    ? listingIndexationPolicy.canonicalUrl
    : `${SEO_HOST}${listingIndexationPolicy.canonicalPath}`;

  return buildBasePageData(`/catalog?cat=${encodeURIComponent(activeCategory)}`, {
    title,
    description,
    canonicalUrl,
    noindex: listingIndexationPolicy.shouldNoindex,
    structuredData: [
      buildBreadcrumbStructuredData(breadcrumbItems),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: activeListing?.h1?.trim() || readableCategoryName,
        description,
        url: canonicalUrl,
      },
      ...(childCategories.length > 0
        ? [
            buildItemListStructuredData({
              name: readableCategoryName,
              url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(activeCategory)}`,
              items: childCategories.map(category => ({
                name: toSeoReadableName(category.name),
                url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(category.slug)}`,
              })),
            }),
          ]
        : []),
      ...(buildFaqStructuredData(categoryFaqItems)
        ? [buildFaqStructuredData(categoryFaqItems)]
        : []),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: breadcrumbItems,
      eyebrow: "Категория",
      title: activeListing?.h1?.trim() || readableCategoryName,
      description: bodyDescription,
      content,
    }),
  });
}

async function buildProductSeoData(url: URL) {
  const slug = decodeURIComponent(url.pathname.replace(/^\/product\//, "").trim());
  const db = getDb();
  const result = await db
    .select({
      id: schema.products.id,
      slug: schema.products.slug,
      name: schema.products.name,
      description: schema.products.description,
      image: schema.products.image,
      images: schema.products.images,
      imageVariants: schema.products.imageVariants,
      price: schema.products.price,
      article: schema.products.article,
      barcode: schema.products.barcode,
      categoryId: schema.products.categoryId,
      specs: schema.products.specs,
      rating: schema.products.rating,
      reviewCount: schema.products.reviewCount,
      categorySlug: schema.categories.slug,
      categoryName: schema.categories.name,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(and(eq(schema.products.slug, slug), publicProductVisibilityCondition))
    .limit(1);

  const product = result[0];
  if (!product) {
    return buildBasePageData(url.pathname, {
      title: "Товар недоступен — ТЕХАКС",
      description: "Товар временно недоступен или снят с витрины.",
      canonicalUrl: `${SEO_HOST}${url.pathname}`,
      noindex: true,
    });
  }

  const storeAvailability = await db
    .select({
      id: schema.stores.id,
      name: schema.stores.name,
      address: schema.stores.address,
      phone: schema.stores.phone,
      hours: schema.stores.hours,
      image: schema.stores.image,
      mapUrl: schema.stores.mapUrl,
      qty: sql<number>`SUM(${schema.productStocks.quantity})`,
    })
    .from(schema.productStocks)
    .innerJoin(schema.stores, eq(schema.productStocks.storeId, schema.stores.id))
    .where(
      and(
        eq(schema.productStocks.productId, product.id),
        eq(schema.stores.isPublic, true),
        sql`${schema.productStocks.quantity} > 0`
      )
    )
    .groupBy(
      schema.stores.id,
      schema.stores.name,
      schema.stores.address,
      schema.stores.phone,
      schema.stores.hours,
      schema.stores.image,
      schema.stores.mapUrl
    )
    .orderBy(desc(sql`SUM(${schema.productStocks.quantity})`))
    .limit(3);

  const categoryRows = await db
    .select()
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id));
  const categoriesById = new Map(categoryRows.map(category => [category.id, category] as const));
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "Главная", url: SEO_HOST },
    { name: "Каталог", url: `${SEO_HOST}/catalog` },
  ];
  let currentCategory = categoriesById.get(product.categoryId);
  const trail: Array<(typeof categoryRows)[number]> = [];
  while (currentCategory) {
    trail.unshift(currentCategory);
    currentCategory = currentCategory.parentId
      ? categoriesById.get(currentCategory.parentId)
      : undefined;
  }
  for (const item of trail) {
    breadcrumbItems.push({
      name: toSeoReadableName(item.name),
      url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(item.slug)}`,
    });
  }
  breadcrumbItems.push({
    name: product.name,
    url: `${SEO_HOST}/product/${encodeURIComponent(product.slug)}`,
  });

  const visibleProductSpecs =
    product.specs && typeof product.specs === "object" && !Array.isArray(product.specs)
      ? Object.fromEntries(
          Object.entries(product.specs as Record<string, unknown>).filter(
            ([key, value]) =>
              !isInternalProductSpecKey(key) &&
              String(value ?? "").trim().length > 0
          )
        )
      : {};
  const manufacturerName =
    getManufacturerNameFromProductSpecs(visibleProductSpecs) || SITE_NAME;
  const specsEntries = Object.entries(visibleProductSpecs)
    .filter(([, value]) => String(value ?? "").trim().length > 0)
    .slice(0, 8)
    .map(([key, value]) => ({
      label: key,
      value: String(value),
    }));
  const reviewRows = await db
    .select({
      rating: schema.productReviews.rating,
      title: schema.productReviews.title,
      text: schema.productReviews.text,
      publishedAt: schema.productReviews.publishedAt,
      authorName:
        sql<string>`coalesce(nullif(${schema.users.fullName}, ''), nullif(${schema.users.email}, ''), 'Покупатель ТЕХАКС')`,
    })
    .from(schema.productReviews)
    .leftJoin(schema.users, eq(schema.productReviews.userId, schema.users.id))
    .where(
      and(
        eq(schema.productReviews.productId, product.id),
        eq(schema.productReviews.status, "published")
      )
    )
    .orderBy(desc(schema.productReviews.publishedAt), desc(schema.productReviews.id))
    .limit(2);
  const hasAggregateRating =
    Number(product.reviewCount ?? 0) > 0 && Number(product.rating ?? 0) > 0;
  const isAvailable = storeAvailability.length > 0;
  const compatibilityValue = getSeoSpecValue(
    visibleProductSpecs,
    ["Совместимость", "Поддержка", "Интерфейс", "Разъем", "Подключение"]
  );
  const productFacts = buildProductFactRows({
    manufacturerName,
    product,
    inStock: isAvailable,
    availableStoreCount: storeAvailability.length,
  });
  const productFaqItems = buildProductFaqItems({
    productName: product.name,
    manufacturerName,
    categoryName: product.categoryName,
    compatibility: compatibilityValue,
    inStock: isAvailable,
    availableStoreCount: storeAvailability.length,
  });
  const productSeo = buildProductSeoCopy({
    productName: product.name,
    manufacturerName,
    categoryName: product.categoryName,
    description: product.description,
    specs: visibleProductSpecs,
    price: product.price,
    inStock: isAvailable,
  });
  const description = normalizeDescription(product.description, productSeo.description);
  const image = product.image || DEFAULT_IMAGE;
  const imageUrls = collectProductImageUrls(
    product.image,
    product.imageVariants,
    product.images
  );

  return buildBasePageData(`/product/${encodeURIComponent(product.slug)}`, {
    title: productSeo.title,
    description,
    canonicalUrl: `${SEO_HOST}/product/${encodeURIComponent(product.slug)}`,
    image,
    structuredData: [
      buildBreadcrumbStructuredData(breadcrumbItems),
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        image: imageUrls,
        description,
        sku: product.article || product.slug.toUpperCase(),
        gtin13: product.barcode || undefined,
        brand: {
          "@type": "Brand",
          name: manufacturerName,
        },
        additionalProperty:
          specsEntries.length > 0
            ? specsEntries.map(spec => ({
                "@type": "PropertyValue",
                name: spec.label,
                value: spec.value,
              }))
            : undefined,
        aggregateRating: hasAggregateRating
          ? {
              "@type": "AggregateRating",
              ratingValue: Number(product.rating),
              reviewCount: Number(product.reviewCount),
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
        review:
          reviewRows.length > 0
            ? reviewRows.map(review => ({
                "@type": "Review",
                name: review.title || `Отзыв о ${product.name}`,
                reviewBody: review.text,
                datePublished: review.publishedAt
                  ? new Date(review.publishedAt).toISOString()
                  : undefined,
                author: {
                  "@type": "Person",
                  name: review.authorName,
                },
                reviewRating: {
                  "@type": "Rating",
                  ratingValue: Number(review.rating),
                  bestRating: 5,
                  worstRating: 1,
                },
              }))
            : undefined,
        offers: {
          "@type": "Offer",
          url: `${SEO_HOST}/product/${encodeURIComponent(product.slug)}`,
          priceCurrency: "RUB",
          price: String(product.price),
          availability: isAvailable
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SEO_HOST,
          },
          availableAtOrFrom:
            storeAvailability.length > 0
              ? storeAvailability.map(store => ({
                  "@type": "Store",
                  name: store.name,
                  telephone: store.phone || undefined,
                  openingHours: store.hours || undefined,
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: store.address,
                    addressLocality: guessAddressLocality(store.address),
                    addressCountry: "RU",
                  },
                }))
              : undefined,
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "RU",
            returnPolicyCategory:
              "https://schema.org/MerchantReturnFiniteReturnWindow",
            merchantReturnDays: 14,
            url: `${SEO_HOST}/returns`,
          },
        },
      },
      ...(buildFaqStructuredData(productFaqItems)
        ? [buildFaqStructuredData(productFaqItems)]
        : []),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: breadcrumbItems,
      eyebrow: "Карточка товара",
      title: product.name,
      description,
      content: [
        renderInlineLinks([
          {
            href: `${SEO_HOST}/product/${encodeURIComponent(product.slug)}`,
            label: "Карточка товара",
          },
          ...(product.categoryName
            ? [
                {
                  href: `${SEO_HOST}/catalog?cat=${encodeURIComponent(trail[trail.length - 1]?.slug ?? "")}`,
                  label: `Раздел ${toSeoReadableName(product.categoryName)}`,
                },
              ]
            : []),
          { href: `${SEO_HOST}/payment-delivery`, label: "Доставка и оплата" },
          { href: `${SEO_HOST}/stores`, label: "Магазины ТЕХАКС" },
        ]),
        `<section class="seo-section"><h2>Кратко о товаре</h2><p>${escapeHtml(
          productSeo.summaryLine ||
            (isAvailable
              ? `${product.name} доступен для покупки в ТЕХАКС с самовывозом в Пензе и доставкой по России.`
              : `${product.name} сейчас недоступен для покупки, но карточка сохранена для сравнения характеристик и цены.`)
        )}</p></section>`,
        `<section class="seo-section"><h2>Факты о товаре</h2>${renderFacts([
          { label: "Цена", value: `${new Intl.NumberFormat("ru-RU").format(product.price)} ₽` },
          ...productFacts,
        ])}</section>`,
        specsEntries.length > 0
          ? `<section class="seo-section"><h2>Основные характеристики</h2>${renderFacts(
              specsEntries
            )}</section>`
          : "",
        storeAvailability.length > 0
          ? `<section class="seo-section"><h2>Наличие и получение</h2>${renderCardList(
              storeAvailability.map(store => ({
                title: store.name,
                text: `${store.address}. В наличии: ${store.qty} шт.`,
                links: [{ href: `${SEO_HOST}/stores`, label: "Все магазины ТЕХАКС" }],
              }))
            )}</section>`
          : `<section class="seo-section"><h2>Получение</h2><p>Проверьте наличие в магазинах ТЕХАКС или оформите доставку по России.</p></section>`,
        reviewRows.length > 0
          ? `<section class="seo-section"><h2>Отзывы покупателей</h2>${renderCardList(
              reviewRows.map(review => ({
                title: review.title || `${review.authorName} — ${review.rating}/5`,
                text: truncateText(review.text, 220),
                meta: `${review.authorName} · ${review.rating}/5`,
                links: [
                  {
                    href: `${SEO_HOST}/product/${encodeURIComponent(product.slug)}#reviews`,
                    label: "Смотреть все отзывы",
                  },
                ],
              }))
            )}</section>`
          : `<section class="seo-section"><h2>Отзывы покупателей</h2><p>Отзывов пока нет. Будьте первым, кто оставит отзыв о товаре после покупки — это поможет другим быстрее принять решение.</p></section>`,
        `<section class="seo-section"><h2>Что проверить перед покупкой</h2><p>${
          compatibilityValue
            ? `Перед покупкой проверьте совместимость устройства, разъёмы, цвет и сценарий использования. Для этой модели указана совместимость: ${escapeHtml(
                compatibilityValue
              )}.`
            : "Перед покупкой проверьте тип товара, модель, совместимость, ключевые характеристики и доступность нужного способа получения."
        }</p></section>`,
        renderFaqSection(`Частые вопросы о товаре «${product.name}»`, productFaqItems),
      ].join(""),
    }),
  });
}

async function buildStoresSeoData() {
  const [profile, stores] = await Promise.all([
    getPublicSiteProfile(),
    getDb()
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.isPublic, true))
      .orderBy(asc(schema.stores.sortOrder)),
  ]);

  return buildBasePageData("/stores", {
    title: "Магазины ТЕХАКС в Пензе — адреса, телефоны и режим работы",
    description:
      "Адреса магазинов ТЕХАКС в Пензе, часы работы, телефоны, самовывоз и схема проезда.",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: "Магазины", url: `${SEO_HOST}/stores` },
      ]),
      buildOrganizationStructuredData({
        email: profile.contacts.email,
        phone: profile.contacts.primaryPhoneDisplay,
        address:
          profile.contacts.shortAddress ||
          profile.contacts.fullAddress ||
          profile.seller.legalAddress,
      }),
      ...stores.map(store => buildStoreStructuredData(store)),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: "Магазины", url: `${SEO_HOST}/stores` },
      ],
      eyebrow: "Офлайн-магазины",
      title: "Магазины ТЕХАКС в Пензе",
      description:
        "Адреса магазинов, режим работы, контакты и самовывоз по актуальному наличию.",
      content: [
        renderInlineLinks([
          { href: `${SEO_HOST}/catalog`, label: "Открыть каталог" },
          { href: `${SEO_HOST}/contacts`, label: "Контакты и реквизиты" },
        ]),
        renderCardList(
          stores.map(store => ({
            title: store.name,
            text: [store.address, store.hours, store.phone].filter(Boolean).join(" • "),
            links: store.mapUrl ? [{ href: store.mapUrl, label: "Открыть карту" }] : undefined,
          }))
        ),
      ].join(""),
    }),
  });
}

async function buildContactsSeoData() {
  const [profile, stores] = await Promise.all([
    getPublicSiteProfile(),
    getDb()
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.isPublic, true))
      .orderBy(asc(schema.stores.sortOrder)),
  ]);

  return buildBasePageData("/contacts", {
    title: "Контакты ТЕХАКС — телефоны, адреса магазинов и режим работы",
    description:
      "Контакты интернет-магазина ТЕХАКС: телефоны, e-mail, адреса магазинов в Пензе, реквизиты продавца и форма обратной связи.",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: "Контакты", url: `${SEO_HOST}/contacts` },
      ]),
      buildOrganizationStructuredData({
        email: profile.contacts.email,
        phone: profile.contacts.primaryPhoneDisplay,
        address:
          profile.contacts.shortAddress ||
          profile.contacts.fullAddress ||
          profile.seller.legalAddress,
      }),
      ...stores.map(store => buildStoreStructuredData(store)),
      buildFaqStructuredData([
        {
          question: "Как связаться с ТЕХАКС?",
          answer: `Основной телефон: ${profile.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88"}. Email: ${profile.contacts.email || "tech.aks@yandex.ru"}.`,
        },
        {
          question: "Когда работает магазин?",
          answer: profile.contacts.workingHours || "Ежедневно 9:00–21:00.",
        },
        ...(stores.length > 0
          ? [
              {
                question: "Где находятся магазины ТЕХАКС?",
                answer: stores.map(store => `${store.name}: ${store.address}`).join(" | "),
              },
            ]
          : []),
      ]),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: "Контакты", url: `${SEO_HOST}/contacts` },
      ],
      eyebrow: "Контакты",
      title: "Контакты ТЕХАКС",
      description:
        "Телефоны, e-mail, адреса магазинов, режим работы и реквизиты интернет-магазина ТЕХАКС.",
      content: [
        renderFacts([
          { label: "Телефон", value: profile.contacts.primaryPhoneDisplay || "" },
          { label: "E-mail", value: profile.contacts.email || "" },
          {
            label: "Адрес",
            value:
              profile.contacts.shortAddress ||
              profile.contacts.fullAddress ||
              profile.seller.legalAddress ||
              "",
          },
          { label: "Режим работы", value: profile.contacts.workingHours || "" },
        ]),
        renderCardList(
          stores.map(store => ({
            title: store.name,
            text: [store.address, store.hours, store.phone].filter(Boolean).join(" • "),
            links: [{ href: `${SEO_HOST}/stores`, label: "Смотреть магазин" }],
          }))
        ),
      ].join(""),
    }),
  });
}

async function buildAboutSeoData() {
  const [profile, stores] = await Promise.all([
    getPublicSiteProfile(),
    getDb()
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.isPublic, true))
      .orderBy(asc(schema.stores.sortOrder)),
  ]);

  return buildBasePageData("/about", {
    title: "О компании ТЕХАКС — техника и аксессуары в Пензе",
    description:
      "ТЕХАКС — розничная сеть магазинов техники и аксессуаров в Пензе. Официальный партнёр брендов HOCO, Remax, ISA и других производителей. Умная электроника, аудиотехника, аксессуары и техника для дома.",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: "О компании", url: `${SEO_HOST}/about` },
      ]),
      buildOrganizationStructuredData({
        email: profile.contacts.email,
        phone: profile.contacts.primaryPhoneDisplay,
        address:
          profile.contacts.shortAddress ||
          profile.contacts.fullAddress ||
          profile.seller.legalAddress,
      }),
      ...stores.map(store => buildStoreStructuredData(store)),
      buildFaqStructuredData([
        {
          question: "Чем занимается ТЕХАКС?",
          answer:
            "ТЕХАКС — интернет-магазин и офлайн-магазины техники, электроники и аксессуаров в Пензе.",
        },
        {
          question: "С какими брендами работает ТЕХАКС?",
          answer:
            "В ассортименте представлены HOCO, Remax, ISA и другие бренды техники и аксессуаров.",
        },
        ...(stores.length > 0
          ? [
              {
                question: "Можно ли забрать заказ самовывозом?",
                answer: stores.map(store => `${store.name}: ${store.address}`).join(" | "),
              },
            ]
          : []),
      ]),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: "О компании", url: `${SEO_HOST}/about` },
      ],
      eyebrow: "О компании",
      title: "ТЕХАКС — техника и аксессуары в Пензе",
      description:
        "Розничная сеть магазинов техники и аксессуаров в Пензе с удобным самовывозом, актуальным наличием и сервисом без лишней сложности.",
      content: [
        `<section class="seo-section"><h2>Кто мы</h2><p>ТЕХАКС — это интернет-магазин и офлайн-магазины техники, электроники и аксессуаров. Мы помогаем выбирать полезные устройства для дома, работы, автомобиля и повседневной жизни без переплат и лишней путаницы.</p></section>`,
        renderCardList(
          stores.map(store => ({
            title: store.name,
            text: [store.address, store.hours].filter(Boolean).join(" • "),
            links: [{ href: `${SEO_HOST}/stores`, label: "Подробнее о магазинах" }],
          }))
        ),
      ].join(""),
    }),
  });
}

async function buildLocalLandingSeoData(url: URL) {
  const slug = decodeURIComponent(url.pathname.replace(/^\/penza\//, "").trim());
  const landing = getLocalSeoLandingBySlug(slug);

  if (!landing) {
    return buildBasePageData(url.pathname, {
      title: "Подборка не найдена — ТЕХАКС",
      description: "Запрошенная локальная подборка недоступна.",
      canonicalUrl: `${SEO_HOST}${url.pathname}`,
      noindex: true,
    });
  }

  const categoryItems = landing.categoryLinks.map(item => ({
    name: item.label,
    url: `${SEO_HOST}${buildCatalogCategoryUrl(item.slug)}`,
  }));
  const brandItems = landing.brandLinks.map(item => ({
    name: item.label,
    url: `${SEO_HOST}${buildBrandCatalogUrl(item.slug)}`,
  }));
  const relatedItems = landing.relatedSlugs
    .map(itemSlug => getLocalSeoLandingBySlug(itemSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map(item => ({
      name: item.h1,
      url: `${SEO_HOST}${buildLocalLandingUrl(item.slug)}`,
    }));
  const faqStructuredData = buildFaqStructuredData(landing.faqs);

  return buildBasePageData(buildLocalLandingUrl(landing.slug), {
    title: landing.title,
    description: landing.description,
    canonicalUrl: `${SEO_HOST}${buildLocalLandingUrl(landing.slug)}`,
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: "Каталог", url: `${SEO_HOST}/catalog` },
        { name: landing.h1, url: `${SEO_HOST}${buildLocalLandingUrl(landing.slug)}` },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: landing.h1,
        headline: landing.h1,
        description: landing.description,
        url: `${SEO_HOST}${buildLocalLandingUrl(landing.slug)}`,
        inLanguage: "ru-RU",
        about: landing.categoryLinks.map(item => item.label),
      },
      buildItemListStructuredData({
        name: `${landing.h1} — быстрые переходы`,
        url: `${SEO_HOST}${buildLocalLandingUrl(landing.slug)}`,
        items: [...categoryItems, ...brandItems].slice(0, 12),
      }),
      ...(faqStructuredData ? [faqStructuredData] : []),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: "Каталог", url: `${SEO_HOST}/catalog` },
        { name: landing.h1, url: `${SEO_HOST}${buildLocalLandingUrl(landing.slug)}` },
      ],
      eyebrow: "Локальная подборка",
      title: landing.h1,
      description: landing.description,
      content: [
        renderInlineLinks([
          {
            href: `${SEO_HOST}${buildCatalogCategoryUrl(landing.primaryCategory.slug)}`,
            label: `Открыть ${landing.primaryCategory.label}`,
          },
          { href: `${SEO_HOST}/stores`, label: "Магазины и самовывоз" },
          { href: `${SEO_HOST}/payment-delivery`, label: "Оплата и доставка" },
        ]),
        `<section class="seo-section"><h2>Зачем нужна эта страница</h2><p>${escapeHtml(
          landing.intro
        )}</p></section>`,
        `<section class="seo-section"><h2>Что удобно открыть отсюда</h2><ul>${landing.supportPoints
          .map(point => `<li>${escapeHtml(point)}</li>`)
          .join("")}</ul></section>`,
        `<section class="seo-section"><h2>Категории по теме</h2>${renderCardList(
          landing.categoryLinks.map(item => ({
            title: item.label,
            text: item.note,
            links: [
              {
                href: `${SEO_HOST}${buildCatalogCategoryUrl(item.slug)}`,
                label: `Перейти в ${item.label}`,
              },
            ],
          }))
        )}</section>`,
        `<section class="seo-section"><h2>Подходящие бренды</h2>${renderCardList(
          landing.brandLinks.map(item => ({
            title: item.label,
            text: item.note,
            links: [
              {
                href: `${SEO_HOST}${buildBrandCatalogUrl(item.slug)}`,
                label: `Открыть бренд ${item.label}`,
              },
            ],
          }))
        )}</section>`,
        relatedItems.length > 0
          ? `<section class="seo-section"><h2>Ещё локальные подборки</h2>${renderInlineLinks(
              relatedItems.map(item => ({
                href: item.url,
                label: item.name,
              }))
            )}</section>`
          : "",
        landing.faqs.length > 0
          ? `<section class="seo-section"><h2>Частые вопросы</h2>${renderCardList(
              landing.faqs.map(item => ({
                title: item.question,
                text: item.answer,
              }))
            )}</section>`
          : "",
      ].join(""),
    }),
  });
}

async function buildPromotionsSeoData() {
  const db = getDb();
  const promos = await db
    .select({
      slug: schema.banners.slug,
      title: schema.banners.title,
    })
    .from(schema.banners)
    .where(eq(schema.banners.active, true))
    .orderBy(asc(schema.banners.sortOrder), asc(schema.banners.id))
    .limit(12);

  return buildBasePageData("/promotions", {
    title: "Акции и спецпредложения ТЕХАКС",
    description:
      "Актуальные акции, скидки и спецпредложения ТЕХАКС на технику и аксессуары.",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: "Акции", url: `${SEO_HOST}/promotions` },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Акции и спецпредложения ТЕХАКС",
        description:
          "Актуальные акции, скидки и спецпредложения ТЕХАКС на технику и аксессуары.",
        url: `${SEO_HOST}/promotions`,
        mainEntity: promos.map((promo, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${SEO_HOST}/promotions/${promo.slug}`,
          name: promo.title,
        })),
      },
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: "Акции", url: `${SEO_HOST}/promotions` },
      ],
      eyebrow: "Акции",
      title: "Акции и спецпредложения ТЕХАКС",
      description:
        "Следите за скидками, подарками и специальными предложениями на технику и аксессуары.",
      content: renderCardList(
        promos.map(promo => ({
          title: promo.title,
          links: [
            {
              href: `${SEO_HOST}/promotions/${encodeURIComponent(promo.slug)}`,
              label: "Открыть акцию",
            },
          ],
        }))
      ),
    }),
  });
}

async function buildPromotionDetailSeoData(url: URL) {
  const slug = decodeURIComponent(url.pathname.replace(/^\/promotions\//, "").trim());
  const db = getDb();
  const [promo] = await db
    .select()
    .from(schema.banners)
    .where(and(eq(schema.banners.slug, slug), eq(schema.banners.active, true)))
    .limit(1);

  if (!promo) {
    return buildBasePageData(url.pathname, {
      title: "Акция не найдена — ТЕХАКС",
      description: "Запрошенная акция недоступна или уже завершена.",
      canonicalUrl: `${SEO_HOST}${url.pathname}`,
      noindex: true,
    });
  }

  const description = normalizeDescription(
    promo.subtitle || promo.content,
    "Подробности акции и спецпредложения ТЕХАКС."
  );

  return buildBasePageData(`/promotions/${encodeURIComponent(promo.slug)}`, {
    title: `${promo.title} — акция ТЕХАКС`,
    description,
    canonicalUrl: `${SEO_HOST}/promotions/${encodeURIComponent(promo.slug)}`,
    image: promo.image || DEFAULT_IMAGE,
    type: "article",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: "Акции", url: `${SEO_HOST}/promotions` },
        { name: promo.title, url: `${SEO_HOST}/promotions/${encodeURIComponent(promo.slug)}` },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: promo.title,
        description,
        image: [toAbsoluteUrl(promo.image || DEFAULT_IMAGE)],
        datePublished: new Date(promo.createdAt).toISOString(),
        dateModified: new Date(promo.createdAt).toISOString(),
        author: {
          "@type": "Organization",
          name: SITE_NAME,
        },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          logo: {
            "@type": "ImageObject",
            url: `${SEO_HOST}/images/logo-light.svg`,
          },
        },
        mainEntityOfPage: `${SEO_HOST}/promotions/${encodeURIComponent(promo.slug)}`,
      },
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: "Акции", url: `${SEO_HOST}/promotions` },
        {
          name: promo.title,
          url: `${SEO_HOST}/promotions/${encodeURIComponent(promo.slug)}`,
        },
      ],
      eyebrow: "Спецпредложение",
      title: promo.title,
      description,
      content: `<section class="seo-section"><h2>Условия акции</h2><p>${escapeHtml(
        truncateText(promo.subtitle || promo.content, 1200) || "Подробности акции доступны на странице предложения."
      )}</p></section>`,
    }),
  });
}

async function buildBlogSeoData() {
  const db = getDb();
  const posts = await db
    .select({
      slug: schema.posts.slug,
      title: schema.posts.title,
    })
    .from(schema.posts)
    .where(
      sql`(${schema.posts.status} = 'published' OR (${schema.posts.status} = 'scheduled' AND ${schema.posts.publishedAt} <= NOW()))`
    )
    .orderBy(desc(schema.posts.featured), desc(schema.posts.publishedAt), desc(schema.posts.createdAt))
    .limit(12);

  return buildBasePageData("/blog", {
    title: "Блог ТЕХАКС — обзоры, советы и подборки аксессуаров",
    description:
      "Полезные статьи ТЕХАКС: как выбрать аксессуары, чем отличаются модели, что подойдёт для смартфона, авто и дома.",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: "Блог", url: `${SEO_HOST}/blog` },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Блог ТЕХАКС",
        description:
          "Полезные статьи ТЕХАКС: как выбрать аксессуары, чем отличаются модели, что подойдёт для смартфона, авто и дома.",
        url: `${SEO_HOST}/blog`,
        mainEntity: posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${SEO_HOST}/blog/${post.slug}`,
          name: post.title,
        })),
      },
      buildItemListStructuredData({
        name: "Контент-план блога ТЕХАКС",
        url: `${SEO_HOST}/blog`,
        items: knowledgeCenterArticlePlan.slice(0, 10).map(item => ({
          name: item.title,
          url: `${SEO_HOST}/blog/${encodeURIComponent(item.slug)}`,
        })),
      }),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: "Блог", url: `${SEO_HOST}/blog` },
      ],
      eyebrow: "Блог",
      title: "Блог ТЕХАКС",
      description:
        "Обзоры, советы и подборки по электронике, аксессуарам и полезным устройствам для повседневной жизни.",
      content: `
        <section class="seo-section">
          <h2>Тематические направления</h2>
          ${renderCardList(
            knowledgeCenterClusters.map(cluster => ({
              title: cluster.title,
              text: cluster.description,
              links: cluster.links.map(link => ({
                href: `${SEO_HOST}${link.href}`,
                label: link.label,
              })),
            }))
          )}
        </section>
        <section class="seo-section">
          <h2>Опубликованные материалы</h2>
          ${renderCardList(
            posts.map(post => ({
              title: post.title,
              links: [
                {
                  href: `${SEO_HOST}/blog/${encodeURIComponent(post.slug)}`,
                  label: "Читать статью",
                },
              ],
            }))
          )}
        </section>
        <section class="seo-section">
          <h2>План ближайших публикаций</h2>
          ${renderCardList(
            knowledgeCenterArticlePlan.slice(0, 6).map(item => ({
              title: item.title,
              text: item.shortAnswer,
              links: item.categoryLinks.slice(0, 2).map(link => ({
                href: `${SEO_HOST}${link.href}`,
                label: link.label,
              })),
            }))
          )}
        </section>
      `,
    }),
  });
}

async function buildBlogPostSeoData(url: URL) {
  const slug = decodeURIComponent(url.pathname.replace(/^\/blog\//, "").trim());
  const db = getDb();
  const [post] = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.slug, slug))
    .limit(1);

  if (!post) {
    return buildBasePageData(url.pathname, { noindex: true });
  }

  const knowledgePlan = getKnowledgeCenterPlanForPost({
    slug: post.slug,
    title: post.title,
    category: post.category,
  });
  const knowledgeFaq = getKnowledgeFaqForPost({
    slug: post.slug,
    title: post.title,
    category: post.category,
    excerpt: post.excerpt,
  });
  const faqStructuredData = buildFaqStructuredData(knowledgeFaq);

  return buildBasePageData(`/blog/${encodeURIComponent(post.slug)}`, {
    title: `${post.metaTitle || post.title} — Блог ТЕХАКС`,
    description:
      post.metaDescription ||
      normalizeDescription(post.excerpt, "Полезные статьи и обзоры от ТЕХАКС."),
    canonicalUrl: `${SEO_HOST}/blog/${encodeURIComponent(post.slug)}`,
    image: post.ogImage || post.image || DEFAULT_IMAGE,
    type: "article",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: "Блог", url: `${SEO_HOST}/blog` },
        { name: post.title, url: `${SEO_HOST}/blog/${encodeURIComponent(post.slug)}` },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.metaTitle || post.title,
        description:
          post.metaDescription ||
          normalizeDescription(post.excerpt, "Полезные статьи и обзоры от ТЕХАКС."),
        image: [toAbsoluteUrl(post.ogImage || post.image || DEFAULT_IMAGE)],
        datePublished: post.publishedAt
          ? new Date(post.publishedAt).toISOString()
          : new Date(post.createdAt).toISOString(),
        dateModified: new Date(post.updatedAt || post.createdAt).toISOString(),
        author: {
          "@type": "Person",
          name: post.authorName || "Редакция ТЕХАКС",
        },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          logo: {
            "@type": "ImageObject",
            url: `${SEO_HOST}/images/logo-light.svg`,
          },
        },
        mainEntityOfPage: `${SEO_HOST}/blog/${encodeURIComponent(post.slug)}`,
      },
      ...(faqStructuredData ? [faqStructuredData] : []),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: "Блог", url: `${SEO_HOST}/blog` },
        { name: post.title, url: `${SEO_HOST}/blog/${encodeURIComponent(post.slug)}` },
      ],
      eyebrow: post.category || "Статья",
      title: post.title,
      description:
        post.metaDescription ||
        normalizeDescription(post.excerpt, "Полезные статьи и обзоры от ТЕХАКС."),
      content: `
        <section class="seo-section">
          <h2>Кратко о материале</h2>
          <p>${escapeHtml(
            knowledgePlan?.shortAnswer ||
              truncateText(post.excerpt || post.content, 1400) ||
              "Материал доступен на странице статьи."
          )}</p>
        </section>
        ${
          knowledgePlan?.categoryLinks?.length
            ? `<section class="seo-section"><h2>Категории по теме</h2>${renderCardList(
                knowledgePlan.categoryLinks.map(link => ({
                  title: link.label,
                  text: link.note,
                  links: [{ href: `${SEO_HOST}${link.href}`, label: "Открыть раздел" }],
                }))
              )}</section>`
            : ""
        }
        ${
          knowledgePlan?.brandLinks?.length
            ? `<section class="seo-section"><h2>Связанные бренды</h2>${renderCardList(
                knowledgePlan.brandLinks.map(link => ({
                  title: link.label,
                  text: link.note,
                  links: [{ href: `${SEO_HOST}${link.href}`, label: "Открыть бренд" }],
                }))
              )}</section>`
            : ""
        }
        ${renderFaqSection("Частые вопросы", knowledgeFaq)}
      `,
    }),
  });
}

async function buildLegalSeoData(pathname: string) {
  const profile = await getPublicSiteProfile();
  const titles: Record<string, string> = {
    "/offer": profile.legalTexts.offerTitle || "Публичная оферта",
    "/privacy-policy":
      profile.legalTexts.privacyPolicyTitle || "Политика обработки персональных данных",
    "/payment-delivery": profile.legalTexts.paymentDeliveryTitle || "Оплата и доставка",
    "/returns": profile.legalTexts.returnsPolicyTitle || "Возврат и обмен",
  };
  const title = titles[pathname] || "Правовая информация";
  const descriptions: Record<string, string> = {
    "/offer":
      "Публичная оферта интернет-магазина ТЕХАКС: условия заказа, оплаты, получения товара и взаимодействия с покупателем.",
    "/privacy-policy":
      "Политика обработки персональных данных ТЕХАКС: какие данные собираются, как используются и как защищаются.",
    "/payment-delivery":
      "Оплата и доставка в ТЕХАКС: самовывоз, доставка по Пензе и России, способы оплаты и условия получения заказа.",
    "/returns":
      "Возврат и обмен в ТЕХАКС: порядок обращения, условия возврата, обмена и поддержки по заказам интернет-магазина.",
  };
  const description =
    descriptions[pathname] || "Юридическая информация интернет-магазина ТЕХАКС.";
  const contents: Record<string, string> = {
    "/offer": profile.legalTexts.offerContent,
    "/privacy-policy": profile.legalTexts.privacyPolicyContent,
    "/payment-delivery": profile.legalTexts.paymentDeliveryContent,
    "/returns": profile.legalTexts.returnsPolicyContent,
  };

  return buildBasePageData(pathname, {
    title: `${title} — ТЕХАКС`,
    description,
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: title, url: `${SEO_HOST}${pathname}` },
      ]),
      buildOrganizationStructuredData({
        email: profile.contacts.email,
        phone: profile.contacts.primaryPhoneDisplay,
        address:
          profile.contacts.shortAddress ||
          profile.contacts.fullAddress ||
          profile.seller.legalAddress,
      }),
      ...(pathname === "/payment-delivery"
        ? [
            buildFaqStructuredData([
              {
                question: "Какие способы получения доступны в ТЕХАКС?",
                answer:
                  "Интернет-магазин ТЕХАКС предлагает самовывоз и доставку. Конкретный сценарий зависит от товара, региона и наличия.",
              },
              {
                question: "От чего зависят способы оплаты и доставки?",
                answer:
                  "Итоговые варианты оплаты и получения зависят от выбранного товара, региона и статуса наличия. Они фиксируются в подтверждённом заказе.",
              },
            ]),
          ]
        : pathname === "/returns"
          ? [
              buildFaqStructuredData([
                {
                  question: "Как оформить возврат или обмен?",
                  answer:
                    "Для возврата или обмена нужно обратиться по контактам магазина и указать номер заказа, причину обращения и удобный способ связи.",
                },
                {
                  question: "Какие данные могут понадобиться для возврата?",
                  answer:
                    "Менеджер может запросить фотографии, описание состояния товара и сведения о комплектности перед принятием решения по возврату или обмену.",
                },
              ]),
            ]
          : []),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: title, url: `${SEO_HOST}${pathname}` },
      ],
      eyebrow: "Правовая информация",
      title,
      description,
      content: `<section class="seo-section"><h2>Основная информация</h2><p>${escapeHtml(
        truncateText(contents[pathname], 1800) || "Документ доступен на странице сайта."
      )}</p></section>`,
    }),
  });
}

function buildNoindexPageData(pathname: string, title: string, description: string) {
  return buildBasePageData(pathname, {
    title,
    description,
    canonicalUrl: `${SEO_HOST}${pathname}`,
    noindex: true,
  });
}

export async function buildSeoHeadData(url: URL): Promise<SeoHeadData> {
  const { pathname } = url;

  if (pathname === "/") return buildHomeSeoData();
  if (pathname === "/catalog") return buildCatalogSeoData(url);
  if (pathname.startsWith("/product/")) return buildProductSeoData(url);
  if (pathname === "/stores") return buildStoresSeoData();
  if (pathname === "/contacts") return buildContactsSeoData();
  if (pathname === "/about") return buildAboutSeoData();
  if (pathname.startsWith("/penza/")) return buildLocalLandingSeoData(url);
  if (pathname === "/promotions") return buildPromotionsSeoData();
  if (pathname.startsWith("/promotions/")) return buildPromotionDetailSeoData(url);
  if (pathname === "/blog") return buildBlogSeoData();
  if (pathname.startsWith("/blog/")) return buildBlogPostSeoData(url);
  if (["/offer", "/privacy-policy", "/payment-delivery", "/returns"].includes(pathname)) {
    return buildLegalSeoData(pathname);
  }
  if (pathname.startsWith("/admin")) {
    return buildNoindexPageData(pathname, "Админка ТЕХАКС", "Служебный раздел администрирования.");
  }
  if (["/checkout", "/account", "/login", "/search", "/payment/result"].includes(pathname)) {
    return buildNoindexPageData(pathname, DEFAULT_TITLE, DEFAULT_DESCRIPTION);
  }

  return buildBasePageData(pathname);
}

export async function renderSeoAwareIndex(html: string, requestUrl: string) {
  const meta = await buildSeoHeadData(new URL(requestUrl, SEO_HOST));
  return injectSeoHead(html, meta);
}
