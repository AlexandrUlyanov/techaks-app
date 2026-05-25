import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router";
import ProductCard from "@/components/ProductCard";
import ProductFilters, { type SelectedSpecFilter } from "@/components/ProductFilters";
import RootCatalogNavigator from "@/components/Catalog/RootCatalogNavigator";
import ProductBreadcrumbsCompact, {
  type CompactBreadcrumbItem,
} from "@/components/product/ProductBreadcrumbsCompact";
import { trpc } from "@/providers/trpc";
import { CategoryIcon } from "@/lib/category-icons";
import {
  ArrowUpDown,
  Grid2X2,
  List,
  RotateCcw,
  SlidersHorizontal,
  X,
  ChevronDown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSeo } from "@/lib/seo";

const PRODUCT_PAGE_SIZE = 28;
const INITIAL_CATEGORY_SHELF_COUNT = 8;

export default function CatalogPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const catalogView = searchParams.get("view") === "brands" ? "brands" : "categories";
  const activeCategory = searchParams.get("cat") || "all";
  const activeBrand = searchParams.get("brand") || "";
  const activeTreeSlugFromHash = decodeURIComponent(location.hash.replace(/^#/, "").trim());
  const isRootCatalogNavigator = catalogView === "categories" && activeCategory === "all";
  const selectedFilterKey = searchParams.getAll("filter").join("|");
  const selectedFilters = useMemo<SelectedSpecFilter[]>(() => {
    return searchParams
      .getAll("filter")
      .map(value => {
        const [normalizedKey, normalizedValue] = value.split(":");
        return normalizedKey && normalizedValue
          ? { normalizedKey, normalizedValue }
          : null;
      })
      .filter(Boolean) as SelectedSpecFilter[];
  }, [searchParams, selectedFilterKey]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isMobileSortOpen, setIsMobileSortOpen] = useState(false);
  const sortBy = (searchParams.get("sort") as "default" | "price-asc" | "price-desc") || "default";
  const viewMode = (searchParams.get("layout") as "grid" | "list") || "grid";
  const [visibleProductCount, setVisibleProductCount] =
    useState(PRODUCT_PAGE_SIZE);

  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: manufacturers = [] } = trpc.manufacturer.getAll.useQuery(
    { onlyVisible: true, withProductsOnly: true },
    { placeholderData: prev => prev }
  );
  const currentManufacturerQuery = trpc.manufacturer.getBySlug.useQuery(
    { slug: activeBrand },
    { enabled: catalogView === "brands" && Boolean(activeBrand) }
  );
  const { data: categorySpecFilters = [] } = trpc.product.getSpecFilters.useQuery(
    { categorySlug: activeCategory },
    {
      placeholderData: prev => prev,
      enabled: catalogView === "categories" && activeCategory !== "all",
    }
  );
  const { data: manufacturerSpecFilters = [] } =
    trpc.product.getManufacturerSpecFilters.useQuery(
      { manufacturerSlug: activeBrand },
      {
        placeholderData: prev => prev,
        enabled: catalogView === "brands" && Boolean(activeBrand),
      }
    );
  const categoryProductsQuery = trpc.product.getByCategory.useQuery(
    { categorySlug: activeCategory, specFilters: selectedFilters },
    {
      placeholderData: prev => prev,
      enabled: catalogView === "categories",
    }
  );
  const manufacturerProductsQuery = trpc.product.getByManufacturer.useQuery(
    { manufacturerSlug: activeBrand, specFilters: selectedFilters },
    {
      placeholderData: prev => prev,
      enabled: catalogView === "brands" && Boolean(activeBrand),
    }
  );

  const specFilters =
    catalogView === "brands" ? manufacturerSpecFilters : categorySpecFilters;
  const products =
    catalogView === "brands"
      ? manufacturerProductsQuery.data ?? []
      : categoryProductsQuery.data ?? [];
  const isLoading =
    catalogView === "brands"
      ? currentManufacturerQuery.isLoading || manufacturerProductsQuery.isLoading
      : categoryProductsQuery.isLoading;

  const updateCatalogParams = (updates: Record<string, string | null>, replace = true) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });
    navigate(`/catalog?${nextParams.toString()}`, { replace });
  };

  const updateFilters = (nextFilters: SelectedSpecFilter[]) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("filter");
    nextFilters.forEach(filter => {
      nextParams.append(
        "filter",
        `${filter.normalizedKey}:${filter.normalizedValue}`
      );
    });
    navigate(`/catalog?${nextParams.toString()}`, { replace: true });
  };

  const toggleFilter = (filter: SelectedSpecFilter) => {
    const exists = selectedFilters.some(
      item =>
        item.normalizedKey === filter.normalizedKey &&
        item.normalizedValue === filter.normalizedValue
    );
    updateFilters(
      exists
        ? selectedFilters.filter(
            item =>
              item.normalizedKey !== filter.normalizedKey ||
              item.normalizedValue !== filter.normalizedValue
          )
        : [...selectedFilters, filter]
    );
  };

  const clearFilters = () => updateFilters([]);

  const sortedProducts = useMemo(() => {
    const result = [...products];
    if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    }
    return result;
  }, [products, sortBy]);

  useEffect(() => {
    setVisibleProductCount(PRODUCT_PAGE_SIZE);
  }, [activeCategory, activeBrand, catalogView, sortBy, selectedFilterKey]);

  useEffect(() => {
    setShowAllCategories(false);
  }, [activeCategory, activeBrand, catalogView]);

  const visibleProducts = useMemo(
    () => sortedProducts.slice(0, visibleProductCount),
    [sortedProducts, visibleProductCount]
  );
  const sortOptions = [
    { value: "default", label: "По популярности" },
    { value: "price-asc", label: "По возрастанию цены" },
    { value: "price-desc", label: "По убыванию цены" },
  ] as const;

  const applyMobileSort = (value: (typeof sortOptions)[number]["value"]) => {
    setIsMobileSortOpen(false);
    window.setTimeout(() => {
      updateCatalogParams({
        sort: value === "default" ? null : value,
      });
    }, 0);
  };

  const applyMobileLayout = (layout: "grid" | "list") => {
    setIsMobileSortOpen(false);
    window.setTimeout(() => {
      updateCatalogParams({ layout: layout === "grid" ? null : layout });
    }, 0);
  };

  const hasMoreProducts = visibleProductCount < sortedProducts.length;

  const selectedFilterLabels = useMemo(() => {
    const filterValueMap = new Map<
      string,
      { key: string; value: string; normalizedKey: string; normalizedValue: string }
    >();

    specFilters.forEach(group => {
      group.values.forEach(value => {
        filterValueMap.set(`${group.normalizedKey}:${value.normalizedValue}`, {
          key: group.key,
          value: value.value,
          normalizedKey: group.normalizedKey,
          normalizedValue: value.normalizedValue,
        });
      });
    });

    return selectedFilters.map(filter => {
      const mapped = filterValueMap.get(
        `${filter.normalizedKey}:${filter.normalizedValue}`
      );
      return (
        mapped ?? {
          key: filter.normalizedKey,
          value: filter.normalizedValue,
          normalizedKey: filter.normalizedKey,
          normalizedValue: filter.normalizedValue,
        }
      );
    });
  }, [selectedFilters, specFilters]);
  const hasSelectedFilters = selectedFilterLabels.length > 0;

  const currentCategory = useMemo(() => {
    return categories.find(c => c.slug === activeCategory);
  }, [categories, activeCategory]);

  const currentManufacturer = currentManufacturerQuery.data ?? null;
  const hashedRootCategory = useMemo(() => {
    if (!activeTreeSlugFromHash) return null;
    return categories.find(category => category.slug === activeTreeSlugFromHash) ?? null;
  }, [categories, activeTreeSlugFromHash]);

  useEffect(() => {
    if (!isRootCatalogNavigator || !hashedRootCategory) return;
    if (hashedRootCategory.parentId === null) return;

    navigate(`/catalog?cat=${hashedRootCategory.slug}`, { replace: true });
  }, [hashedRootCategory, isRootCatalogNavigator, navigate]);

  const activeCategoryName = useMemo(() => {
    if (activeCategory === "all") return "Все";
    return currentCategory?.name || "Каталог";
  }, [currentCategory, activeCategory]);

  const displayCategories = useMemo(() => {
    if (catalogView === "brands") return [];
    if (activeCategory === "all") {
      return categories.filter(c => !c.parentId);
    }
    if (currentCategory) {
      return categories.filter(c => c.parentId === currentCategory.id);
    }
    return [];
  }, [catalogView, categories, activeCategory, currentCategory]);
  const visibleCategories = useMemo(
    () =>
      showAllCategories
        ? displayCategories
        : displayCategories.slice(0, INITIAL_CATEGORY_SHELF_COUNT),
    [displayCategories, showAllCategories]
  );

  const displayManufacturers = useMemo(() => {
    if (catalogView !== "brands" || activeBrand) return [];
    return manufacturers;
  }, [catalogView, activeBrand, manufacturers]);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (catalogView === "brands") {
      return [];
    }
    if (activeCategory === "all" || !currentCategory) return [];
    const trail = [];
    let curr: any = currentCategory;
    while (curr) {
      trail.unshift(curr);
      const pid = curr.parentId;
      curr = categories.find(c => c.id === pid);
    }
    return trail;
  }, [catalogView, categories, currentCategory, activeCategory]);

  const headerTitle = catalogView === "brands"
    ? currentManufacturer?.name || "Производители"
    : activeCategoryName;
  const showProductSection = catalogView === "categories" || Boolean(activeBrand);
  const currentResultCount = sortedProducts.length;

  const seoTitle = currentManufacturer
    ? `${currentManufacturer.name} — купить в интернет-магазине ТЕХАКС`
    : currentCategory && activeCategory !== "all"
      ? `${currentCategory.name} — купить в интернет-магазине ТЕХАКС`
      : "Каталог товаров — интернет-магазин ТЕХАКС";

  const seoDescription = currentManufacturer
    ? `Товары бренда ${currentManufacturer.name}: актуальные цены, характеристики и наличие в интернет-магазине ТЕХАКС.`
    : currentCategory && activeCategory !== "all"
      ? `${currentCategory.name}: цены, характеристики и наличие в интернет-магазине ТЕХАКС.`
      : "Каталог техники и аксессуаров ТЕХАКС: выбирайте товары по категориям и брендам.";

  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonicalPath: "/catalog",
  });

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      <ProductBreadcrumbsCompact
        rootTo="/catalog?cat=all"
        compactRootLabel="Кат."
        items={
          catalogView === "brands"
            ? [
                {
                  id: "brands",
                  label: "Производители",
                  to: "/catalog?view=brands",
                },
              ]
            : breadcrumbs.map(
                breadcrumb =>
                  ({
                    id: breadcrumb.id,
                    label: String(breadcrumb.name),
                    to: `/catalog?cat=${breadcrumb.slug}`,
                  }) satisfies CompactBreadcrumbItem
              )
        }
        currentLabel={
          catalogView === "brands"
            ? currentManufacturer?.name || "Производители"
            : activeCategory === "all"
              ? "Каталог"
              : undefined
        }
      />

      {/* Content */}
      <section className={isRootCatalogNavigator ? "py-6 md:py-8" : "py-6 md:py-8"}>
        <div className="container-main space-y-8 md:space-y-10">
          {isRootCatalogNavigator ? (
            <RootCatalogNavigator
              categories={categories}
              products={products}
              activeBranchSlug={activeTreeSlugFromHash || null}
              onSelectBranch={slug =>
                navigate(`/catalog?cat=all#${encodeURIComponent(slug)}`, { replace: true })
              }
              onOpenCategory={slug => navigate(`/catalog?cat=${slug}`)}
              onOpenLeafCategory={slug => navigate(`/catalog?cat=${slug}`)}
            />
          ) : (
            <>
          
          {/* Categories Grid */}
          {displayManufacturers.length > 0 && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {displayManufacturers.map(manufacturer => (
                  <button
                    key={manufacturer.id}
                    type="button"
                    onClick={() => navigate(`/catalog?view=brands&brand=${manufacturer.slug}`)}
                    className="flex min-h-[156px] flex-col items-center justify-center rounded-2xl border border-border bg-[var(--tech-color-surface)] p-5 text-center transition-all hover:border-[#05C3D4] hover:brightness-[1.03]"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-surface)_88%,white)] p-3">
                      {manufacturer.logoUrl ? (
                        <img
                          src={manufacturer.logoUrl}
                          alt={manufacturer.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs font-black text-[#05C3D4]">
                          {manufacturer.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 line-clamp-2 text-sm font-bold uppercase tracking-wide">
                      {manufacturer.name}
                    </div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {manufacturer.productCount} товаров
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayCategories.length > 0 && (
            <div className="space-y-4">
              <div className="px-1 py-1 md:px-0 md:py-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-[11px] font-black uppercase tracking-[0.26em] text-muted-foreground">
                      {activeCategory === "all" ? "Категории" : "Подкатегории"}
                    </h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Быстрый переход по основным разделам каталога
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {displayCategories.length > INITIAL_CATEGORY_SHELF_COUNT ? (
                      <button
                        type="button"
                        onClick={() => setShowAllCategories(prev => !prev)}
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--tech-color-surface-muted)]/85 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,white)]"
                      >
                        {showAllCategories ? "Скрыть" : "Показать все"}
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${showAllCategories ? "rotate-180" : ""}`}
                        />
                      </button>
                    ) : null}
                    {activeCategory !== "all" ? (
                      <button
                        type="button"
                        onClick={() => navigate("/catalog?cat=all")}
                        className="text-[11px] font-semibold text-muted-foreground transition hover:text-[var(--tech-color-primary)]"
                      >
                        Весь каталог
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 md:hidden -mx-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex gap-2.5 pb-1">
                    {visibleCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => navigate(`/catalog?cat=${cat.slug}`)}
                        className="group inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-[var(--tech-color-surface-muted)]/85 px-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--tech-color-surface-muted)] active:scale-[0.98]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,white)] text-[var(--tech-color-primary)] transition duration-200 group-hover:scale-[1.04] group-hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_16%,white)]">
                          <CategoryIcon
                            name={cat.name}
                            slug={cat.slug}
                            size={15}
                            className="text-current"
                          />
                        </span>
                        <span className="max-w-[170px] truncate text-sm font-semibold text-foreground">
                          {cat.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 hidden md:flex md:flex-wrap md:gap-2.5">
                  {visibleCategories.map((cat, index) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => navigate(`/catalog?cat=${cat.slug}`)}
                      className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--tech-color-surface-muted)]/85 px-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--tech-color-surface-muted)] active:scale-[0.98] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,white)] text-[var(--tech-color-primary)] transition duration-200 group-hover:scale-[1.04] group-hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_16%,white)]">
                        <CategoryIcon
                          name={cat.name}
                          slug={cat.slug}
                          size={15}
                          className="text-current"
                        />
                      </span>
                      <span className="max-w-[240px] truncate text-sm font-semibold text-foreground">
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {showProductSection && (
          <div className={displayCategories.length > 0 || displayManufacturers.length > 0 ? "pt-6" : ""}>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="h-[380px] rounded-[28px] bg-[var(--tech-color-surface)] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
                <div className="hidden lg:block">
                  <div className="sticky top-[var(--header-height,96px)] self-start">
                  <ProductFilters
                    filters={specFilters}
                    selected={selectedFilters}
                    onToggle={toggleFilter}
                    onClear={clearFilters}
                  />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="py-1 md:py-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-black uppercase tracking-[0.18em] text-foreground">
                          {activeCategory === "all" ? "Все товары" : headerTitle}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {currentResultCount > 0
                            ? `${currentResultCount} ${currentResultCount === 1 ? "товар" : currentResultCount < 5 ? "товара" : "товаров"}`
                            : "Товары появятся после следующего обновления"}
                        </div>
                      </div>

                      <div className="hidden items-center gap-3 md:flex">
                        <Select
                          value={sortBy}
                          onValueChange={value =>
                            updateCatalogParams({
                              sort: value === "default" ? null : value,
                            })
                          }
                        >
                          <SelectTrigger className="h-11 min-w-[220px] rounded-full border-transparent bg-[var(--tech-color-surface-muted)]/85 pl-2.5 pr-3 text-[13px] font-semibold text-foreground shadow-none">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,var(--tech-color-surface))] text-[var(--tech-color-primary)]">
                                <ArrowUpDown size={14} />
                              </span>
                              <SelectValue placeholder="Сортировка" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">По популярности</SelectItem>
                            <SelectItem value="price-asc">По возрастанию цены</SelectItem>
                            <SelectItem value="price-desc">По убыванию цены</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--tech-color-surface-muted)]/85 p-1">
                          <button
                            type="button"
                            onClick={() => updateCatalogParams({ layout: null })}
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                              viewMode === "grid"
                                ? "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]"
                                : "text-muted-foreground hover:bg-background hover:text-foreground"
                            }`}
                            aria-label="Плитка"
                            aria-pressed={viewMode === "grid"}
                          >
                            <Grid2X2 size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCatalogParams({ layout: "list" })}
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                              viewMode === "list"
                                ? "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]"
                                : "text-muted-foreground hover:bg-background hover:text-foreground"
                            }`}
                            aria-label="Список"
                            aria-pressed={viewMode === "list"}
                          >
                            <List size={17} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 md:hidden">
                      <Sheet>
                        <SheetTrigger asChild>
                          <button
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--tech-color-surface-muted)] px-4 text-[13px] font-semibold text-foreground transition hover:text-[var(--tech-color-primary)]"
                            aria-label="Фильтры"
                          >
                            <SlidersHorizontal size={15} />
                            Фильтры
                          </button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[86vw] max-w-sm overflow-y-auto p-5">
                          <SheetHeader className="px-0 pt-0">
                            <SheetTitle className="text-sm font-black uppercase tracking-widest">
                              Фильтры
                            </SheetTitle>
                          </SheetHeader>
                          <ProductFilters
                            filters={specFilters}
                            selected={selectedFilters}
                            onToggle={toggleFilter}
                            onClear={clearFilters}
                          />
                        </SheetContent>
                      </Sheet>

                      <Popover open={isMobileSortOpen} onOpenChange={setIsMobileSortOpen}>
                        <PopoverTrigger asChild>
                          <button
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--tech-color-surface-muted)] px-4 text-[13px] font-semibold text-foreground transition hover:text-[var(--tech-color-primary)]"
                            aria-label="Сортировка"
                          >
                            <ArrowUpDown size={15} />
                            Сортировка
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          side="bottom"
                          sideOffset={10}
                          className="w-[min(86vw,19rem)] rounded-[1.35rem] border-none bg-[var(--tech-color-surface)] p-3 shadow-[0_18px_44px_rgba(15,23,42,0.16)]"
                        >
                          <div className="space-y-3">
                            <div className="space-y-2">
                              {sortOptions.map(option => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => applyMobileSort(option.value)}
                                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[14px] font-semibold transition ${
                                    sortBy === option.value
                                      ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,var(--tech-color-surface))] text-foreground"
                                      : "bg-[var(--tech-color-surface)] text-foreground"
                                  }`}
                                >
                                  <span>{option.label}</span>
                                  {sortBy === option.value ? (
                                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--tech-color-primary)]" />
                                  ) : null}
                                </button>
                              ))}
                            </div>
                            <div className="inline-flex items-center gap-1 rounded-full bg-[var(--tech-color-surface-muted)] p-1">
                              <button
                                type="button"
                                onClick={() => applyMobileLayout("grid")}
                                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                                  viewMode === "grid"
                                    ? "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]"
                                    : "text-muted-foreground"
                                }`}
                                aria-label="Плитка"
                                aria-pressed={viewMode === "grid"}
                              >
                                <Grid2X2 size={17} />
                              </button>
                              <button
                                type="button"
                                onClick={() => applyMobileLayout("list")}
                                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                                  viewMode === "list"
                                    ? "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]"
                                    : "text-muted-foreground"
                                }`}
                                aria-label="Список"
                                aria-pressed={viewMode === "list"}
                              >
                                <List size={17} />
                              </button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {hasSelectedFilters && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                      {selectedFilterLabels.map(filter => (
                        <button
                          key={`${filter.normalizedKey}:${filter.normalizedValue}`}
                          type="button"
                          onClick={() =>
                            toggleFilter({
                              normalizedKey: filter.normalizedKey,
                              normalizedValue: filter.normalizedValue,
                            })
                          }
                          className="inline-flex h-8 items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,var(--tech-color-surface))] px-3.5 text-[13px] font-semibold text-foreground transition hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_18%,var(--tech-color-surface))]"
                        >
                          <span className="truncate max-w-[180px]">{filter.value}</span>
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_20%,var(--tech-color-surface))] text-[var(--tech-color-primary)]">
                            <X size={10} />
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex h-8 items-center gap-2 rounded-full bg-[var(--tech-color-surface)] px-3.5 text-[13px] font-semibold text-foreground transition hover:brightness-95"
                      >
                        Сбросить все
                      </button>
                      </div>
                    )}
                  </div>

                  <div className={
                    viewMode === "grid"
                      ? "grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-4"
                      : "grid grid-cols-1 gap-4"
                  }>
                    {visibleProducts.map((product: any) => (
                      <ProductCard key={product.id} product={product} variant={viewMode} />
                    ))}
                  </div>
                  {hasMoreProducts && (
                    <div className="mt-12 flex flex-col items-center gap-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Показано {visibleProducts.length} из{" "}
                        {sortedProducts.length}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleProductCount(count =>
                            Math.min(count + PRODUCT_PAGE_SIZE, sortedProducts.length)
                          )
                        }
                        className="px-10 py-4 rounded-xl bg-[#05C3D4] text-white dark:text-black text-xs font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all active:scale-95 shadow-lg shadow-[#05C3D4]/20"
                      >
                        Загрузить еще
                      </button>
                    </div>
                  )}
                  {sortedProducts.length === 0 && (
                    <div className="py-12">
                      <div className="mx-auto flex max-w-2xl flex-col items-center rounded-[2rem] bg-[var(--tech-color-surface)] px-6 py-14 text-center shadow-[0_16px_36px_rgba(0,0,0,0.06)] sm:px-10">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,var(--tech-color-surface))] text-[var(--tech-color-primary)]">
                          <SlidersHorizontal size={22} />
                        </div>
                        <h2 className="mt-6 text-2xl font-black tracking-tight text-foreground">
                          {hasSelectedFilters
                            ? "Подходящих товаров сейчас нет"
                            : "Товары скоро появятся"}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                          {hasSelectedFilters
                            ? "Попробуйте снять часть фильтров или сбросить их полностью — тогда мы покажем больше подходящих товаров."
                            : "В этой категории пока пусто, но мы уже готовим подборку. Попробуйте открыть весь каталог или соседние категории."}
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                          {hasSelectedFilters ? (
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#05C3D4] px-5 text-sm font-black text-white transition hover:bg-[#27E6F2] dark:text-black"
                            >
                              <RotateCcw size={15} />
                              Сбросить фильтры
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate("/catalog?cat=all")}
                              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#05C3D4] px-5 text-sm font-black text-white transition hover:bg-[#27E6F2] dark:text-black"
                            >
                              Перейти в каталог
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate("/contacts")}
                            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground transition hover:bg-[var(--tech-color-surface)]"
                          >
                            Нужна помощь с подбором
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
