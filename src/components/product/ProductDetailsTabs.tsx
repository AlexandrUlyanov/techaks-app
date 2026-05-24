import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

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
  const panels: Record<ProductDetailsTabKey, ReactNode> = {
    about,
    specs,
    stock,
    delivery,
    reviews,
    warranty,
  };

  return (
    <section className="mt-16 md:mt-20">
      <div className="overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-full items-center gap-2 border-b border-[#E9EDF0] pb-3">
          {TAB_ITEMS.map(item => {
            const isActive = item.key === activeTab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={cn(
                  "relative shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors md:px-5",
                  isActive
                    ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[#1F2328]"
                    : "text-[#6B7280] hover:bg-[#F6F7F8] hover:text-[#1F2328]"
                )}
                aria-pressed={isActive}
              >
                {item.label}
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

      <div className="mt-6 rounded-[1.75rem] border border-[#EDF1F4] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
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
