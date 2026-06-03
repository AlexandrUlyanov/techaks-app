import { Package, ShieldCheck, Store, Truck } from "lucide-react";

type ProductServicesProps = {
  pickupText: string;
  deliveryText: string;
  storeText: string;
  compactMobile?: boolean;
  onPickupClick?: () => void;
};

const rows = [
  {
    key: "pickup",
    title: "Самовывоз",
    icon: Package,
  },
  {
    key: "delivery",
    title: "Доставка",
    icon: Truck,
  },
  {
    key: "store",
    title: "Магазины",
    icon: Store,
  },
  {
    key: "warranty",
    title: "Гарантия",
    icon: ShieldCheck,
  },
] as const;

export default function ProductServices({
  pickupText,
  deliveryText,
  storeText,
  compactMobile = false,
  onPickupClick,
}: ProductServicesProps) {
  const mobileRows = rows.filter(row => row.key !== "store");
  const rowsToRender = compactMobile ? mobileRows : rows;
  const descriptions: Record<string, string> = {
    pickup: pickupText,
    delivery: deliveryText,
    store: storeText,
    warranty: "Официальная гарантия магазина и производителя при наличии.",
  };

  return (
    <section className="mt-12">
      <h2
        className={`text-2xl font-black tracking-tight text-[var(--tech-color-text-main)] md:text-3xl ${
          compactMobile ? "hidden md:block" : ""
        }`}
      >
        Услуги и получение
      </h2>
      <div className={compactMobile ? "mt-0 space-y-2 md:mt-4" : "mt-4 space-y-2.5"}>
        {rowsToRender.map(row => {
          const Icon = row.icon;
          const isPickupAction = row.key === "pickup" && Boolean(onPickupClick);
          const rowClassName = `flex w-full items-start justify-between gap-4 rounded-[22px] px-4 py-4 text-left transition-colors duration-200 ${
            isPickupAction
              ? "cursor-pointer hover:bg-[rgba(5,195,212,0.07)] dark:hover:bg-[rgba(5,195,212,0.09)]"
              : "bg-transparent"
          }`;

          const content = (
            <>
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={`mt-0.5 flex shrink-0 items-center justify-center rounded-2xl bg-[var(--tech-color-surface-muted)] text-[var(--tech-color-text-main)] ${
                    compactMobile ? "h-9 w-9 md:h-10 md:w-10" : "h-10 w-10"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div
                    className={`font-semibold text-[var(--tech-color-text-main)] ${
                      compactMobile ? "text-[15px] md:text-base" : "text-base"
                    }`}
                  >
                    {row.title}
                  </div>
                  <div
                    className={`mt-1 text-[var(--tech-color-text-muted)] ${
                      compactMobile
                        ? "text-[13px] leading-5 md:text-sm md:leading-6"
                        : "text-sm leading-6"
                    }`}
                  >
                    {descriptions[row.key]}
                  </div>
                </div>
              </div>
            </>
          );

          if (isPickupAction) {
            return (
              <button
                key={row.key}
                type="button"
                onClick={onPickupClick}
                className={rowClassName}
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={row.key}
              className={rowClassName}
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
