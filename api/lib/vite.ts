import type { Context, Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");
  const sendIndex = (c: Context) => {
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  };

  app.get("/admin/*", sendIndex);
  app.get("/catalog", sendIndex);
  app.get("/product/*", sendIndex);
  app.get("/stores", sendIndex);
  app.get("/contacts", sendIndex);
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
