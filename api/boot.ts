import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { serveStatic } from "@hono/node-server/serve-static";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { getAppSetting } from "./lib/app-settings";
import { processMoyskladWebhookQueue } from "./lib/moysklad-webhook-worker";
import { runMoyskladFullSyncWatchdog } from "./lib/moysklad-full-sync-watchdog";
import {
  getMoyskladOrderWebhookToken,
  ingestMoyskladOrderWebhook,
  processMoyskladOrderSyncJobs,
} from "./lib/moysklad-order-sync";
import { runMoyskladStockReconcile } from "./lib/moysklad-reconcile";
import { runScheduledFullSync } from "./routers/sync";
import { buildPublicProductVisibilityCondition } from "./lib/product-visibility";
import {
  processLoyaltySyncJobs,
  scheduleLoyaltyMaintenanceJobs,
} from "./lib/moysklad-loyalty";
import {
  getSyncRuntimeSettings,
  getSyncSchedulerSlot,
  setSyncSchedulerLastFullSyncKey,
} from "./lib/sync-runtime-settings";
import { handleYooKassaWebhook } from "./lib/yookassa";
import { buildVkFeed, buildYandexYmlFeed } from "./lib/feeds";
import { buildLocalLandingUrl, localSeoLandings } from "@contracts/local-seo-landings";
import { shouldIncludeCategoryListingInSitemap } from "./lib/listing-pages";

const app = new Hono<{ Bindings: HttpBindings }>();
const SEO_HOST = "https://techaks.ru";
const webhookRateState = new Map<string, { count: number; windowStart: number }>();
const WEBHOOK_RATE_LIMIT = 180;
const WEBHOOK_RATE_WINDOW_MS = 60_000;
const publicProductVisibilityCondition = buildPublicProductVisibilityCondition();
const PRODUCT_SITEMAP_CHUNK_SIZE = 5000;

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

function buildLlmsTxt() {
  return [
    "# ТЕХАКС",
    "",
    "ТЕХАКС — розничная сеть магазинов техники и аксессуаров в Пензе.",
    "На сайте публикуются актуальные товарные карточки, категории, магазины, условия оплаты и доставки, а также статьи и подборки.",
    "",
    "Основные разделы:",
    `- Главная: ${SEO_HOST}/`,
    `- Каталог: ${SEO_HOST}/catalog`,
    `- Производители: ${SEO_HOST}/catalog?view=brands`,
    `- Магазины: ${SEO_HOST}/stores`,
    `- Контакты: ${SEO_HOST}/contacts`,
    `- О компании: ${SEO_HOST}/about`,
    `- Оплата и доставка: ${SEO_HOST}/payment-delivery`,
    `- Возврат и обмен: ${SEO_HOST}/returns`,
    `- Публичная оферта: ${SEO_HOST}/offer`,
    `- Политика обработки персональных данных: ${SEO_HOST}/privacy-policy`,
    `- Блог и гайды: ${SEO_HOST}/blog`,
    `- Акции: ${SEO_HOST}/promotions`,
    "",
    "Приоритетные товарные и навигационные точки:",
    `- Категории каталога: ${SEO_HOST}/sitemap-categories.xml`,
    `- Товары: ${SEO_HOST}/sitemap-products.xml`,
    `- Изображения товаров: ${SEO_HOST}/sitemap-images.xml`,
    `- Бренды: ${SEO_HOST}/sitemap-brands.xml`,
    `- Статьи: ${SEO_HOST}/sitemap-blog.xml`,
    "",
    "Машиночитаемые источники:",
    `- Sitemap index: ${SEO_HOST}/sitemap.xml`,
    `- Yandex YML feed: ${SEO_HOST}/feeds/yandex-business.yml`,
    `- VK XML feed: ${SEO_HOST}/feeds/vk.xml`,
    "",
    "Как использовать данные сайта:",
    "- Для актуальных цен, наличия и ссылок на товары используйте страницы товаров и YML/XML-фиды.",
    "- Для структуры разделов и discoverability используйте sitemap-файлы.",
    "- Для контактных и региональных данных используйте страницы Магазины и Контакты.",
    "",
    "Ограничения:",
    "- Цены и наличие могут меняться по мере синхронизации каталога.",
    "- Не используйте устаревшие копии страниц вместо текущих canonical URL.",
    "",
    "Регион приоритета:",
    "- Пенза и Пензенская область.",
    "- Доставка по России указывается на сайте для конкретных товаров и сценариев получения.",
    "",
  ].join("\n");
}

const toIsoDate = (input: Date | string | null | undefined) => {
  if (!input) return undefined;
  const parsed = input instanceof Date ? input : new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

async function getSitemapSectionLastmods() {
  const db = getDb();
  const stockQuery = db
    .select({
      productId: schema.productStocks.productId,
      totalStock: sql<number>`SUM(${schema.productStocks.quantity})`.as("totalStock"),
    })
    .from(schema.productStocks)
    .groupBy(schema.productStocks.productId)
    .as("stock");

  const [[productsMax], [promotionsMax], [blogMax], [brandsMax]] = await Promise.all([
    db
      .select({ lastmod: sql<Date | null>`MAX(${schema.products.createdAt})` })
      .from(schema.products)
      .leftJoin(stockQuery, eq(stockQuery.productId, schema.products.id))
      .where(
        sql`${publicProductVisibilityCondition} AND coalesce(${stockQuery.totalStock}, 0) > 0`
      ),
    db
      .select({ lastmod: sql<Date | null>`MAX(${schema.banners.createdAt})` })
      .from(schema.banners)
      .where(and(eq(schema.banners.active, true), sql`${schema.banners.slug} <> ''`)),
    db
      .select({
        lastmod:
          sql<Date | null>`MAX(COALESCE(${schema.posts.updatedAt}, ${schema.posts.publishedAt}, ${schema.posts.createdAt}))`,
      })
      .from(schema.posts)
      .where(
        sql`(${schema.posts.status} = 'published' OR (${schema.posts.status} = 'scheduled' AND ${schema.posts.publishedAt} <= NOW()))`
      ),
    db
      .select({ lastmod: sql<Date | null>`MAX(${schema.manufacturers.updatedAt})` })
      .from(schema.manufacturers)
      .where(
        and(
          eq(schema.manufacturers.isVisible, true),
          sql`${schema.manufacturers.productCount} > 0`
        )
      ),
  ]);

  const products = toIsoDate(productsMax?.lastmod);
  const promotions = toIsoDate(promotionsMax?.lastmod);
  const blog = toIsoDate(blogMax?.lastmod);
  const brands = toIsoDate(brandsMax?.lastmod);
  const pages = blog || promotions || products;

  return {
    categories: products,
    brands,
    products,
    promotions,
    pages,
    blog,
    images: products,
  };
}

function getClientIp(c: { req: { header: (name: string) => string | undefined } }) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return c.req.header("x-real-ip") || "unknown";
}

function isWebhookRateLimited(ip: string) {
  const now = Date.now();
  const current = webhookRateState.get(ip);
  if (!current || now - current.windowStart >= WEBHOOK_RATE_WINDOW_MS) {
    webhookRateState.set(ip, { count: 1, windowStart: now });
    return false;
  }
  current.count += 1;
  webhookRateState.set(ip, current);
  return current.count > WEBHOOK_RATE_LIMIT;
}

async function logWebhookAudit(status: string, message: string, details?: Record<string, unknown>) {
  try {
    const db = getDb();
    await db.insert(schema.syncLogs).values({
      type: "moysklad_webhook",
      status,
      message,
      details: details ?? null,
    });
  } catch {
    // no-op
  }
}

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Serve uploaded images (persist across builds)
app.use(
  "/images/*",
  serveStatic({ root: "./public" })
);

app.get("/robots.txt", c => {
  const body = [
    "User-agent: *",
    "Disallow: /*sort=",
    "Disallow: /*layout=",
    "Disallow: /*show=",
    "Disallow: /*limit=",
    "Disallow: /*price=",
    "Disallow: /*color=",
    "Disallow: /*?utm_",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /account",
    "Disallow: /login",
    "Disallow: /search",
    "",
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&layout&sort&show&limit",
    `Sitemap: ${SEO_HOST}/sitemap.xml`,
    "",
  ].join("\n");
  return c.body(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get("/llms.txt", c => {
  return c.body(buildLlmsTxt(), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get("/yandex_0c5c892438bce9a8.html", c => {
  const body = `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: 0c5c892438bce9a8</body>
</html>`;
  return c.html(body);
});

app.get("/api/health", async c => {
  const startedAt = Date.now();

  try {
    const db = getDb();
    await db.execute(sql`select 1 as ok`);

    return c.json(
      {
        ok: true,
        status: "healthy",
        env: env.isProduction ? "production" : "development",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        checks: {
          app: "ok",
          db: "ok",
        },
        responseMs: Date.now() - startedAt,
      },
      200,
      {
        "Cache-Control": "no-store",
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Healthcheck failed";

    return c.json(
      {
        ok: false,
        status: "unhealthy",
        env: env.isProduction ? "production" : "development",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        checks: {
          app: "ok",
          db: "error",
        },
        responseMs: Date.now() - startedAt,
        error: message,
      },
      503,
      {
        "Cache-Control": "no-store",
      }
    );
  }
});

app.get("/sitemap.xml", async c => {
  const lastmods = await getSitemapSectionLastmods();
  const rows = [
    { path: "sitemap-categories.xml", lastmod: lastmods.categories },
    { path: "sitemap-brands.xml", lastmod: lastmods.brands },
    { path: "sitemap-products.xml", lastmod: lastmods.products },
    { path: "sitemap-promotions.xml", lastmod: lastmods.promotions },
    { path: "sitemap-pages.xml", lastmod: lastmods.pages },
    { path: "sitemap-blog.xml", lastmod: lastmods.blog },
    { path: "sitemap-images.xml", lastmod: lastmods.images },
  ]
    .map(
      item =>
        `  <sitemap><loc>${SEO_HOST}/${item.path}</loc>${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : ""}</sitemap>`
    )
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows}
</sitemapindex>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-pages.xml", async c => {
  const staticPages = [
    "/",
    "/catalog",
    "/catalog?view=brands",
    "/stores",
    "/contacts",
    "/about",
    "/promotions",
    "/blog",
    "/offer",
    "/privacy-policy",
    "/payment-delivery",
    "/returns",
    ...localSeoLandings.map(item => buildLocalLandingUrl(item.slug)),
  ];
  const lastmods = await getSitemapSectionLastmods();
  const rows = staticPages
    .map(
      path =>
        `<url><loc>${SEO_HOST}${path}</loc>${lastmods.pages ? `<lastmod>${lastmods.pages}</lastmod>` : ""}<changefreq>daily</changefreq><priority>${path === "/" ? "1.0" : "0.8"}</priority></url>`
    )
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-categories.xml", async c => {
  const db = getDb();
  const stockQuery = db
    .select({
      productId: schema.productStocks.productId,
      totalStock: sql<number>`SUM(${schema.productStocks.quantity})`.as("totalStock"),
    })
    .from(schema.productStocks)
    .groupBy(schema.productStocks.productId)
    .as("stock");

  const categories = await db
    .select({
      id: schema.categories.id,
      parentId: schema.categories.parentId,
      slug: schema.categories.slug,
    })
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id));

  const listingRows = await db
    .select()
    .from(schema.listingPages)
    .where(eq(schema.listingPages.type, "category"));
  const listingByCategoryId = new Map(
    listingRows.map(item => [item.categoryId, item] as const)
  );

  const visibleProductRows = await db
    .select({
      categoryId: schema.products.categoryId,
      count: sql<number>`count(*)`.as("count"),
      lastmod: sql<Date | null>`MAX(${schema.products.createdAt})`.as("lastmod"),
    })
    .from(schema.products)
    .leftJoin(stockQuery, eq(stockQuery.productId, schema.products.id))
    .where(
      sql`${publicProductVisibilityCondition} AND coalesce(${stockQuery.totalStock}, 0) > 0`
    )
    .groupBy(schema.products.categoryId);

  const visibleCounts = new Map<number, number>();
  const categoryLastmods = new Map<number, string>();
  for (const row of visibleProductRows) {
    visibleCounts.set(row.categoryId, Number(row.count));
    const lastmod = toIsoDate(row.lastmod);
    if (lastmod) {
      categoryLastmods.set(row.categoryId, lastmod);
    }
  }

  const categoriesById = new Map(categories.map(category => [category.id, category] as const));
  const eligibleCategoryIds = new Set<number>();
  const propagatedLastmods = new Map<number, string>();

  for (const [categoryId, count] of visibleCounts.entries()) {
    if (count <= 0) continue;
    let currentId: number | null | undefined = categoryId;
    const baseLastmod = categoryLastmods.get(categoryId);
    while (currentId) {
      eligibleCategoryIds.add(currentId);
      if (baseLastmod) {
        const currentLastmod = propagatedLastmods.get(currentId);
        if (!currentLastmod || baseLastmod > currentLastmod) {
          propagatedLastmods.set(currentId, baseLastmod);
        }
      }
      currentId = categoriesById.get(currentId)?.parentId;
    }
  }

  const rows = categories
    .filter(category => eligibleCategoryIds.has(category.id))
    .filter(category =>
      shouldIncludeCategoryListingInSitemap(listingByCategoryId.get(category.id))
    )
    .map(category => {
      const lastmod = propagatedLastmods.get(category.id);
      return `<url><loc>${SEO_HOST}/catalog?cat=${encodeURIComponent(category.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>daily</changefreq><priority>0.8</priority></url>`;
    })
    .join("");
  const filterRows = await db
    .select({
      url: schema.listingPages.url,
      updatedAt: schema.listingPages.updatedAt,
    })
    .from(schema.listingPages)
    .where(
      and(
        eq(schema.listingPages.type, "filter"),
        eq(schema.listingPages.isPublished, true),
        eq(schema.listingPages.indexationMode, "index")
      )
    );
  const filterUrls = filterRows
    .map(item => {
      const lastmod = toIsoDate(item.updatedAt);
      return `<url><loc>${SEO_HOST}${item.url}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>daily</changefreq><priority>0.7</priority></url>`;
    })
    .join("");
  const catalogLastmod = [...propagatedLastmods.values()].sort().at(-1);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SEO_HOST}/catalog</loc>${catalogLastmod ? `<lastmod>${catalogLastmod}</lastmod>` : ""}<changefreq>daily</changefreq><priority>0.9</priority></url>
  ${rows}${filterUrls}
</urlset>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-brands.xml", async c => {
  const db = getDb();
  const brands = await db
    .select({
      slug: schema.manufacturers.slug,
      updatedAt: schema.manufacturers.updatedAt,
    })
    .from(schema.manufacturers)
    .where(
      and(
        eq(schema.manufacturers.isVisible, true),
        sql`${schema.manufacturers.productCount} > 0`
      )
    )
    .orderBy(asc(schema.manufacturers.sortOrder), asc(schema.manufacturers.name));

  const rows = brands
    .map(brand => {
      const lastmod = toIsoDate(brand.updatedAt);
      return `<url><loc>${SEO_HOST}/catalog?view=brands&amp;brand=${encodeURIComponent(brand.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>daily</changefreq><priority>0.7</priority></url>`;
    })
    .join("");
  const brandsLastmod = brands
    .map(brand => toIsoDate(brand.updatedAt))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SEO_HOST}/catalog?view=brands</loc>${brandsLastmod ? `<lastmod>${brandsLastmod}</lastmod>` : ""}<changefreq>daily</changefreq><priority>0.8</priority></url>
  ${rows}
</urlset>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-products.xml", async c => {
  const db = getDb();
  const stockQuery = db
    .select({
      productId: schema.productStocks.productId,
      totalStock: sql<number>`SUM(${schema.productStocks.quantity})`.as(
        "totalStock"
      ),
    })
    .from(schema.productStocks)
    .groupBy(schema.productStocks.productId)
    .as("stock");

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.products)
    .leftJoin(stockQuery, eq(stockQuery.productId, schema.products.id))
    .where(
      sql`${publicProductVisibilityCondition} AND coalesce(${stockQuery.totalStock}, 0) > 0`
    );

  const [latestProductRow] = await db
    .select({ lastmod: sql<Date | null>`MAX(${schema.products.createdAt})` })
    .from(schema.products)
    .leftJoin(stockQuery, eq(stockQuery.productId, schema.products.id))
    .where(
      sql`${publicProductVisibilityCondition} AND coalesce(${stockQuery.totalStock}, 0) > 0`
    );

  const totalProducts = Number(countRow?.count ?? 0);
  const chunkCount = Math.max(1, Math.ceil(totalProducts / PRODUCT_SITEMAP_CHUNK_SIZE));
  const lastmod = toIsoDate(latestProductRow?.lastmod);
  const rows = Array.from({ length: chunkCount }, (_, index) => {
    const chunk = index + 1;
    return `<sitemap><loc>${SEO_HOST}/sitemap-products-${chunk}.xml</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`;
  }).join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</sitemapindex>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-products-*", async c => {
  const db = getDb();
  const stockQuery = db
    .select({
      productId: schema.productStocks.productId,
      totalStock: sql<number>`SUM(${schema.productStocks.quantity})`.as(
        "totalStock"
      ),
    })
    .from(schema.productStocks)
    .groupBy(schema.productStocks.productId)
    .as("stock");

  const chunkMatch = c.req.path.match(/^\/sitemap-products-(\d+)\.xml$/);
  if (!chunkMatch) {
    return c.notFound();
  }

  const chunk = Number(chunkMatch[1] || "1");
  const safeChunk = Number.isFinite(chunk) && chunk > 0 ? Math.floor(chunk) : 1;
  const offset = (safeChunk - 1) * PRODUCT_SITEMAP_CHUNK_SIZE;

  const products = await db
    .select({
      slug: schema.products.slug,
      updatedAt: schema.products.createdAt,
    })
    .from(schema.products)
    .leftJoin(stockQuery, eq(stockQuery.productId, schema.products.id))
    .where(
      sql`${publicProductVisibilityCondition} AND coalesce(${stockQuery.totalStock}, 0) > 0`
    )
    .orderBy(asc(schema.products.id))
    .limit(PRODUCT_SITEMAP_CHUNK_SIZE)
    .offset(offset);

  const rows = products
    .map(product => {
      const lastmod = toIsoDate(product.updatedAt);
      return `<url><loc>${SEO_HOST}/product/${encodeURIComponent(product.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>daily</changefreq><priority>0.7</priority></url>`;
    })
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-promotions.xml", async c => {
  const db = getDb();
  const promos = await db
    .select({
      slug: schema.banners.slug,
      createdAt: schema.banners.createdAt,
    })
    .from(schema.banners)
    .where(and(eq(schema.banners.active, true), sql`${schema.banners.slug} <> ''`))
    .orderBy(asc(schema.banners.sortOrder), asc(schema.banners.id));

  const rows = promos
    .map(promo => {
      const lastmod = toIsoDate(promo.createdAt);
      return `<url><loc>${SEO_HOST}/promotions/${encodeURIComponent(promo.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.6</priority></url>`;
    })
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SEO_HOST}/promotions</loc><changefreq>daily</changefreq><priority>0.7</priority></url>
  ${rows}
</urlset>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-images.xml", async c => {
  const db = getDb();
  const products = await db
    .select({
      slug: schema.products.slug,
      name: schema.products.name,
      image: schema.products.image,
    })
    .from(schema.products)
    .where(
      sql`${publicProductVisibilityCondition} AND ${schema.products.image} IS NOT NULL`
    );

  const rows = products
    .map(product => {
      const imageUrl = product.image.startsWith("http")
        ? product.image
        : `${SEO_HOST}${product.image}`;
      return `<url><loc>${SEO_HOST}/product/${encodeURIComponent(product.slug)}</loc><image:image xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><image:loc>${xmlEscape(imageUrl)}</image:loc><image:title>${xmlEscape(product.name)}</image:title></image:image></url>`;
    })
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-blog.xml", async c => {
  const db = getDb();
  const posts = await db
    .select({
      slug: schema.posts.slug,
      updatedAt: schema.posts.updatedAt,
      publishedAt: schema.posts.publishedAt,
      createdAt: schema.posts.createdAt,
    })
    .from(schema.posts)
    .where(
      sql`(${schema.posts.status} = 'published' OR (${schema.posts.status} = 'scheduled' AND ${schema.posts.publishedAt} <= NOW()))`
    )
    .orderBy(asc(schema.posts.createdAt));

  const rows = posts
    .map(post => {
      const lastmod = toIsoDate(post.updatedAt ?? post.publishedAt ?? post.createdAt);
      return `<url><loc>${SEO_HOST}/blog/${encodeURIComponent(post.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    })
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/feeds/yandex-business.yml", async c => {
  try {
    const { xml } = await buildYandexYmlFeed();
    return c.body(xml, 200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Yandex YML feed disabled") {
      return c.text("Feed disabled", 404);
    }

    console.error("Yandex YML feed generation error:", error);
    return c.text("Feed generation failed", 500);
  }
});

app.get("/feeds/vk.xml", async c => {
  try {
    const { xml } = await buildVkFeed();
    return c.body(xml, 200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VK feed disabled") {
      return c.text("Feed disabled", 404);
    }

    console.error("VK feed generation error:", error);
    return c.text("Feed generation failed", 500);
  }
});

// File Upload Endpoint
app.post("/api/upload", async c => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"] as File | string | undefined;

    if (!file || typeof file === "string") {
      return c.json({ error: "No file uploaded" }, 400);
    }

    // Access properties safely for TS
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = String(file.name || "unnamed-file").replace(/\s+/g, "-");

    // Create unique filename
    const filename = `${Date.now()}-${fileName}`;

    // Determine public path
    const publicPath = join(process.cwd(), "public", "images");

    const filePath = join(publicPath, filename);

    // Ensure directory exists
    await mkdir(publicPath, { recursive: true });

    // Write file
    await writeFile(filePath, buffer);

    return c.json({
      url: `/images/${filename}`,
      success: true,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/webhooks/moysklad", async c => {
  try {
    const ip = getClientIp(c);
    if (isWebhookRateLimited(ip)) {
      await logWebhookAudit("error", "Webhook rate limit exceeded", { ip });
      return c.json({ ok: false, error: "Rate limit exceeded" }, 429);
    }

    const db = getDb();
    const payload = await c.req.json().catch(() => null);
    if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) {
      return c.json({ ok: false, error: "Invalid payload" }, 400);
    }

    const configuredSecret = (await getAppSetting("moysklad_webhook_secret"))?.trim();
    if (!configuredSecret && env.isProduction) {
      await logWebhookAudit("error", "Webhook rejected: secret is not configured", { ip });
      return c.json({ ok: false, error: "Webhook secret is not configured" }, 503);
    }
    if (configuredSecret) {
      const incomingSecret =
        c.req.header("x-webhook-secret") ??
        c.req.header("x-moysklad-secret") ??
        c.req.query("secret");
      if (!incomingSecret || incomingSecret !== configuredSecret) {
        await logWebhookAudit("error", "Webhook unauthorized", { ip });
        return c.json({ ok: false, error: "Unauthorized webhook" }, 401);
      }
    }

    const now = Date.now();
    const events: unknown[] =
      Array.isArray(payload)
        ? payload
        : Array.isArray((payload as Record<string, unknown>).events)
          ? ((payload as Record<string, unknown>).events as unknown[])
          : Array.isArray((payload as Record<string, unknown>).rows)
            ? ((payload as Record<string, unknown>).rows as unknown[])
            : [payload];

    let inserted = 0;
    let duplicates = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventObj =
        event && typeof event === "object" ? (event as Record<string, unknown>) : {};

      const meta = (eventObj.meta ?? null) as Record<string, unknown> | null;
      const sourceId =
        (typeof eventObj.id === "string" ? eventObj.id : null) ??
        (typeof meta?.href === "string" ? meta.href : null);
      const marker =
        (typeof eventObj.updated === "string" ? eventObj.updated : null) ??
        (typeof eventObj.moment === "string" ? eventObj.moment : null) ??
        `${now}-${i}`;

      const eventType =
        (typeof eventObj.type === "string" && eventObj.type) ||
        (typeof eventObj.event === "string" && eventObj.event) ||
        (typeof meta?.type === "string" && meta.type) ||
        "unknown";

      const fallbackHash = createHash("sha256")
        .update(JSON.stringify(event))
        .digest("hex")
        .slice(0, 32);

      const eventKey = sourceId ? `${sourceId}:${marker}` : `${eventType}:${fallbackHash}`;

      const result = await db
        .insert(schema.webhookEvents)
        .values({
          provider: "moysklad",
          eventType,
          eventKey,
          payloadJson: event,
          status: "new",
          attempts: 0,
        })
        .onDuplicateKeyUpdate({
          set: {
            eventType,
          },
        });

      const insertId = (result as { insertId?: number } | undefined)?.insertId ?? 0;
      if (insertId > 0) {
        inserted += 1;
      } else {
        duplicates += 1;
      }
    }

    return c.json({
      ok: true,
      received: events.length,
      inserted,
      duplicates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook ingest failed";
    await logWebhookAudit("error", `Webhook ingest failed: ${message}`);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/api/webhooks/moysklad/process", async c => {
  try {
    const ip = getClientIp(c);
    if (isWebhookRateLimited(ip)) {
      await logWebhookAudit("error", "Manual queue process rate limit exceeded", { ip });
      return c.json({ ok: false, error: "Rate limit exceeded" }, 429);
    }
    const secret = (await getAppSetting("moysklad_webhook_secret"))?.trim();
    if (!secret && env.isProduction) {
      return c.json({ ok: false, error: "Webhook secret is not configured" }, 503);
    }
    if (secret) {
      const incomingSecret =
        c.req.header("x-webhook-secret") ??
        c.req.header("x-moysklad-secret") ??
        c.req.query("secret");
      if (!incomingSecret || incomingSecret !== secret) {
        return c.json({ ok: false, error: "Unauthorized" }, 401);
      }
    }

    const result = await processMoyskladWebhookQueue(100);
    return c.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Queue process failed";
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/api/sync/moysklad/reconcile", async c => {
  try {
    const ip = getClientIp(c);
    if (isWebhookRateLimited(ip)) {
      await logWebhookAudit("error", "Manual reconcile rate limit exceeded", { ip });
      return c.json({ ok: false, error: "Rate limit exceeded" }, 429);
    }
    const secret = (await getAppSetting("moysklad_webhook_secret"))?.trim();
    if (!secret && env.isProduction) {
      return c.json({ ok: false, error: "Webhook secret is not configured" }, 503);
    }
    if (secret) {
      const incomingSecret =
        c.req.header("x-webhook-secret") ??
        c.req.header("x-moysklad-secret") ??
        c.req.query("secret");
      if (!incomingSecret || incomingSecret !== secret) {
        return c.json({ ok: false, error: "Unauthorized" }, 401);
      }
    }

    const result = await runMoyskladStockReconcile();
    return c.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconcile failed";
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/api/moysklad/webhook/orders", async c => {
  try {
    const configuredToken = await getMoyskladOrderWebhookToken();
    if (!configuredToken) {
      return c.body(null, 204);
    }

    const providedToken =
      c.req.query("token")?.trim() ||
      c.req.query("secret")?.trim() ||
      c.req.header("x-webhook-secret")?.trim() ||
      c.req.header("x-moysklad-secret")?.trim() ||
      "";
    if (!providedToken || providedToken !== configuredToken) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }

    const requestId =
      c.req.query("requestId")?.trim() ||
      c.req.query("request_id")?.trim() ||
      c.req.header("x-request-id")?.trim() ||
      c.req.header("x-lognex-requestid")?.trim() ||
      "";

    if (!requestId) {
      return c.json({ ok: false, error: "requestId is required" }, 400);
    }

    const payload = await c.req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return c.json({ ok: false, error: "Invalid payload" }, 400);
    }

    await ingestMoyskladOrderWebhook(requestId, payload);
    return c.body(null, 204);
  } catch (error) {
    console.error("[moysklad-order-webhook] ingest failed:", error);
    return c.body(null, 204);
  }
});

app.post("/api/yookassa/webhook", async c => {
  try {
    const payload = await c.req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return c.json({ ok: false, error: "Invalid payload" }, 400);
    }

    const result = await handleYooKassaWebhook(payload as any);
    return c.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "YooKassa webhook failed";
    try {
      await getDb().insert(schema.syncLogs).values({
        type: "yookassa",
        status: "error",
        message: `YooKassa webhook failed: ${message}`,
      });
    } catch {
      // no-op
    }
    return c.json({ ok: false, error: message }, 500);
  }
});

app.use("/api/trpc/*", async c => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");

  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  setInterval(() => {
    processMoyskladWebhookQueue(50).catch(error => {
      console.error("[webhook-worker] queue cycle failed:", error);
    });
  }, 60_000);

  setInterval(() => {
    processMoyskladOrderSyncJobs(3).catch(error => {
      console.error("[moysklad-order-sync] queue cycle failed:", error);
    });
  }, 15_000);

  setInterval(() => {
    processLoyaltySyncJobs(6).catch(error => {
      console.error("[loyalty-sync] queue cycle failed:", error);
    });
  }, 60_000);

  setInterval(() => {
    scheduleLoyaltyMaintenanceJobs(20).catch(error => {
      console.error("[loyalty-maintenance] schedule cycle failed:", error);
    });
  }, 5 * 60_000);

  setInterval(() => {
    runMoyskladStockReconcile().catch(error => {
      console.error("[reconcile-worker] stock reconcile failed:", error);
    });
  }, 30 * 60_000);

  setInterval(() => {
    runMoyskladFullSyncWatchdog().catch(error => {
      console.error("[full-sync-watchdog] cycle failed:", error);
    });
  }, 60_000);

  setInterval(() => {
    void (async () => {
      try {
        const runtimeSettings = await getSyncRuntimeSettings();
        if (!runtimeSettings.fullSyncEnabled) return;

        const slot = getSyncSchedulerSlot(
          new Date(),
          runtimeSettings.fullSyncTime,
          runtimeSettings.fullSyncTimezone
        );

        if (!slot.matches) return;
        if (runtimeSettings.schedulerLastFullSyncKey === slot.slotKey) return;

        await setSyncSchedulerLastFullSyncKey(slot.slotKey);

        runScheduledFullSync().catch(error => {
          console.error(
            `[nightly-full-sync] failed for slot ${slot.slotKey} (${slot.timeZone}):`,
            error
          );
        });
      } catch (error) {
        console.error("[nightly-full-sync] scheduler cycle failed:", error);
      }
    })();
  }, 60_000);
}
