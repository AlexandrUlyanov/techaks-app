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
  PromoBlock,
  Brand,
} from "@/contracts/catalog.types";
import { useCatalog } from "@/providers/CatalogProvider";
import { useMediaQuery, useBodyScrollLock } from "@/hooks/use-catalog-menu";
import { CategoryIcon } from "@/lib/category-icons";

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
      className={`flex items-center gap-3 h-11 px-5 sm:px-6 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-[#05C3D4]/10 ${
        isOpen
          ? "bg-white text-[#05C3D4] dark:bg-background border-border"
          : "bg-[#05C3D4] text-white dark:text-black hover:bg-[#27E6F2] border-transparent"
      } border ${className}`}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isOpen ? (
          <X size={20} strokeWidth={2.5} />
        ) : (
          <LayoutGrid size={20} strokeWidth={2.5} />
        )}
      </div>
      <span className="hidden sm:inline">Каталог</span>
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
  const showTopProductsBlock = groupsWithChildren.length === 0;
  const { data: topCategoryProducts = [] } = trpc.product.getTopByCategoryStock.useQuery(
    {
      categorySlug: menu.activeCategory?.slug ?? "",
      limit: 3,
    },
    {
      enabled: Boolean(menu.activeCategory?.slug) && showTopProductsBlock,
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
        className="fixed top-[80px] left-0 right-0 bg-white dark:bg-[#15171A] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-b border-border z-[100] animate-in fade-in slide-in-from-top-4 duration-300 overflow-hidden"
        style={{ height: "640px" }}
      >
        <div className="container-main flex h-full p-0">
          <div className="w-[300px] border-r border-border bg-muted/20 overflow-y-auto custom-scrollbar">
            <div className="py-4">
              {menu.catalogCategories.map(cat => (
                <div
                  key={cat.id}
                  onMouseEnter={() => handleCategoryHover(cat.id)}
                  onClick={() => {
                    navigate(cat.href);
                    menu.close();
                  }}
                  className={`flex items-center justify-between px-8 py-4 cursor-pointer transition-all relative group ${
                    menu.activeCategoryId === cat.id
                      ? "bg-white dark:bg-background text-[#05C3D4]"
                      : "text-foreground/60 hover:text-[#05C3D4] hover:bg-[#05C3D4]/5"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <IconWrapper
                      title={cat.title}
                      slug={cat.slug}
                      size={20}
                      className={
                        menu.activeCategoryId === cat.id
                          ? "text-[#05C3D4]"
                          : "text-foreground/30 group-hover:text-[#05C3D4]"
                      }
                    />
                    <span className="text-[12px] font-black uppercase tracking-widest leading-none">
                      {cat.title}
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`opacity-0 group-hover:opacity-40 transition-all ${menu.activeCategoryId === cat.id ? "opacity-100 text-[#05C3D4]" : ""}`}
                  />
                  {menu.activeCategoryId === cat.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#05C3D4]" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white dark:bg-background">
            <div className="flex items-center justify-between mb-10 pb-6 border-b border-border">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground">
                {menu.activeCategory.title}
              </h2>
              {groupsWithChildren.length > 0 && (
                <Link
                  to={menu.activeCategory.href}
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#05C3D4] hover:underline"
                  onClick={menu.close}
                >
                  Все товары в категории <ArrowRight size={14} />
                </Link>
              )}
            </div>
            {groupsWithChildren.length > 0 ? (
              <div className="columns-3 xl:columns-4 gap-8">
                {groupsWithChildren.map((group: CategoryGroup) => (
                  <div key={group.id} className="break-inside-avoid mb-6 space-y-2.5">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground hover:text-[#05C3D4] transition-colors leading-tight">
                      <Link to={group.href || "#"} onClick={menu.close}>
                        {group.title}
                      </Link>
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      {group.items?.map((item: CategoryItem) => (
                        <Link
                          key={item.id}
                          to={item.href}
                          className="text-[13px] leading-snug font-medium text-muted-foreground hover:text-[#05C3D4] transition-colors flex items-center group/item"
                          onClick={menu.close}
                        >
                          <span className="group-hover/item:translate-x-1 transition-transform">
                            {item.title}
                          </span>
                          <Badge type={item.badge} />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/10 p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground">
                    Топ товары
                  </h3>
                  <Link
                    to={menu.activeCategory.href}
                    className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4] hover:underline"
                    onClick={menu.close}
                  >
                    Смотреть все товары
                  </Link>
                </div>
                {topCategoryProducts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    {topCategoryProducts.map(product => (
                      <Link
                        key={product.id}
                        to={`/product/${product.slug}`}
                        onClick={menu.close}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 hover:border-[#05C3D4]/60 transition-colors"
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-11 w-11 shrink-0 object-contain"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-[12px] font-bold leading-tight text-foreground">
                            {product.name}
                          </div>
                          <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#05C3D4]">
                            {new Intl.NumberFormat("ru-RU").format(product.price)} ₽
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-muted-foreground">
                    Пока нет товаров в наличии для отображения.
                  </div>
                )}
              </div>
            )}
            {singleCategories.length > 0 && (
              <div className="mt-6 border-t border-border pt-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 xl:grid-cols-3">
                  {singleCategories.map((group: CategoryGroup) => (
                    <Link
                      key={group.id}
                      to={group.href || "#"}
                      onClick={menu.close}
                      className="text-[12px] font-bold text-muted-foreground hover:text-[#05C3D4] transition-colors"
                    >
                      {group.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {hasBottomSection && (
            <div className="mt-10 pt-8 border-t border-border flex gap-12">
              {hasBrands && (
                <div className="flex-1">
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
                <div className="w-[400px]">
                  {menu.activeCategory?.promo?.map((promo: PromoBlock) => (
                    <Link
                      key={promo.id}
                      to={promo.href}
                      className={`block p-8 rounded-3xl relative overflow-hidden group h-full shadow-lg ${promo.theme === "accent" ? "bg-[#05C3D4] text-black" : "bg-muted"}`}
                      onClick={menu.close}
                    >
                      <div className="relative z-10">
                        <h4 className="text-xl font-black uppercase leading-tight mb-2">
                          {promo.title}
                        </h4>
                        <p className="text-sm font-bold opacity-70 mb-6">
                          {promo.subtitle}
                        </p>
                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-black/10 px-4 py-2 rounded-xl">
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
                  <span className="text-sm font-black uppercase text-foreground">
                    {item.title}
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
                  <span className="text-[14px] font-black uppercase tracking-widest">
                    {cat.title}
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
              <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">
                {currentCategory?.title}
              </h3>
              <Link
                to={currentCategory?.href || "#"}
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#05C3D4]"
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
                  <span className="text-[13px] font-black uppercase tracking-wider">
                    {group.title}
                  </span>
                  <ChevronRight size={18} className="opacity-20" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-right duration-300">
            <div className="p-8 bg-card border-b border-border">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4] block mb-2">
                {currentCategory?.title}
              </span>
              <h3 className="text-2xl font-black uppercase tracking-tighter">
                {currentGroup.title}
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
                  <span className="text-[13px] font-bold uppercase tracking-tight text-foreground/80">
                    {item.title}
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
