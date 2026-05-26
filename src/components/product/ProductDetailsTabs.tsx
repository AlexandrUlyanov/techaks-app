import { cn } from "@/lib/utils";
import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type ProductDetailsTabKey =
  | "about"
  | "specs"
  | "stock"
  | "delivery"
  | "reviews"
  | "warranty";

const TAB_ITEMS: Array<{ key: ProductDetailsTabKey; label: string }> = [
  { key: "about", label: "О товаре" },
  { key: "specs", label: "Характеристики" },
  { key: "stock", label: "Наличие в магазинах" },
  { key: "delivery", label: "Доставка и оплата" },
  { key: "reviews", label: "Отзывы" },
  { key: "warranty", label: "Гарантия" },
];

type IndicatorMetrics = {
  left: number;
  width: number;
};

export default function ProductDetailsTabs({
  activeTab,
  onTabChange,
  about,
  specs,
  stock,
  delivery,
  reviews,
  warranty,
  aboutMobile,
  specsMobile,
  stockMobile,
  deliveryMobile,
  reviewsMobile,
  warrantyMobile,
}: {
  activeTab: ProductDetailsTabKey;
  onTabChange: (tab: ProductDetailsTabKey) => void;
  about: ReactNode;
  specs: ReactNode;
  stock: ReactNode;
  delivery: ReactNode;
  reviews: ReactNode;
  warranty: ReactNode;
  aboutMobile?: ReactNode;
  specsMobile?: ReactNode;
  stockMobile?: ReactNode;
  deliveryMobile?: ReactNode;
  reviewsMobile?: ReactNode;
  warrantyMobile?: ReactNode;
}) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileScrollerRef = useRef<HTMLDivElement | null>(null);
  const tabsRailRef = useRef<HTMLDivElement | null>(null);
  const mobileSectionRefs = useRef<Record<ProductDetailsTabKey, HTMLElement | null>>({
    about: null,
    specs: null,
    stock: null,
    delivery: null,
    reviews: null,
    warranty: null,
  });
  const tabButtonRefs = useRef<Record<ProductDetailsTabKey, HTMLButtonElement | null>>({
    about: null,
    specs: null,
    stock: null,
    delivery: null,
    reviews: null,
    warranty: null,
  });
  const panelRefs = useRef<Record<ProductDetailsTabKey, HTMLDivElement | null>>({
    about: null,
    specs: null,
    stock: null,
    delivery: null,
    reviews: null,
    warranty: null,
  });
  const panels: Record<ProductDetailsTabKey, ReactNode> = {
    about,
    specs,
    stock,
    delivery,
    reviews,
    warranty,
  };
  const mobilePanels: Record<ProductDetailsTabKey, ReactNode> = {
    about: aboutMobile ?? about,
    specs: specsMobile ?? specs,
    stock: stockMobile ?? stock,
    delivery: deliveryMobile ?? delivery,
    reviews: reviewsMobile ?? reviews,
    warranty: warrantyMobile ?? warranty,
  };
  const [indicator, setIndicator] = useState<IndicatorMetrics | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [mobileActiveTab, setMobileActiveTab] = useState<ProductDetailsTabKey>(activeTab);

  const panelOrder = useMemo(() => TAB_ITEMS.map(item => item.key), []);

  const getMobileScrollOffset = () => {
    if (typeof window === "undefined") return 128;
    const rootStyles = window.getComputedStyle(document.documentElement);
    const headerHeight = Number.parseInt(
      rootStyles.getPropertyValue("--mobile-header-height"),
      10
    );
    const navHeight = mobileScrollerRef.current?.offsetHeight ?? 52;
    return (Number.isFinite(headerHeight) ? headerHeight : 64) + navHeight + 14;
  };

  const syncMobileRail = (tab: ProductDetailsTabKey) => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;

    const scroller = mobileScrollerRef.current;
    const activeButton = scroller?.querySelector<HTMLButtonElement>(
      `[data-mobile-tab-trigger="${tab}"]`
    );
    const activeIndex = TAB_ITEMS.findIndex(item => item.key === tab);
    if (!scroller || !activeButton || activeIndex === -1) return;

    window.requestAnimationFrame(() => {
      const nextLeft =
        activeButton.offsetLeft -
        scroller.clientWidth / 2 +
        activeButton.clientWidth / 2;
      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const clampedLeft =
        activeIndex <= 1 ? 0 : Math.min(Math.max(0, nextLeft), maxScroll);

      scroller.scrollTo({
        left: clampedLeft,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    });
  };

  useEffect(() => {
    syncMobileRail(mobileActiveTab);
  }, [mobileActiveTab, reducedMotion]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    setMobileActiveTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;

    const observer = new IntersectionObserver(
      entries => {
        const visibleEntry = entries
          .filter(entry => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const nextKey = visibleEntry?.target.getAttribute("data-mobile-tab") as ProductDetailsTabKey | null;
        if (nextKey) {
          setMobileActiveTab(nextKey);
          syncMobileRail(nextKey);
        }
      },
      {
        rootMargin: "-96px 0px -55% 0px",
        threshold: [0.2, 0.35, 0.5],
      }
    );

    for (const key of panelOrder) {
      const node = mobileSectionRefs.current[key];
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, [panelOrder]);

  useLayoutEffect(() => {
    const rail = tabsRailRef.current;
    const activeButton = tabButtonRefs.current[activeTab];
    const activePanel = panelRefs.current[activeTab];
    if (!rail || !activeButton || !activePanel) return;

    const syncMetrics = () => {
      const railRect = rail.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setIndicator({
        left: buttonRect.left - railRect.left + buttonRect.width / 2,
        width: Math.max(buttonRect.width - 20, 44),
      });
      setContentHeight(activePanel.scrollHeight);
    };

    syncMetrics();
    window.addEventListener("resize", syncMetrics);
    return () => window.removeEventListener("resize", syncMetrics);
  }, [activeTab, panelOrder]);

  const focusTab = (index: number) => {
    const target = TAB_ITEMS[(index + TAB_ITEMS.length) % TAB_ITEMS.length];
    const button = tabButtonRefs.current[target.key];
    button?.focus();
    onTabChange(target.key);
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(TAB_ITEMS.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onTabChange(TAB_ITEMS[index].key);
        break;
      default:
        break;
    }
  };

  const scrollToMobileSection = (tab: ProductDetailsTabKey) => {
    const target = mobileSectionRefs.current[tab];
    if (!target) return;
    setMobileActiveTab(tab);
    syncMobileRail(tab);
    const nextTop =
      target.getBoundingClientRect().top + window.scrollY - getMobileScrollOffset();
    window.scrollTo({
      top: Math.max(0, nextTop),
      behavior: reducedMotion ? "auto" : "smooth",
    });
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = tab;
      window.history.replaceState({}, "", nextUrl.toString());
    }
  };

  return (
    <section className="mt-16 md:mt-20">
      <div className="md:hidden">
        <div
          ref={mobileScrollerRef}
          className="sticky top-[calc(var(--mobile-header-height,64px)+6px)] z-20 -mx-4 overflow-x-auto bg-[rgba(245,247,250,0.92)] px-4 py-2 backdrop-blur-[14px] [-ms-overflow-style:none] [scrollbar-width:none] [scroll-snap-type:x_mandatory] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max items-center gap-2">
            {TAB_ITEMS.map(item => {
              const isActive = item.key === mobileActiveTab;
              const shortLabel =
                item.key === "stock"
                  ? "Наличие"
                  : item.key === "delivery"
                    ? "Доставка"
                    : item.label;

              return (
                <button
                  key={`mobile-${item.key}`}
                  data-mobile-tab-trigger={item.key}
                  type="button"
                  onClick={() => scrollToMobileSection(item.key)}
                  className={cn(
                    "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors [scroll-snap-align:start]",
                    isActive
                      ? "bg-[rgba(5,195,212,0.14)] text-[#047E8A]"
                      : "bg-[#F5F7FA] text-[#6B7280]"
                  )}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 overflow-hidden bg-white">
          {TAB_ITEMS.map(item => (
            <section
              key={`mobile-panel-${item.key}`}
              ref={node => {
                mobileSectionRefs.current[item.key] = node;
              }}
              id={item.key}
              data-mobile-tab={item.key}
              className="scroll-mt-36 px-4 py-6"
            >
              {mobilePanels[item.key]}
            </section>
          ))}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="sticky top-[var(--header-height,78px)] z-20 bg-[rgba(245,247,250,0.9)] py-3 backdrop-blur-[14px] supports-[backdrop-filter]:bg-[rgba(245,247,250,0.86)]">
          <div
            className="overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [scroll-snap-type:x_mandatory] [&::-webkit-scrollbar]:hidden"
          >
            <div
              ref={tabsRailRef}
              role="tablist"
              aria-label="Информация о товаре"
              className="relative inline-flex min-w-full items-center gap-2 px-0 py-1 md:min-h-[56px]"
            >
              {indicator ? (
                <span
                  className="pointer-events-none absolute bottom-0 z-20 h-[3px] rounded-full bg-[#05C3D4] transition-[left,width] duration-300 ease-out"
                  style={{
                    left: indicator.left,
                    width: indicator.width,
                    transform: "translateX(-50%)",
                  }}
                />
              ) : null}

              {TAB_ITEMS.map((item, index) => {
                const isActive = item.key === activeTab;

                return (
                  <button
                    key={item.key}
                    ref={node => {
                      tabButtonRefs.current[item.key] = node;
                    }}
                    id={`product-tab-${item.key}`}
                    role="tab"
                    type="button"
                    tabIndex={isActive ? 0 : -1}
                    aria-selected={isActive}
                    aria-controls={`product-tab-panel-${item.key}`}
                    onClick={() => onTabChange(item.key)}
                    onKeyDown={event => handleTabKeyDown(event, index)}
                    className={cn(
                      "relative z-30 h-11 shrink-0 [scroll-snap-align:start] rounded-full px-4 text-sm font-bold transition-[color,background,transform] duration-200 ease-out md:h-[46px] md:px-[18px]",
                      isActive
                        ? "bg-[rgba(5,195,212,0.14)] text-[#047E8A]"
                        : "text-[#64748B] hover:-translate-y-px hover:bg-white/80 hover:text-[#20262E]"
                    )}
                  >
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="relative overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
          style={contentHeight ? { height: contentHeight } : undefined}
        >
          {TAB_ITEMS.map(item => {
            const isActive = item.key === activeTab;

            return (
              <div
                key={item.key}
                ref={node => {
                  panelRefs.current[item.key] = node;
                }}
                id={`product-tab-panel-${item.key}`}
                role="tabpanel"
                aria-labelledby={`product-tab-${item.key}`}
                aria-hidden={!isActive}
                className={cn(
                  "left-0 top-0 w-full py-8",
                  isActive
                    ? "relative z-10 opacity-100 translate-y-0 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none"
                    : "pointer-events-none absolute opacity-0 translate-y-1 transition-[opacity,transform] duration-120 ease-out motion-reduce:transition-none"
                )}
              >
                <div className="[&>*:nth-child(1)]:motion-safe:animate-in [&>*:nth-child(1)]:motion-safe:fade-in-0 [&>*:nth-child(1)]:motion-safe:slide-in-from-bottom-1 [&>*:nth-child(1)]:motion-safe:duration-200">
                  {panels[item.key]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
