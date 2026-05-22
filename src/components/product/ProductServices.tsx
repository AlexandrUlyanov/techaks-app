import { Package, ShieldCheck, Store, Truck } from "lucide-react";

type ProductServicesProps = {
  pickupText: string;
  deliveryText: string;
  storeText: string;
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
}: ProductServicesProps) {
  const descriptions: Record<string, string> = {
    pickup: pickupText,
    delivery: deliveryText,
    store: storeText,
    warranty: "Официальная гарантия магазина и производителя при наличии.",
  };

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-black tracking-tight text-[#1F2328] md:text-3xl">
        Услуги и получение
      </h2>
      <div className="mt-4">
        {rows.map((row, index) => {
          const Icon = row.icon;
          return (
            <div
              key={row.key}
              className={`flex items-start justify-between gap-4 py-4 ${
                index > 0 ? "border-t border-[#F0F1F2]" : ""
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F6F7F8] text-[#464A50]">
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-[#1F2328]">
                    {row.title}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[#6B7280]">
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
