import { createRouter, publicQuery } from "./middleware";
import { leadRouter } from "./routers/lead";
import { productRouter } from "./routers/product";
import { storeRouter } from "./routers/store";
import { bannerRouter } from "./routers/banner";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  lead: leadRouter,
  product: productRouter,
  store: storeRouter,
  banner: bannerRouter,
});

export type AppRouter = typeof appRouter;
