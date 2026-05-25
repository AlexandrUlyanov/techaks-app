import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderTree, Search, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import {
  applyProductImageFallback,
  getProductCardImageProps,
} from "@/lib/product-images";

type CategoryRecord = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
};

type ProductRecord = {
  id: number;
  categoryId: number;
  name: string;
  image?: string | null;
  imageVariants?: unknown;
};

type RootCatalogNavigatorProps = {
  categories: CategoryRecord[];
  products: ProductRecord[];
  activeBranchSlug: string | null;
  onSelectBranch: (slug: string) => void;
  onOpenLeafCategory: (slug: string) => void;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function highlightLabel(label: string, query: string) {
  if (!query) return label;
  const normalizedLabel = normalizeText(label);
  const normalizedQuery = normalizeText(query);
  const startIndex = normalizedLabel.indexOf(normalizedQuery);
  if (startIndex === -1) return label;
  const endIndex = startIndex + normalizedQuery.length;
  return (
    <>
      {label.slice(0, startIndex)}
      <mark className="rounded bg-[color:color-mix(in_srgb,var(--tech-color-primary)_18%,transparent)] px-1 text-foreground">
        {label.slice(startIndex, endIndex)}
      </mark>
      {label.slice(endIndex)}
    </>
  );
}

export default function RootCatalogNavigator({
  categories,
  products,
  activeBranchSlug,
  onSelectBranch,
  onOpenLeafCategory,
}: RootCatalogNavigatorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSlugs, setExpandedSlugs] = useState<Record<string, boolean>>({});

  const byParent = useMemo(() => {
    const map = new Map<number | null, CategoryRecord[]>();
    for (const category of categories) {
      const key = category.parentId ?? null;
      const bucket = map.get(key) ?? [];
      bucket.push(category);
      map.set(key, bucket);
    }
    return map;
  }, [categories]);

  const slugMap = useMemo(
    () => new Map(categories.map(category => [category.slug, category])),
    [categories]
  );

  const topLevelCategories = useMemo(
    () => byParent.get(null) ?? [],
    [byParent]
  );

  const isLeaf = (category: CategoryRecord) => (byParent.get(category.id)?.length ?? 0) === 0;

  const getAncestors = (category: CategoryRecord) => {
    const result: CategoryRecord[] = [];
    let currentParentId = category.parentId ?? null;
    while (currentParentId !== null) {
      const parent = categories.find(item => item.id === currentParentId);
      if (!parent) break;
      result.unshift(parent);
      currentParentId = parent.parentId ?? null;
    }
    return result;
  };

  const getLeafDescendants = (category: CategoryRecord): CategoryRecord[] => {
    const children = byParent.get(category.id) ?? [];
    if (children.length === 0) return [category];
    return children.flatMap(child => getLeafDescendants(child));
  };

  const normalizedSearchQuery = normalizeText(searchQuery);

  const matchedLeafCategories = useMemo(() => {
    if (!normalizedSearchQuery) return [];

    return categories.filter(category => {
      if (!isLeaf(category)) return false;
      const trail = [category, ...getAncestors(category)];
      return trail.some(item => normalizeText(item.name).includes(normalizedSearchQuery));
    });
  }, [categories, normalizedSearchQuery]);

  const matchedAncestorSlugSet = useMemo(() => {
    if (!normalizedSearchQuery) return new Set<string>();
    const slugs = new Set<string>();
    matchedLeafCategories.forEach(category => {
      getAncestors(category).forEach(ancestor => slugs.add(ancestor.slug));
    });
    return slugs;
  }, [matchedLeafCategories, normalizedSearchQuery]);

  const effectiveBranch = useMemo(() => {
    if (normalizedSearchQuery) return null;
    if (activeBranchSlug && slugMap.has(activeBranchSlug)) {
      return slugMap.get(activeBranchSlug) ?? null;
    }
    return topLevelCategories[0] ?? null;
  }, [activeBranchSlug, normalizedSearchQuery, slugMap, topLevelCategories]);

  const visibleLeafCategories = useMemo(() => {
    if (normalizedSearchQuery) return matchedLeafCategories;
    if (!effectiveBranch) return [];
    return getLeafDescendants(effectiveBranch);
  }, [effectiveBranch, matchedLeafCategories, normalizedSearchQuery]);

  const categoryStats = useMemo(() => {
    const map = new Map<number, { count: number; product?: ProductRecord }>();
    for (const product of products) {
      const current = map.get(product.categoryId) ?? { count: 0, product: undefined };
      current.count += 1;
      if (!current.product && product.image) {
        current.product = product;
      }
      map.set(product.categoryId, current);
    }
    return map;
  }, [products]);

  const toggleExpanded = (slug: string) => {
    setExpandedSlugs(prev => ({ ...prev, [slug]: !prev[slug] }));
  };

  const isExpanded = (category: CategoryRecord) => {
    if (matchedAncestorSlugSet.has(category.slug)) return true;
    if (effectiveBranch && getAncestors(effectiveBranch).some(item => item.slug === category.slug)) return true;
    return expandedSlugs[category.slug] ?? topLevelCategories[0]?.slug === category.slug;
  };

  const renderTree = (nodes: CategoryRecord[], depth = 0) => {
    return (
      <div className={cn("space-y-1", depth > 0 ? "mt-1 pl-4" : "")}>
        {nodes.map(category => {
          const children = byParent.get(category.id) ?? [];
          const hasChildren = children.length > 0;
          const active = effectiveBranch?.slug === category.slug && !normalizedSearchQuery;

          return (
            <div key={category.id} className="space-y-1">
              <div
                className={cn(
                  "group flex items-center gap-2 rounded-2xl px-2.5 py-2 text-left transition-all duration-200 motion-reduce:transition-none",
                  active
                    ? "bg-[linear-gradient(90deg,rgba(5,195,212,0.16),rgba(5,195,212,0.04))] text-foreground shadow-[inset_3px_0_0_0_#05C3D4]"
                    : "text-muted-foreground hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_8%,transparent)] hover:text-foreground"
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    hasChildren ? onSelectBranch(category.slug) : onOpenLeafCategory(category.slug)
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] text-[var(--tech-color-primary)] transition group-hover:scale-[1.03] motion-reduce:transition-none">
                    <CategoryIcon name={category.name} slug={category.slug} size={16} className="text-current" />
                  </span>
                  <span className="truncate text-sm font-semibold">
                    {highlightLabel(category.name, searchQuery)}
                  </span>
                </button>

                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(category.slug)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                    aria-label={isExpanded(category) ? "Свернуть категорию" : "Раскрыть категорию"}
                  >
                    <ChevronDown
                      size={16}
                      className={cn(
                        "transition-transform duration-200 motion-reduce:transition-none",
                        isExpanded(category) ? "rotate-180" : ""
                      )}
                    />
                  </button>
                ) : (
                  <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--tech-color-primary)]/70" />
                )}
              </div>

              {hasChildren && isExpanded(category) ? renderTree(children, depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const treePanel = (
    <div className="rounded-[1.6rem] border border-white/5 bg-[rgba(255,255,255,0.035)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.16)] backdrop-blur-sm md:p-5">
      <div className="mb-4">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
          Дерево каталога
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Выберите ветку и перейдите к конечной категории с товарами
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Найти категорию..."
            className="h-11 rounded-full border-white/8 bg-[rgba(255,255,255,0.025)] pl-9 pr-4 text-sm shadow-none focus-visible:ring-[var(--tech-color-primary)]/25"
          />
        </div>
      </div>

      <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
        {renderTree(topLevelCategories)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="rounded-[1.75rem] border border-white/5 bg-[rgba(255,255,255,0.03)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.16)] md:px-6 md:py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground md:text-[2rem]">
              Все
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Категории и подкатегории интернет-магазина ТЕХАКС. Сначала выбираем ветку каталога, потом открываем конечную категорию с товарами.
            </p>
          </div>

          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/5 bg-[rgba(255,255,255,0.04)] px-4 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:bg-[rgba(255,255,255,0.06)]"
                >
                  <FolderTree size={16} />
                  Категории
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full max-w-none overflow-y-auto border-r-white/5 bg-background p-0">
                <SheetHeader className="border-b border-white/5 px-5 py-4">
                  <SheetTitle className="text-left text-sm font-black uppercase tracking-[0.2em]">
                    Категории
                  </SheetTitle>
                </SheetHeader>
                <div className="p-4">{treePanel}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
        <div className="hidden lg:block">
          <div className="sticky top-[var(--header-height,96px)]">{treePanel}</div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-white/5 bg-[rgba(255,255,255,0.035)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.16)] md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  {normalizedSearchQuery ? "Результаты поиска" : "Конечные категории"}
                </div>
                <div className="mt-1 text-lg font-black text-foreground">
                  {normalizedSearchQuery
                    ? `Найдено ${visibleLeafCategories.length}`
                    : effectiveBranch?.name ?? "Каталог"}
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tech-color-primary)]">
                <Sparkles size={14} />
                {visibleLeafCategories.length} категорий
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {normalizedSearchQuery
                ? "Показали конечные категории, которые совпали по названию или находятся внутри подходящей ветки."
                : "Откройте нужную конечную категорию и перейдите к обычной товарной выдаче."}
            </p>
          </div>

          {visibleLeafCategories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleLeafCategories.map((category, index) => {
                const stats = categoryStats.get(category.id);
                const previewProduct = stats?.product;
                const imageProps = previewProduct
                  ? getProductCardImageProps({
                      image: previewProduct.image,
                      imageVariants: previewProduct.imageVariants,
                      sizes: "(max-width: 768px) 44vw, (max-width: 1280px) 26vw, 220px",
                    })
                  : null;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onOpenLeafCategory(category.slug)}
                    className="group overflow-hidden rounded-[1.5rem] border border-white/5 bg-[rgba(255,255,255,0.035)] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-[3px] hover:bg-[rgba(255,255,255,0.055)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.22)] active:scale-[0.99] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-reduce:transition-none"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex h-[124px] items-center justify-center bg-white p-4">
                      {imageProps ? (
                        <img
                          src={imageProps.src}
                          srcSet={imageProps.srcSet}
                          sizes={imageProps.sizes}
                          alt={category.name}
                          loading="lazy"
                          decoding="async"
                          className="category-leaf-card__image h-full w-full object-contain transition duration-200 group-hover:scale-[1.045] motion-reduce:transition-none"
                          onError={applyProductImageFallback}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-[1.25rem] bg-[rgba(255,255,255,0.025)] text-[var(--tech-color-primary)]">
                          <CategoryIcon name={category.name} slug={category.slug} size={42} className="text-current" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 px-4 py-4">
                      <div className="line-clamp-2 text-sm font-bold leading-5 text-foreground">
                        {highlightLabel(category.name, searchQuery)}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {stats?.count ? `${stats.count} товаров` : "Подборка товаров"}
                        </span>
                        <ChevronRight size={15} className="text-[var(--tech-color-primary)] transition group-hover:translate-x-0.5 motion-reduce:transition-none" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-white/8 bg-[rgba(255,255,255,0.03)] px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.16)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,transparent)] text-[var(--tech-color-primary)]">
                <Search size={22} />
              </div>
              <div className="mt-5 text-xl font-black text-foreground">Категории не найдены</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Попробуйте другой запрос или откройте соседнюю ветку каталога.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
