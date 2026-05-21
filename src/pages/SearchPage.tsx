import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams, Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import ProductCard from "@/components/ProductCard";
import ProductFilters, { type SelectedSpecFilter } from "@/components/ProductFilters";
import { Loader2, Search, ArrowLeft, ShoppingCart, Grid2X2, List, SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSeo } from "@/lib/seo";

const PRODUCT_PAGE_SIZE = 28;

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(query);
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
  const [visibleProductCount, setVisibleProductCount] =
    useState(PRODUCT_PAGE_SIZE);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useSeo({
    title: query ? `Поиск: ${query} — ТЕХАКС` : "Поиск — ТЕХАКС",
    description: "Поиск товаров в интернет-магазине ТЕХАКС.",
    canonicalPath: "/search",
    noindex: true,
  });

  const { data: specFilters = [] } = trpc.product.getSpecFilters.useQuery({
    categorySlug: "all",
  });
  const { data: results = [], isLoading } = trpc.product.search.useQuery(
    { query, limit: 500, specFilters: selectedFilters },
    { enabled: query.length >= 2 }
  );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    const normalizedQuery = searchInput.trim();

    nextParams.delete("filter");
    if (normalizedQuery) {
      nextParams.set("q", normalizedQuery);
    } else {
      nextParams.delete("q");
    }

    navigate(`/search${nextParams.toString() ? `?${nextParams.toString()}` : ""}`, {
      replace: false,
    });
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
    navigate(`/search?${nextParams.toString()}`, { replace: true });
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

  useEffect(() => {
    setVisibleProductCount(PRODUCT_PAGE_SIZE);
  }, [query, selectedFilterKey]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const visibleResults = useMemo(
    () => results.slice(0, visibleProductCount),
    [results, visibleProductCount]
  );

  const hasMoreResults = visibleProductCount < results.length;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <section className="bg-muted/30 py-12 md:py-20 border-b border-border">
        <div className="container-main">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/50">
              <Link to="/" className="hover:text-[#05C3D4] transition-colors">
                Главная
              </Link>
              <span>/</span>
              <span>Поиск</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase font-heading tracking-tighter text-foreground">
              РЕЗУЛЬТАТЫ{" "}
              <span className="text-muted-foreground/30">ПОИСКА</span>
            </h1>
            <p className="text-muted-foreground font-medium">
              {query ? (
                <>
                  Найдено товаров по запросу «
                  <span className="text-foreground font-black">{query}</span>»:{" "}
                  {results.length}
                </>
              ) : (
                "Введите запрос для поиска товаров"
              )}
            </p>
            <form onSubmit={submitSearch} className="pt-2">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Search size={18} />
                </div>
                <input
                  value={searchInput}
                  onChange={event => setSearchInput(event.target.value)}
                  type="search"
                  autoFocus
                  inputMode="search"
                  placeholder="Найти аксессуар или гаджет..."
                  aria-label="Поиск товаров"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#05C3D4] px-4 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-[#27E6F2] dark:text-black"
                >
                  Найти
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Results Grid */}
      <section className="py-16 md:py-24">
        <div className="container-main">
          {query.length >= 2 && (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
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
              <div className="ml-auto h-11 rounded-xl border border-border bg-card p-1 flex items-center">
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
            </div>
          )}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Ищем лучшие предложения...
              </p>
            </div>
          ) : query.length >= 2 ? (
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
                {results.length > 0 ? (
                  <>
                    <div className={
                      viewMode === "grid"
                        ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
                        : "grid grid-cols-1 gap-4"
                    }>
                      {visibleResults.map(product => (
                        <ProductCard key={product.id} product={product as any} variant={viewMode} />
                      ))}
                    </div>
                    {hasMoreResults && (
                      <div className="mt-12 flex flex-col items-center gap-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Показано {visibleResults.length} из {results.length}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleProductCount(count =>
                              Math.min(count + PRODUCT_PAGE_SIZE, results.length)
                            )
                          }
                          className="px-10 py-4 rounded-xl bg-[#05C3D4] text-white dark:text-black text-xs font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all active:scale-95 shadow-lg shadow-[#05C3D4]/20"
                        >
                          Загрузить еще
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="max-w-md mx-auto text-center py-24 space-y-8">
                    <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20">
                      <Search size={48} />
                    </div>
                    <div className="space-y-4">
                      <h2 className="text-2xl font-black uppercase font-heading tracking-tight">
                        Ничего не нашли
                      </h2>
                      <p className="text-muted-foreground font-medium">
                        Попробуйте изменить запрос или сбросить выбранные фильтры.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto text-center py-24 space-y-8">
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20">
                <Search size={48} />
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-black uppercase font-heading tracking-tight">
                  Ничего не нашли
                </h2>
                <p className="text-muted-foreground font-medium">
                  К сожалению, по вашему запросу товаров не найдено. Попробуйте
                  изменить запрос или поискать в каталоге.
                </p>
              </div>
              <div className="pt-8 flex flex-col gap-4">
                <Link to="/catalog">
                  <button className="w-full h-14 bg-[#05C3D4] text-white dark:text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all glow-cyan flex items-center justify-center gap-3">
                    <ShoppingCart size={18} />
                    ПЕРЕЙТИ В КАТАЛОГ
                  </button>
                </Link>
                <Link to="/">
                  <button className="w-full h-14 border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:bg-muted transition-all flex items-center justify-center gap-3">
                    <ArrowLeft size={18} />
                    НА ГЛАВНУЮ
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
