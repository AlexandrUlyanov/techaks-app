import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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
};

type CategoryPreviewRecord = {
  categoryId: number;
  productCount: number;
  previewImage?: string | null;
  previewImageVariants?: unknown;
  hasChildren: boolean;
};

type CategoryLandingPageProps = {
  currentCategory: CategoryRecord;
  categories: CategoryRecord[];
  previews: CategoryPreviewRecord[];
  loading?: boolean;
  onShowAllProducts: () => void;
  onNavigateCategory?: (slug: string, source: "card" | "accordion" | "sidebar") => void;
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

function buildByParent(categories: CategoryRecord[]) {
  const map = new Map<number | null, CategoryRecord[]>();
  for (const category of categories) {
    const key = category.parentId ?? null;
    const bucket = map.get(key) ?? [];
    bucket.push(category);
    map.set(key, bucket);
  }
  return map;
}

function getChildren(
  byParent: Map<number | null, CategoryRecord[]>,
  parentId: number | null
) {
  return byParent.get(parentId) ?? [];
}

function getAncestors(
  category: CategoryRecord,
  categoryById: Map<number, CategoryRecord>
) {
  const result: CategoryRecord[] = [];
  let currentParentId = category.parentId ?? null;
  while (currentParentId !== null) {
    const parent = categoryById.get(currentParentId);
    if (!parent) break;
    result.unshift(parent);
    currentParentId = parent.parentId ?? null;
  }
  return result;
}

function getDescendants(
  category: CategoryRecord,
  byParent: Map<number | null, CategoryRecord[]>
): CategoryRecord[] {
  const children = getChildren(byParent, category.id);
  return children.flatMap(child => [child, ...getDescendants(child, byParent)]);
}

function getBranchProductCount(
  category: CategoryRecord,
  byParent: Map<number | null, CategoryRecord[]>,
  previewsByCategoryId: Map<number, CategoryPreviewRecord>
) {
  const branch = [category, ...getDescendants(category, byParent)];
  return branch.reduce(
    (sum, item) => sum + (previewsByCategoryId.get(item.id)?.productCount ?? 0),
    0
  );
}

function findBranchPreview(
  category: CategoryRecord,
  byParent: Map<number | null, CategoryRecord[]>,
  previewsByCategoryId: Map<number, CategoryPreviewRecord>
) {
  const branch = [category, ...getDescendants(category, byParent)];
  for (const item of branch) {
    const preview = previewsByCategoryId.get(item.id);
    if (preview?.previewImage) {
      return preview;
    }
  }
  return previewsByCategoryId.get(category.id);
}

function CategoryCard({
  category,
  preview,
  productCount,
  variant,
  childNames,
  onNavigate,
}: {
  category: CategoryRecord;
  preview?: CategoryPreviewRecord | { previewImage?: string | null; previewImageVariants?: unknown } | null;
  productCount: number;
  variant: "parent" | "leaf";
  childNames?: string[];
  onNavigate?: (slug: string, source: "card") => void;
}) {
  const imageProps =
    category.imageUrl
      ? getProductCardImageProps({
          image: category.imageUrl,
          imageVariants: null,
          sizes: "(max-width: 768px) 44vw, (max-width: 1280px) 26vw, 240px",
        })
      : null;
  const categoryLabel = formatCategoryLabel(category.name);

  return (
    <Link
      to={`/catalog?cat=${category.slug}`}
      onClick={() => onNavigate?.(category.slug, "card")}
      aria-label={
        variant === "leaf"
          ? `Перейти в категорию ${categoryLabel}`
          : `Открыть раздел ${categoryLabel}`
      }
      className="group overflow-hidden rounded-[1.5rem] bg-[var(--tech-color-surface)] p-4 ring-1 ring-transparent transition-[border-color,box-shadow] duration-200 hover:ring-[rgba(5,195,212,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tech-color-primary)]/40 dark:hover:ring-[#05C3D4]/30"
    >
      <div className="flex h-[132px] items-center justify-center rounded-[1.25rem] bg-white p-4 dark:bg-white">
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
          <CategoryIcon
            name={category.name}
            slug={category.slug}
            size={44}
            className="text-[var(--tech-color-primary)]"
          />
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-black leading-6 text-foreground dark:text-white/92">
            {categoryLabel}
          </div>
          {variant === "leaf" ? (
          <div className="mt-2 text-sm text-muted-foreground dark:text-white/62">
              {productCount > 0 ? formatProductCount(productCount) : "Перейти в раздел"}
            </div>
          ) : childNames?.length ? (
            <div className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground dark:text-white/62">
              {childNames.join(" · ")}
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground dark:text-white/62">Смотреть раздел</div>
          )}
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-[var(--tech-color-primary)]" />
      </div>
    </Link>
  );
}

function MobileCategoryAccordion({
  sections,
  byParent,
  previewsByCategoryId,
  getBranchCount,
  onNavigateCategory,
}: {
  sections: CategoryRecord[];
  byParent: Map<number | null, CategoryRecord[]>;
  previewsByCategoryId: Map<number, CategoryPreviewRecord>;
  getBranchCount: (category: CategoryRecord) => number;
  onNavigateCategory?: (slug: string, source: "accordion") => void;
}) {
  const navigate = useNavigate();
  const [openSlugs, setOpenSlugs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenSlugs(prev => {
      if (sections.length === 0) return prev;
      if (Object.keys(prev).length > 0) return prev;
      return sections.reduce<Record<string, boolean>>((acc, section, index) => {
        acc[section.slug] = index < 2;
        return acc;
      }, {});
    });
  }, [sections]);

  return (
    <div className="space-y-3">
      {sections.map(section => {
        const isOpen = openSlugs[section.slug] ?? false;
        const children = getChildren(byParent, section.id);
        const hasChildren = children.length > 0;
        return (
          <div key={section.id} className="rounded-[1.4rem] bg-[var(--tech-color-surface)] px-4 py-3 ring-1 ring-transparent">
            <button
              type="button"
              onClick={() => {
                if (!hasChildren) {
                  onNavigateCategory?.(section.slug, "accordion");
                  navigate(`/catalog?cat=${section.slug}`);
                  return;
                }
                setOpenSlugs(prev => ({ ...prev, [section.slug]: !isOpen }));
              }}
              aria-expanded={hasChildren ? isOpen : undefined}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <div className="text-base font-black text-foreground dark:text-white/92">{formatCategoryLabel(section.name)}</div>
                <div className="mt-1 text-sm text-muted-foreground dark:text-white/62">
                  {getBranchCount(section) > 0
                    ? formatProductCount(getBranchCount(section))
                    : hasChildren
                      ? "Выберите раздел"
                      : "Открыть раздел"}
                </div>
              </div>
              {hasChildren ? (
                <ChevronDown
                  size={18}
                  className={cn(
                    "shrink-0 text-[var(--tech-color-primary)] transition-transform",
                    isOpen ? "rotate-180" : ""
                  )}
                />
              ) : (
                <ChevronRight
                  size={18}
                  className="shrink-0 text-[var(--tech-color-primary)]"
                />
              )}
            </button>

            {hasChildren && isOpen ? (
              <div className="mt-4 grid grid-cols-1 gap-3">
                {children.map(child => {
                  const childHasChildren = getChildren(byParent, child.id).length > 0;
                  const preview = childHasChildren
                    ? findBranchPreview(child, byParent, previewsByCategoryId)
                    : previewsByCategoryId.get(child.id);
                  return (
                    <CategoryCard
                      key={child.id}
                      category={child}
                      preview={preview}
                      productCount={childHasChildren ? getBranchCount(child) : previewsByCategoryId.get(child.id)?.productCount ?? 0}
                      variant={childHasChildren ? "parent" : "leaf"}
                      onNavigate={onNavigateCategory ? (slug) => onNavigateCategory(slug, "accordion") : undefined}
                      childNames={
                        childHasChildren
                          ? getChildren(byParent, child.id)
                              .slice(0, 4)
                              .map(item => formatCategoryLabel(item.name))
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function CategoryLandingPage({
  currentCategory,
  categories,
  previews,
  loading = false,
  onShowAllProducts,
  onNavigateCategory,
}: CategoryLandingPageProps) {
  const navigate = useNavigate();
  const [activeSectionSlug, setActiveSectionSlug] = useState<string | null>(null);
  const [expandedSectionSlugs, setExpandedSectionSlugs] = useState<Record<string, boolean>>({});

  const byParent = useMemo(() => buildByParent(categories), [categories]);
  const previewsByCategoryId = useMemo(
    () => new Map(previews.map(preview => [preview.categoryId, preview] as const)),
    [previews]
  );

  const sectionCategories = useMemo(
    () => getChildren(byParent, currentCategory.id),
    [byParent, currentCategory.id]
  );
  const compactLayout = sectionCategories.length <= 6;

  useEffect(() => {
    setActiveSectionSlug(prev =>
      prev && sectionCategories.some(category => category.slug === prev)
        ? prev
        : null
    );
  }, [sectionCategories]);

  useEffect(() => {
    setExpandedSectionSlugs(prev => {
      const nextEntries = Object.entries(prev).filter(([slug]) =>
        sectionCategories.some(category => category.slug === slug)
      );
      return Object.fromEntries(nextEntries);
    });
  }, [sectionCategories]);

  const activeSection = useMemo(
    () =>
      sectionCategories.find(category => category.slug === activeSectionSlug) ?? null,
    [activeSectionSlug, sectionCategories]
  );

  const getBranchCount = (category: CategoryRecord) =>
    getBranchProductCount(category, byParent, previewsByCategoryId);

  const desktopCards = useMemo(() => {
    if (compactLayout || !activeSection) {
      return sectionCategories;
    }
    const children = getChildren(byParent, activeSection.id);
    return children.length > 0 ? children : [activeSection];
  }, [activeSection, byParent, compactLayout, sectionCategories]);

  const compactGridClassName = useMemo(() => {
    const count = desktopCards.length;

    if (count <= 1) {
      return "mx-auto grid max-w-[360px] grid-cols-1 gap-4";
    }

    if (count === 2) {
      return "mx-auto grid max-w-[820px] grid-cols-1 gap-4 md:grid-cols-2";
    }

    if (count === 3) {
      return "mx-auto grid max-w-[1120px] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
    }

    return "mx-auto grid max-w-[1120px] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
  }, [desktopCards.length]);

  const topDescription =
    currentCategory.description?.trim() ||
    "";
  const currentCategoryLabel = formatCategoryLabel(currentCategory.name);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="h-10 w-72 animate-pulse rounded-2xl bg-[rgba(255,255,255,0.35)]" />
          <div className="h-5 w-full max-w-2xl animate-pulse rounded-xl bg-[rgba(255,255,255,0.28)]" />
          <div className="h-12 w-full animate-pulse rounded-full bg-[rgba(255,255,255,0.32)]" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-[1.2rem] bg-[rgba(255,255,255,0.32)]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-[260px] animate-pulse rounded-[1.5rem] bg-[rgba(255,255,255,0.32)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sectionCategories.length === 0) {
    return (
      <div className="rounded-[1.75rem] bg-[var(--tech-color-surface)] px-6 py-10 text-center ring-1 ring-transparent">
        <div className="text-2xl font-black text-foreground dark:text-white/92">
          В этом разделе пока нет подкатегорий
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground dark:text-white/62">
          Попробуйте выбрать другую категорию или вернуться в каталог.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/catalog?cat=all"
            className="inline-flex h-11 items-center rounded-full bg-[#05C3D4] px-5 text-sm font-black text-white transition hover:bg-[#27E6F2]"
          >
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-4 md:space-y-5">
        <div className="space-y-2">
          <h1 className="text-[30px] font-black tracking-tight text-foreground md:text-[38px]">
            {currentCategoryLabel}
          </h1>
          {topDescription ? (
            <p className="max-w-3xl text-[15px] leading-7 text-muted-foreground dark:text-white/64">
              {topDescription}
            </p>
          ) : null}
        </div>

      <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onShowAllProducts}
            aria-label={`Показать все товары в разделе ${currentCategoryLabel}`}
            className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-[#05C3D4] ring-1 ring-[rgba(5,195,212,0.28)] transition hover:bg-[rgba(5,195,212,0.05)] dark:bg-transparent dark:hover:bg-[rgba(5,195,212,0.08)]"
          >
            Показать все товары в разделе
          </button>
        </div>
      </div>

      <>
          <div
            className={cn(
              "hidden gap-6 lg:grid xl:gap-8",
              compactLayout ? "lg:grid-cols-1" : "lg:grid-cols-[300px_minmax(0,1fr)]"
            )}
          >
            {!compactLayout ? (
              <aside className="sticky top-[var(--header-height,96px)] max-h-[calc(100vh_-_var(--header-height,96px)_-_24px)] overflow-y-auto pr-2 no-scrollbar">
                <nav aria-label={`Подкатегории раздела ${currentCategoryLabel}`}>
                <div className="space-y-1">
                  {sectionCategories.map((section: CategoryRecord) => {
                    const isActive = activeSection?.slug === section.slug;
                    const children = getChildren(byParent, section.id);
                    const sectionLabel = formatCategoryLabel(section.name);
                    return (
                      <div key={section.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (children.length === 0) {
                              onNavigateCategory?.(section.slug, "sidebar");
                              navigate(`/catalog?cat=${section.slug}`);
                              return;
                            }
                            setActiveSectionSlug(prev =>
                              prev === section.slug ? null : section.slug
                            );
                            setExpandedSectionSlugs(prev => ({
                              ...prev,
                              [section.slug]: !prev[section.slug],
                            }));
                          }}
                            className={cn(
                              "flex min-h-12 w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition",
                              isActive
                              ? "bg-[linear-gradient(90deg,rgba(5,195,212,0.16),rgba(5,195,212,0.04))] text-foreground shadow-[inset_3px_0_0_0_#05C3D4] dark:text-white"
                              : "text-muted-foreground hover:bg-[rgba(5,195,212,0.06)] hover:text-foreground dark:text-white/62 dark:hover:text-white"
                          )}
                          aria-expanded={children.length > 0 ? expandedSectionSlugs[section.slug] ?? false : undefined}
                          aria-current={isActive ? "true" : undefined}
                        >
                          <span className="flex min-w-0 items-start">
                            <span className="line-clamp-2 text-sm font-semibold leading-5">
                              {sectionLabel}
                            </span>
                          </span>
                          {children.length > 0 ? (
                            <ChevronDown
                              size={16}
                              className={cn(
                                "mt-1 shrink-0 text-[#05C3D4] transition-transform",
                                expandedSectionSlugs[section.slug] ? "rotate-180" : ""
                              )}
                            />
                          ) : (
                            <ChevronRight size={16} className="mt-1 shrink-0 text-[#05C3D4]" />
                          )}
                        </button>
                        {expandedSectionSlugs[section.slug] && children.length > 0 ? (
                          <div className="space-y-1 pl-4">
                            {children.map((child: CategoryRecord) => (
                              <Link
                                key={child.id}
                                to={`/catalog?cat=${child.slug}`}
                                onClick={() => onNavigateCategory?.(child.slug, "sidebar")}
                                aria-label={`Перейти в категорию ${formatCategoryLabel(child.name)}`}
                                className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-[rgba(5,195,212,0.06)] hover:text-foreground dark:text-white/62 dark:hover:text-white"
                              >
                                <span className="line-clamp-2 leading-5">{formatCategoryLabel(child.name)}</span>
                                <ChevronRight size={14} className="mt-0.5 shrink-0 text-[#05C3D4]" />
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                </nav>
              </aside>
            ) : null}

            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {activeSection ? (
                  <div className="text-sm font-bold text-muted-foreground dark:text-white/66">
                    {formatCategoryLabel(activeSection.name)}
                  </div>
                ) : <div />}
                {activeSection ? (
                  <button
                    type="button"
                    onClick={() => setActiveSectionSlug(null)}
                    className="inline-flex min-h-10 items-center rounded-full bg-white/84 px-4 text-sm font-semibold text-[var(--tech-color-primary)] ring-1 ring-[rgba(5,195,212,0.24)] transition hover:bg-white dark:bg-white/6 dark:hover:bg-[rgba(5,195,212,0.08)]"
                  >
                    Все разделы категории
                  </button>
                ) : null}
              </div>

              {desktopCards.length > 0 ? (
                <div
                  className={cn(
                    "grid gap-4",
                    compactLayout
                      ? compactGridClassName
                      : "grid-cols-2 xl:grid-cols-3"
                  )}
                >
                  {desktopCards.map(child => {
                    const hasChildren = getChildren(byParent, child.id).length > 0;
                    const preview = hasChildren
                      ? findBranchPreview(child, byParent, previewsByCategoryId)
                      : previewsByCategoryId.get(child.id);
                    return (
                      <CategoryCard
                        key={child.id}
                        category={child}
                        preview={preview}
                        productCount={hasChildren ? getBranchCount(child) : previewsByCategoryId.get(child.id)?.productCount ?? 0}
                      variant={hasChildren ? "parent" : "leaf"}
                      onNavigate={onNavigateCategory ? (slug) => onNavigateCategory(slug, "card") : undefined}
                      childNames={
                        hasChildren
                          ? getChildren(byParent, child.id)
                                .slice(0, 4)
                                .map(item => formatCategoryLabel(item.name))
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[1.6rem] bg-[var(--tech-color-surface)] px-6 py-8 text-center ring-1 ring-transparent">
                  <div className="text-xl font-black text-foreground dark:text-white/92">
                    Внутри раздела пока пусто
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground dark:text-white/62">
                    Попробуйте открыть соседнюю категорию или перейти ко всем товарам раздела.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:hidden">
            <nav aria-label={`Все категории раздела ${currentCategoryLabel}`} className="space-y-4">
              <div className="text-sm font-bold text-muted-foreground dark:text-white/66">
                Все категории
              </div>
              <MobileCategoryAccordion
                sections={sectionCategories}
                byParent={byParent}
                previewsByCategoryId={previewsByCategoryId}
                getBranchCount={getBranchCount}
                onNavigateCategory={onNavigateCategory ? (slug) => onNavigateCategory(slug, "accordion") : undefined}
              />
            </nav>
          </div>
      </>
    </div>
  );
}
