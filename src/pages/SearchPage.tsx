import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import ProductCard from "@/components/ProductCard";
import ProductFilters, { type SelectedSpecFilter } from "@/components/ProductFilters";
import { Loader2, Search, ArrowLeft, ShoppingBag } from "lucide-react";

const PRODUCT_PAGE_SIZE = 28;

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
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

  const { data: specFilters = [] } = trpc.product.getSpecFilters.useQuery({
    categorySlug: "all",
  });
  const { data: results = [], isLoading } = trpc.product.search.useQuery(
    { query, limit: 500, specFilters: selectedFilters },
    { enabled: query.length >= 2 }
  );

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
          </div>
        </div>
      </section>

      {/* Results Grid */}
      <section className="py-16 md:py-24">
        <div className="container-main">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Ищем лучшие предложения...
              </p>
            </div>
          ) : query.length >= 2 ? (
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
              <ProductFilters
                filters={specFilters}
                selected={selectedFilters}
                onToggle={toggleFilter}
                onClear={clearFilters}
              />
              <div>
                {results.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                      {visibleResults.map(product => (
                        <ProductCard key={product.id} product={product as any} />
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
                    <ShoppingBag size={18} />
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
