import { createRouter, publicQuery } from "./middleware";
import { leadRouter } from "./routers/lead";
import { productRouter } from "./routers/product";
import { storeRouter } from "./routers/store";
import { bannerRouter } from "./routers/banner";
import { blogRouter } from "./routers/blog";
import { ecommerceRouter } from "./routers/ecommerce";
import { authRouter } from "./routers/auth";
import { syncRouter } from "./routers/sync";
import { normalizeRouter } from "./routers/normalize";
import { merchandisingRouter } from "./routers/merchandising";
import { settingsRouter } from "./routers/settings";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  lead: leadRouter,
  product: productRouter,
  store: storeRouter,
  banner: bannerRouter,
  blog: blogRouter,
  ecommerce: ecommerceRouter,
  auth: authRouter,
  sync: syncRouter,
  normalize: normalizeRouter,
  merchandising: merchandisingRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
