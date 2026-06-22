import { startTransition, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowRight, Percent } from "lucide-react";
import { Link } from "react-router";
import { trackHomepagePromoShowcase } from "@/lib/yandex-metrika";

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
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-[#05C3D4]/12 backdrop-blur-sm transition-colors motion-reduce:transition-none hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white/6 dark:text-white/82 dark:ring-white/10 dark:hover:bg-white/10 dark:focus-visible:ring-offset-[#11161c]"
                >
                  <span>{item.name}</span>
                  <span className="rounded-full bg-[#05C3D4]/10 px-2 py-0.5 text-[11px] font-black text-[#05C3D4]">
                    {formatProductCount(item.productCount)}
                  </span>
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
                        : "bg-white/72 text-slate-600 ring-1 ring-[#05C3D4]/12 backdrop-blur-sm hover:bg-white dark:bg-white/6 dark:text-white/78 dark:ring-white/10 dark:hover:bg-white/10"
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
              className="rounded-[34px] bg-white/58 p-4 ring-1 ring-[#05C3D4]/10 backdrop-blur-xl dark:bg-white/5 dark:ring-white/10 md:p-5"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <Link
                  to={spotlight ? `/product/${spotlight.slug}` : activeTab.href}
                  onClick={() =>
                    spotlight
                      ? trackHomepagePromoShowcase({
                          action: "spotlight_click",
                          tabId: activeTab.id,
                          tabLabel: activeTab.label,
                          productId: String(spotlight.id),
                          productName: spotlight.name,
                          href: `/product/${spotlight.slug}`,
                        })
                      : trackHomepagePromoShowcase({
                          action: "primary_cta_click",
                          tabId: activeTab.id,
                          tabLabel: activeTab.label,
                          href: activeTab.href,
                        })
                  }
                  className="group relative hidden overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top,rgba(5,195,212,0.10),transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,252,0.92))] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-[radial-gradient(circle_at_top,rgba(5,195,212,0.14),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] dark:focus-visible:ring-offset-[#11161c] md:block"
                >
                  {spotlight ? (
                    <>
                      <div className="relative flex min-h-[300px] items-center justify-center rounded-[28px] bg-white p-6 dark:bg-white/95">
                        <img
                          src={spotlight.image}
                          alt={spotlight.name}
                          className="max-h-[280px] max-w-full object-contain"
                          loading="eager"
                        />
                      </div>

                      <div className="mt-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-xl font-black leading-7 text-[#141b24] dark:text-white">
                            {spotlight.name}
                          </div>
                        </div>
                        <ArrowRight
                          size={18}
                          className="mt-1 shrink-0 text-[#05C3D4] transition-transform duration-200 group-hover:translate-x-1"
                        />
                      </div>

                      <div className="mt-4 flex items-end gap-3">
                        <div className="text-3xl font-black tracking-[-0.04em] text-[#141b24] dark:text-white">
                          {formatPrice(spotlight.price)}
                        </div>
                        {spotlight.oldPrice ? (
                          <div className="pb-1 text-sm font-semibold text-slate-400 line-through dark:text-white/35">
                            {formatPrice(spotlight.oldPrice)}
                          </div>
                        ) : null}
                        {getDiscountPercent(spotlight) ? (
                          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#05C3D4]/12 px-2.5 py-1 text-[11px] font-black text-[#05C3D4]">
                            <Percent size={12} />
                            -{getDiscountPercent(spotlight)}%
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </Link>

                {spotlight ? (
                  <Link
                    to={`/product/${spotlight.slug}`}
                    onClick={() =>
                      trackHomepagePromoShowcase({
                        action: "spotlight_click",
                        tabId: activeTab.id,
                        tabLabel: activeTab.label,
                        productId: String(spotlight.id),
                        productName: spotlight.name,
                        href: `/product/${spotlight.slug}`,
                      })
                    }
                    className="group overflow-hidden rounded-[28px] bg-white/88 p-4 ring-1 ring-transparent transition-[ring-color,background-color] duration-200 motion-reduce:transition-none hover:ring-[#05C3D4]/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white/6 dark:hover:bg-white/8 dark:focus-visible:ring-offset-[#11161c] md:hidden"
                  >
                    <div className="relative flex min-h-[220px] items-center justify-center rounded-[24px] bg-white p-4 dark:bg-white/96">
                      <img
                        src={spotlight.image}
                        alt={spotlight.name}
                        className="max-h-[200px] max-w-full object-contain"
                        loading="eager"
                      />
                      {getDiscountPercent(spotlight) ? (
                        <span className="absolute left-3 top-3 rounded-full bg-[#05C3D4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-black">
                          -{getDiscountPercent(spotlight)}%
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 line-clamp-2 text-lg font-black leading-7 text-[#141b24] dark:text-white">
                      {spotlight.name}
                    </div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-2xl font-black tracking-[-0.04em] text-[#141b24] dark:text-white">
                        {formatPrice(spotlight.price)}
                      </span>
                      {spotlight.oldPrice ? (
                        <span className="pb-0.5 text-sm font-semibold text-slate-400 line-through dark:text-white/35">
                          {formatPrice(spotlight.oldPrice)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  {activeTab.products.slice(0, 4).map(card => {
                    const discountPercent = getDiscountPercent(card);
                    return (
                      <Link
                        key={card.id}
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
                        className="group rounded-[28px] bg-white/88 p-4 ring-1 ring-transparent transition-[ring-color,background-color] duration-200 motion-reduce:transition-none hover:ring-[#05C3D4]/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white/6 dark:hover:bg-white/8 dark:focus-visible:ring-offset-[#11161c]"
                      >
                        <div className="relative flex min-h-[176px] items-center justify-center rounded-[24px] bg-white p-4 dark:bg-white/96">
                          <img
                            src={card.image}
                            alt={card.name}
                            className="max-h-[152px] max-w-full object-contain"
                            loading="lazy"
                          />
                          {discountPercent ? (
                            <span className="absolute left-3 top-3 rounded-full bg-[#05C3D4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-black">
                              -{discountPercent}%
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 line-clamp-2 min-h-[3.5rem] text-base font-black leading-6 text-[#141b24] dark:text-white">
                          {card.name}
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                          <span className="text-xl font-black tracking-[-0.04em] text-[#141b24] dark:text-white">
                            {formatPrice(card.price)}
                          </span>
                          {card.oldPrice ? (
                            <span className="pb-0.5 text-sm font-semibold text-slate-400 line-through dark:text-white/35">
                              {formatPrice(card.oldPrice)}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {activeTab.products.slice(4).map(card => (
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
                    className="min-w-[220px] rounded-[24px] bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-[#05C3D4]/10 transition-colors motion-reduce:transition-none hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white/6 dark:text-white/78 dark:ring-white/10 dark:hover:bg-white/10 dark:focus-visible:ring-offset-[#11161c]"
                  >
                    <div className="truncate">{card.name}</div>
                    <div className="mt-2 text-[#05C3D4]">{formatPrice(card.price)}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
