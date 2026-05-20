import { createRouter, publicQuery } from "../middleware";
import { getHomepagePageData } from "../lib/homepage-data";

export const homeRouter = createRouter({
  getPageData: publicQuery.query(async () => {
    return getHomepagePageData();
  }),
});
