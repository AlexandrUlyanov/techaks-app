import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
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
};

type SearchResultItem = {
  category: CategoryRecord;
  trail: CategoryRecord[];
  productCount: number;
  previewImage?: string | null;
  previewImageVariants?: unknown;
  isLeaf: boolean;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function formatProductCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} товара`;
  }

  return `${count} товаров`;
}

function highlightText(label: string, query: string) {
  if (!query) return label;
  const normalizedLabel = normalizeText(label);
  const normalizedQuery = normalizeText(query);
  const startIndex = normalizedLabel.indexOf(normalizedQuery);
  if (startIndex === -1) return label;
  const endIndex = startIndex + normalizedQuery.length;
  return (
    <>
      {label.slice(0, startIndex)}
      <mark className="rounded bg-[color:color-mix(in_srgb,var(--tech-color-primary)_16%,transparent)] px-1 text-foreground">
        {label.slice(startIndex, endIndex)}
      </mark>
      {label.slice(endIndex)}
    </>
  );
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

function CategorySearch({
  query,
  onQueryChange,
  searchResults,
  currentCategory,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  searchResults: SearchResultItem[];
  currentCategory: CategoryRecord;
}) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setActiveIndex(searchResults.length > 0 ? 0 : -1);
  }, [searchResults.length, query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!query.trim() || searchResults.length === 0) {
      if (event.key === "Escape") onQueryChange("");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(prev => (prev + 1) % searchResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const target = searchResults[activeIndex] ?? searchResults[0];
      navigate(`/catalog?cat=${target.category.slug}`);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onQueryChange("");
    }
  };

  return (
    <div className="space-y-4">
      <label className="sr-only" htmlFor={`category-search-${currentCategory.slug}`}>
        Найти категорию в разделе {currentCategory.name}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`category-search-${currentCategory.slug}`}
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Найти категорию в «${currentCategory.name}»`}
          className="h-12 rounded-full border-transparent bg-[rgba(255,255,255,0.72)] pl-11 pr-12 text-sm shadow-[0_10px_30px_rgba(15,23,42,0.08)] focus-visible:ring-[var(--tech-color-primary)]/30"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Очистить поиск"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {query.trim() ? (
        searchResults.length > 0 ? (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-muted-foreground">
              Найдено {searchResults.length} категорий
            </div>
            <div className="space-y-3">
              {searchResults.map((result, index) => {
                const preview = result.previewImage
                  ? getProductCardImageProps({
                      image: result.previewImage,
                      imageVariants: result.previewImageVariants,
                      sizes: "(max-width: 768px) 88vw, 120px",
                    })
                  : null;

                return (
                  <Link
                    key={result.category.id}
                    to={`/catalog?cat=${result.category.slug}`}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-[1.25rem] bg-white/88 px-4 py-3 text-left shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:bg-white",
                      activeIndex === index && "ring-2 ring-[var(--tech-color-primary)]/30"
                    )}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                      {preview ? (
                        <img
                          src={preview.src}
                          srcSet={preview.srcSet}
                          sizes={preview.sizes}
                          alt={result.category.name}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                          onError={applyProductImageFallback}
                        />
                      ) : (
                        <CategoryIcon
                          name={result.category.name}
                          slug={result.category.slug}
                          size={22}
                          className="text-[var(--tech-color-primary)]"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-foreground">
                        {highlightText(result.category.name, query)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {result.trail.map(item => item.name).join(" → ")}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-muted-foreground">
                        {result.productCount > 0 ? formatProductCount(result.productCount) : result.isLeaf ? "Раздел" : "Категория"}
                      </div>
                      <ChevronRight size={16} className="ml-auto mt-1 text-[var(--tech-color-primary)]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] bg-[radial-gradient(circle_at_top,rgba(5,195,212,0.08),transparent_55%)] px-5 py-6 text-center shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="text-lg font-black text-foreground">Ничего не найдено</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Попробуйте изменить запрос или выбрать категорию из списка ниже.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}

function CategoryCard({
  category,
  preview,
  productCount,
  variant,
  childNames,
}: {
  category: CategoryRecord;
  preview?: CategoryPreviewRecord | { previewImage?: string | null; previewImageVariants?: unknown } | null;
  productCount: number;
  variant: "parent" | "leaf";
  childNames?: string[];
}) {
  const imageProps =
    preview?.previewImage
      ? getProductCardImageProps({
          image: preview.previewImage,
          imageVariants: preview.previewImageVariants,
          sizes: "(max-width: 768px) 44vw, (max-width: 1280px) 26vw, 240px",
        })
      : null;

  return (
    <Link
      to={`/catalog?cat=${category.slug}`}
      className="group overflow-hidden rounded-[1.5rem] bg-white/84 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-[2px] hover:bg-white hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tech-color-primary)]/40"
    >
      <div className="flex h-[132px] items-center justify-center rounded-[1.25rem] bg-white">
        {imageProps ? (
          <img
            src={imageProps.src}
            srcSet={imageProps.srcSet}
            sizes={imageProps.sizes}
            alt={category.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.04]"
            onError={applyProductImageFallback}
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
          <div className="text-base font-black leading-6 text-[#1F2933]">
            {category.name}
          </div>
          {variant === "leaf" ? (
          <div className="mt-2 text-sm text-[#6B7280]">
              {productCount > 0 ? formatProductCount(productCount) : "Перейти в раздел"}
            </div>
          ) : childNames?.length ? (
            <div className="mt-2 line-clamp-3 text-sm leading-6 text-[#6B7280]">
              {childNames.join(" · ")}
            </div>
          ) : (
            <div className="mt-2 text-sm text-[#6B7280]">Смотреть раздел</div>
          )}
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-[var(--tech-color-primary)] transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function MobileCategoryAccordion({
  sections,
  byParent,
  previewsByCategoryId,
  getBranchCount,
}: {
  sections: CategoryRecord[];
  byParent: Map<number | null, CategoryRecord[]>;
  previewsByCategoryId: Map<number, CategoryPreviewRecord>;
  getBranchCount: (category: CategoryRecord) => number;
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
          <div key={section.id} className="rounded-[1.4rem] bg-white/86 px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <button
              type="button"
              onClick={() => {
                if (!hasChildren) {
                  navigate(`/catalog?cat=${section.slug}`);
                  return;
                }
                setOpenSlugs(prev => ({ ...prev, [section.slug]: !isOpen }));
              }}
              aria-expanded={hasChildren ? isOpen : undefined}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <div className="text-base font-black text-[#1F2933]">{section.name}</div>
                <div className="mt-1 text-sm text-[#6B7280]">
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
                      childNames={
                        childHasChildren
                          ? getChildren(byParent, child.id)
                              .slice(0, 4)
                              .map(item => item.name)
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
}: CategoryLandingPageProps) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeSectionSlug, setActiveSectionSlug] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 180);
    return () => window.clearTimeout(handle);
  }, [searchValue]);

  const byParent = useMemo(() => buildByParent(categories), [categories]);
  const categoryById = useMemo(
    () => new Map(categories.map(category => [category.id, category] as const)),
    [categories]
  );
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
    if (!sectionCategories.length) {
      setActiveSectionSlug(null);
      return;
    }
    if (compactLayout) {
      setActiveSectionSlug(null);
      return;
    }
    setActiveSectionSlug(prev =>
      prev && sectionCategories.some(category => category.slug === prev)
        ? prev
        : sectionCategories.find(category => getChildren(byParent, category.id).length > 0)?.slug ??
          sectionCategories[0]?.slug ??
          null
    );
  }, [byParent, compactLayout, sectionCategories]);

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

  const searchResults = useMemo<SearchResultItem[]>(() => {
    const normalizedQuery = normalizeText(debouncedSearch);
    if (!normalizedQuery) return [];

    const scopedCategories = getDescendants(currentCategory, byParent);
    return scopedCategories
      .filter(category => {
        const fullTrail = [...getAncestors(category, categoryById), category];
        const currentCategoryIndex = fullTrail.findIndex(item => item.id === currentCategory.id);
        const trail =
          currentCategoryIndex >= 0
            ? fullTrail.slice(currentCategoryIndex)
            : [currentCategory, category];
        return trail.some(item => normalizeText(item.name).includes(normalizedQuery));
      })
      .map(category => {
        const fullTrail = [...getAncestors(category, categoryById), category];
        const currentCategoryIndex = fullTrail.findIndex(item => item.id === currentCategory.id);
        const trail =
          currentCategoryIndex >= 0
            ? fullTrail.slice(currentCategoryIndex)
            : [currentCategory, category];
        const preview =
          previewsByCategoryId.get(category.id)?.previewImage
            ? previewsByCategoryId.get(category.id)
            : findBranchPreview(category, byParent, previewsByCategoryId);
        const isLeaf = getChildren(byParent, category.id).length === 0;
        return {
          category,
          trail,
          productCount: isLeaf
            ? previewsByCategoryId.get(category.id)?.productCount ?? 0
            : getBranchCount(category),
          previewImage: preview?.previewImage ?? null,
          previewImageVariants: preview?.previewImageVariants ?? null,
          isLeaf,
        };
      })
      .sort(
        (a: SearchResultItem, b: SearchResultItem) =>
          b.productCount - a.productCount ||
          a.category.name.localeCompare(b.category.name, "ru")
      )
      .slice(0, 12);
  }, [byParent, categoryById, currentCategory, debouncedSearch, previewsByCategoryId]);

  const topDescription =
    currentCategory.description?.trim() ||
    `Найдите нужный раздел: техника для ухода, красоты, здоровья и личного использования.`;

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
      <div className="rounded-[1.75rem] bg-white/84 px-6 py-10 text-center shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
        <div className="text-2xl font-black text-[#1F2933]">
          В этом разделе пока нет подкатегорий
        </div>
        <p className="mt-3 text-sm leading-6 text-[#6B7280]">
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
          <h1 className="text-[30px] font-black tracking-tight text-[#1F2933] md:text-[38px]">
            {currentCategory.name}
          </h1>
          <p className="max-w-3xl text-[15px] leading-7 text-[#6B7280]">
            {topDescription}
          </p>
        </div>

        <CategorySearch
          query={searchValue}
          onQueryChange={setSearchValue}
          searchResults={searchResults}
          currentCategory={currentCategory}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onShowAllProducts}
            className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-[#05C3D4] ring-1 ring-[rgba(5,195,212,0.28)] transition hover:bg-[rgba(5,195,212,0.05)]"
          >
            Показать все товары в разделе
          </button>
        </div>
      </div>

      {!searchValue.trim() ? (
        <>
          <div
            className={cn(
              "hidden gap-6 lg:grid xl:gap-8",
              compactLayout ? "lg:grid-cols-1" : "lg:grid-cols-[300px_minmax(0,1fr)]"
            )}
          >
            {!compactLayout ? (
              <aside className="sticky top-[var(--header-height,96px)] max-h-[calc(100vh-var(--header-height,96px)-24px)] overflow-y-auto pr-2">
                <div className="space-y-1">
                  {sectionCategories.map((section: CategoryRecord) => {
                    const isActive = activeSection?.slug === section.slug;
                    const children = getChildren(byParent, section.id);
                    return (
                      <div key={section.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (children.length === 0) {
                              navigate(`/catalog?cat=${section.slug}`);
                              return;
                            }
                            setActiveSectionSlug(section.slug);
                          }}
                          className={cn(
                            "flex min-h-12 w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition",
                            isActive
                              ? "bg-[linear-gradient(90deg,rgba(5,195,212,0.16),rgba(5,195,212,0.04))] text-[#1F2933] shadow-[inset_3px_0_0_0_#05C3D4]"
                              : "text-[#464A50] hover:bg-[rgba(5,195,212,0.06)]"
                          )}
                        >
                          <span className="flex min-w-0 items-start gap-2">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
                              <CategoryIcon name={section.name} slug={section.slug} size={16} className="text-current" />
                            </span>
                            <span className="line-clamp-2 text-sm font-semibold leading-5">
                              {section.name}
                            </span>
                          </span>
                          {children.length > 0 ? (
                            <ChevronDown
                              size={16}
                              className={cn(
                                "mt-1 shrink-0 text-[#05C3D4] transition-transform",
                                isActive ? "rotate-180" : ""
                              )}
                            />
                          ) : (
                            <ChevronRight size={16} className="mt-1 shrink-0 text-[#05C3D4]" />
                          )}
                        </button>
                        {isActive && children.length > 0 ? (
                          <div className="space-y-1 pl-4">
                            {children.map((child: CategoryRecord) => (
                              <Link
                                key={child.id}
                                to={`/catalog?cat=${child.slug}`}
                                className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-[#464A50] transition hover:bg-[rgba(5,195,212,0.06)] hover:text-[#1F2933]"
                              >
                                <span className="line-clamp-2 leading-5">{child.name}</span>
                                <ChevronRight size={14} className="mt-0.5 shrink-0 text-[#05C3D4]" />
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </aside>
            ) : null}

            <div className="space-y-5">
              <div>
                <div className="text-sm font-bold text-[#6B7280]">
                  Выберите подкатегорию
                </div>
              </div>

              {desktopCards.length > 0 ? (
                <div className={cn("grid gap-4", compactLayout ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-2 xl:grid-cols-3")}>
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
                        childNames={
                          hasChildren
                            ? getChildren(byParent, child.id)
                                .slice(0, 4)
                                .map(item => item.name)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[1.6rem] bg-white/82 px-6 py-8 text-center shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                  <div className="text-xl font-black text-[#1F2933]">
                    Внутри раздела пока пусто
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                    Попробуйте открыть соседнюю категорию или перейти ко всем товарам раздела.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:hidden">
            <div className="text-sm font-bold text-[#6B7280]">
              Все категории
            </div>
            <MobileCategoryAccordion
              sections={sectionCategories}
              byParent={byParent}
              previewsByCategoryId={previewsByCategoryId}
              getBranchCount={getBranchCount}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
