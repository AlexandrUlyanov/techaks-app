import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router";
import ProductCard from "@/components/ProductCard";
import ProductFilters, { type SelectedSpecFilter } from "@/components/ProductFilters";
import { trpc } from "@/providers/trpc";
import { CategoryIcon } from "@/lib/category-icons";
import { ChevronDown, Grid2X2, List, SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  const [isSortOpen, setIsSortOpen] = useState(false);
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
  const sortLabel =
    sortBy === "price-asc"
      ? "Цена: по возрастанию"
      : sortBy === "price-desc"
      ? "Цена: по убыванию"
      : "По популярности";

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

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Breadcrumbs */}
      <section className="bg-muted/30 py-4 border-b border-border">
        <div className="container-main">
          <div className="flex items-center flex-wrap gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
            <Link to="/catalog?cat=all" className="hover:text-[#05C3D4] transition-colors">
              Каталог
            </Link>
            {catalogView === "brands" ? (
              <>
                <span className="text-muted-foreground/20">/</span>
                <span className={!activeBrand ? "text-[#05C3D4]" : ""}>
                  Производители
                </span>
                {activeBrand && currentManufacturer && (
                  <>
                    <span className="text-muted-foreground/20">/</span>
                    <span className="text-[#05C3D4]">{currentManufacturer.name}</span>
                  </>
                )}
              </>
            ) : (
              breadcrumbs.map(bc => (
                <div key={bc.id} className="flex items-center gap-2">
                  <span className="text-muted-foreground/20">/</span>
                  <Link 
                    to={`/catalog?cat=${bc.slug}`}
                    className={bc.id === currentCategory?.id ? "text-[#05C3D4]" : "hover:text-[#05C3D4] transition-colors"}
                  >
                    {bc.name}
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <h2 className="hidden md:block text-xl font-black uppercase tracking-widest text-foreground leading-none">
                Товары
              </h2>
              
              <div className="flex flex-wrap items-center gap-3">
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      className="lg:hidden h-11 w-11 rounded-xl border border-border bg-card flex items-center justify-center"
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
                <div className="h-11 rounded-xl border border-border bg-card p-1 flex items-center">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                      viewMode === "grid" ? "bg-[#05C3D4] text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label="Плитка"
                  >
                    <Grid2X2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                      viewMode === "list" ? "bg-[#05C3D4] text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label="Список"
                  >
                    <List size={17} />
                  </button>
                </div>
                <div className="relative min-w-[220px]">
                  <button
                    type="button"
                    onClick={() => setIsSortOpen(prev => !prev)}
                    className="h-11 w-full rounded-xl border border-border bg-card px-4 text-left text-xs font-black uppercase tracking-widest text-foreground shadow-none transition-colors hover:border-[#05C3D4]/50"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate">{sortLabel}</span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-muted-foreground transition-transform ${
                          isSortOpen ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>
                  {isSortOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-xl border border-border bg-card p-1 shadow-xl">
                      {[
                        { value: "default", label: "По популярности" },
                        { value: "price-asc", label: "Цена: по возрастанию" },
                        { value: "price-desc", label: "Цена: по убыванию" },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setSortBy(
                              option.value as "default" | "price-asc" | "price-desc"
                            );
                            setIsSortOpen(false);
                          }}
                          className={`flex h-9 w-full items-center rounded-lg px-3 text-left text-[11px] font-black uppercase tracking-wider transition-colors ${
                            sortBy === option.value
                              ? "bg-[#05C3D4] text-black"
                              : "text-foreground hover:bg-muted/70"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                <div>
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
