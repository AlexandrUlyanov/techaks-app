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

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// Serve uploaded images in dev mode
app.use("/images/*", serveStatic({ root: env.isProduction ? "./dist/public" : "./public" }));

// File Upload Endpoint
app.post("/api/upload", async (c) => {
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
    
    // Determine public path based on environment
    const publicPath = env.isProduction 
      ? join(process.cwd(), "dist", "public", "images")
      : join(process.cwd(), "public", "images");
      
    const filePath = join(publicPath, filename);

    // Ensure directory exists
    await mkdir(publicPath, { recursive: true });
    
    // Write file
    await writeFile(filePath, buffer);
    
    return c.json({ 
      url: `/images/${filename}`,
      success: true 
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return c.json({ error: error.message || "Failed to upload file" }, 500);
  }
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  const { migrate } = await import("drizzle-orm/mysql2/migrator");
  const { getDb } = await import("./queries/connection");

  // Run migrations
  try {
    console.log("Running database migrations...");
    await migrate(getDb() as any, { migrationsFolder: "./db/migrations" });
    console.log("Migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  }

  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
