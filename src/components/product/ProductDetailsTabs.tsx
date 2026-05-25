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
}: {
  activeTab: ProductDetailsTabKey;
  onTabChange: (tab: ProductDetailsTabKey) => void;
  about: ReactNode;
  specs: ReactNode;
  stock: ReactNode;
  delivery: ReactNode;
  reviews: ReactNode;
  warranty: ReactNode;
}) {
  const mobileScrollerRef = useRef<HTMLDivElement | null>(null);
  const tabsRailRef = useRef<HTMLDivElement | null>(null);
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
  const activeIndex = TAB_ITEMS.findIndex(item => item.key === activeTab);
  const [indicator, setIndicator] = useState<IndicatorMetrics | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const panelOrder = useMemo(() => TAB_ITEMS.map(item => item.key), []);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;

    const scroller = mobileScrollerRef.current;
    const activeButton = tabButtonRefs.current[activeTab];
    if (!scroller || !activeButton) return;

    const nextLeft =
      activeButton.offsetLeft -
      scroller.clientWidth / 2 +
      activeButton.clientWidth / 2;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const clampedLeft =
      activeIndex <= 1 ? 0 : Math.min(Math.max(0, nextLeft), maxScroll);

    scroller.scrollTo({ left: clampedLeft, behavior: "smooth" });
  }, [activeIndex, activeTab]);

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

  return (
    <section className="mt-16 md:mt-20">
      <div className="rounded-[1.5rem] border border-[rgba(226,232,240,0.9)] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06),0_4px_18px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08),0_8px_24px_rgba(15,23,42,0.05)] md:rounded-[1.75rem]">
        <div className="sticky top-[var(--header-height,78px)] z-20 rounded-t-[1.5rem] bg-[rgba(255,255,255,0.92)] backdrop-blur-[14px] supports-[backdrop-filter]:bg-[rgba(255,255,255,0.92)] md:rounded-t-[1.75rem]">
          <div
            ref={mobileScrollerRef}
            className="overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [scroll-snap-type:x_mandatory] [&::-webkit-scrollbar]:hidden"
          >
            <div
              ref={tabsRailRef}
              role="tablist"
              aria-label="Информация о товаре"
              className="relative inline-flex min-w-full items-end gap-1.5 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] px-2 py-2.5 md:h-[68px] md:gap-1.5 md:px-3.5 md:py-2.5"
            >
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#E2E8F0]" />
              {indicator ? (
                <>
                  <span
                    className="pointer-events-none absolute bottom-0 z-20 h-[3px] rounded-full bg-[#05C3D4] shadow-[0_0_18px_rgba(5,195,212,0.24)] transition-[left,width] duration-300 ease-out"
                    style={{
                      left: indicator.left,
                      width: indicator.width,
                      transform: "translateX(-50%)",
                    }}
                  />
                  <span
                    className="pointer-events-none absolute bottom-0 z-20 h-4 transition-[left,width] duration-300 ease-out"
                    style={{
                      left: indicator.left,
                      width: Math.min(indicator.width, 52),
                      transform: "translateX(-50%)",
                    }}
                  >
                    <span className="absolute inset-x-0 bottom-0 h-4 rounded-t-[18px] border-x border-t border-[rgba(5,195,212,0.36)] bg-white shadow-[0_-10px_24px_rgba(15,23,42,0.06)]" />
                  </span>
                </>
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
                      "relative z-30 h-11 shrink-0 [scroll-snap-align:start] rounded-2xl px-4 text-sm font-bold transition-[color,background,transform,box-shadow,border-color] duration-200 ease-out md:h-[46px] md:px-[18px]",
                      isActive
                        ? "translate-y-px bg-white text-[#20262E] shadow-[0_10px_24px_rgba(15,23,42,0.08),inset_0_0_0_1px_rgba(5,195,212,0.35)]"
                        : "text-[#64748B] hover:-translate-y-px hover:bg-[rgba(5,195,212,0.08)] hover:text-[#20262E]"
                    )}
                  >
                    <span className="whitespace-nowrap">{item.label}</span>
                    <span
                      className={cn(
                        "pointer-events-none absolute left-1/2 bottom-[6px] h-[3px] w-7 -translate-x-1/2 rounded-full bg-[#05C3D4] shadow-[0_0_14px_rgba(5,195,212,0.25)] transition-opacity duration-200",
                        isActive ? "opacity-100" : "opacity-0"
                      )}
                    />
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
                  "left-0 top-0 w-full p-5 md:p-8",
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
