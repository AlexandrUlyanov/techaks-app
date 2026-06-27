import { useRef, useMemo } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  X,
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  LayoutGrid,
  Sparkles,
  Tag,
  Star,
  PackageCheck,
  Store,
} from "lucide-react";
import type {
  CategoryGroup,
  CategoryItem,
  PromoBlock,
  Brand,
} from "@/contracts/catalog.types";
import { useCatalog } from "@/providers/CatalogProvider";
import { useMediaQuery, useBodyScrollLock } from "@/hooks/use-catalog-menu";
import { CategoryIcon } from "@/lib/category-icons";
import { formatCategoryLabel } from "@/lib/category-labels";
import { applyProductImageFallback, getProductCardImageProps } from "@/lib/product-images";

const IconWrapper = ({
  title,
  slug,
  size = 20,
  className = "",
}: {
  title: string;
  slug: string;
  size?: number;
  className?: string;
}) => {
  return <CategoryIcon name={title} slug={slug} size={size} className={className} />;
};

const Badge = ({ type }: { type?: string }) => {
  if (!type) return null;
  const styles: any = {
    new: "bg-green-500 text-white",
    sale: "bg-red-500 text-white",
    popular: "bg-[#05C3D4] text-white",
  };
  return (
    <span
      className={`text-[7px] font-black uppercase px-1 py-0.5 rounded ml-1.5 ${styles[type] || styles.new}`}
    >
      {type}
    </span>
  );
};

const desktopScenarioLinks = [
  {
    id: "sale",
    label: "Скидки",
    href: "/promotions",
    icon: Tag,
  },
  {
    id: "picks",
    label: "Выбор ТЕХАКС",
    href: "/promotions",
    icon: Star,
  },
  {
    id: "instock",
    label: "В наличии",
    href: "/catalog",
    icon: PackageCheck,
  },
  {
    id: "stores",
    label: "Магазины",
    href: "/stores",
    icon: Store,
  },
] as const;

// --- Trigger Component ---

export function CatalogTrigger({ className = "" }: { className?: string }) {
  const { isOpen, toggle } = useCatalog();
  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-3 h-11 px-5 sm:px-6 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-[#05C3D4]/10 ${
        isOpen
          ? "bg-white text-[#05C3D4] dark:bg-background border-border"
          : "bg-[#05C3D4] text-white dark:text-black hover:bg-[#27E6F2] border-transparent"
      } border ${className}`}
    >
      <div className="relative hidden sm:flex w-5 h-5 items-center justify-center">
        {isOpen ? (
          <X size={20} strokeWidth={2.5} />
        ) : (
          <LayoutGrid size={20} strokeWidth={2.5} />
        )}
      </div>
      <span>Каталог</span>
    </button>
  );
}

// --- Desktop Implementation ---

const DesktopCatalog = () => {
  const menu = useCatalog();
  const hoverTimeout = useRef<any>(null);
  const categoryGroups = menu.activeCategory?.children ?? [];
  const groupsWithChildren = categoryGroups.filter(group => (group.items?.length ?? 0) > 0);
  const singleCategories = categoryGroups.filter(group => (group.items?.length ?? 0) === 0);
  const hasAnyCategoryGroups = categoryGroups.length > 0;
  const showLeafCategoryFilters = !hasAnyCategoryGroups;
  const highlightedGroups = useMemo(
    () => categoryGroups.slice(0, 6),
    [categoryGroups]
  );
  const highlightedGroupIds = useMemo(
    () => new Set(highlightedGroups.map(group => group.id)),
    [highlightedGroups]
  );
  const secondaryGroups = useMemo(
    () => groupsWithChildren.filter(group => !highlightedGroupIds.has(group.id)),
    [groupsWithChildren, highlightedGroupIds]
  );
  const quickLinks = useMemo(
    () =>
      groupsWithChildren
        .flatMap(group => group.items.slice(0, 2).map(item => ({ ...item, groupTitle: group.title })))
        .slice(0, 10),
    [groupsWithChildren]
  );
  const { data: leafCategoryFilters = [] } = trpc.product.getSpecFilters.useQuery(
    {
      categorySlug: menu.activeCategory?.slug ?? "",
    },
    {
      enabled: Boolean(menu.activeCategory?.slug) && showLeafCategoryFilters,
      placeholderData: prev => prev,
    }
  );
  const typeFilter = useMemo(
    () =>
      leafCategoryFilters.find(
        filter => String(filter.normalizedKey).toLowerCase() === "тип"
      ),
    [leafCategoryFilters]
  );
  const { data: featuredProducts = [] } = trpc.product.getTopByCategoryStock.useQuery(
    {
      categorySlug: menu.activeCategory?.slug ?? "",
      limit: 2,
    },
    {
      enabled: Boolean(menu.activeCategory?.slug),
      placeholderData: prev => prev,
    }
  );

  const handleCategoryHover = (id: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      menu.setActiveCategoryId(id);
      menu.track("catalog_category_hover", { category_id: id });
    }, 100);
  };

  if (menu.isLoading) {
    return (
      <>
        <div
          className="fixed inset-0 top-[80px] bg-black/40 backdrop-blur-sm z-[90] animate-in fade-in duration-300"
          onClick={menu.close}
        />
        <div className="fixed top-[80px] left-0 right-0 bg-white dark:bg-[#15171A] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-b border-border z-[100] p-12">
          <div className="container-main text-sm font-bold text-muted-foreground">
            Загружаем каталог...
          </div>
        </div>
      </>
    );
  }

  if (!menu.activeCategory) return null;
  const hasBrands = Boolean(menu.activeCategory.brands?.length);
  const hasPromo = Boolean(menu.activeCategory.promo?.length);
  const hasBottomSection = hasBrands || hasPromo;

  return (
    <>
      <div
        className="fixed inset-0 top-[80px] bg-black/40 backdrop-blur-sm z-[90] animate-in fade-in duration-300"
        onClick={menu.close}
      />
      <div
        className="fixed top-[80px] left-0 right-0 border-b border-border bg-background/98 backdrop-blur-xl z-[100] animate-in fade-in slide-in-from-top-4 duration-300 overflow-hidden"
        style={{ height: "min(calc(100vh - 80px), 860px)" }}
      >
        <div className="container-main flex h-full p-0">
          <div className="w-[320px] border-r border-border bg-muted/[0.18] overflow-hidden">
            <div className="border-b border-border px-8 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tech-color-primary)]">
                Каталог
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Выберите раздел, а справа сразу покажем понятные входы и популярные направления.
              </p>
            </div>
            <div className="py-3">
              {menu.catalogCategories.map(cat => (
                <button
                  key={cat.id}
                  onMouseEnter={() => handleCategoryHover(cat.id)}
                  onClick={() => {
                    menu.setActiveCategoryId(cat.id);
                    menu.track("catalog_category_click", { category_id: cat.id });
                  }}
                  className={`flex w-full items-center justify-between gap-4 px-8 py-4 text-left transition-all relative group ${
                    menu.activeCategoryId === cat.id
                      ? "bg-background text-foreground"
                      : "text-foreground/70 hover:text-foreground hover:bg-[var(--tech-color-primary)]/5"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                        menu.activeCategoryId === cat.id
                          ? "bg-[var(--tech-color-primary)]/10 text-[var(--tech-color-primary)]"
                          : "bg-background text-foreground/40 group-hover:bg-[var(--tech-color-primary)]/10 group-hover:text-[var(--tech-color-primary)]"
                      }`}
                    >
                      <IconWrapper
                        title={cat.title}
                        slug={cat.slug}
                        size={18}
                      />
                    </span>
                    <span className="text-[15px] font-semibold leading-[1.25]">
                      {formatCategoryLabel(cat.title)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={cat.href}
                      onClick={event => {
                        event.stopPropagation();
                        menu.close();
                      }}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        menu.activeCategoryId === cat.id
                          ? "text-[var(--tech-color-primary)] hover:bg-[var(--tech-color-primary)]/8"
                          : "text-muted-foreground hover:bg-background hover:text-foreground"
                      }`}
                    >
                      Открыть
                      <ArrowRight size={14} />
                    </Link>
                    <ChevronRight
                      size={14}
                      className={`transition-all ${
                        menu.activeCategoryId === cat.id
                          ? "text-[var(--tech-color-primary)] opacity-100"
                          : "opacity-30 group-hover:opacity-60"
                      }`}
                    />
                  </div>
                  {menu.activeCategoryId === cat.id && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[var(--tech-color-primary)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar bg-background">
            <div className="flex items-start justify-between gap-8 border-b border-border pb-6">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  {desktopScenarioLinks.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.id}
                        to={item.href}
                        onClick={menu.close}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[13px] font-semibold text-foreground/80 transition-colors hover:border-[var(--tech-color-primary)]/30 hover:bg-[var(--tech-color-primary)]/6 hover:text-foreground"
                      >
                        <Icon size={14} className="text-[var(--tech-color-primary)]" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tech-color-primary)]">
                    Активный раздел
                  </p>
                  <h2 className="mt-3 text-[34px] font-black leading-none tracking-[-0.03em] text-foreground">
                    {formatCategoryLabel(menu.activeCategory.title)}
                  </h2>
                </div>
              </div>
              <Link
                to={menu.activeCategory.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-[13px] font-semibold text-foreground transition-colors hover:border-[var(--tech-color-primary)]/30 hover:bg-[var(--tech-color-primary)]/6"
                onClick={menu.close}
              >
                Смотреть весь раздел
                <ArrowRight size={15} className="text-[var(--tech-color-primary)]" />
              </Link>
            </div>

            {highlightedGroups.length > 0 || featuredProducts.length > 0 ? (
              <div className="mt-7 grid grid-cols-[minmax(0,1fr)_320px] gap-6">
                {highlightedGroups.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                    {highlightedGroups.map(group => (
                      <Link
                        key={group.id}
                        to={group.href || "#"}
                        onClick={menu.close}
                        className="group rounded-[28px] border border-border bg-background px-5 py-5 transition-colors hover:border-[var(--tech-color-primary)]/35"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-[16px] font-semibold leading-[1.25] text-foreground">
                              {formatCategoryLabel(group.title)}
                            </h3>
                            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                              {group.items
                                ?.slice(0, 3)
                                .map(item => formatCategoryLabel(item.title))
                                .join(" · ") || "Открыть раздел"}
                            </p>
                          </div>
                          <ArrowRight
                            size={16}
                            className="mt-0.5 shrink-0 text-[var(--tech-color-primary)]/70 transition-transform group-hover:translate-x-0.5"
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div />
                )}
                {featuredProducts.length > 0 ? (
                  <div className="rounded-[30px] border border-border bg-muted/[0.16] px-5 py-5">
                    <div className="mb-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tech-color-primary)]">
                        Популярно сейчас
                      </div>
                      <div className="mt-2 text-[14px] leading-6 text-muted-foreground">
                        Быстрый вход в товары, которые чаще всего смотрят в этом разделе.
                      </div>
                    </div>
                    <div className="space-y-4">
                      {featuredProducts.map(product => {
                        const imageProps = getProductCardImageProps({
                          image: product.image ?? null,
                          imageVariants: null,
                          maxVariant: "thumb",
                          sizes: "84px",
                        });

                        return (
                          <Link
                            key={product.id}
                            to={`/product/${product.slug}`}
                            onClick={menu.close}
                            className="group flex items-center gap-4 rounded-[24px] bg-background px-3 py-3 transition-colors hover:border-[var(--tech-color-primary)]/20 hover:bg-background"
                          >
                            <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-[22px] bg-white p-2">
                              <img
                                src={imageProps.src}
                                srcSet={imageProps.srcSet}
                                sizes={imageProps.sizes}
                                alt={product.name}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-contain"
                                onError={applyProductImageFallback}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 text-[15px] font-semibold leading-[1.3] text-foreground">
                                {product.name}
                              </div>
                              <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-500">
                                В наличии
                              </div>
                              <div className="mt-2 flex items-center gap-3">
                                <span className="text-[22px] font-black leading-none text-foreground">
                                  {new Intl.NumberFormat("ru-RU").format(Number(product.price || 0))} ₽
                                </span>
                                <ArrowRight
                                  size={16}
                                  className="text-[var(--tech-color-primary)]/70 transition-transform group-hover:translate-x-0.5"
                                />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {secondaryGroups.length > 0 ? (
              <div className="mt-8 grid grid-cols-3 gap-x-8 gap-y-7">
                {secondaryGroups.map((group: CategoryGroup) => (
                  <div key={group.id} className="space-y-3">
                    <h3 className="text-[15px] font-semibold leading-tight text-foreground">
                      <Link to={group.href || "#"} onClick={menu.close} className="transition-colors hover:text-[var(--tech-color-primary)]">
                        {formatCategoryLabel(group.title)}
                      </Link>
                    </h3>
                    <div className="flex flex-col gap-2">
                      {group.items?.slice(0, 6).map((item: CategoryItem) => (
                        <Link
                          key={item.id}
                          to={item.href}
                          className="text-[14px] leading-5 font-medium text-muted-foreground transition-colors hover:text-foreground"
                          onClick={menu.close}
                        >
                          {formatCategoryLabel(item.title)}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : showLeafCategoryFilters ? (
              <div className="mt-8 pt-1">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    Типы товаров
                  </h3>
                  <Link
                    to={menu.activeCategory.href}
                    className="text-[13px] font-semibold text-[var(--tech-color-primary)] hover:underline"
                    onClick={menu.close}
                  >
                    Смотреть все товары
                  </Link>
                </div>
                {typeFilter && typeFilter.values.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {typeFilter.values.slice(0, 12).map(value => (
                      <Link
                        key={`${typeFilter.normalizedKey}:${value.normalizedValue}`}
                        to={`/catalog?cat=${menu.activeCategory?.slug ?? "all"}&filter=${encodeURIComponent(
                          `${typeFilter.normalizedKey}:${value.normalizedValue}`
                        )}`}
                        onClick={menu.close}
                        className="rounded-full border border-border px-4 py-3 text-[14px] font-medium text-foreground/75 transition-colors hover:border-[var(--tech-color-primary)]/30 hover:text-foreground"
                      >
                        {value.value}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-muted-foreground">
                    Для этой категории пока нет значений свойства "Тип".
                  </div>
                )}
              </div>
            ) : null}
            {singleCategories.length > 0 && (
              <div className={`${groupsWithChildren.length > 0 || showLeafCategoryFilters ? "mt-8 border-t border-border pt-6" : "mt-8"}`}>
                <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tech-color-primary)]">
                  <Sparkles size={14} />
                  Быстрые входы
                </div>
                <div className="flex flex-wrap gap-3">
                  {singleCategories.map((group: CategoryGroup) => (
                    <Link
                      key={group.id}
                      to={group.href || "#"}
                      onClick={menu.close}
                      className="rounded-full border border-border px-4 py-2.5 text-[14px] font-medium text-foreground/75 transition-colors hover:border-[var(--tech-color-primary)]/30 hover:text-foreground"
                    >
                      {formatCategoryLabel(group.title)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {quickLinks.length > 0 && (
              <div className="mt-8 border-t border-border pt-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tech-color-primary)]">
                    Быстрые переходы
                  </div>
                  <span className="text-[13px] text-muted-foreground">
                    Самые очевидные входы в раздел
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {quickLinks.map(item => (
                    <Link
                      key={`${item.id}-${item.href}`}
                      to={item.href}
                      onClick={menu.close}
                      className="rounded-full bg-muted/35 px-4 py-2.5 text-[14px] font-medium text-foreground/80 transition-colors hover:bg-[var(--tech-color-primary)]/8 hover:text-foreground"
                    >
                      {formatCategoryLabel(item.title)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {hasBottomSection && (
            <div className={`${groupsWithChildren.length > 0 || singleCategories.length > 0 || showLeafCategoryFilters ? "mt-8 pt-6 border-t border-border" : ""} flex gap-10`}>
              {hasBrands && (
                <div className="flex-1">
                  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tech-color-primary)]">
                    Производители
                  </div>
                  <div className="grid max-h-[150px] grid-cols-6 gap-x-5 gap-y-3 overflow-y-auto pr-2 xl:grid-cols-8">
                    {menu.activeCategory?.brands?.map((brand: Brand) => (
                      <Link
                        key={brand.id}
                        to={brand.href}
                        className="flex h-10 items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
                        title={brand.title}
                        onClick={menu.close}
                      >
                        {brand.logo ? (
                          <img
                            src={brand.logo}
                            alt={brand.title}
                            className="h-8 max-w-[86px] object-contain"
                            loading="lazy"
                          />
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {hasPromo && (
                <div className="w-[360px]">
                  {menu.activeCategory?.promo?.map((promo: PromoBlock) => (
                    <Link
                      key={promo.id}
                      to={promo.href}
                      className={`block rounded-[28px] border border-border p-7 relative overflow-hidden group h-full ${promo.theme === "accent" ? "bg-[var(--tech-color-primary)]/10 text-foreground" : "bg-muted/35"}`}
                      onClick={menu.close}
                    >
                      <div className="relative z-10">
                        <h4 className="text-[22px] font-black leading-tight mb-2">
                          {promo.title}
                        </h4>
                        <p className="text-sm leading-6 text-muted-foreground mb-6">
                          {promo.subtitle}
                        </p>
                        <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-[12px] font-semibold">
                          {promo.cta || "Смотреть"} <ArrowRight size={14} />
                        </span>
                      </div>
                      <div className="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform duration-700 translate-x-6 translate-y-6">
                        <LayoutGrid size={150} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// --- Mobile Implementation ---

const MobileCatalog = () => {
  const menu = useCatalog();
  useBodyScrollLock(menu.isOpen);

  const currentCategory = useMemo(
    () =>
      menu.mobilePath.length > 0
        ? menu.catalogCategories.find(c => c.id === menu.mobilePath[0])
        : null,
    [menu.catalogCategories, menu.mobilePath]
  );

  const currentGroup = useMemo(
    () =>
      menu.mobilePath.length >= 2 && currentCategory
        ? currentCategory.children?.find(g => g.id === menu.mobilePath[1])
        : null,
    [menu.mobilePath, currentCategory]
  );

  const handleBack = () => {
    menu.setMobilePath(prev => prev.slice(0, -1));
    menu.track("catalog_mobile_back");
  };

  const navigateIn = (id: string) => {
    menu.setMobilePath(prev => [...prev, id]);
    menu.track("catalog_category_click", { category_id: id });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
      <div className="h-16 px-6 border-b border-border flex items-center justify-between bg-card sticky top-0 z-20">
        {menu.mobilePath.length > 0 ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#05C3D4]"
          >
            <ChevronLeft size={24} />
            <span className="text-xs font-black uppercase tracking-widest">
              Назад
            </span>
          </button>
        ) : (
          <h2 className="text-lg font-black uppercase tracking-tighter">
            Каталог
          </h2>
        )}
        <button
          onClick={menu.close}
          className="p-2 -mr-2 text-muted-foreground"
        >
          <X size={24} />
        </button>
      </div>

      <div className="p-4 bg-muted/10 border-b border-border">
        <div className="relative group">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-[#05C3D4] transition-colors"
          />
          <input
            type="text"
            placeholder="Поиск по категориям..."
            value={menu.searchTerm}
            onChange={e => menu.setSearchTerm(e.target.value)}
            className="w-full h-12 bg-card border border-border rounded-xl pl-12 pr-4 text-sm font-bold placeholder:font-medium outline-none focus:border-[#05C3D4] transition-all"
          />
        </div>
        {!menu.searchTerm && menu.mobilePath.length === 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {desktopScenarioLinks.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={menu.close}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[12px] font-medium text-foreground/80"
                >
                  <Icon size={13} className="text-[var(--tech-color-primary)]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
        {menu.searchTerm ? (
            <div className="p-4 space-y-2">
              {menu.filteredCategories.map((item: any, i: number) => (
              <Link
                key={`${item.id}-${i}`}
                to={item.href || item.parentHref || "#"}
                onClick={menu.close}
                className="flex items-center justify-between p-5 bg-muted/30 rounded-2xl active:bg-[#05C3D4]/10 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">
                    {item.type}
                  </span>
                  <span className="text-sm font-black text-foreground">
                    {formatCategoryLabel(item.title)}
                  </span>
                </div>
                <ChevronRight size={16} className="text-[#05C3D4]" />
              </Link>
            ))}
          </div>
        ) : menu.mobilePath.length === 0 ? (
          <div className="divide-y divide-border">
            {menu.catalogCategories.map(cat => (
              <div
                key={cat.id}
                className="flex items-center justify-between py-5 px-6 active:bg-muted/50 transition-colors"
                onClick={() =>
                  cat.children
                    ? navigateIn(cat.id)
                    : (window.location.href = cat.href)
                }
              >
                <div className="flex items-center gap-5">
                  <IconWrapper
                    title={cat.title}
                    slug={cat.slug}
                    size={22}
                    className="text-[#05C3D4]"
                  />
                  <span className="text-[14px] font-black tracking-[0.08em]">
                    {formatCategoryLabel(cat.title)}
                  </span>
                </div>
                {cat.children && (
                  <ChevronRight size={18} className="opacity-20" />
                )}
              </div>
            ))}
          </div>
        ) : !currentGroup ? (
          <div className="animate-in slide-in-from-right duration-300">
            <div className="p-8 bg-card border-b border-border">
              <h3 className="text-[28px] font-black leading-none tracking-[-0.03em] mb-4">
                {currentCategory ? formatCategoryLabel(currentCategory.title) : ""}
              </h3>
              <Link
                to={currentCategory?.href || "#"}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--tech-color-primary)]"
                onClick={menu.close}
              >
                Смотреть весь раздел <ArrowRight size={12} />
              </Link>
            </div>
            <div className="p-4 space-y-2">
              {currentCategory?.children?.map(group => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-5 bg-card border border-border rounded-2xl active:bg-muted/50"
                  onClick={() =>
                    group.items?.length
                      ? navigateIn(group.id)
                      : (window.location.href = group.href || "#")
                  }
                >
                  <span className="text-[15px] font-semibold leading-[1.3]">
                    {formatCategoryLabel(group.title)}
                  </span>
                  <ChevronRight size={18} className="opacity-20" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-right duration-300">
            <div className="p-8 bg-card border-b border-border">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tech-color-primary)] block mb-2">
                {currentCategory ? formatCategoryLabel(currentCategory.title) : ""}
              </span>
              <h3 className="text-[28px] font-black leading-none tracking-[-0.03em]">
                {formatCategoryLabel(currentGroup.title)}
              </h3>
            </div>
            <div className="p-4 space-y-1">
              {currentGroup.items?.map(item => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="flex items-center justify-between p-5 bg-card border border-transparent border-b-border active:bg-[#05C3D4]/5"
                  onClick={menu.close}
                >
                  <span className="text-[15px] font-medium leading-6 text-foreground/85">
                    {formatCategoryLabel(item.title)}
                  </span>
                  <Badge type={item.badge} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Root Component ---

export default function CatalogMenu() {
  const { isOpen } = useCatalog();
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  if (!isOpen) return null;

  return isDesktop ? <DesktopCatalog /> : <MobileCatalog />;
}
