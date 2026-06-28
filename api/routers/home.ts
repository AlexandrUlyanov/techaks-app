import { createRouter, protectedProcedure, publicQuery, requireAbility } from "../middleware";
import {
  getHomepagePageData,
  getHomepageSnapshotStatus,
  refreshHomepageSnapshot,
} from "../lib/homepage-snapshot";

export const homeRouter = createRouter({
  getPageData: publicQuery.query(async () => {
    return getHomepagePageData();
  }),

  getSnapshotStatus: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "Settings");
    return getHomepageSnapshotStatus();
  }),

  refreshSnapshot: protectedProcedure.mutation(async ({ ctx }) => {
    requireAbility(ctx, "configure", "Settings");
    const payload = await refreshHomepageSnapshot();
    return {
      success: true,
      status: await getHomepageSnapshotStatus(),
      counts: {
        categories: payload.critical.categories.length,
        weekProducts: payload.critical.weekProducts.length,
        banners: payload.secondary.banners.length,
        stores: payload.secondary.stores.length,
        posts: payload.secondary.latestPosts.length,
        popularProducts: payload.secondary.popularProducts.length,
        manufacturers: payload.secondary.featuredManufacturers.length,
        reviews: payload.secondary.reviews.length,
      },
    };
  }),
});
