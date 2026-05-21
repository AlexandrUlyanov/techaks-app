import { Link } from "react-router";
import SearchHighlight from "./SearchHighlight";

type SuggestionResult = {
  products: Array<{
    id: number;
    title: string;
    subtitle: string;
    url: string;
    imageUrl?: string;
    price?: number;
    inStock: boolean;
  }>;
  categories: Array<{
    id: number;
    title: string;
    url: string;
  }>;
  pages: Array<{
    id: number;
    title: string;
    url: string;
  }>;
};

function formatPrice(value?: number) {
  if (typeof value !== "number" || value <= 0) return null;
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export default function SearchSuggestions({
  query,
  results,
  isLoading,
  onSelect,
  onShowAll,
}: {
  query: string;
  results: SuggestionResult;
  isLoading: boolean;
  onSelect: (url: string, entityType: "product" | "category" | "page", entityId: number, position: number) => void;
  onShowAll: () => void;
}) {
  const hasResults =
    results.products.length > 0 ||
    results.categories.length > 0 ||
    results.pages.length > 0;

  return (
    <div className="absolute top-[calc(100%+0.5rem)] left-0 right-0 z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      {isLoading ? (
        <div className="p-6 text-center text-sm font-semibold text-muted-foreground">
          Ищем совпадения...
        </div>
      ) : hasResults ? (
        <>
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Быстрый поиск
            </span>
            <button
              type="button"
              onClick={onShowAll}
              className="text-[10px] font-black uppercase tracking-widest text-[var(--tech-color-primary)] hover:underline"
            >
              Показать все
            </button>
          </div>
          <div className="max-h-[440px] overflow-y-auto">
            {results.products.length > 0 ? (
              <div className="border-b border-border/80 px-3 py-3">
                <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Товары
                </div>
                <div className="space-y-1">
                  {results.products.map((item, index) => (
                    <button
                      key={`product-${item.id}`}
                      type="button"
                      onClick={() => onSelect(item.url, "product", item.id, index)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-muted/50"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-2">
                        <img
                          src={item.imageUrl || "/images/nofoto.jpg"}
                          alt={item.title}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-bold text-foreground">
                          <SearchHighlight text={item.title} query={query} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {item.subtitle ? (
                            <span className="line-clamp-1">
                              <SearchHighlight text={item.subtitle} query={query} />
                            </span>
                          ) : null}
                          {formatPrice(item.price) ? (
                            <span className="font-black text-[var(--tech-color-primary)]">
                              {formatPrice(item.price)}
                            </span>
                          ) : null}
                          <span className={item.inStock ? "text-green-600" : "text-muted-foreground"}>
                            {item.inStock ? "В наличии" : "Нет в наличии"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {results.categories.length > 0 ? (
              <div className="border-b border-border/80 px-3 py-3">
                <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Категории
                </div>
                <div className="space-y-1">
                  {results.categories.map((item, index) => (
                    <button
                      key={`category-${item.id}`}
                      type="button"
                      onClick={() => onSelect(item.url, "category", item.id, index)}
                      className="block w-full rounded-xl px-2 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted/50"
                    >
                      <SearchHighlight text={item.title} query={query} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {results.pages.length > 0 ? (
              <div className="px-3 py-3">
                <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Страницы
                </div>
                <div className="space-y-1">
                  {results.pages.map((item, index) => (
                    <button
                      key={`page-${item.id}`}
                      type="button"
                      onClick={() => onSelect(item.url, "page", item.id, index)}
                      className="block w-full rounded-xl px-2 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted/50"
                    >
                      <SearchHighlight text={item.title} query={query} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="space-y-3 p-6 text-center">
          <div className="text-sm font-bold text-foreground">Ничего не нашли</div>
          <div className="text-sm text-muted-foreground">
            По запросу «{query}» пока нет совпадений.
          </div>
          <Link
            to={`/search?q=${encodeURIComponent(query)}`}
            className="inline-flex rounded-xl bg-[var(--tech-color-primary)] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-[var(--tech-color-primary-foreground)]"
          >
            Открыть страницу поиска
          </Link>
        </div>
      )}
    </div>
  );
}
