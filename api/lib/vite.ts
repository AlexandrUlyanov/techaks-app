import type { Context, Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { renderSeoAwareIndex } from "./seo-head";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { eq } from "drizzle-orm";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");
  const sendIndex = async (c: Context) => {
    const requestUrl = new URL(c.req.url);
    if (requestUrl.pathname.startsWith("/product/")) {
      const slug = decodeURIComponent(
        requestUrl.pathname.replace(/^\/product\//, "").trim()
      );

      if (slug) {
        const db = getDb();
        const [hiddenProduct] = await db
          .select({
            slug: schema.products.slug,
            isActive: schema.products.isActive,
            categorySlug: schema.categories.slug,
          })
          .from(schema.products)
          .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
          .where(eq(schema.products.slug, slug))
          .limit(1);

        if (hiddenProduct && hiddenProduct.isActive === false) {
          const destination = hiddenProduct.categorySlug
            ? `/catalog?cat=${encodeURIComponent(hiddenProduct.categorySlug)}`
            : "/catalog";
          return c.redirect(destination, 301);
        }
      }
    }

    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    const html = await renderSeoAwareIndex(content, c.req.url);
    return c.html(html);
  };

  app.get("/", sendIndex);
  app.get("/admin/*", sendIndex);
  app.get("/catalog", sendIndex);
  app.get("/product/*", sendIndex);
  app.get("/stores", sendIndex);
  app.get("/contacts", sendIndex);
  app.get("/about", sendIndex);
  app.get("/offer", sendIndex);
  app.get("/privacy-policy", sendIndex);
  app.get("/payment-delivery", sendIndex);
  app.get("/returns", sendIndex);
  app.get("/promotions", sendIndex);
  app.get("/promotions/*", sendIndex);
  app.get("/blog", sendIndex);
  app.get("/blog/*", sendIndex);
  app.get("/checkout", sendIndex);
  app.get("/payment/result", sendIndex);
  app.get("/account", sendIndex);
  app.get("/login", sendIndex);
  app.get("/search", sendIndex);

  app.use("/images/*", serveStatic({ root: "./public" }));
  app.use("/logs/*", serveStatic({ root: "./public" }));
  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound(c => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    return sendIndex(c);
  });
}
