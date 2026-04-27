import { createRouter, publicQuery } from "./middleware";
import { leadRouter } from "./routers/lead";
import { productRouter } from "./routers/product";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  lead: leadRouter,
  product: productRouter,
});

export type AppRouter = typeof appRouter;
