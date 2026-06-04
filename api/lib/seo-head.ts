import { and, asc, desc, eq, sql } from "drizzle-orm";

import * as schema from "@db/schema";

import { getDb } from "../queries/connection";
import { buildPublicProductVisibilityCondition } from "./product-visibility";
import { getPublicSiteProfile } from "./site-profile-settings";
import { getManufacturerNameFromProductSpecs } from "./manufacturers";

const SEO_HOST = "https://techaks.ru";
const SITE_NAME = "ТЕХАКС";
const DEFAULT_TITLE = "ТЕХАКС — техника и аксессуары в Пензе";
const DEFAULT_DESCRIPTION =
  "Техника и аксессуары: смартфоны, наушники, зарядные устройства, кабели, чехлы и гаджеты. Актуальные цены, наличие и доставка.";
const DEFAULT_IMAGE = `${SEO_HOST}/images/logo-light.svg`;
const publicProductVisibilityCondition = buildPublicProductVisibilityCondition();

type SeoHeadData = {
  title: string;
  description: string;
  canonicalUrl: string;
  noindex?: boolean;
  image?: string | null;
  type?: "website" | "article";
  structuredData?: unknown[] | null;
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
    address: input.address
      ? {
          "@type": "PostalAddress",
          streetAddress: input.address,
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
          addressCountry: "RU",
        }
      : undefined,
    openingHours: store.hours || undefined,
  };
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
    ...overrides,
  };
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

  return cleaned.replace("</head>", `${buildServerSeoHeadTags(meta)}\n</head>`);
}

async function buildHomeSeoData() {
  const profile = await getPublicSiteProfile();
  return buildBasePageData("/", {
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: SEO_HOST,
        potentialAction: {
          "@type": "SearchAction",
          target: `${SEO_HOST}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      buildOrganizationStructuredData({
        email: profile.contacts.email,
        phone: profile.contacts.primaryPhoneDisplay,
        address: profile.contacts.fullAddress || profile.seller.legalAddress,
      }),
      buildBreadcrumbStructuredData([{ name: "Главная", url: SEO_HOST }]),
    ],
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
      return buildBasePageData("/catalog?view=brands", {
        title: "Производители — каталог брендов ТЕХАКС",
        description:
          "Производители техники и аксессуаров в каталоге ТЕХАКС. Бренды с товарами в наличии, самовывозом и доставкой.",
        canonicalUrl: `${SEO_HOST}/catalog?view=brands`,
        noindex: hasFilters || hasLayout || hasSort || forceProductsView,
        structuredData: [
          buildBreadcrumbStructuredData([
            { name: "Главная", url: SEO_HOST },
            { name: "Каталог", url: `${SEO_HOST}/catalog` },
            { name: "Производители", url: `${SEO_HOST}/catalog?view=brands` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Производители ТЕХАКС",
            description:
              "Производители техники и аксессуаров в каталоге ТЕХАКС. Бренды с товарами в наличии, самовывозом и доставкой.",
            url: `${SEO_HOST}/catalog?view=brands`,
          },
        ],
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

    return buildBasePageData(`/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`, {
      title: `${manufacturer.name} — товары бренда в ТЕХАКС`,
      description: `Товары бренда ${manufacturer.name} в интернет-магазине ТЕХАКС: актуальные цены, наличие, самовывоз и доставка по Пензе и России.`,
      canonicalUrl: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`,
      noindex: hasFilters || hasLayout || hasSort || forceProductsView,
      image: manufacturer.logoUrl || DEFAULT_IMAGE,
      structuredData: [
        buildBreadcrumbStructuredData([
          { name: "Главная", url: SEO_HOST },
          { name: "Каталог", url: `${SEO_HOST}/catalog` },
          { name: "Производители", url: `${SEO_HOST}/catalog?view=brands` },
          {
            name: manufacturer.name,
            url: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`,
          },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Товары бренда ${manufacturer.name}`,
          description: `Товары бренда ${manufacturer.name} в интернет-магазине ТЕХАКС: актуальные цены, наличие, самовывоз и доставка по Пензе и России.`,
          url: `${SEO_HOST}/catalog?view=brands&brand=${encodeURIComponent(activeBrand)}`,
        },
      ],
    });
  }

  if (!activeCategory || activeCategory === "all") {
    return buildBasePageData("/catalog", {
      title: "Каталог товаров ТЕХАКС — техника и аксессуары",
      description:
        "Каталог товаров ТЕХАКС: смартфоны, гаджеты, аксессуары, бытовая техника, самовывоз и доставка по Пензе и России.",
      canonicalUrl: `${SEO_HOST}/catalog`,
      noindex: hasFilters || hasLayout || hasSort || forceProductsView,
      structuredData: [
        buildBreadcrumbStructuredData([
          { name: "Главная", url: SEO_HOST },
          { name: "Каталог", url: `${SEO_HOST}/catalog` },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Каталог товаров ТЕХАКС",
          description:
            "Каталог товаров ТЕХАКС: смартфоны, гаджеты, аксессуары, бытовая техника, самовывоз и доставка по Пензе и России.",
          url: `${SEO_HOST}/catalog`,
        },
      ],
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
      name: item.name,
      url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(item.slug)}`,
    });
  }

  const description = normalizeDescription(
    currentCategory.metaDescription || currentCategory.description,
    `${currentCategory.name} в интернет-магазине ТЕХАКС: цены, наличие, самовывоз и доставка по Пензе и России.`
  );
  const title =
    currentCategory.metaTitle?.trim() || `${currentCategory.name} — купить в ТЕХАКС`;

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
        name: currentCategory.name,
        description,
        url: `${SEO_HOST}/catalog?cat=${encodeURIComponent(activeCategory)}`,
      },
    ],
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
    `${product.name}: цена, характеристики, фото, наличие и доставка. Купить в интернет-магазине ТЕХАКС.`
  );

  const image = product.image || DEFAULT_IMAGE;

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
        image: [toAbsoluteUrl(image)],
        description,
        sku: product.article || product.slug.toUpperCase(),
        gtin13: product.barcode || undefined,
        brand: {
          "@type": "Brand",
          name: manufacturerName,
        },
        offers: {
          "@type": "Offer",
          url: `${SEO_HOST}/product/${encodeURIComponent(product.slug)}`,
          priceCurrency: "RUB",
          price: String(product.price),
          availability: "https://schema.org/InStock",
        },
      },
    ],
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
