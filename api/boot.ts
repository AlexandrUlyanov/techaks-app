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
import { asc, eq, sql } from "drizzle-orm";
import { getAppSetting } from "./lib/app-settings";
import { processMoyskladWebhookQueue } from "./lib/moysklad-webhook-worker";
import { runMoyskladStockReconcile } from "./lib/moysklad-reconcile";

const app = new Hono<{ Bindings: HttpBindings }>();
const SEO_HOST = "https://techaks.ru";

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toIsoDate = (input: Date | string | null | undefined) => {
  if (!input) return undefined;
  const parsed = input instanceof Date ? input : new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Serve uploaded images (persist across builds)
app.use(
  "/images/*",
  serveStatic({ root: "./public" })
);

app.get("/robots.txt", c => {
  const body = [
    "User-agent: *",
    "Disallow: /*?sort=",
    "Disallow: /*?view=",
    "Disallow: /*?limit=",
    "Disallow: /*?price=",
    "Disallow: /*?color=",
    "Disallow: /*?utm_",
    "Disallow: /cart/",
    "Disallow: /checkout/",
    "Disallow: /account/",
    "Disallow: /login/",
    "Disallow: /search/",
    "",
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid",
    `Sitemap: ${SEO_HOST}/sitemap.xml`,
    "",
  ].join("\n");
  return c.body(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

app.get("/sitemap.xml", c => {
  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SEO_HOST}/sitemap-categories.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SEO_HOST}/sitemap-products-1.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SEO_HOST}/sitemap-pages.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SEO_HOST}/sitemap-images.xml</loc><lastmod>${now}</lastmod></sitemap>
</sitemapindex>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-pages.xml", c => {
  const staticPages = ["/", "/catalog", "/stores", "/contacts", "/promotions", "/blog"];
  const rows = staticPages
    .map(path => `<url><loc>${SEO_HOST}${path}</loc><changefreq>daily</changefreq><priority>${path === "/" ? "1.0" : "0.8"}</priority></url>`)
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
  const categories = await db
    .select({
      slug: schema.categories.slug,
    })
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.id));

  const rows = categories
    .map(category => `<url><loc>${SEO_HOST}/catalog?cat=${encodeURIComponent(category.slug)}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`)
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SEO_HOST}/catalog</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  ${rows}
</urlset>`;
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=1800",
  });
});

app.get("/sitemap-products-1.xml", async c => {
  const db = getDb();
  const stockQuery = db
    .select({
      productId: schema.productStocks.productId,
      totalStock: sql<number>`SUM(${schema.productStocks.quantity})`,
    })
    .from(schema.productStocks)
    .groupBy(schema.productStocks.productId)
    .as("stock");

  const products = await db
    .select({
      slug: schema.products.slug,
      updatedAt: schema.products.createdAt,
    })
    .from(schema.products)
    .leftJoin(stockQuery, eq(stockQuery.productId, schema.products.id))
    .where(sql`${schema.products.price} > 0 AND coalesce(${stockQuery.totalStock}, 0) > 0`);

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

app.get("/sitemap-images.xml", async c => {
  const db = getDb();
  const products = await db
    .select({
      slug: schema.products.slug,
      name: schema.products.name,
      image: schema.products.image,
    })
    .from(schema.products)
    .where(sql`${schema.products.price} > 0 AND ${schema.products.image} IS NOT NULL`);

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
    const db = getDb();
    const payload = await c.req.json().catch(() => null);
    if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) {
      return c.json({ ok: false, error: "Invalid payload" }, 400);
    }

    const configuredSecret = (await getAppSetting("moysklad_webhook_secret"))?.trim();
    if (configuredSecret) {
      const incomingSecret =
        c.req.header("x-webhook-secret") ??
        c.req.header("x-moysklad-secret") ??
        c.req.query("secret");
      if (!incomingSecret || incomingSecret !== configuredSecret) {
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

      if ((result as { insertId?: number }).insertId && (result as { insertId?: number }).insertId > 0) {
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
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/api/webhooks/moysklad/process", async c => {
  try {
    const secret = (await getAppSetting("moysklad_webhook_secret"))?.trim();
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
    const secret = (await getAppSetting("moysklad_webhook_secret"))?.trim();
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
    runMoyskladStockReconcile().catch(error => {
      console.error("[reconcile-worker] stock reconcile failed:", error);
    });
  }, 30 * 60_000);
}
