import { useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  X,
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  LayoutGrid,
} from "lucide-react";
import type {
  CategoryGroup,
  CategoryItem,
  Brand,
} from "@/contracts/catalog.types";
import { useCatalog } from "@/providers/CatalogProvider";
import { useMediaQuery, useBodyScrollLock } from "@/hooks/use-catalog-menu";
import { CategoryIcon } from "@/lib/category-icons";
import { formatCategoryLabel } from "@/lib/category-labels";

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

// --- Trigger Component ---

export function CatalogTrigger({ className = "" }: { className?: string }) {
  const { isOpen, toggle } = useCatalog();
  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-3 h-11 px-5 sm:px-6 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${
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
  const navigate = useNavigate();
  const categoryGroups = menu.activeCategory?.children ?? [];
  const groupsWithChildren = categoryGroups.filter(group => (group.items?.length ?? 0) > 0);
  const singleCategories = categoryGroups.filter(group => (group.items?.length ?? 0) === 0);
  const visibleGroups = groupsWithChildren.slice(0, 8);
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
  const typeFilter = useMemo(
    () =>
      leafCategoryFilters.find(
        filter => String(filter.normalizedKey).toLowerCase() === "тип"
      ),
    [leafCategoryFilters]
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
  const desktopSearchResults = menu.searchTerm ? menu.filteredCategories.slice(0, 12) : [];

  return (
    <>
      <div
        className="fixed inset-0 top-[80px] bg-black/40 backdrop-blur-sm z-[90] animate-in fade-in duration-300"
        onClick={menu.close}
      />
      <div
        className="fixed top-[80px] left-0 right-0 bottom-0 bg-white dark:bg-[#15171A] border-b border-border z-[100] animate-in fade-in slide-in-from-top-4 duration-300 overflow-hidden"
      >
        <div className="container-main flex h-full flex-col py-5">
          <div className="mb-5 flex items-center gap-5">
            <div className="min-w-0 flex-1">
              <div className="relative group">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-[#05C3D4] transition-colors"
                />
                <input
                  type="text"
                  placeholder="Найти категорию или раздел..."
                  value={menu.searchTerm}
                  onChange={e => menu.setSearchTerm(e.target.value)}
                  className="h-13 w-full rounded-2xl border border-border bg-card pl-12 pr-5 text-[15px] font-medium outline-none transition-colors focus:border-[#05C3D4]"
                />
              </div>
            </div>
            <button
              onClick={menu.close}
              className="inline-flex h-13 shrink-0 items-center rounded-2xl border border-border px-5 text-[12px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-[#05C3D4]"
            >
              Закрыть
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] gap-6">
            <div className="rounded-[28px] border border-border bg-muted/10 p-4">
              <div className="mb-4 px-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#05C3D4]">
                  Каталог
                </div>
                <div className="mt-2 text-[14px] font-medium leading-6 text-muted-foreground">
                  Быстрый вход в основные разделы без прокрутки и лишних переходов.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
              {menu.catalogCategories.map(cat => (
                <div
                  key={cat.id}
                  onMouseEnter={() => handleCategoryHover(cat.id)}
                  onClick={() => {
                    navigate(cat.href);
                    menu.close();
                  }}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 cursor-pointer transition-all relative group ${
                    menu.activeCategoryId === cat.id
                      ? "bg-white dark:bg-background text-[#05C3D4] border border-[#05C3D4]/20"
                      : "text-foreground/60 hover:text-[#05C3D4] hover:bg-[#05C3D4]/5"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <IconWrapper
                      title={cat.title}
                      slug={cat.slug}
                      size={18}
                      className={
                        menu.activeCategoryId === cat.id
                          ? "text-[#05C3D4]"
                          : "text-foreground/30 group-hover:text-[#05C3D4]"
                      }
                    />
                    <span className="line-clamp-2 text-[13px] font-semibold leading-4">
                      {formatCategoryLabel(cat.title)}
                    </span>
                  </div>
                  <ChevronRight
                    size={12}
                    className={`opacity-0 group-hover:opacity-40 transition-all ${menu.activeCategoryId === cat.id ? "opacity-100 text-[#05C3D4]" : ""}`}
                  />
                </div>
              ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-border bg-white p-7 dark:bg-background">
              {menu.searchTerm ? (
                <div className="flex h-full flex-col">
                  <div className="mb-5 flex items-center justify-between gap-4 border-b border-border pb-4">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#05C3D4]">
                        Результаты поиска
                      </div>
                      <h2 className="mt-2 text-[30px] font-black tracking-tight text-foreground">
                        {menu.searchTerm}
                      </h2>
                    </div>
                    <button
                      onClick={() => menu.setSearchTerm("")}
                      className="rounded-full border border-border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-[#05C3D4]"
                    >
                      Очистить
                    </button>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-3">
                    {desktopSearchResults.map((item: any, i: number) => (
                      <Link
                        key={`${item.id}-${i}`}
                        to={item.href || item.parentHref || "#"}
                        onClick={menu.close}
                        className="rounded-[22px] border border-border bg-card/60 p-5 transition-colors hover:border-[#05C3D4]/35 hover:bg-[#05C3D4]/[0.03]"
                      >
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
                          {item.type}
                        </div>
                        <div className="text-[16px] font-bold leading-snug text-foreground">
                          {formatCategoryLabel(item.title)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="mb-6 flex items-start justify-between gap-5 border-b border-border pb-5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#05C3D4]">
                        Активный раздел
                      </div>
                      <h2 className="mt-2 text-[30px] font-black tracking-tight text-foreground">
                        {formatCategoryLabel(menu.activeCategory.title)}
                      </h2>
                    </div>
                    <Link
                      to={menu.activeCategory.href}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#05C3D4] transition-colors hover:border-[#05C3D4]/35"
                      onClick={menu.close}
                    >
                      Смотреть раздел <ArrowRight size={14} />
                    </Link>
                  </div>

                  {visibleGroups.length > 0 ? (
                    <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-6 xl:grid-cols-3">
                      {visibleGroups.map((group: CategoryGroup) => (
                        <div key={group.id} className="min-w-0">
                          <h3 className="mb-2 text-[15px] font-bold text-foreground leading-tight">
                            <Link to={group.href || "#"} onClick={menu.close} className="hover:text-[#05C3D4] transition-colors">
                              {formatCategoryLabel(group.title)}
                            </Link>
                          </h3>
                          <div className="flex flex-col gap-1.5">
                            {group.items?.slice(0, 4).map((item: CategoryItem) => (
                              <Link
                                key={item.id}
                                to={item.href}
                                className="truncate text-[13px] font-medium text-muted-foreground transition-colors hover:text-[#05C3D4]"
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
                      <div className="mb-4 text-[15px] font-bold text-foreground">
                        Типы товаров
                      </div>
                      {typeFilter && typeFilter.values.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 xl:grid-cols-4">
                          {typeFilter.values.slice(0, 12).map(value => (
                            <Link
                              key={`${typeFilter.normalizedKey}:${value.normalizedValue}`}
                              to={`/catalog?cat=${menu.activeCategory?.slug ?? "all"}&filter=${encodeURIComponent(
                                `${typeFilter.normalizedKey}:${value.normalizedValue}`
                              )}`}
                              onClick={menu.close}
                              className="inline-flex rounded-full border border-border px-4 py-2 text-[12px] font-semibold text-muted-foreground hover:border-[#05C3D4]/35 hover:text-[#05C3D4] transition-colors"
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
                    <div className={`${visibleGroups.length > 0 || showLeafCategoryFilters ? "mt-6 border-t border-border pt-5" : "mt-auto pt-5"}`}>
                      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                        {visibleSingleCategories.map((group: CategoryGroup) => (
                          <Link
                            key={group.id}
                            to={group.href || "#"}
                            onClick={menu.close}
                            className="rounded-full border border-border px-4 py-2 text-[12px] font-semibold text-muted-foreground hover:border-[#05C3D4]/35 hover:text-[#05C3D4] transition-colors"
                          >
                            {formatCategoryLabel(group.title)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasBottomSection && (
                    <div className="mt-6 flex items-end justify-between gap-6 border-t border-border pt-5">
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
                      {hasPromo && menu.activeCategory?.promo?.[0] ? (
                        <Link
                          to={menu.activeCategory.promo[0].href}
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground transition-colors hover:border-[#05C3D4]/35 hover:text-[#05C3D4]"
                          onClick={menu.close}
                        >
                          {menu.activeCategory.promo[0].cta || "Смотреть"} <ArrowRight size={14} />
                        </Link>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
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
            className="w-full h-12 bg-card border border-border rounded-xl pl-12 pr-4 text-sm font-medium placeholder:font-medium outline-none focus:border-[#05C3D4] transition-all"
          />
        </div>
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
                  <span className="text-[15px] font-semibold">
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
              <h3 className="text-[28px] font-black tracking-tight mb-4">
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
                  <span className="text-[14px] font-semibold">
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
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#05C3D4] block mb-2">
                {currentCategory ? formatCategoryLabel(currentCategory.title) : ""}
              </span>
              <h3 className="text-[28px] font-black tracking-tight">
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

// --- Main Root Component ---

export default function CatalogMenu() {
  const { isOpen } = useCatalog();
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  if (!isOpen) return null;

  return isDesktop ? <DesktopCatalog /> : <MobileCatalog />;
}
