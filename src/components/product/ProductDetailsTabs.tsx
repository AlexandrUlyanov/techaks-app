import { cn } from "@/lib/utils";
import { type ReactNode, useEffect, useRef } from "react";

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
        <div className="inline-flex min-w-full items-center gap-2 border-b border-[var(--tech-color-border)]/65 pb-3">
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
                  "relative shrink-0 overflow-hidden rounded-full px-4 py-2.5 text-sm font-semibold transition-[background-color,color] duration-200 md:px-5",
                  isActive
                    ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_16%,var(--tech-color-surface))] text-[var(--tech-color-text-main)]"
                    : "px-4 text-[var(--tech-color-text-muted)] hover:bg-[var(--tech-color-surface-muted)] hover:text-[var(--tech-color-text-main)]"
                )}
                aria-pressed={isActive}
                aria-label={item.label}
              >
                <span className="whitespace-nowrap">
                  {item.label}
                </span>
                <span
                  className={cn(
                    "pointer-events-none absolute inset-x-4 -bottom-[13px] h-0.5 rounded-full transition-opacity",
                    isActive ? "bg-[var(--tech-color-primary)] opacity-100" : "opacity-0"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-[var(--tech-color-border)]/70 bg-[var(--tech-color-surface)] shadow-[var(--tech-shadow-card)]">
        {TAB_ITEMS.map(item => {
          const isActive = item.key === activeTab;
          return (
            <div
              key={item.key}
              id={`product-tab-panel-${item.key}`}
              data-state={isActive ? "active" : "inactive"}
              aria-hidden={!isActive}
              className={cn("p-5 md:p-8", isActive ? "block" : "hidden")}
            >
              {panels[item.key]}
            </div>
          );
        })}
      </div>
    </section>
  );
}
