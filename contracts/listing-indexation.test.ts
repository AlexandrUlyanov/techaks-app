import { describe, expect, it } from "vitest";
import { resolveCatalogIndexationPolicy } from "./listing-indexation";

describe("resolveCatalogIndexationPolicy", () => {
  it("keeps plain category pages indexable", () => {
    const result = resolveCatalogIndexationPolicy({
      catalogView: "categories",
      activeCategory: "naushniki",
      selectedFiltersCount: 0,
      sortBy: "default",
      viewMode: "grid",
      forceProductsView: false,
      hasProducts: true,
    });

    expect(result.pageType).toBe("category");
    expect(result.shouldNoindex).toBe(false);
    expect(result.canonicalPath).toBe("/catalog?cat=naushniki");
  });

  it("keeps approved single-filter pages indexable", () => {
    const result = resolveCatalogIndexationPolicy({
      catalogView: "categories",
      activeCategory: "naushniki",
      selectedFiltersCount: 1,
      singleFilter: { filterKey: "tip", filterValue: "besprovodnye" },
      approvedSingleFilter: true,
      sortBy: "default",
      viewMode: "grid",
      forceProductsView: false,
      listingIndexationMode: "index",
      hasProducts: true,
    });

    expect(result.pageType).toBe("category_filter");
    expect(result.shouldNoindex).toBe(false);
    expect(result.canonicalPath).toBe(
      "/catalog?cat=naushniki&filter=tip%3Abesprovodnye"
    );
  });

  it("forces unapproved single-filter pages to canonical parent + noindex", () => {
    const result = resolveCatalogIndexationPolicy({
      catalogView: "categories",
      activeCategory: "naushniki",
      selectedFiltersCount: 1,
      singleFilter: { filterKey: "tip", filterValue: "besprovodnye" },
      approvedSingleFilter: false,
      sortBy: "default",
      viewMode: "grid",
      forceProductsView: false,
      listingIndexationMode: "index",
      hasProducts: true,
    });

    expect(result.shouldNoindex).toBe(true);
    expect(result.reasons).toContain("unapproved_single_filter");
    expect(result.canonicalPath).toBe("/catalog?cat=naushniki");
  });

  it("forces multi-filter pages to noindex and canonical parent", () => {
    const result = resolveCatalogIndexationPolicy({
      catalogView: "categories",
      activeCategory: "naushniki",
      selectedFiltersCount: 2,
      sortBy: "default",
      viewMode: "grid",
      forceProductsView: false,
      hasProducts: true,
    });

    expect(result.shouldNoindex).toBe(true);
    expect(result.reasons).toContain("multi_filter");
    expect(result.canonicalPath).toBe("/catalog?cat=naushniki");
  });

  it("marks decorated variants as noindex while keeping base canonical", () => {
    const result = resolveCatalogIndexationPolicy({
      catalogView: "categories",
      activeCategory: "naushniki",
      selectedFiltersCount: 0,
      sortBy: "price-desc",
      viewMode: "list",
      forceProductsView: true,
      hasProducts: true,
    });

    expect(result.shouldNoindex).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["sort_variant", "layout_variant", "forced_products_view"])
    );
    expect(result.canonicalPath).toBe("/catalog?cat=naushniki");
  });

  it("does not allow brand pages with filters to stay indexable", () => {
    const result = resolveCatalogIndexationPolicy({
      catalogView: "brands",
      activeCategory: "all",
      activeBrand: "hoco",
      selectedFiltersCount: 1,
      singleFilter: { filterKey: "color", filterValue: "black" },
      sortBy: "default",
      viewMode: "grid",
      forceProductsView: false,
      hasProducts: true,
    });

    expect(result.pageType).toBe("brand");
    expect(result.shouldNoindex).toBe(true);
    expect(result.reasons).toContain("brand_filter");
    expect(result.canonicalPath).toBe("/catalog?view=brands&brand=hoco");
  });
});
