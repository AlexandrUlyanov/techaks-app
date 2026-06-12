import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight, FolderTree, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CategoryIcon } from "@/lib/category-icons";
import { formatCategoryLabel } from "@/lib/category-labels";
import { cn } from "@/lib/utils";
import {
  getProductCardImageProps,
} from "@/lib/product-images";

type CategoryRecord = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  icon?: string | null;
};

type CategoryPreviewRecord = {
  categoryId: number;
  productCount: number;
  previewImage?: string | null;
  previewImageVariants?: unknown;
  hasChildren: boolean;
};

type RootCatalogNavigatorProps = {
  categories: CategoryRecord[];
  previews: CategoryPreviewRecord[];
  activeBranchSlug: string | null;
  onSelectBranch: (slug: string, source: "tree" | "card") => void;
  onOpenCategory: (slug: string, source: "tree" | "card") => void;
  onOpenLeafCategory: (slug: string, source: "tree" | "card") => void;
};

function formatProductCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} товара`;
  }

  return `${count} товаров`;
}

export default function RootCatalogNavigator({
  categories,
  previews,
  activeBranchSlug,
  onSelectBranch,
  onOpenCategory,
  onOpenLeafCategory,
}: RootCatalogNavigatorProps) {
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

  const getBranchDescendants = (category: CategoryRecord): CategoryRecord[] => {
    const children = byParent.get(category.id) ?? [];
    return [category, ...children.flatMap(child => getBranchDescendants(child))];
  };

  const effectiveBranch = useMemo(() => {
    if (activeBranchSlug && slugMap.has(activeBranchSlug)) {
      return slugMap.get(activeBranchSlug) ?? null;
    }
    return null;
  }, [activeBranchSlug, slugMap]);

  const previewByCategoryId = useMemo(
    () => new Map(previews.map(preview => [preview.categoryId, preview] as const)),
    [previews]
  );

  const branchStats = useMemo(() => {
    const map = new Map<
      number,
      {
        count: number;
        previewImage?: string | null;
        previewImageVariants?: unknown;
      }
    >();
    for (const category of categories) {
      const branch = getBranchDescendants(category);
      let count = 0;
      let previewImage: string | null | undefined;
      let previewImageVariants: unknown;

      for (const item of branch) {
        const stats = previewByCategoryId.get(item.id);
        count += stats?.productCount ?? 0;
        if (!previewImage && stats?.previewImage) {
          previewImage = stats.previewImage;
          previewImageVariants = stats.previewImageVariants;
        }
      }
      map.set(category.id, { count, previewImage, previewImageVariants });
    }
    return map;
  }, [categories, previewByCategoryId]);

  const toggleExpanded = (slug: string) => {
    setExpandedSlugs(prev => ({ ...prev, [slug]: !prev[slug] }));
  };

  const isExpanded = (category: CategoryRecord) => {
    if (effectiveBranch && getAncestors(effectiveBranch).some(item => item.slug === category.slug)) return true;
    return expandedSlugs[category.slug] ?? false;
  };

  const renderTree = (nodes: CategoryRecord[], depth = 0) => {
    return (
      <ul className={cn("space-y-1", depth > 0 ? "mt-1 pl-4" : "")}>
        {nodes.map(category => {
          const children = byParent.get(category.id) ?? [];
          const hasChildren = children.length > 0;
          const active = effectiveBranch?.slug === category.slug;
          const categoryLabel = formatCategoryLabel(category.name);

          return (
            <li key={category.id} className="space-y-1">
              <div
                className={cn(
                  "group flex items-center gap-2 rounded-2xl px-2.5 py-2 text-left transition-colors duration-200 motion-reduce:transition-none",
                  active
                    ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_13%,transparent)] text-foreground dark:text-white"
                    : "text-muted-foreground hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_8%,transparent)] hover:text-foreground dark:text-white/62 dark:hover:text-white"
                )}
              >
                <Link
                  to={
                    hasChildren && depth === 0
                      ? `/catalog?cat=all#${encodeURIComponent(category.slug)}`
                      : `/catalog?cat=${category.slug}`
                  }
                  replace={hasChildren && depth === 0}
                  onClick={() => {
                    if (!hasChildren) {
                      onOpenLeafCategory(category.slug, "tree");
                      return;
                    }

                    if (depth === 0) {
                      onSelectBranch(category.slug, "tree");
                      return;
                    }

                    onOpenCategory(category.slug, "tree");
                  }}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    hasChildren
                      ? `Открыть ветку каталога ${categoryLabel}`
                      : `Перейти в категорию ${categoryLabel}`
                  }
                  className="flex min-w-0 flex-1 items-center rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tech-color-primary)]/40"
                >
                  <span className="line-clamp-2 text-sm font-semibold leading-5">
                    {categoryLabel}
                  </span>
                </Link>

                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(category.slug)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[var(--tech-color-surface-muted)] hover:text-foreground dark:text-white/52 dark:hover:text-white"
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
            </li>
          );
        })}
      </ul>
    );
  };

  const treePanel = (
    <nav
      aria-label="Дерево категорий каталога"
      className="rounded-[1.4rem] bg-[color:color-mix(in_srgb,var(--tech-color-surface)_58%,transparent)] p-4 md:p-5"
    >
      <div>{renderTree(topLevelCategories)}</div>
    </nav>
  );

  const mobileRootCategories = topLevelCategories;
  const desktopVisibleCategories = effectiveBranch
    ? byParent.get(effectiveBranch.id) ?? []
    : topLevelCategories;
  const mobileVisibleCategories = effectiveBranch
    ? byParent.get(effectiveBranch.id) ?? []
    : mobileRootCategories;

  const getCardCount = (
    stats:
      | CategoryPreviewRecord
      | {
          count: number;
          previewImage?: string | null;
          previewImageVariants?: unknown;
        }
      | undefined
  ) => {
    if (!stats) return 0;
    return "productCount" in stats ? stats.productCount : stats.count;
  };

  const renderCategoryCards = (
    items: CategoryRecord[],
    context: "root-top" | "branch-children",
    layoutClassName: string,
    imageSizes: string
  ) => (
    <div className={layoutClassName}>
      {items.map((category, index) => {
        const hasChildren = (byParent.get(category.id) ?? []).length > 0;
        const stats =
          hasChildren
            ? branchStats.get(category.id)
            : previewByCategoryId.get(category.id) ?? branchStats.get(category.id);
        const imageProps =
          category.imageUrl
            ? getProductCardImageProps({
                image: category.imageUrl,
                imageVariants: null,
                sizes: imageSizes,
              })
            : null;
        const categoryLabel = formatCategoryLabel(category.name);

        return (
          <Link
            key={category.id}
            to={
              context === "root-top"
                ? `/catalog?cat=all#${encodeURIComponent(category.slug)}`
                : `/catalog?cat=${category.slug}`
            }
            replace={context === "root-top"}
            onClick={() => {
              if (context === "root-top") {
                onSelectBranch(category.slug, "card");
                return;
              }

              if (hasChildren) {
                onOpenCategory(category.slug, "card");
                return;
              }

              onOpenLeafCategory(category.slug, "card");
            }}
            aria-label={
              hasChildren
                ? `Открыть раздел каталога ${categoryLabel}`
                : `Перейти в категорию ${categoryLabel}`
            }
            className="group block overflow-hidden rounded-[1.5rem] bg-[var(--tech-color-surface)] text-left ring-1 ring-transparent transition-[border-color,box-shadow] duration-200 hover:ring-[rgba(5,195,212,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tech-color-primary)]/40 active:scale-[0.995] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-reduce:transition-none dark:hover:ring-[#05C3D4]/30"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="flex h-[152px] items-center justify-center bg-white p-5 dark:bg-white">
              {imageProps ? (
                <img
                  src={imageProps.src}
                  srcSet={imageProps.srcSet}
                  sizes={imageProps.sizes}
                  alt={categoryLabel}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[1.25rem] bg-[var(--tech-color-surface-muted)]/60 text-[var(--tech-color-primary)]">
                  <CategoryIcon name={category.name} slug={category.slug} size={hasChildren ? 52 : 42} className="text-current" />
                </div>
              )}
            </div>
            <div className="space-y-2 px-4 py-4 md:px-5">
              <div className={cn(
                "line-clamp-2 text-foreground dark:text-white/92",
                hasChildren
                  ? "text-sm font-black tracking-tight md:text-base"
                  : "text-sm font-bold leading-5"
              )}>
                {categoryLabel}
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground dark:text-white/62">
                <span>
                  {getCardCount(stats) > 0
                    ? formatProductCount(getCardCount(stats))
                    : hasChildren
                      ? "Открыть категорию"
                      : "Подборка товаров"}
                </span>
                <ChevronRight size={15} className="text-[var(--tech-color-primary)]" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <h1 className="text-[30px] font-black tracking-tight text-foreground md:text-[38px]">
        Каталог
      </h1>

      <div className="md:hidden">
        {effectiveBranch ? (
          <>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--tech-color-surface-muted)]/80 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--tech-color-surface-muted)]"
                >
                  <FolderTree size={16} />
                  Категории
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full max-w-none overflow-y-auto bg-background p-0">
                <SheetHeader className="px-5 py-4">
                  <SheetTitle className="text-left text-sm font-black uppercase tracking-[0.2em]">
                    Категории
                  </SheetTitle>
                </SheetHeader>
                <div className="p-4">{treePanel}</div>
              </SheetContent>
            </Sheet>

            <div className="mt-6 space-y-4">
              <div className="px-1 text-lg font-black text-foreground">
                {effectiveBranch ? formatCategoryLabel(effectiveBranch.name) : "Каталог"}
              </div>

              {mobileVisibleCategories.length > 0 ? (
                renderCategoryCards(
                  mobileVisibleCategories,
                  "branch-children",
                  "grid grid-cols-2 gap-3 sm:grid-cols-2",
                  "(max-width: 768px) 44vw, 220px"
                )
              ) : (
                <div className="rounded-[1.5rem] bg-[color:color-mix(in_srgb,var(--tech-color-surface)_58%,transparent)] px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,transparent)] text-[var(--tech-color-primary)]">
                    <Search size={22} />
                  </div>
                  <div className="mt-5 text-xl font-black text-foreground dark:text-white/92">Категории не найдены</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-white/62">
                    Откройте соседнюю ветку каталога или вернитесь к верхнему уровню.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          renderCategoryCards(
            mobileRootCategories,
            "root-top",
            "grid grid-cols-2 gap-3 sm:grid-cols-2",
            "(max-width: 768px) 44vw, 260px"
          )
        )}
      </div>

      <div className="hidden gap-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
        <div className="sticky top-[var(--header-height,96px)] max-h-[calc(100vh_-_var(--header-height,96px)_-_24px)] self-start overflow-y-auto pr-2 no-scrollbar">
          {treePanel}
        </div>

        <div className="space-y-4">
          {effectiveBranch ? (
            <div className="px-1 text-lg font-black text-foreground">
              {formatCategoryLabel(effectiveBranch.name)}
            </div>
          ) : null}

          {desktopVisibleCategories.length > 0 ? (
            renderCategoryCards(
              desktopVisibleCategories,
              effectiveBranch ? "branch-children" : "root-top",
              "grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4",
              "(max-width: 1280px) 26vw, 240px"
            )
          ) : (
            <div className="rounded-[1.5rem] bg-[color:color-mix(in_srgb,var(--tech-color-surface)_58%,transparent)] px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,transparent)] text-[var(--tech-color-primary)]">
                <Search size={22} />
              </div>
              <div className="mt-5 text-xl font-black text-foreground dark:text-white/92">Категории не найдены</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-white/62">
                Откройте соседнюю ветку каталога или вернитесь к верхнему уровню.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
