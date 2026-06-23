export type ListingIndexationMode =
  | "index"
  | "noindex"
  | "canonical_to_parent"
  | "exclude_from_sitemap";

export type CatalogViewMode = "categories" | "brands";

export type CatalogIndexationPageType =
  | "catalog_root"
  | "category"
  | "category_filter"
  | "brand_index"
  | "brand";

export type CatalogNoindexReason =
  | "multi_filter"
  | "brand_filter"
  | "layout_variant"
  | "sort_variant"
  | "forced_products_view"
  | "listing_noindex"
  | "canonical_to_parent"
  | "unapproved_single_filter"
  | "empty_listing";

export type SingleFilterDescriptor = {
  filterKey: string;
  filterValue: string;
};

export type ResolveCatalogIndexationInput = {
  catalogView: CatalogViewMode;
  activeCategory: string;
  activeBrand?: string | null;
  selectedFiltersCount: number;
  singleFilter?: SingleFilterDescriptor | null;
  approvedSingleFilter?: boolean;
  sortBy?: string | null;
  viewMode?: string | null;
  forceProductsView?: boolean;
  listingIndexationMode?: ListingIndexationMode | string | null;
  listingCanonicalUrl?: string | null;
  hasProducts?: boolean;
};

export type CatalogIndexationPolicy = {
  pageType: CatalogIndexationPageType;
  basePath: string;
  canonicalPath: string;
  canonicalUrl?: string;
  shouldNoindex: boolean;
  shouldIncludeInSitemap: boolean;
  reasons: CatalogNoindexReason[];
  isApprovedIndexableListing: boolean;
};

function normalizeCanonicalTarget(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildCategoryPath(categorySlug: string) {
  if (!categorySlug || categorySlug === "all") return "/catalog";
  return `/catalog?cat=${encodeURIComponent(categorySlug)}`;
}

function buildBrandPath(brandSlug?: string | null) {
  if (!brandSlug) return "/catalog?view=brands";
  return `/catalog?view=brands&brand=${encodeURIComponent(brandSlug)}`;
}

function buildSingleFilterPath(categorySlug: string, filter: SingleFilterDescriptor) {
  const params = new URLSearchParams();
  params.set("cat", categorySlug);
  params.append("filter", `${filter.filterKey}:${filter.filterValue}`);
  return `/catalog?${params.toString()}`;
}

function normalizeListingIndexationMode(
  value?: ListingIndexationMode | string | null
): ListingIndexationMode {
  if (
    value === "index" ||
    value === "noindex" ||
    value === "canonical_to_parent" ||
    value === "exclude_from_sitemap"
  ) {
    return value;
  }

  return "index";
}

export function resolveCatalogIndexationPolicy(
  input: ResolveCatalogIndexationInput
): CatalogIndexationPolicy {
  const hasSort = (input.sortBy ?? "default") !== "default";
  const hasLayout = (input.viewMode ?? "grid") !== "grid";
  const forceProductsView = Boolean(input.forceProductsView);
  const hasProducts = input.hasProducts ?? true;
  const normalizedCanonical = normalizeCanonicalTarget(input.listingCanonicalUrl);
  const activeBrand = input.activeBrand?.trim() ?? "";
  const isBrandView = input.catalogView === "brands";
  const selectedFiltersCount = Math.max(0, input.selectedFiltersCount);
  const hasSingleFilter = selectedFiltersCount === 1 && Boolean(input.singleFilter);
  const hasMultiFilter = selectedFiltersCount > 1;
  const approvedSingleFilter = Boolean(input.approvedSingleFilter && hasSingleFilter);
  const listingMode = normalizeListingIndexationMode(input.listingIndexationMode);

  const pageType: CatalogIndexationPageType = isBrandView
    ? activeBrand
      ? "brand"
      : "brand_index"
    : input.activeCategory === "all"
      ? "catalog_root"
      : hasSingleFilter
        ? "category_filter"
        : "category";

  const basePath = isBrandView
    ? buildBrandPath(activeBrand)
    : buildCategoryPath(input.activeCategory);

  const filterPath =
    !isBrandView && hasSingleFilter && input.singleFilter
      ? buildSingleFilterPath(input.activeCategory, input.singleFilter)
      : basePath;

  const reasons: CatalogNoindexReason[] = [];

  if (hasMultiFilter) reasons.push("multi_filter");
  if (isBrandView && selectedFiltersCount > 0) reasons.push("brand_filter");
  if (hasLayout) reasons.push("layout_variant");
  if (hasSort) reasons.push("sort_variant");
  if (forceProductsView) reasons.push("forced_products_view");
  if (!hasProducts) reasons.push("empty_listing");
  if (!isBrandView && hasSingleFilter && !approvedSingleFilter) {
    reasons.push("unapproved_single_filter");
  }
  if (listingMode === "noindex") {
    reasons.push("listing_noindex");
  } else if (listingMode === "canonical_to_parent") {
    reasons.push("canonical_to_parent");
  }

  let canonicalTarget: string | null = normalizedCanonical;
  if (!canonicalTarget) {
    canonicalTarget =
      !isBrandView && hasSingleFilter && approvedSingleFilter ? filterPath : basePath;
  }
  if (listingMode === "canonical_to_parent") {
    canonicalTarget = normalizedCanonical || basePath;
  }
  if (!isBrandView && hasSingleFilter && !approvedSingleFilter) {
    canonicalTarget = basePath;
  }
  if (hasMultiFilter || (isBrandView && selectedFiltersCount > 0)) {
    canonicalTarget = basePath;
  }

  const shouldNoindex = reasons.length > 0;
  const isApprovedIndexableListing =
    !shouldNoindex &&
    hasProducts &&
    (pageType !== "category_filter" || approvedSingleFilter) &&
    listingMode !== "exclude_from_sitemap";

  return {
    pageType,
    basePath,
    canonicalPath:
      canonicalTarget && !canonicalTarget.startsWith("http") ? canonicalTarget : basePath,
    canonicalUrl:
      canonicalTarget && canonicalTarget.startsWith("http") ? canonicalTarget : undefined,
    shouldNoindex,
    shouldIncludeInSitemap: isApprovedIndexableListing,
    reasons,
    isApprovedIndexableListing,
  };
}
