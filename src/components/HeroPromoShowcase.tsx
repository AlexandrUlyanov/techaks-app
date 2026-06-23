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
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[6%] top-[16%] h-44 w-44 rounded-full bg-[#05C3D4]/12 blur-[120px]" />
        <div className="absolute right-[10%] top-[8%] h-52 w-52 rounded-full bg-sky-200/35 blur-[140px] dark:bg-cyan-500/10" />
        <div className="absolute bottom-[4%] left-[24%] h-40 w-40 rounded-full bg-[#05C3D4]/10 blur-[120px]" />
      </div>

      <div className="container-main relative z-10 py-8 md:py-10 lg:py-12">
        <div className="space-y-4">
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
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
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 py-2.5 text-sm font-black transition-colors ${
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

            <div className="flex items-center justify-end px-4 pb-4 pt-2 sm:px-5">
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
                className="inline-flex items-center gap-2 text-sm font-bold text-[#05C3D4] transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#11161c]"
              >
                Смотреть все
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
