import { startTransition, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowRight, Percent } from "lucide-react";
import { Link } from "react-router";
import { trackHomepagePromoShowcase } from "@/lib/yandex-metrika";
import { useCart } from "@/hooks/use-cart";
import { CartIcon } from "@/components/product/ProductActionIcons";

type PromoShowcaseCard = {
  id: number;
  slug: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string;
  badge: string | null;
  inStock: boolean;
  categoryName?: string | null;
};

type PromoShowcaseTab = {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
  href: string;
  products: PromoShowcaseCard[];
};

type PromoShowcaseCategoryRailItem = {
  slug: string;
  name: string;
  productCount: number;
  href: string;
};

type HeroPromoShowcaseProps = {
  showcase: {
    eyebrow: string;
    title: string;
    subtitle: string;
    description: string;
    accent: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    spotlight: PromoShowcaseCard | null;
    categoryRail: PromoShowcaseCategoryRailItem[];
    tabs: PromoShowcaseTab[];
  };
};

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
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

function getDiscountPercent(card: PromoShowcaseCard) {
  if (!card.oldPrice || card.oldPrice <= card.price) return null;
  return Math.max(0, Math.round(((card.oldPrice - card.price) / card.oldPrice) * 100));
}

export default function HeroPromoShowcase({ showcase }: HeroPromoShowcaseProps) {
  const tabs = showcase.tabs;
  const { addItem } = useCart();
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isAutoplayPaused, setIsAutoplayPaused] = useState(false);
  const activeTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  );

  useEffect(() => {
    if (!tabs.some(tab => tab.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? "");
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(media.matches);
    sync();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (tabs.length < 2) return;
    if (prefersReducedMotion || isAutoplayPaused) return;

    const timer = window.setInterval(() => {
      startTransition(() => {
        setActiveTabId(current => {
          const index = tabs.findIndex(tab => tab.id === current);
          const nextIndex = index >= 0 ? (index + 1) % tabs.length : 0;
          return tabs[nextIndex]?.id ?? tabs[0]?.id ?? "";
        });
      });
    }, 8500);

    return () => window.clearInterval(timer);
  }, [isAutoplayPaused, prefersReducedMotion, tabs]);

  const spotlight = activeTab?.products[0] ?? showcase.spotlight;

  useEffect(() => {
    if (!activeTab) return;
    trackHomepagePromoShowcase({
      action: "view_collection",
      tabId: activeTab.id,
      tabLabel: activeTab.label,
      href: activeTab.href,
    });
  }, [activeTab]);

  if (!activeTab) return null;

  const activeTabIndex = tabs.findIndex(tab => tab.id === activeTab.id);
  const panelId = `promo-showcase-panel-${activeTab.id}`;
  const featuredProducts = spotlight
    ? [spotlight, ...activeTab.products.filter(card => card.id !== spotlight.id)]
    : activeTab.products;
  const showcaseProducts = featuredProducts.slice(0, 5);
  const tailProducts = featuredProducts.slice(5, 10);

  const handleTabSelect = (tab: PromoShowcaseTab) => {
    setActiveTabId(tab.id);
    trackHomepagePromoShowcase({
      action: "tab_click",
      tabId: tab.id,
      tabLabel: tab.label,
      href: tab.href,
    });
  };

  const handleTabsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (tabs.length < 2) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();

    let nextIndex = activeTabIndex;
    if (event.key === "ArrowRight") {
      nextIndex = (activeTabIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (activeTabIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    const nextTab = tabs[nextIndex];
    if (nextTab) {
      handleTabSelect(nextTab);
    }
  };

  const handleAddToCart = (event: React.MouseEvent<HTMLButtonElement>, card: PromoShowcaseCard) => {
    event.preventDefault();
    event.stopPropagation();
    if (!card.inStock) return;
    addItem({
      id: card.id,
      slug: card.slug,
      name: card.name,
      price: card.price,
      image: card.image,
    });
  };

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.16),transparent_20%),radial-gradient(circle_at_8%_88%,rgba(5,195,212,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,253,0.98))] transition-colors duration-500 dark:bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.18),transparent_18%),radial-gradient(circle_at_8%_88%,rgba(5,195,212,0.12),transparent_24%),linear-gradient(180deg,#0f1318,#12181f)]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[6%] top-[16%] h-44 w-44 rounded-full bg-[#05C3D4]/12 blur-[120px]" />
        <div className="absolute right-[10%] top-[8%] h-52 w-52 rounded-full bg-sky-200/35 blur-[140px] dark:bg-cyan-500/10" />
        <div className="absolute bottom-[4%] left-[24%] h-40 w-40 rounded-full bg-[#05C3D4]/10 blur-[120px]" />
      </div>

      <div className="container-main relative z-10 py-8 md:py-10 lg:py-12">
        <div className="space-y-4">
          {showcase.categoryRail.length > 0 ? (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {showcase.categoryRail.map(item => (
                <Link
                  key={item.slug}
                  to={item.href}
                  onClick={() =>
                    trackHomepagePromoShowcase({
                      action: "category_click",
                      tabId: activeTab.id,
                      tabLabel: activeTab.label,
                      categorySlug: item.slug,
                      categoryName: item.name,
                      href: item.href,
                    })
                  }
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white/82 px-4 py-2 text-sm font-bold text-slate-700 backdrop-blur-sm transition-colors motion-reduce:transition-none hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white/8 dark:text-white/82 dark:hover:bg-white/12 dark:focus-visible:ring-offset-[#11161c]"
                >
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="space-y-4">
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
              role="tablist"
              aria-label="Подборки промо-витрины"
              onKeyDown={handleTabsKeyDown}
              onMouseEnter={() => setIsAutoplayPaused(true)}
              onMouseLeave={() => setIsAutoplayPaused(false)}
              onFocusCapture={() => setIsAutoplayPaused(true)}
              onBlurCapture={() => setIsAutoplayPaused(false)}
            >
              {tabs.map(tab => {
                const isActive = tab.id === activeTab.id;
                return (
                  <button
                    key={tab.id}
                    id={`promo-showcase-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-pressed={isActive}
                    aria-controls={panelId}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => handleTabSelect(tab)}
                    className={`inline-flex shrink-0 items-center rounded-full px-4 py-2.5 text-sm font-black transition-colors ${
                      isActive
                        ? "bg-[#05C3D4] text-black"
                        : "bg-slate-100/92 text-slate-600 hover:bg-[#dff9fc] dark:bg-white/8 dark:text-white/78 dark:hover:bg-white/14"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={`promo-showcase-tab-${activeTab.id}`}
              className="rounded-[34px] bg-white/58 p-4 backdrop-blur-xl dark:bg-white/5 md:p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {showcaseProducts.map(card => {
                    const discountPercent = getDiscountPercent(card);
                    return (
                      <div
                        key={card.id}
                        className="group flex h-full min-h-[420px] flex-col rounded-[28px] bg-white/88 p-5 transition-colors duration-200 motion-reduce:transition-none hover:bg-white dark:bg-white/6 dark:hover:bg-white/8"
                      >
                        <Link
                          to={`/product/${card.slug}`}
                          onClick={() =>
                            trackHomepagePromoShowcase({
                              action: "product_click",
                              tabId: activeTab.id,
                              tabLabel: activeTab.label,
                              productId: String(card.id),
                              productName: card.name,
                              href: `/product/${card.slug}`,
                            })
                          }
                          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#11161c]"
                        >
                          <div className="relative flex h-[220px] items-center justify-center rounded-[24px] bg-white p-4 dark:bg-white/96">
                            <img
                              src={card.image}
                              alt={card.name}
                              className="max-h-[188px] max-w-full object-contain"
                              loading="lazy"
                            />
                            {discountPercent ? (
                              <span className="absolute left-3 top-3 rounded-full bg-[#05C3D4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-black">
                                -{discountPercent}%
                              </span>
                            ) : null}
                          </div>
                        </Link>

                        <Link
                          to={`/product/${card.slug}`}
                          onClick={() =>
                            trackHomepagePromoShowcase({
                              action: "product_click",
                              tabId: activeTab.id,
                              tabLabel: activeTab.label,
                              productId: String(card.id),
                              productName: card.name,
                              href: `/product/${card.slug}`,
                            })
                          }
                          className="mt-4 block min-h-[2.8rem] line-clamp-2 text-base font-semibold leading-[1.38] text-[#141b24] transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-white dark:focus-visible:ring-offset-[#11161c]"
                        >
                          {card.name}
                        </Link>

                        <div className="mt-4 flex items-center gap-2">
                          <span className="text-2xl font-black tracking-[-0.04em] text-[#141b24] dark:text-white">
                            {formatPrice(card.price)}
                          </span>
                          {card.oldPrice ? (
                            <span className="pt-0.5 text-sm font-semibold text-slate-400 line-through dark:text-white/35">
                              {formatPrice(card.oldPrice)}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-auto pt-4">
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={event => handleAddToCart(event, card)}
                              disabled={!card.inStock}
                              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#05C3D4] px-4 text-sm font-black text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <CartIcon size={15} />
                              В корзину
                            </button>
                            <Link
                              to={`/product/${card.slug}`}
                              onClick={() =>
                                trackHomepagePromoShowcase({
                                  action: "product_click",
                                  tabId: activeTab.id,
                                  tabLabel: activeTab.label,
                                  productId: String(card.id),
                                  productName: card.name,
                                  href: `/product/${card.slug}`,
                                })
                              }
                              className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[#05C3D4] transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#11161c]"
                            >
                              <span className="hidden sm:inline">Подробнее</span>
                              <ArrowRight size={16} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {tailProducts.length > 0 ? (
                <div className="mt-5 border-t border-[#05C3D4]/10 pt-5 dark:border-white/10">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="text-sm font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                      Ещё в подборке
                    </div>
                    <Link
                      to={activeTab.href}
                      onClick={() =>
                        trackHomepagePromoShowcase({
                          action: "primary_cta_click",
                          tabId: activeTab.id,
                          tabLabel: activeTab.label,
                          href: activeTab.href,
                        })
                      }
                      className="inline-flex items-center gap-1 text-sm font-bold text-[#05C3D4] transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#11161c]"
                    >
                      Смотреть все
                      <ArrowRight size={16} />
                    </Link>
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {tailProducts.map(card => (
                      <Link
                        key={card.id}
                        to={`/product/${card.slug}`}
                        onClick={() =>
                          trackHomepagePromoShowcase({
                            action: "tail_click",
                            tabId: activeTab.id,
                            tabLabel: activeTab.label,
                            productId: String(card.id),
                            productName: card.name,
                            href: `/product/${card.slug}`,
                          })
                        }
                        className="grid min-w-[248px] grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-[22px] bg-white/82 p-3 text-slate-700 transition-colors motion-reduce:transition-none hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white/6 dark:text-white/78 dark:hover:bg-white/10 dark:focus-visible:ring-offset-[#11161c]"
                      >
                        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-white p-2 dark:bg-white/96">
                          <img
                            src={card.image}
                            alt={card.name}
                            className="max-h-full max-w-full object-contain"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-semibold leading-5 text-[#141b24] dark:text-white">
                            {card.name}
                          </div>
                          <div className="mt-2 text-base font-black text-[#141b24] dark:text-white">
                            {formatPrice(card.price)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
