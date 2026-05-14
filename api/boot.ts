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
import { serveStatic } from "@hono/node-server/serve-static";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { asc, eq, sql } from "drizzle-orm";

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
    const file = body["file"] as any;

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
  } catch (error: any) {
    console.error("Upload error:", error);
    return c.json({ error: error.message || "Failed to upload file" }, 500);
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
}
