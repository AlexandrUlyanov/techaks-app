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
  const railRef = useRef<HTMLDivElement | null>(null);
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

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const rail = railRef.current;
      const activeButton = tabButtonRefs.current[activeTab];
      if (!rail || !activeButton) return;

      const center = activeButton.offsetLeft + activeButton.offsetWidth / 2;
      const width = Math.min(Math.max(activeButton.offsetWidth * 0.58, 34), 68);
      setIndicator({ left: center, width });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);

    return () => {
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeTab]);

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

  return (
    <section className="mt-16 md:mt-20">
      <div
        ref={mobileScrollerRef}
        className="overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          ref={railRef}
          className="relative inline-flex min-w-full items-center gap-2 pb-4"
        >
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[color:color-mix(in_srgb,var(--tech-color-border)_72%,transparent)]" />
          {indicator ? (
            <>
              <span
                className="pointer-events-none absolute bottom-0 hidden h-[2px] rounded-full bg-[var(--tech-color-primary)] opacity-90 shadow-[0_0_14px_rgba(5,195,212,0.28)] transition-[left,width] duration-300 ease-out md:block"
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  transform: "translateX(-50%)",
                }}
              />
              <span
                className="pointer-events-none absolute bottom-0 z-10 h-[3px] rounded-full bg-[var(--tech-color-primary)] shadow-[0_0_16px_rgba(5,195,212,0.34)] transition-[left,width] duration-300 ease-out md:hidden"
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  transform: "translateX(-50%)",
                }}
              >
                <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-[72%] rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_18%,white)] shadow-[0_0_0_6px_rgba(5,195,212,0.11),0_0_22px_rgba(5,195,212,0.28)]" />
                <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-[72%] rounded-full bg-[var(--tech-color-primary)] shadow-[0_0_12px_rgba(5,195,212,0.55)]" />
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
                  "relative shrink-0 overflow-hidden rounded-full py-2.5 text-sm font-semibold transition-[width,padding,background-color,color] duration-200 md:px-5",
                  isActive
                    ? "w-10 bg-[color:color-mix(in_srgb,var(--tech-color-primary)_16%,var(--tech-color-surface))] px-0 text-[var(--tech-color-text-main)] md:w-auto md:px-5"
                    : "px-4 text-[var(--tech-color-text-muted)] hover:bg-[var(--tech-color-surface-muted)] hover:text-[var(--tech-color-text-main)]"
                )}
                aria-pressed={isActive}
                aria-label={item.label}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-auto flex h-5 items-center justify-center transition-all duration-200 md:hidden",
                    isActive ? "w-5 opacity-100" : "w-0 opacity-0"
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--tech-color-primary)]" />
                </span>
                <span
                  className={cn(
                    "hidden whitespace-nowrap transition-all duration-200 md:inline",
                    isActive ? "md:opacity-100" : "md:opacity-100"
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 md:hidden",
                    isActive
                      ? "max-w-0 opacity-0"
                      : "max-w-[13rem] opacity-100"
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    "pointer-events-none absolute inset-x-4 -bottom-[14px] hidden h-0.5 rounded-full transition-opacity md:block",
                    isActive ? "bg-[var(--tech-color-primary)] opacity-100" : "opacity-0"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-[var(--tech-color-border)]/70 bg-[var(--tech-color-surface)] shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(5,195,212,0.32),transparent)]" />
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
                  ? "block motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
                  : "hidden"
              )}
            >
              {panels[item.key]}
            </div>
          );
        })}
      </div>
    </section>
  );
}
