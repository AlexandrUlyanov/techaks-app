type ProductVariant = {
  id: number;
  name: string;
  article?: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  attributes?: Record<string, string>;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
}

export default function ProductVariantSelector({
  variants,
  selectedVariantId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedVariantId: number | null;
  onSelect: (variantId: number) => void;
}) {
  if (variants.length === 0) return null;

  return (
    <div className="rounded-[1.75rem] border border-border bg-card/70 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
          Выберите вариант
        </h3>
      </div>

      <div className="space-y-3">
        {variants.map(variant => {
          const isAvailable = variant.isActive && variant.stock > 0;
          const isSelected = selectedVariantId === variant.id;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              disabled={!isAvailable}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-[#05C3D4] bg-[#F4FEFF] shadow-sm"
                  : "border-border bg-white hover:border-[#05C3D4]/40"
              } ${!isAvailable ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-[#15171A]">{variant.name}</div>
                  {variant.article ? (
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Артикул: {variant.article}
                    </div>
                  ) : null}
                  {variant.attributes && Object.keys(variant.attributes).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(variant.attributes).map(([key, value]) => (
                        <span
                          key={`${variant.id}-${key}`}
                          className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 text-left sm:text-right">
                  <div className="text-lg font-black text-[#05C3D4]">
                    {formatPrice(variant.price)}
                  </div>
                  <div
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                      isAvailable
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isAvailable ? "В наличии" : "Нет в наличии"}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
