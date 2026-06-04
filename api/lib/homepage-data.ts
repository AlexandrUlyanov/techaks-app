import { banners, categories, posts, stores } from "@db/schema";
import { desc, eq, isNull, asc } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { getPublicSiteProfile } from "./site-profile-settings";
import { getAppSettings } from "./app-settings";
import { buildHomepageHeroStorefrontData } from "./homepage-hero";
import { getVisibleManufacturerCatalogEntries } from "./manufacturers";
import { getRecommendedProducts } from "./merchandising-score";
import { listHomepageFallbackProducts } from "./public-products";

function rankBadge(badge?: string | null) {
  if (badge === "Акция") return 0;
  if (badge === "Хит") return 1;
  if (badge === "Новинка") return 2;
  return 3;
}

export async function buildHomepageData() {
  const db = getDb();

  const [
    siteProfile,
    maintenanceSettings,
    rootCategories,
    storesRows,
    bannerRows,
    postRows,
    weekRecommendations,
    popularRecommendations,
    manufacturerRows,
    hero,
  ] = await Promise.all([
    getPublicSiteProfile(),
    getAppSettings(["maintenance_mode", "maintenance_reopen_date"]),
    db
      .select()
      .from(categories)
      .where(isNull(categories.parentId))
      .orderBy(asc(categories.sortOrder))
      .limit(8),
    db.select().from(stores).orderBy(asc(stores.sortOrder)),
    db
      .select()
      .from(banners)
      .where(eq(banners.active, true))
      .orderBy(asc(banners.sortOrder))
      .limit(2),
    db
      .select()
      .from(posts)
      .where(eq(posts.published, true))
      .orderBy(desc(posts.createdAt))
      .limit(3),
    getRecommendedProducts({ limit: 10 }),
    getRecommendedProducts({ limit: 8 }),
    getVisibleManufacturerCatalogEntries(18),
    buildHomepageHeroStorefrontData(),
  ]);

  const fallbackProducts = await listHomepageFallbackProducts(12);

  const weekProductsSource =
    weekRecommendations.length > 0 ? weekRecommendations : fallbackProducts;
  const weekProducts = [...weekProductsSource]
    .sort((a, b) => rankBadge(a.badge) - rankBadge(b.badge))
    .slice(0, 10);
  const popularProducts =
    popularRecommendations.length > 0
      ? popularRecommendations
      : fallbackProducts.slice(0, 8);

  return {
    siteProfile,
    hero,
    maintenanceStatus: {
      isEnabled: maintenanceSettings.maintenance_mode === "true",
      reopenDate: maintenanceSettings.maintenance_reopen_date || null,
    },
    critical: {
      categories: rootCategories,
      weekProducts,
    },
    secondary: {
      featuredManufacturers: manufacturerRows,
      banners: bannerRows,
      stores: storesRows,
      latestPosts: postRows,
      popularProducts,
    },
  };
}
