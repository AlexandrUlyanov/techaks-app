import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowRight,
  ArrowUpDown,
  Grid2X2,
  List,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import ProductCard from "@/components/ProductCard";
import ProductFilters, {
  type SelectedSpecFilter,
} from "@/components/ProductFilters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trpc } from "@/providers/trpc";
import { isFullPriceRange, normalizePriceRange } from "@/lib/price-range";
import { useSeo } from "@/lib/seo";
import { formatRussianCount } from "@/lib/russian-plurals";
import {
  buildBreadcrumbStructuredData,
  buildOrganizationStructuredData,
  getPublicSchemaAddress,
} from "@/lib/seo-structured";

const PAGE_SIZE = 28;

const sortOptions = [
  { value: "discount-desc", label: "По размеру скидки" },
  { value: "price-asc", label: "Сначала дешевле" },
  { value: "price-desc", label: "Сначала дороже" },
  { value: "name-asc", label: "По названию" },
] as const;

type SortValue = (typeof sortOptions)[number]["value"];

function readNumber(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function discountPercent(product: { price: number; oldPrice?: number | null }) {
  const oldPrice = Number(product.oldPrice ?? 0);
  const price = Number(product.price ?? 0);
  if (oldPrice <= price || price <= 0) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export default function PromotionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const activeCategory = searchParams.get("category") || "all";
  const sortBy =
    (searchParams.get("sort") as SortValue | null) || "discount-desc";
  const layout = searchParams.get("layout") === "list" ? "list" : "grid";
  const priceFrom = readNumber(searchParams.get("priceFrom"));
  const priceTo = readNumber(searchParams.get("priceTo"));

  const selectedFilters = useMemo<SelectedSpecFilter[]>(() => {
    return searchParams.getAll("filter").flatMap(value => {
      const separator = value.indexOf(":");
      if (separator <= 0 || separator === value.length - 1) return [];
      return [
        {
          normalizedKey: value.slice(0, separator),
          normalizedValue: value.slice(separator + 1),
        },
      ];
    });
  }, [searchParams]);

  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: banners = [], isLoading: bannersLoading } =
    trpc.banner.getActive.useQuery();
  const { data: specFilters = [] } = trpc.product.getSpecFilters.useQuery({
    categorySlug: activeCategory,
    promotionalOnly: true,
  });
  const { data: promotionalData, isLoading: productsLoading } =
    trpc.product.getPromotionalProducts.useQuery({
      categorySlug: activeCategory,
      specFilters: selectedFilters,
    });

  const promotionalProducts = promotionalData?.products ?? [];
  const promotionalCategories = promotionalData?.categories ?? [];
  const activeCategoryItem = promotionalCategories.find(
    category => category.slug === activeCategory
  );
  const priceRange = useMemo(() => {
    const bounds = promotionalData?.priceBounds;
    if (!bounds || bounds.max <= 0) return null;
    return normalizePriceRange(bounds, { from: priceFrom, to: priceTo });
  }, [priceFrom, priceTo, promotionalData?.priceBounds]);

  const filteredProducts = useMemo(() => {
    if (!priceRange) return promotionalProducts;
    return promotionalProducts.filter(product => {
      const price = Number(product.price ?? 0);
      return price >= priceRange.currentMin && price <= priceRange.currentMax;
    });
  }, [priceRange, promotionalProducts]);

  const sortedProducts = useMemo(() => {
    const products = [...filteredProducts];
    if (sortBy === "price-asc") products.sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") products.sort((a, b) => b.price - a.price);
    if (sortBy === "name-asc") {
      products.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }
    if (sortBy === "discount-desc") {
      products.sort(
        (a, b) =>
          discountPercent(b) - discountPercent(a) ||
          Number(b.oldPrice ?? b.price) -
            b.price -
            (Number(a.oldPrice ?? a.price) - a.price) ||
          a.name.localeCompare(b.name, "ru")
      );
    }
    return products;
  }, [filteredProducts, sortBy]);

  const visibleProducts = sortedProducts.slice(0, visibleCount);
  const hasMoreProducts = visibleCount < sortedProducts.length;
  const resultLabel = formatRussianCount(sortedProducts.length, [
    "товар",
    "товара",
    "товаров",
  ]);
  const allProductsCount = promotionalCategories.reduce(
    (sum, category) => sum + category.productCount,
    0
  );

  const selectedFilterLabels = useMemo(() => {
    const labels = new Map<string, { key: string; value: string }>();
    for (const group of specFilters) {
      for (const value of group.values) {
        labels.set(`${group.normalizedKey}:${value.normalizedValue}`, {
          key: group.key,
          value: value.value,
        });
      }
    }
    return selectedFilters.map(filter => ({
      ...filter,
      ...(labels.get(`${filter.normalizedKey}:${filter.normalizedValue}`) ?? {
        key: filter.normalizedKey,
        value: filter.normalizedValue,
      }),
    }));
  }, [selectedFilters, specFilters]);

  const hasProductFilters =
    selectedFilters.length > 0 || Boolean(priceRange?.isActive);
  const hasAnyFilters = activeCategory !== "all" || hasProductFilters;

  const updateParams = useCallback(
    (update: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      update(next);
      setSearchParams(next, { replace: true });
      setVisibleCount(PAGE_SIZE);
    },
    [searchParams, setSearchParams]
  );

  const selectCategory = (categorySlug: string) => {
    updateParams(next => {
      if (categorySlug === "all") next.delete("category");
      else next.set("category", categorySlug);
      next.delete("filter");
      next.delete("priceFrom");
      next.delete("priceTo");
    });
    setMobileFiltersOpen(false);
  };

  const updateSelectedFilters = (filters: SelectedSpecFilter[]) => {
    updateParams(next => {
      next.delete("filter");
      for (const filter of filters) {
        next.append(
          "filter",
          `${filter.normalizedKey}:${filter.normalizedValue}`
        );
      }
    });
  };

  const toggleFilter = (filter: SelectedSpecFilter) => {
    const exists = selectedFilters.some(
      item =>
        item.normalizedKey === filter.normalizedKey &&
        item.normalizedValue === filter.normalizedValue
    );
    updateSelectedFilters(
      exists
        ? selectedFilters.filter(
            item =>
              item.normalizedKey !== filter.normalizedKey ||
              item.normalizedValue !== filter.normalizedValue
          )
        : [...selectedFilters, filter]
    );
  };

  const clearProductFilters = () => {
    updateParams(next => {
      next.delete("filter");
      next.delete("priceFrom");
      next.delete("priceTo");
    });
  };

  const clearAllFilters = () => {
    updateParams(next => {
      next.delete("category");
      next.delete("filter");
      next.delete("priceFrom");
      next.delete("priceTo");
    });
  };

  const setPriceRange = (min: number, max: number) => {
    updateParams(next => {
      const bounds = promotionalData?.priceBounds;
      if (!bounds || isFullPriceRange(bounds, { from: min, to: max })) {
        next.delete("priceFrom");
        next.delete("priceTo");
      } else {
        next.set("priceFrom", String(Math.floor(min)));
        next.set("priceTo", String(Math.ceil(max)));
      }
    });
  };

  useEffect(() => {
    if (!promotionalData?.priceBounds) return;
    const normalized = normalizePriceRange(promotionalData.priceBounds, {
      from: priceFrom,
      to: priceTo,
    });
    if (
      (priceFrom !== undefined && priceFrom !== normalized.currentMin) ||
      (priceTo !== undefined && priceTo !== normalized.currentMax)
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete("priceFrom");
      next.delete("priceTo");
      setSearchParams(next, { replace: true });
    }
  }, [
    priceFrom,
    priceTo,
    promotionalData?.priceBounds,
    searchParams,
    setSearchParams,
  ]);

  useSeo({
    title: activeCategoryItem
      ? `Акции на товары категории ${activeCategoryItem.name} — ТЕХАКС`
      : "Акции и спецпредложения ТЕХАКС",
    description: activeCategoryItem
      ? `Товары категории ${activeCategoryItem.name} со скидками в ТЕХАКС. Актуальные цены и наличие.`
      : "Актуальные акции, скидки и спецпредложения ТЕХАКС на технику и аксессуары.",
    canonicalPath: "/promotions",
    noindex: searchParams.toString().length > 0,
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", path: "/" },
        { name: "Акции", path: "/promotions" },
      ]),
      buildOrganizationStructuredData({
        name: "ТЕХАКС",
        url: "https://techaks.ru",
        logo: "https://techaks.ru/images/logo-light.svg",
        email: siteProfile?.contacts.email || "tech.aks@yandex.ru",
        phone:
          siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88",
        address: getPublicSchemaAddress({
          shortAddress: siteProfile?.contacts.shortAddress,
          fullAddress: siteProfile?.contacts.fullAddress,
          legalAddress: siteProfile?.seller.legalAddress,
        }),
      }),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Акции и спецпредложения ТЕХАКС",
        url: "https://techaks.ru/promotions",
      },
    ],
  });

  const categoryFilter = (
    <div className="space-y-1.5">
      <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        Категории
      </div>
      <button
        type="button"
        onClick={() => selectCategory("all")}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
          activeCategory === "all"
            ? "bg-[#05C3D4]/14 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span>Все товары</span>
        <span className="text-xs font-bold text-[#05C3D4]">
          {allProductsCount}
        </span>
      </button>
      {promotionalCategories.map(category => (
        <button
          key={category.id}
          type="button"
          onClick={() => selectCategory(category.slug)}
          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors ${
            activeCategory === category.slug
              ? "bg-[#05C3D4]/14 text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span className="min-w-0">{category.name}</span>
          <span className="shrink-0 text-xs font-bold text-[#05C3D4]">
            {category.productCount}
          </span>
        </button>
      ))}
    </div>
  );

  const productFilters = (
    <ProductFilters
      filters={specFilters}
      selected={selectedFilters}
      priceRange={
        priceRange
          ? {
              min: priceRange.min,
              max: priceRange.max,
              currentMin: priceRange.currentMin,
              currentMax: priceRange.currentMax,
            }
          : null
      }
      onToggle={toggleFilter}
      onPriceChange={setPriceRange}
      onClear={clearProductFilters}
    />
  );

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <section className="relative overflow-hidden py-8 md:py-11">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(5,195,212,0.08),transparent_34%)]" />
        <div className="container-main relative">
          <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
            Акции и выгода
          </span>
          <h1 className="font-heading text-3xl font-black tracking-tight md:text-5xl">
            Товары со скидкой
          </h1>
        </div>
      </section>

      {!bannersLoading && banners.length > 0 ? (
        <section className="pb-10">
          <div className="container-main grid gap-5 md:grid-cols-2">
            {banners.map(promo => (
              <Link
                key={promo.id}
                to={promo.slug ? `/promotions/${promo.slug}` : "/promotions"}
                className="group relative min-h-56 overflow-hidden rounded-[24px] bg-muted"
              >
                <img
                  src={promo.image}
                  alt={promo.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-6 text-white">
                  <div>
                    <h2 className="font-heading text-2xl font-black">
                      {promo.title}
                    </h2>
                    {promo.subtitle ? (
                      <p className="mt-1 line-clamp-2 text-sm text-white/80">
                        {promo.subtitle}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight className="shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="pb-16">
        <div className="container-main">
          <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="hidden self-start lg:sticky lg:top-24 lg:block">
              {categoryFilter}
              <div className="my-5 h-px bg-border/70" />
              {productFilters}
            </aside>

            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-heading text-2xl font-black md:text-3xl">
                    {activeCategoryItem?.name || "Все акционные товары"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {resultLabel}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Sheet
                    open={mobileFiltersOpen}
                    onOpenChange={setMobileFiltersOpen}
                  >
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        className="relative flex h-11 items-center gap-2 rounded-full bg-muted px-4 text-sm font-bold lg:hidden"
                      >
                        <SlidersHorizontal size={17} />
                        Фильтры
                        {hasAnyFilters ? (
                          <span className="h-2 w-2 rounded-full bg-[#05C3D4]" />
                        ) : null}
                      </button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      className="w-[92vw] overflow-y-auto sm:max-w-md"
                    >
                      <SheetHeader className="mb-6 text-left">
                        <SheetTitle>Фильтры</SheetTitle>
                      </SheetHeader>
                      {categoryFilter}
                      <div className="my-5 h-px bg-border" />
                      {productFilters}
                    </SheetContent>
                  </Sheet>

                  <Select
                    value={sortBy}
                    onValueChange={value =>
                      updateParams(next => {
                        if (value === "discount-desc") next.delete("sort");
                        else next.set("sort", value);
                      })
                    }
                  >
                    <SelectTrigger className="h-11 min-w-[185px] rounded-full border-0 bg-muted px-4">
                      <ArrowUpDown size={16} />
                      <SelectValue placeholder="Сортировка" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="hidden items-center rounded-full bg-muted p-1 sm:flex">
                    <button
                      type="button"
                      aria-label="Показывать сеткой"
                      onClick={() =>
                        updateParams(next => next.delete("layout"))
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        layout === "grid"
                          ? "bg-[#05C3D4] text-black"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Grid2X2 size={17} />
                    </button>
                    <button
                      type="button"
                      aria-label="Показывать списком"
                      onClick={() =>
                        updateParams(next => next.set("layout", "list"))
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        layout === "list"
                          ? "bg-[#05C3D4] text-black"
                          : "text-muted-foreground"
                      }`}
                    >
                      <List size={17} />
                    </button>
                  </div>
                </div>
              </div>

              {hasAnyFilters ? (
                <div className="mb-6 flex flex-wrap gap-2">
                  {activeCategoryItem ? (
                    <button
                      type="button"
                      onClick={() => selectCategory("all")}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#05C3D4]/12 px-3 text-xs font-bold"
                    >
                      {activeCategoryItem.name}
                      <X size={14} />
                    </button>
                  ) : null}
                  {selectedFilterLabels.map(filter => (
                    <button
                      key={`${filter.normalizedKey}:${filter.normalizedValue}`}
                      type="button"
                      onClick={() => toggleFilter(filter)}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full bg-muted px-3 text-xs font-bold"
                    >
                      {filter.key}: {filter.value}
                      <X size={14} />
                    </button>
                  ))}
                  {priceRange?.isActive ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPriceRange(priceRange.min, priceRange.max)
                      }
                      className="inline-flex min-h-9 items-center gap-2 rounded-full bg-muted px-3 text-xs font-bold"
                    >
                      Цена: {priceRange.currentMin.toLocaleString("ru-RU")}–
                      {priceRange.currentMax.toLocaleString("ru-RU")} ₽
                      <X size={14} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex min-h-9 items-center gap-2 px-2 text-xs font-bold text-[#05C3D4]"
                  >
                    <RotateCcw size={14} />
                    Сбросить всё
                  </button>
                </div>
              ) : null}

              {productsLoading ? (
                <div className="flex justify-center py-24">
                  <Loader2 className="animate-spin text-[#05C3D4]" size={42} />
                </div>
              ) : visibleProducts.length > 0 ? (
                <>
                  <div
                    className={
                      layout === "list"
                        ? "space-y-3"
                        : "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                    }
                  >
                    {visibleProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product as any}
                        variant={layout}
                      />
                    ))}
                  </div>
                  {hasMoreProducts ? (
                    <div className="mt-8 flex justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleCount(count => count + PAGE_SIZE)
                        }
                        className="rounded-full bg-[#05C3D4] px-7 py-3 text-sm font-black text-black transition-opacity hover:opacity-90"
                      >
                        Показать ещё
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="py-20 text-center">
                  <h3 className="font-heading text-2xl font-black">
                    Подходящих товаров сейчас нет
                  </h3>
                  <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
                    Снимите часть фильтров, чтобы увидеть больше товаров со
                    скидкой.
                  </p>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#05C3D4] px-6 py-3 text-sm font-black text-black"
                  >
                    <RotateCcw size={16} />
                    Сбросить фильтры
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
