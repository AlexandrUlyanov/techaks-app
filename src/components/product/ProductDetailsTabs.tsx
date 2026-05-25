import { cn } from "@/lib/utils";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

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
  const panels: Record<ProductDetailsTabKey, ReactNode> = {
    about,
    specs,
    stock,
    delivery,
    reviews,
    warranty,
  };
  const activeIndex = TAB_ITEMS.findIndex(item => item.key === activeTab);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;

    const scroller = mobileScrollerRef.current;
    const activeButton = tabButtonRefs.current[activeTab];
    if (!scroller || !activeButton) return;

    if (activeIndex <= 1) {
      scroller.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    const nextLeft =
      activeButton.offsetLeft -
      scroller.clientWidth / 2 +
      activeButton.clientWidth / 2;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const clampedLeft = Math.min(Math.max(0, nextLeft), maxScroll);

    scroller.scrollTo({ left: clampedLeft, behavior: "smooth" });
  }, [activeIndex, activeTab]);

  useLayoutEffect(() => {
    const rail = tabsRailRef.current;
    const activeButton = tabButtonRefs.current[activeTab];
    if (!rail || !activeButton) return;

    const syncIndicator = () => {
      const railRect = rail.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setIndicator({
        left: buttonRect.left - railRect.left + buttonRect.width / 2,
        width: Math.max(buttonRect.width - 18, 42),
      });
    };

    syncIndicator();
    window.addEventListener("resize", syncIndicator);
    return () => window.removeEventListener("resize", syncIndicator);
  }, [activeTab]);

  return (
    <section className="mt-16 md:mt-20">
      <div className="overflow-hidden rounded-[1.75rem] border border-[var(--tech-color-border)]/75 bg-[var(--tech-color-surface)] shadow-[var(--tech-shadow-card)]">
        <div
          ref={mobileScrollerRef}
          className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div
            ref={tabsRailRef}
            className="relative inline-flex min-w-full items-end gap-2 px-3 pt-3 md:px-5 md:pt-5"
          >
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--tech-color-border)]/75 transition-colors duration-300" />
            {indicator ? (
              <>
                <span
                  className="pointer-events-none absolute bottom-0 z-10 h-px bg-[var(--tech-color-primary)]/90 shadow-[0_0_12px_rgba(5,195,212,0.28)] transition-[left,width] duration-300 ease-out"
                  style={{
                    left: indicator.left,
                    width: indicator.width,
                    transform: "translateX(-50%)",
                  }}
                />
                <span
                  className="pointer-events-none absolute bottom-0 z-10 h-4 transition-[left,width] duration-300 ease-out"
                  style={{
                    left: indicator.left,
                    width: Math.min(indicator.width, 48),
                    transform: "translateX(-50%)",
                  }}
                >
                  <span className="absolute left-1/2 top-[1px] h-4 w-full -translate-x-1/2 rounded-t-full border-x border-t border-[var(--tech-color-primary)]/85 bg-[var(--tech-color-surface)] shadow-[0_-2px_10px_rgba(5,195,212,0.10)]" />
                </span>
              </>
            ) : null}
            {TAB_ITEMS.map(item => {
              const isActive = item.key === activeTab;
              return (
                <button
                  key={item.key}
                  ref={node => {
                    tabButtonRefs.current[item.key] = node;
                  }}
                  type="button"
                  onClick={() => onTabChange(item.key)}
                  className={cn(
                    "relative z-20 shrink-0 whitespace-nowrap rounded-t-[1.15rem] border border-b-0 px-4 py-3 text-sm font-semibold transition-[color,border-color,background-color,transform,box-shadow] duration-300 ease-out md:px-5",
                    isActive
                      ? "translate-y-px border-[var(--tech-color-primary)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,var(--tech-color-surface))] text-[var(--tech-color-text-main)] shadow-[0_-8px_18px_rgba(5,195,212,0.10)]"
                      : "border-transparent bg-transparent text-[var(--tech-color-text-muted)] hover:border-[var(--tech-color-border)]/75 hover:bg-[var(--tech-color-surface-muted)]/60 hover:text-[var(--tech-color-text-main)]"
                  )}
                  aria-pressed={isActive}
                  aria-label={item.label}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[color:color-mix(in_srgb,var(--tech-color-primary)_72%,var(--tech-color-border))] transition-colors duration-300" />
          {TAB_ITEMS.map(item => {
            const isActive = item.key === activeTab;
            return (
              <div
                key={item.key}
                id={`product-tab-panel-${item.key}`}
                data-state={isActive ? "active" : "inactive"}
                aria-hidden={!isActive}
                className={cn(
                  "p-5 md:p-8",
                  isActive
                    ? "block motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-300"
                    : "hidden"
                )}
              >
                {panels[item.key]}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
