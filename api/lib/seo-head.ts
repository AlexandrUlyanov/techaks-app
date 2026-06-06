import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import * as schema from "@db/schema";
import { normalizeProductImageVariantSet } from "@contracts/product-images";

import { getDb } from "../queries/connection";
import { buildPublicProductVisibilityCondition } from "./product-visibility";
import { getPublicSiteProfile } from "./site-profile-settings";
import { getManufacturerNameFromProductSpecs } from "./manufacturers";

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

function toSeoReadableName(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return "";
  const hasLetters = /[A-Za-zА-Яа-яЁё]/.test(normalized);
  if (!hasLetters) return normalized;
  if (normalized !== normalized.toUpperCase()) return normalized;
  const lower = normalized.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function stripHtml(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
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
    .map(item => `<script id="__seo-ldjson" type="application/ld+json">${JSON.stringify(item)}</script>`)
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
    .replace(/<script id="__seo-ldjson"[\s\S]*?<\/script>\s*/gi, "");

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
    structuredData: [
      buildWebsiteStructuredData(),
      buildOrganizationStructuredData({
        email: profile.contacts.email,
        phone: profile.contacts.primaryPhoneDisplay,
        address: profile.contacts.fullAddress || profile.seller.legalAddress,
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
  const hasFilters = searchParams.getAll("filter").length > 0;
  const hasLayout = (searchParams.get("layout") || "grid") !== "grid";
  const hasSort = (searchParams.get("sort") || "default") !== "default";
  const forceProductsView = searchParams.get("show") === "products";

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
        title: "Производители — каталог брендов ТЕХАКС",
        description:
          "Производители техники и аксессуаров в каталоге ТЕХАКС. Бренды с товарами в наличии, самовывозом и доставкой.",
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

    const description = normalizeDescription(
      manufacturer.metaDescription || manufacturer.description,
      `Товары бренда ${manufacturer.name} в интернет-магазине ТЕХАКС: актуальные цены, наличие, самовывоз и доставка по Пензе и России.`
    );
    const title =
      manufacturer.metaTitle?.trim() || `${manufacturer.name} — товары бренда в ТЕХАКС`;
    const breadcrumbs = [
      { name: "Главная", url: SEO_HOST },
      { name: "Каталог", url: `${SEO_HOST}/catalog` },
      { name: "Производители", url: `${SEO_HOST}/catalog?view=brands` },
      {
        name: manufacturer.name,
        url: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`,
      },
    ];

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
          ]),
          manufacturer.description?.trim()
            ? `<section class="seo-section"><h2>О бренде</h2><p>${escapeHtml(
                truncateText(manufacturer.description, 800)
              )}</p></section>`
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
      title: "Каталог товаров ТЕХАКС — техника и аксессуары",
      description:
        "Каталог товаров ТЕХАКС: смартфоны, гаджеты, аксессуары, бытовая техника, самовывоз и доставка по Пензе и России.",
      canonicalUrl: `${SEO_HOST}/catalog`,
      noindex: hasFilters || hasLayout || hasSort || forceProductsView,
      structuredData: [
        buildBreadcrumbStructuredData(breadcrumbs),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Каталог товаров ТЕХАКС",
          description:
            "Каталог товаров ТЕХАКС: смартфоны, гаджеты, аксессуары, бытовая техника, самовывоз и доставка по Пензе и России.",
          url: `${SEO_HOST}/catalog`,
        },
      ],
      bodyHtml: renderSeoBodyShell({
        breadcrumbs,
        eyebrow: "Каталог",
        title: "Каталог товаров ТЕХАКС",
        description:
          "Смартфоны, аксессуары, гаджеты, техника для дома и полезная электроника с самовывозом в Пензе и доставкой по России.",
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
  const description = normalizeDescription(
    currentCategory.metaDescription || currentCategory.description,
    `${readableCategoryName} в интернет-магазине ТЕХАКС: цены, наличие, самовывоз и доставка по Пензе и России.`
  );
  const title =
    currentCategory.metaTitle?.trim() || `${readableCategoryName} — купить в ТЕХАКС`;
  const childCategories = categoryRows
    .filter(category => category.parentId === currentCategory.id)
    .slice(0, 16);
  const content = [
    childCategories.length > 0
      ? renderCardList(
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
        )
      : "",
    `<section class="seo-section"><h2>Покупка и получение</h2><p>В разделе доступны актуальные цены, наличие по магазинам ТЕХАКС, самовывоз в Пензе и доставка по России.</p></section>`,
  ].join("");

  return buildBasePageData(`/catalog?cat=${encodeURIComponent(activeCategory)}`, {
    title,
    description,
    canonicalUrl: `${SEO_HOST}/catalog?cat=${encodeURIComponent(activeCategory)}`,
    noindex: hasFilters || hasLayout || hasSort || forceProductsView,
    structuredData: [
      buildBreadcrumbStructuredData(breadcrumbItems),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: readableCategoryName,
        description,
        url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(activeCategory)}`,
      },
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: breadcrumbItems,
      eyebrow: "Категория",
      title: readableCategoryName,
      description,
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
      name: item.name,
      url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(item.slug)}`,
    });
  }
  breadcrumbItems.push({
    name: product.name,
    url: `${SEO_HOST}/product/${encodeURIComponent(product.slug)}`,
  });

  const manufacturerName = getManufacturerNameFromProductSpecs(product.specs) || SITE_NAME;
  const description = normalizeDescription(
    product.description,
    `${product.name}: цена, характеристики, фото, наличие, самовывоз в Пензе и доставка по России. Купить в интернет-магазине ТЕХАКС.`
  );

  const image = product.image || DEFAULT_IMAGE;
  const imageUrls = collectProductImageUrls(
    product.image,
    product.imageVariants,
    product.images
  );
  const specsEntries = Object.entries(
    product.specs && typeof product.specs === "object" && !Array.isArray(product.specs)
      ? (product.specs as Record<string, unknown>)
      : {}
  )
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

  return buildBasePageData(`/product/${encodeURIComponent(product.slug)}`, {
    title: `${product.name} — купить в ТЕХАКС`,
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
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: breadcrumbItems,
      eyebrow: "Карточка товара",
      title: product.name,
      description,
      content: [
        renderFacts([
          { label: "Цена", value: `${new Intl.NumberFormat("ru-RU").format(product.price)} ₽` },
          { label: "Бренд", value: manufacturerName },
          { label: "Артикул", value: product.article || "Уточняется" },
          {
            label: "Категория",
            value: product.categoryName || "Каталог ТЕХАКС",
          },
        ]),
        specsEntries.length > 0
          ? `<section class="seo-section"><h2>Основные характеристики</h2>${renderFacts(
              specsEntries
            )}</section>`
          : "",
        storeAvailability.length > 0
          ? renderCardList(
              storeAvailability.map(store => ({
                title: store.name,
                text: `${store.address}. В наличии: ${store.qty} шт.`,
                links: [{ href: `${SEO_HOST}/stores`, label: "Все магазины ТЕХАКС" }],
              }))
            )
          : `<section class="seo-section"><h2>Получение</h2><p>Проверьте наличие в магазинах ТЕХАКС или оформите доставку по России.</p></section>`,
      ].join(""),
    }),
  });
}

async function buildStoresSeoData() {
  const [profile, stores] = await Promise.all([
    getPublicSiteProfile(),
    getDb().select().from(schema.stores).orderBy(asc(schema.stores.sortOrder)),
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
        address: profile.contacts.fullAddress || profile.seller.legalAddress,
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
    getDb().select().from(schema.stores).orderBy(asc(schema.stores.sortOrder)),
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
        address: profile.contacts.fullAddress || profile.seller.legalAddress,
      }),
      ...stores.map(store => buildStoreStructuredData(store)),
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
          { label: "Адрес", value: profile.contacts.fullAddress || "" },
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
    getDb().select().from(schema.stores).orderBy(asc(schema.stores.sortOrder)),
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
        address: profile.contacts.fullAddress || profile.seller.legalAddress,
      }),
      ...stores.map(store => buildStoreStructuredData(store)),
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
      content: renderCardList(
        posts.map(post => ({
          title: post.title,
          links: [
            { href: `${SEO_HOST}/blog/${encodeURIComponent(post.slug)}`, label: "Читать статью" },
          ],
        }))
      ),
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
      content: `<section class="seo-section"><h2>Кратко о материале</h2><p>${escapeHtml(
        truncateText(post.excerpt || post.content, 1400) || "Материал доступен на странице статьи."
      )}</p></section>`,
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
  const contents: Record<string, string> = {
    "/offer": profile.legalTexts.offerContent,
    "/privacy-policy": profile.legalTexts.privacyPolicyContent,
    "/payment-delivery": profile.legalTexts.paymentDeliveryContent,
    "/returns": profile.legalTexts.returnsPolicyContent,
  };

  return buildBasePageData(pathname, {
    title: `${title} — ТЕХАКС`,
    description: `${title} интернет-магазина ТЕХАКС.`,
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: SEO_HOST },
        { name: title, url: `${SEO_HOST}${pathname}` },
      ]),
      buildOrganizationStructuredData({
        email: profile.contacts.email,
        phone: profile.contacts.primaryPhoneDisplay,
        address: profile.seller.legalAddress,
      }),
    ],
    bodyHtml: renderSeoBodyShell({
      breadcrumbs: [
        { name: "Главная", url: SEO_HOST },
        { name: title, url: `${SEO_HOST}${pathname}` },
      ],
      eyebrow: "Правовая информация",
      title,
      description: `${title} интернет-магазина ТЕХАКС.`,
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
