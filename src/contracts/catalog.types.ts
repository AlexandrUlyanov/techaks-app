export type CategoryItem = {
  id: string;
  title: string;
  href: string;
  badge?: "new" | "sale" | "popular";
  icon?: string;
};

export type CategoryGroup = {
  id: string;
  title: string;
  href?: string;
  items: CategoryItem[];
};

export type Brand = {
  id: string;
  title: string;
  href: string;
  logo?: string;
  normalizedName?: string;
  sourceNormalizedKey?: string;
};

export type PromoBlock = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  image?: string;
  cta?: string;
  theme?: "light" | "dark" | "accent";
};

export type Category = {
  id: string;
  title: string;
  slug: string;
  icon?: string;
  href: string;
  featured?: boolean;
  children?: CategoryGroup[];
  brands?: Brand[];
  promo?: PromoBlock[];
};

export type CatalogAnalyticsEvent =
  | "catalog_open"
  | "catalog_close"
  | "catalog_category_hover"
  | "catalog_category_click"
  | "catalog_subcategory_click"
  | "catalog_search"
  | "catalog_search_empty"
  | "catalog_promo_click"
  | "catalog_mobile_back"
  | "catalog_mobile_close";

export interface CatalogEventData {
  event: CatalogAnalyticsEvent;
  category_id?: string;
  category_title?: string;
  href?: string;
  source: "desktop" | "mobile";
  position?: number;
  search_term?: string;
  timestamp: number;
}
