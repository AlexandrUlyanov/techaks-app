import { Package, ShieldCheck, Store, Truck } from "lucide-react";

type ProductServicesProps = {
  pickupText: string;
  deliveryText: string;
  storeText: string;
  compactMobile?: boolean;
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
        className={`text-2xl font-black tracking-tight text-[#1F2328] md:text-3xl ${
          compactMobile ? "hidden md:block" : ""
        }`}
      >
        Услуги и получение
      </h2>
      <div className={compactMobile ? "mt-0 md:mt-4" : "mt-4"}>
        {rowsToRender.map((row, index) => {
          const Icon = row.icon;
          return (
            <div
              key={row.key}
              className={`flex items-start justify-between gap-4 py-4 ${
                index > 0 ? "border-t border-[#F0F1F2]" : ""
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={`mt-0.5 flex shrink-0 items-center justify-center rounded-2xl bg-[#F6F7F8] text-[#464A50] ${
                    compactMobile ? "h-9 w-9 md:h-10 md:w-10" : "h-10 w-10"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div
                    className={`font-semibold text-[#1F2328] ${
                      compactMobile ? "text-[15px] md:text-base" : "text-base"
                    }`}
                  >
                    {row.title}
                  </div>
                  <div
                    className={`mt-1 text-[#6B7280] ${
                      compactMobile
                        ? "text-[13px] leading-5 md:text-sm md:leading-6"
                        : "text-sm leading-6"
                    }`}
                  >
                    {descriptions[row.key]}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
