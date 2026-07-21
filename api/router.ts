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
import { manufacturerRouter } from "./routers/manufacturer";
import { userRouter } from "./routers/user";
import { reviewsRouter } from "./routers/reviews";
import { homeRouter } from "./routers/home";
import { designSystemRouter } from "./routers/design-system";
import { searchRouter } from "./routers/search";
import { listingRouter } from "./routers/listing";
import { loyaltyRouter } from "./routers/loyalty";
import { accountRouter } from "./routers/account";
import { wordstatRouter } from "./routers/wordstat";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  home: homeRouter,
  designSystem: designSystemRouter,
  search: searchRouter,
  loyalty: loyaltyRouter,
  listing: listingRouter,
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
  manufacturer: manufacturerRouter,
  user: userRouter,
  reviews: reviewsRouter,
  account: accountRouter,
  wordstat: wordstatRouter,
});

export type AppRouter = typeof appRouter;
