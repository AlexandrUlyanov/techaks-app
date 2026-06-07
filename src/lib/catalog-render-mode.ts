export type CatalogCategoryLike = {
  id: number;
  parentId: number | null;
  slug: string;
};

export type CatalogViewMode = "categories" | "brands";

export type CatalogRenderMode =
  | "root-navigation"
  | "category-navigation"
  | "category-products"
  | "brands-index"
  | "brands-products";

export function categoryHasChildren<TCategory extends CatalogCategoryLike>(
  categories: TCategory[],
  currentCategory: TCategory | null | undefined
) {
  if (!currentCategory) return false;
  return categories.some(category => category.parentId === currentCategory.id);
}

export function resolveCatalogRenderMode<TCategory extends CatalogCategoryLike>(input: {
  catalogView: CatalogViewMode;
  activeCategory: string;
  activeBrand: string;
  currentCategory?: TCategory | null;
  categories: TCategory[];
  forceProductsView?: boolean;
}): CatalogRenderMode {
  const {
    catalogView,
    activeCategory,
    activeBrand,
    currentCategory,
    categories,
    forceProductsView = false,
  } = input;

  if (catalogView === "brands") {
    return activeBrand ? "brands-products" : "brands-index";
  }

  if (activeCategory === "all") {
    return "root-navigation";
  }

  if (!currentCategory) {
    return "category-products";
  }

  if (categoryHasChildren(categories, currentCategory) && !forceProductsView) {
    return "category-navigation";
  }

  return "category-products";
}

export function isCatalogNavigationMode(mode: CatalogRenderMode) {
  return mode === "root-navigation" || mode === "category-navigation";
}

export function isCatalogProductMode(mode: CatalogRenderMode) {
  return mode === "category-products" || mode === "brands-products";
}
