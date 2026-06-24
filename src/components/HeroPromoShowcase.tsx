import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { trackHomepagePromoShowcase } from "@/lib/yandex-metrika";
import ProductCard from "@/components/ProductCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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
    categoryRail: Array<{
      slug: string;
      name: string;
      productCount: number;
      href: string;
    }>;
    tabs: PromoShowcaseTab[];
  };
};

export default function HeroPromoShowcase({ showcase }: HeroPromoShowcaseProps) {
  const tabs = showcase.tabs;
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");

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
    if (!activeTab) return;
    trackHomepagePromoShowcase({
      action: "view_collection",
      tabId: activeTab.id,
      tabLabel: activeTab.label,
      href: activeTab.href,
    });
  }, [activeTab]);

  if (!activeTab) return null;

  const spotlight = activeTab.products[0] ?? showcase.spotlight;
  const featuredProducts = spotlight
    ? [spotlight, ...activeTab.products.filter(card => card.id !== spotlight.id)]
    : activeTab.products;

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
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();

    const activeTabIndex = tabs.findIndex(tab => tab.id === activeTab.id);
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
      <style>{`
        @keyframes heroPromoDrift {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(32px, -24px, 0) scale(1.08); }
          100% { transform: translate3d(-20px, 18px, 0) scale(0.96); }
        }

        @keyframes heroPromoGlow {
          0% { opacity: 0.34; transform: scale(0.92); }
          50% { opacity: 0.82; transform: scale(1.08); }
          100% { opacity: 0.4; transform: scale(0.97); }
        }

        @keyframes heroPromoSheen {
          0% { transform: translate3d(-6%, 0, 0) rotate(0deg); opacity: 0.14; }
          50% { transform: translate3d(5%, -2%, 0) rotate(3deg); opacity: 0.34; }
          100% { transform: translate3d(-2%, 2%, 0) rotate(-2deg); opacity: 0.18; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-promo-motion {
            animation: none !important;
          }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div
          className="hero-promo-motion absolute inset-y-[10%] right-[4%] w-[48%] rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.18),transparent_65%)] blur-[78px]"
          style={{ animation: "heroPromoSheen 15s ease-in-out infinite alternate" }}
        />
        <div
          className="hero-promo-motion absolute left-[4%] top-[12%] h-52 w-52 rounded-full bg-[#05C3D4]/14 blur-[118px]"
          style={{ animation: "heroPromoDrift 14s ease-in-out infinite alternate" }}
        />
        <div
          className="hero-promo-motion absolute right-[10%] top-[4%] h-64 w-64 rounded-full bg-sky-200/40 blur-[138px] dark:bg-cyan-500/12"
          style={{ animation: "heroPromoGlow 12s ease-in-out infinite alternate" }}
        />
        <div
          className="hero-promo-motion absolute bottom-[2%] left-[22%] h-48 w-48 rounded-full bg-[#05C3D4]/12 blur-[116px]"
          style={{ animation: "heroPromoDrift 18s ease-in-out -4s infinite alternate" }}
        />
      </div>

      <div className="container-main relative z-10 py-8 md:py-10 lg:py-12">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div
              className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3"
              role="tablist"
              aria-label="Подборки промо-витрины"
              onKeyDown={handleTabsKeyDown}
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
                    aria-controls={`promo-showcase-panel-${activeTab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => handleTabSelect(tab)}
                    className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.22em] transition-colors sm:min-h-12 sm:w-auto sm:px-6 sm:py-4 sm:text-[11px] sm:tracking-widest ${
                      isActive
                        ? "bg-[#05C3D4] text-white dark:text-black hover:bg-[#27E6F2]"
                        : "border border-black/10 bg-white/70 text-slate-900 hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
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
              className="order-first inline-flex min-h-10 items-center justify-center self-end rounded-full px-1 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-900 transition-colors hover:text-[#05C3D4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-white dark:hover:text-[#4EE7F1] dark:focus-visible:ring-offset-[#11161c] lg:order-none lg:self-auto"
            >
              Смотреть все акции
            </Link>
          </div>

          <div
            id={`promo-showcase-panel-${activeTab.id}`}
            role="tabpanel"
            aria-labelledby={`promo-showcase-tab-${activeTab.id}`}
            className="rounded-[34px] bg-white/40 p-0 backdrop-blur-xl dark:bg-white/5"
          >
            <div className="px-1 pb-2 pt-1 sm:px-0 sm:pb-0 sm:pt-0">
              <Carousel
                opts={{
                  align: "start",
                  loop: featuredProducts.length > 4,
                }}
                className="relative"
              >
                <CarouselContent className="-ml-3 sm:-ml-5">
                  {featuredProducts.map((product, index) => (
                    <CarouselItem
                      key={product.id}
                      className="pl-3 sm:pl-5 basis-[78%] min-[520px]:basis-1/2 lg:basis-1/3 2xl:basis-1/4"
                    >
                      <ProductCard
                        product={{
                          id: product.id,
                          slug: product.slug,
                          name: product.name,
                          price: product.price,
                          oldPrice: product.oldPrice,
                          badge: product.badge,
                          image: product.image,
                          categoryId: 0,
                          categoryName: product.categoryName ?? null,
                          inStock: product.inStock,
                        }}
                        imagePriority={index < 4}
                        blockLinkNavigation={false}
                        onNavigate={url => {
                          trackHomepagePromoShowcase({
                            action: "product_click",
                            tabId: activeTab.id,
                            tabLabel: activeTab.label,
                            productId: String(product.id),
                            productName: product.name,
                            href: url,
                          });
                        }}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>

                <CarouselPrevious className="hidden md:flex -left-4 top-1/2 h-11 w-11 border border-transparent bg-white text-[#20262E] hover:border-transparent hover:bg-[#05C3D4] hover:text-black dark:bg-[#1b232c] dark:text-white dark:hover:bg-[#05C3D4] dark:hover:text-black" />
                <CarouselNext className="hidden md:flex -right-4 top-1/2 h-11 w-11 border border-transparent bg-white text-[#20262E] hover:border-transparent hover:bg-[#05C3D4] hover:text-black dark:bg-[#1b232c] dark:text-white dark:hover:bg-[#05C3D4] dark:hover:text-black" />
              </Carousel>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
