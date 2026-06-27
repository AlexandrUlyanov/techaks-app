import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { X, ChevronRight, ChevronLeft, ArrowRight, LayoutGrid } from "lucide-react";
import type { CategoryGroup, CategoryItem, Brand } from "@/contracts/catalog.types";
import { useCatalog } from "@/providers/CatalogProvider";
import { useMediaQuery, useBodyScrollLock } from "@/hooks/use-catalog-menu";
import { CategoryIcon } from "@/lib/category-icons";
import { formatCategoryLabel } from "@/lib/category-labels";
import { getProductCardImageProps } from "@/lib/product-images";

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
  const styles: Record<string, string> = {
    new: "bg-green-500 text-white",
    sale: "bg-red-500 text-white",
    popular: "bg-[#05C3D4] text-white",
  };
  return (
    <span
      className={`ml-1.5 rounded px-1 py-0.5 text-[7px] font-black uppercase ${styles[type] || styles.new}`}
    >
      {type}
    </span>
  );
};

type PromoMenuProduct = {
  id: number;
  slug: string;
  name: string;
  price: number;
  oldPrice?: number | null;
  image: string;
  imageVariants?: unknown;
  inStock?: boolean | null;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price) + " ₽";

function CatalogPromoCard({
  product,
  onClose,
}: {
  product: PromoMenuProduct;
  onClose: () => void;
}) {
  const imageProps = getProductCardImageProps({
    image: product.image,
    imageVariants: product.imageVariants,
    maxVariant: "card",
    sizes: "(max-width: 1680px) 220px, 240px",
  });
  const hasDiscount =
    typeof product.oldPrice === "number" && product.oldPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.max(
        1,
        Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)
      )
    : null;

  return (
    <Link
      to={`/product/${product.slug}`}
      onClick={onClose}
      className="group flex min-w-0 flex-col rounded-[28px] bg-muted/[0.08] p-4 transition-colors hover:bg-muted/[0.12]"
    >
      <div className="relative mb-4 overflow-hidden rounded-[22px] bg-white dark:bg-white/[0.03]">
        {discountPercent ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-[#05C3D4] px-2.5 py-1 text-[10px] font-black text-white">
            -{discountPercent}%
          </span>
        ) : null}
        <div className="aspect-square w-full">
          <img
            src={imageProps.src}
            srcSet={imageProps.srcSet}
            sizes={imageProps.sizes}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-4"
          />
        </div>
      </div>

      <div className="mb-2 min-h-[42px] text-[14px] font-bold leading-5 text-foreground">
        {product.name}
      </div>

      <div className="mt-auto flex items-end gap-2">
        <span className="text-[26px] font-black leading-none text-foreground">
          {formatPrice(product.price)}
        </span>
        {hasDiscount ? (
          <span className="pb-0.5 text-[13px] font-semibold text-muted-foreground line-through">
            {formatPrice(product.oldPrice!)}
          </span>
        ) : null}
      </div>

      <div
        className={`mt-2 text-[12px] font-semibold ${
          product.inStock ? "text-emerald-600" : "text-muted-foreground"
        }`}
      >
        {product.inStock ? "В наличии" : "Нет в наличии"}
      </div>
    </Link>
  );
}

export function CatalogTrigger({ className = "" }: { className?: string }) {
  const { isOpen, toggle } = useCatalog();
  return (
    <button
      onClick={toggle}
      className={`flex h-11 items-center gap-3 rounded-xl border px-5 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 sm:px-6 ${
        isOpen
          ? "border-border bg-white text-[#05C3D4] dark:bg-background"
          : "border-transparent bg-[#05C3D4] text-white hover:bg-[#27E6F2] dark:text-black"
      } ${className}`}
    >
      <div className="relative hidden h-5 w-5 items-center justify-center sm:flex">
        {isOpen ? <X size={20} strokeWidth={2.5} /> : <LayoutGrid size={20} strokeWidth={2.5} />}
      </div>
      <span>Каталог</span>
    </button>
  );
}

const DesktopCatalog = () => {
  const menu = useCatalog();
  const hoverTimeout = useRef<any>(null);
  const navigate = useNavigate();
  const [promoSlide, setPromoSlide] = useState(0);
  const categoryGroups = menu.activeCategory?.children ?? [];
  const groupsWithChildren = categoryGroups.filter(group => (group.items?.length ?? 0) > 0);
  const singleCategories = categoryGroups.filter(group => (group.items?.length ?? 0) === 0);
  const visibleGroups = groupsWithChildren.slice(0, 6);
  const visibleSingleCategories = singleCategories.slice(0, 8);
  const hasAnyCategoryGroups = categoryGroups.length > 0;
  const showLeafCategoryFilters = !hasAnyCategoryGroups;
  const { data: leafCategoryFilters = [] } = trpc.product.getSpecFilters.useQuery(
    {
      categorySlug: menu.activeCategory?.slug ?? "",
    },
    {
      enabled: Boolean(menu.activeCategory?.slug) && showLeafCategoryFilters,
      placeholderData: prev => prev,
    }
  );
  const { data: promotionalData } = trpc.product.getPromotionalProducts.useQuery(
    {
      categorySlug: menu.activeCategory?.slug ?? "all",
    },
    {
      enabled: Boolean(menu.activeCategory?.slug),
      placeholderData: prev => prev,
    }
  );

  const typeFilter = useMemo(
    () => leafCategoryFilters.find(filter => String(filter.normalizedKey).toLowerCase() === "тип"),
    [leafCategoryFilters]
  );

  const quickPreviewItems = useMemo(
    () =>
      visibleGroups
        .flatMap(group =>
          (group.items ?? []).slice(0, 2).map(item => ({
            ...item,
            groupTitle: group.title,
          }))
        )
        .slice(0, 8),
    [visibleGroups]
  );
  const promoProducts = useMemo<PromoMenuProduct[]>(
    () => (promotionalData?.products ?? []).slice(0, 9) as PromoMenuProduct[],
    [promotionalData?.products]
  );
  const promoPageCount = Math.max(1, Math.ceil(promoProducts.length / 3));
  const visiblePromoProducts = useMemo(
    () => promoProducts.slice(promoSlide * 3, promoSlide * 3 + 3),
    [promoProducts, promoSlide]
  );

  useEffect(() => {
    setPromoSlide(0);
  }, [menu.activeCategory?.slug]);

  useEffect(() => {
    if (promoSlide > promoPageCount - 1) {
      setPromoSlide(0);
    }
  }, [promoPageCount, promoSlide]);

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
          className="fixed inset-0 top-[80px] z-[90] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={menu.close}
        />
        <div className="fixed top-[80px] left-0 right-0 z-[100] bg-white p-12 dark:bg-[#15171A]">
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
        className="fixed inset-0 top-[80px] z-[90] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={menu.close}
      />
      <div className="fixed top-[80px] left-0 right-0 bottom-0 z-[100] overflow-hidden bg-white animate-in fade-in slide-in-from-top-4 duration-300 dark:bg-[#15171A]">
        <div className="container-main flex h-full flex-col py-4">
          <div className="mb-4 flex items-center justify-end">
            <button
              onClick={menu.close}
              className="inline-flex h-11 items-center rounded-2xl bg-muted/35 px-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-[#05C3D4]/10 hover:text-[#05C3D4]"
            >
              Закрыть
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[284px_minmax(0,1fr)] gap-7">
            <div className="rounded-[26px] bg-muted/[0.07] p-2.5">
              <div className="mb-2 px-2">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#05C3D4]">
                  Разделы
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {menu.catalogCategories.map(cat => (
                  <div
                    key={cat.id}
                    onMouseEnter={() => handleCategoryHover(cat.id)}
                    onClick={() => {
                      navigate(cat.href);
                      menu.close();
                    }}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-2xl px-4 py-2.5 transition-all ${
                      menu.activeCategoryId === cat.id
                        ? "bg-white text-[#05C3D4] dark:bg-background"
                        : "text-foreground/60 hover:bg-white/80 hover:text-[#05C3D4] dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    {menu.activeCategoryId === cat.id ? (
                      <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-[#05C3D4]" />
                    ) : null}
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          menu.activeCategoryId === cat.id
                            ? "bg-[#05C3D4]/10 text-[#05C3D4]"
                            : "bg-white/70 text-foreground/30 group-hover:bg-[#05C3D4]/8 group-hover:text-[#05C3D4] dark:bg-white/[0.03]"
                        }`}
                      >
                        <IconWrapper
                          title={cat.title}
                          slug={cat.slug}
                          size={17}
                          className="text-current"
                        />
                      </span>
                      <span className="line-clamp-2 text-[12.5px] font-semibold leading-4">
                        {formatCategoryLabel(cat.title)}
                      </span>
                    </div>
                    <ChevronRight
                      size={12}
                      className={`transition-all ${
                        menu.activeCategoryId === cat.id
                          ? "text-[#05C3D4] opacity-100"
                          : "opacity-0 group-hover:opacity-40"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] bg-white p-6 dark:bg-background">
              <div className="flex h-full flex-col">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[30px] font-black tracking-tight text-foreground xl:text-[34px]">
                      {formatCategoryLabel(menu.activeCategory.title)}
                    </h2>
                  </div>
                  <Link
                    to={menu.activeCategory.href}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#05C3D4]/10 px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#05C3D4] transition-colors hover:bg-[#05C3D4]/15"
                    onClick={menu.close}
                  >
                    Смотреть раздел <ArrowRight size={14} />
                  </Link>
                </div>

                {quickPreviewItems.length > 0 && (
                  <div className="mb-5 flex flex-wrap gap-2">
                    {quickPreviewItems.map((item: CategoryItem & { groupTitle?: string }) => (
                      <Link
                        key={`quick-${item.id}`}
                        to={item.href}
                        onClick={menu.close}
                        className="inline-flex items-center rounded-full bg-muted/35 px-3.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-[#05C3D4]/10 hover:text-[#05C3D4]"
                        title={formatCategoryLabel(item.groupTitle || "")}
                      >
                        {formatCategoryLabel(item.title)}
                      </Link>
                    ))}
                  </div>
                )}

                {visibleGroups.length > 0 ? (
                  <div className="grid flex-1 grid-cols-2 gap-x-10 gap-y-6 xl:grid-cols-3">
                    {visibleGroups.map((group: CategoryGroup) => (
                      <div key={group.id} className="min-w-0">
                        <h3 className="mb-2.5 text-[14px] font-bold leading-tight text-foreground">
                          <Link
                            to={group.href || "#"}
                            onClick={menu.close}
                            className="transition-colors hover:text-[#05C3D4]"
                          >
                            {formatCategoryLabel(group.title)}
                          </Link>
                        </h3>
                        <div className="flex flex-col gap-1.5">
                          {group.items?.slice(0, 5).map((item: CategoryItem) => (
                            <Link
                              key={item.id}
                              to={item.href}
                              className="truncate text-[12.5px] leading-5 font-medium text-muted-foreground transition-colors hover:text-[#05C3D4]"
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
                  <div className="flex flex-1 flex-col">
                    <div className="mb-3 text-[14px] font-bold text-foreground">Типы товаров</div>
                    {typeFilter && typeFilter.values.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 xl:grid-cols-4">
                        {typeFilter.values.slice(0, 12).map(value => (
                          <Link
                            key={`${typeFilter.normalizedKey}:${value.normalizedValue}`}
                            to={`/catalog?cat=${menu.activeCategory?.slug ?? "all"}&filter=${encodeURIComponent(
                              `${typeFilter.normalizedKey}:${value.normalizedValue}`
                            )}`}
                            onClick={menu.close}
                            className="inline-flex rounded-full bg-muted/35 px-3.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-[#05C3D4]/10 hover:text-[#05C3D4]"
                          >
                            {value.value}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-muted-foreground">
                        Для этой категории пока нет значений свойства "Тип".
                      </div>
                    )}
                  </div>
                ) : null}

                {visibleSingleCategories.length > 0 && (
                  <div className={`${visibleGroups.length > 0 || showLeafCategoryFilters ? "mt-4 pt-3" : "mt-auto pt-3"}`}>
                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                      {visibleSingleCategories.map((group: CategoryGroup) => (
                        <Link
                          key={group.id}
                          to={group.href || "#"}
                          onClick={menu.close}
                          className="rounded-full bg-muted/35 px-3.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-[#05C3D4]/10 hover:text-[#05C3D4]"
                        >
                          {formatCategoryLabel(group.title)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {visiblePromoProducts.length > 0 ? (
                  <div className="mt-5 border-t border-border/50 pt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
                          Акционные товары
                        </div>
                        <div className="mt-1 text-[13px] font-medium text-muted-foreground">
                          Скидки из раздела {formatCategoryLabel(menu.activeCategory.title)}
                        </div>
                      </div>
                      {promoPageCount > 1 ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPromoSlide(prev => Math.max(0, prev - 1))}
                            disabled={promoSlide === 0}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/35 text-foreground transition-colors hover:bg-[#05C3D4]/10 hover:text-[#05C3D4] disabled:cursor-default disabled:opacity-40"
                            aria-label="Предыдущие акционные товары"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPromoSlide(prev => Math.min(promoPageCount - 1, prev + 1))
                            }
                            disabled={promoSlide >= promoPageCount - 1}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/35 text-foreground transition-colors hover:bg-[#05C3D4]/10 hover:text-[#05C3D4] disabled:cursor-default disabled:opacity-40"
                            aria-label="Следующие акционные товары"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {visiblePromoProducts.map(product => (
                        <CatalogPromoCard
                          key={`catalog-promo-${product.id}`}
                          product={product}
                          onClose={menu.close}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {hasBottomSection && (
                  <div className="mt-4 flex items-end justify-between gap-4 pt-3">
                    {hasBrands ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-4">
                        {menu.activeCategory?.brands?.slice(0, 8).map((brand: Brand) => (
                          <Link
                            key={brand.id}
                            to={brand.href}
                            className="flex h-9 items-center justify-center opacity-80 transition-opacity hover:opacity-100"
                            title={brand.title}
                            onClick={menu.close}
                          >
                            {brand.logo ? (
                              <img
                                src={brand.logo}
                                alt={brand.title}
                                className="h-7 max-w-[82px] object-contain"
                                loading="lazy"
                              />
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div />
                    )}
                    {hasPromo && menu.activeCategory.promo?.[0] ? (
                      <Link
                        to={menu.activeCategory.promo[0].href}
                        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted/35 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-[#05C3D4]/10 hover:text-[#05C3D4]"
                        onClick={menu.close}
                      >
                        {menu.activeCategory.promo[0].cta || "Смотреть"} <ArrowRight size={14} />
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

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
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-background animate-in slide-in-from-right duration-300">
      <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-6">
        {menu.mobilePath.length > 0 ? (
          <button onClick={handleBack} className="flex items-center gap-2 text-[#05C3D4]">
            <ChevronLeft size={24} />
            <span className="text-xs font-black uppercase tracking-widest">Назад</span>
          </button>
        ) : (
          <h2 className="text-lg font-black uppercase tracking-tighter">Каталог</h2>
        )}
        <button onClick={menu.close} className="p-2 -mr-2 text-muted-foreground">
          <X size={24} />
        </button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto pb-24">
        {menu.mobilePath.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 p-4">
            {menu.catalogCategories.map(cat => (
              <div
                key={cat.id}
                className="rounded-[22px] bg-card px-4 py-4 transition-colors active:bg-muted/50"
                onClick={() => (cat.children ? navigateIn(cat.id) : (window.location.href = cat.href))}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#05C3D4]/10 text-[#05C3D4]">
                  <IconWrapper title={cat.title} slug={cat.slug} size={20} className="text-[#05C3D4]" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[14px] font-semibold leading-5">
                    {formatCategoryLabel(cat.title)}
                  </span>
                  {cat.children ? (
                    <ChevronRight size={16} className="mt-0.5 shrink-0 opacity-25" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : !currentGroup ? (
          <div className="animate-in slide-in-from-right duration-300">
            <div className="bg-card p-8">
              <h3 className="mb-4 text-[28px] font-black tracking-tight">
                {currentCategory ? formatCategoryLabel(currentCategory.title) : ""}
              </h3>
              <Link
                to={currentCategory?.href || "#"}
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#05C3D4]"
                onClick={menu.close}
              >
                Смотреть всё <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {currentCategory?.children?.map(group => (
                <div
                  key={group.id}
                  className="rounded-[22px] bg-card p-4 active:bg-muted/50"
                  onClick={() =>
                    group.items?.length
                      ? navigateIn(group.id)
                      : (window.location.href = group.href || "#")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[14px] font-semibold leading-5">
                      {formatCategoryLabel(group.title)}
                    </span>
                    <ChevronRight size={16} className="mt-0.5 shrink-0 opacity-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-right duration-300">
            <div className="bg-card p-8">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
                {currentCategory ? formatCategoryLabel(currentCategory.title) : ""}
              </span>
              <h3 className="text-[28px] font-black tracking-tight">
                {formatCategoryLabel(currentGroup.title)}
              </h3>
            </div>
            <div className="space-y-1 p-4">
              {currentGroup.items?.map(item => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="flex items-center justify-between rounded-2xl bg-card/80 p-5 active:bg-[#05C3D4]/5"
                  onClick={menu.close}
                >
                  <span className="text-[14px] font-medium tracking-tight text-foreground/80">
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

export default function CatalogMenu() {
  const { isOpen } = useCatalog();
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  if (!isOpen) return null;

  return isDesktop ? <DesktopCatalog /> : <MobileCatalog />;
}
