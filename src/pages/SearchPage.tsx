import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useSeo } from "@/lib/seo";
import SearchInput from "@/components/search/SearchInput";
import SearchFilters from "@/components/search/SearchFilters";
import SearchSortSelect, {
  type SearchSortValue,
} from "@/components/search/SearchSortSelect";
import SearchEmptyState from "@/components/search/SearchEmptyState";
import SearchResultsGrid from "@/components/search/SearchResultsGrid";
import SearchHighlight from "@/components/search/SearchHighlight";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const DEFAULT_PAGE_SIZE = 24;

function parseNumber(value: string | null) {
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : undefined;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const page = parseNumber(searchParams.get("page")) || 1;
  const limit = parseNumber(searchParams.get("limit")) || DEFAULT_PAGE_SIZE;
  const categoryId = parseNumber(searchParams.get("categoryId"));
  const brandId = parseNumber(searchParams.get("brandId"));
  const priceFrom = parseNumber(searchParams.get("priceFrom"));
  const priceTo = parseNumber(searchParams.get("priceTo"));
  const inStockOnly = searchParams.get("inStockOnly") === "true";
  const sort = (searchParams.get("sort") as SearchSortValue | null) || "relevance";

  const [searchInput, setSearchInput] = useState(query);

  useSeo({
    title: query ? `Поиск: ${query} — ТЕХАКС` : "Поиск — ТЕХАКС",
    description: "Полнотекстовый поиск по товарам, категориям и страницам Techaks.",
    canonicalPath: `/search${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    noindex: true,
  });

  const searchQuery = trpc.search.query.useQuery(
    {
      query,
      page,
      limit,
      categoryId,
      brandId,
      priceFrom,
      priceTo,
      inStockOnly,
      sort,
    },
    {
      enabled: query.length >= 1,
      staleTime: 30_000,
      retry: false,
    }
  );
  const clickLogMutation = trpc.search.logClick.useMutation();

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const data = searchQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const updateSearch = (patch: Record<string, string | number | boolean | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "" || value === false) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    if (!patch.page) next.delete("page");
    navigate(`/search?${next.toString()}`);
  };

  const submitSearch = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const normalized = searchInput.trim();
    if (!normalized) return;
    updateSearch({
      q: normalized,
      page: 1,
    });
  };

  const summaryText = useMemo(() => {
    if (!query) return "Введите запрос, чтобы начать поиск";
    if (!data) return `Ищем совпадения по запросу «${query}»`;
    return `Найдено ${data.total} товаров по запросу «${query}»`;
  }, [data, query]);

  const handleResultClick = async (
    url: string,
    entityType: "product" | "category" | "page",
    entityId: number,
    position: number
  ) => {
    if (data?.searchLogId) {
      try {
        await clickLogMutation.mutateAsync({
          searchLogId: data.searchLogId,
          entityType,
          entityId,
          position,
          url,
        });
      } catch {
        // Logging should never block navigation.
      }
    }
    navigate(url);
  };

  const filtersPanel = data ? (
    <SearchFilters
      facets={data.facets}
      selectedCategoryId={categoryId}
      selectedBrandId={brandId}
      inStockOnly={inStockOnly}
      priceFrom={priceFrom}
      priceTo={priceTo}
      onCategoryChange={value =>
        updateSearch({ categoryId: value, page: 1 })
      }
      onBrandChange={value =>
        updateSearch({ brandId: value, page: 1 })
      }
      onInStockChange={value =>
        updateSearch({ inStockOnly: value ? "true" : undefined, page: 1 })
      }
      onPriceChange={(from, to) =>
        updateSearch({ priceFrom: from, priceTo: to, page: 1 })
      }
      onReset={() =>
        updateSearch({
          categoryId: undefined,
          brandId: undefined,
          priceFrom: undefined,
          priceTo: undefined,
          inStockOnly: undefined,
          page: 1,
        })
      }
    />
  ) : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <section className="border-b border-border bg-muted/20 py-12 md:py-16">
        <div className="container-main space-y-6">
          <div className="space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--tech-color-primary)]">
              Поиск
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-5xl">
              {query ? (
                <>
                  Результаты по запросу{" "}
                  <span className="text-[var(--tech-color-primary)]">«{query}»</span>
                </>
              ) : (
                "Поиск по сайту"
              )}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              {summaryText}
            </p>
          </div>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={submitSearch}
            autoFocus
            placeholder="Найти товар, артикул, бренд, категорию или страницу..."
          />
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="container-main">
          {searchQuery.isLoading ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-[var(--tech-color-primary)]" size={42} />
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Строим результаты поиска
              </div>
            </div>
          ) : searchQuery.isError ? (
            <div className="mx-auto max-w-2xl rounded-[var(--tech-radius-card)] border border-red-200 bg-red-50 px-6 py-8 text-center text-red-700 shadow-[var(--tech-shadow-card)]">
              <div className="text-sm font-black uppercase tracking-[0.2em]">
                Поиск временно недоступен
              </div>
              <p className="mt-3 text-sm leading-6">
                Не удалось собрать результаты по запросу. Попробуйте обновить страницу
                или повторить поиск чуть позже.
              </p>
            </div>
          ) : !query ? (
            <SearchEmptyState query="..." />
          ) : data ? (
            data.total > 0 || data.categories.length > 0 || data.pages.length > 0 ? (
              <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="hidden lg:block">{filtersPanel}</div>

                <div className="space-y-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <Sheet>
                      <SheetTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground lg:hidden"
                        >
                          <SlidersHorizontal size={16} />
                          Фильтры
                        </button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto p-5">
                        <SheetHeader className="px-0 pt-0">
                          <SheetTitle>Фильтры поиска</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">{filtersPanel}</div>
                      </SheetContent>
                    </Sheet>
                    <div className="ml-auto">
                      <SearchSortSelect
                        value={sort}
                        onChange={value => updateSearch({ sort: value, page: 1 })}
                      />
                    </div>
                  </div>

                  {(data.categories.length > 0 || data.pages.length > 0) && (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {data.categories.length > 0 ? (
                        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                          <div className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                            Найденные категории
                          </div>
                          <div className="space-y-2">
                            {data.categories.map((item, index) => (
                              <button
                                key={`category-${item.id}`}
                                type="button"
                                onClick={() => handleResultClick(item.url, "category", item.id, index)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-muted/40"
                              >
                                <div>
                                  <div className="text-sm font-bold text-foreground">
                                    <SearchHighlight text={item.title} query={query} />
                                  </div>
                                  {item.subtitle ? (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {item.subtitle}
                                    </div>
                                  ) : null}
                                </div>
                                <span className="text-xs font-black text-[var(--tech-color-primary)]">
                                  {item.count}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {data.pages.length > 0 ? (
                        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                          <div className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                            Найденные страницы
                          </div>
                          <div className="space-y-2">
                            {data.pages.map((item, index) => (
                              <button
                                key={`page-${item.id}`}
                                type="button"
                                onClick={() => handleResultClick(item.url, "page", item.id, index)}
                                className="block w-full rounded-xl px-3 py-3 text-left transition hover:bg-muted/40"
                              >
                                <div className="text-sm font-bold text-foreground">
                                  <SearchHighlight text={item.title} query={query} />
                                </div>
                                {item.subtitle ? (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {item.subtitle}
                                  </div>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {data.products.length > 0 ? (
                    <>
                      <SearchResultsGrid
                        products={data.products}
                        onProductClick={(productId, url, position) =>
                          handleResultClick(url, "product", productId, position)
                        }
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--tech-radius-card)] border border-border bg-card px-5 py-4 shadow-[var(--tech-shadow-card)]">
                        <div className="text-sm text-muted-foreground">
                          Страница {page} из {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => updateSearch({ page: page - 1 })}
                            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Назад
                          </button>
                          <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => updateSearch({ page: page + 1 })}
                            className="rounded-xl bg-[var(--tech-color-primary)] px-4 py-2 text-sm font-black text-[var(--tech-color-primary-foreground)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Дальше
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <SearchEmptyState query={query} correctedQuery={data.correctedQuery} />
                  )}
                </div>
              </div>
            ) : (
              <SearchEmptyState query={query} correctedQuery={data.correctedQuery} />
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
