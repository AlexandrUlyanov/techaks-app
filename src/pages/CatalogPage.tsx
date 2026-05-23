import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router";
import ProductCard from "@/components/ProductCard";
import ProductFilters, { type SelectedSpecFilter } from "@/components/ProductFilters";
import ProductBreadcrumbsCompact, {
  type CompactBreadcrumbItem,
} from "@/components/product/ProductBreadcrumbsCompact";
import { trpc } from "@/providers/trpc";
import { CategoryIcon } from "@/lib/category-icons";
import { ArrowUpDown, Grid2X2, List, SlidersHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSeo } from "@/lib/seo";

const PRODUCT_PAGE_SIZE = 28;

export default function CatalogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const catalogView = searchParams.get("view") === "brands" ? "brands" : "categories";
  const activeCategory = searchParams.get("cat") || "all";
  const activeBrand = searchParams.get("brand") || "";
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
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">(
    "default"
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
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
      enabled: catalogView === "categories",
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

  const visibleProducts = useMemo(
    () => sortedProducts.slice(0, visibleProductCount),
    [sortedProducts, visibleProductCount]
  );

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

  const currentCategory = useMemo(() => {
    return categories.find(c => c.slug === activeCategory);
  }, [categories, activeCategory]);

  const currentManufacturer = currentManufacturerQuery.data ?? null;

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

      {/* Header Info */}
      <section className="pt-12 pb-8 border-b border-border">
        <div className="container-main">
          <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
            {headerTitle}
          </h1>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container-main space-y-12">
          
          {/* Categories Grid */}
          {displayManufacturers.length > 0 && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {displayManufacturers.map(manufacturer => (
                  <button
                    key={manufacturer.id}
                    type="button"
                    onClick={() => navigate(`/catalog?view=brands&brand=${manufacturer.slug}`)}
                    className="flex min-h-[156px] flex-col items-center justify-center rounded-2xl border border-border bg-white/5 p-5 text-center transition-all hover:border-[#05C3D4] hover:bg-white/10"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-3">
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
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest mb-6 text-foreground">
                {activeCategory === "all" ? "Категории" : "Подкатегории"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayCategories.map(cat => {
                  const subCats = categories.filter(c => c.parentId === cat.id);
                  return (
                    <div
                      key={cat.id}
                      onClick={() => navigate(`/catalog?cat=${cat.slug}`)}
                      className="flex flex-col p-6 bg-white/5 border border-border rounded-2xl hover:border-[#05C3D4] hover:bg-white/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <CategoryIcon 
                          name={cat.name} 
                          slug={cat.slug} 
                          size={24} 
                          className="text-muted-foreground group-hover:text-[#05C3D4] transition-colors" 
                        />
                        <span className="text-sm font-bold uppercase tracking-wider group-hover:text-[#05C3D4] transition-colors line-clamp-2">
                          {cat.name}
                        </span>
                      </div>
                      
                      {subCats.length > 0 && (
                        <ul className="space-y-2 mt-auto border-t border-white/5 pt-4">
                          {subCats.slice(0, 6).map(sub => (
                            <li key={sub.id}>
                              <Link
                                to={`/catalog?cat=${sub.slug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-medium text-muted-foreground hover:text-[#05C3D4] transition-colors flex items-center gap-2"
                              >
                                <span className="w-1 h-1 rounded-full bg-[#05C3D4]/50 shrink-0" />
                                <span className="truncate">{sub.name}</span>
                              </Link>
                            </li>
                          ))}
                          {subCats.length > 6 && (
                            <li className="text-[10px] text-muted-foreground italic mt-2 uppercase tracking-wider">
                              и еще {subCats.length - 6}...
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products Grid */}
          {showProductSection && (
          <div className={displayCategories.length > 0 || displayManufacturers.length > 0 ? "pt-10 border-t border-border" : ""}>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/5 rounded-2xl h-[400px] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
                <div className="hidden lg:block">
                  <ProductFilters
                    filters={specFilters}
                    selected={selectedFilters}
                    onToggle={toggleFilter}
                    onClear={clearFilters}
                  />
                </div>
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Sheet>
                      <SheetTrigger asChild>
                        <button
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:border-[var(--tech-color-primary)] hover:text-[var(--tech-color-primary)] lg:hidden"
                          aria-label="Фильтры"
                        >
                          <SlidersHorizontal size={16} />
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

                    <Select
                      value={sortBy}
                      onValueChange={value =>
                        setSortBy(value as "default" | "price-asc" | "price-desc")
                      }
                    >
                      <SelectTrigger className="h-11 min-w-[230px] rounded-2xl border-border/70 bg-white pl-3 pr-4 text-sm font-semibold shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[var(--tech-color-primary)]">
                            <ArrowUpDown size={15} />
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

                    <div className="ml-auto inline-flex items-center gap-1 rounded-2xl border border-border/70 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                          viewMode === "grid"
                            ? "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        }`}
                        aria-label="Плитка"
                      >
                        <Grid2X2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                          viewMode === "list"
                            ? "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        }`}
                        aria-label="Список"
                      >
                        <List size={17} />
                      </button>
                    </div>
                  </div>

                  {selectedFilterLabels.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
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
                          className="inline-flex h-9 items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,white)] px-4 text-sm font-semibold text-foreground transition hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_22%,white)]"
                        >
                          <span className="truncate max-w-[180px]">{filter.value}</span>
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_22%,white)] text-[var(--tech-color-primary)]">
                            <X size={11} />
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex h-9 items-center gap-2 rounded-full bg-muted px-4 text-sm font-semibold text-foreground transition hover:bg-muted/80"
                      >
                        Сбросить все
                      </button>
                    </div>
                  )}

                  <div className={
                    viewMode === "grid"
                      ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
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
                    <div className="text-center py-24">
                      <p className="text-xl font-black uppercase font-heading text-white/10 tracking-widest">
                        Товары скоро появятся
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </section>
    </div>
  );
}
