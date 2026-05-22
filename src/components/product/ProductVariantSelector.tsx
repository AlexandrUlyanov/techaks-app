import {
  applyProductImageFallback,
  getProductCardImageProps,
} from "@/lib/product-images";

type ProductVariant = {
  id: number;
  name: string;
  article?: string | null;
  image?: string | null;
  imageVariants?: unknown;
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
  fallbackImage,
  fallbackImageVariants,
}: {
  variants: ProductVariant[];
  selectedVariantId: number | null;
  onSelect: (variantId: number) => void;
  fallbackImage?: string | null;
  fallbackImageVariants?: unknown;
}) {
  if (variants.length === 0) return null;

  return (
    <div className="rounded-[1.75rem] border border-border bg-card/70 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
          Выберите вариант
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {variants.map(variant => {
          const isAvailable = variant.isActive && variant.stock > 0;
          const isSelected = selectedVariantId === variant.id;
          const imageProps = getProductCardImageProps({
            image: variant.image || fallbackImage,
            imageVariants: variant.imageVariants || fallbackImageVariants,
            sizes: "(max-width: 640px) 42vw, (max-width: 1280px) 180px, 150px",
          });
          const attributeSummary = variant.attributes
            ? Object.values(variant.attributes)
                .filter(Boolean)
                .join(" / ")
            : "";

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              disabled={!isAvailable}
              className={`overflow-hidden rounded-2xl border bg-white text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isSelected
                  ? "border-[#05C3D4] shadow-[0_10px_24px_rgba(5,195,212,0.18)]"
                  : "border-border hover:border-[#05C3D4]/40"
              } ${!isAvailable ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <div className="aspect-square border-b border-border bg-muted/40 p-3">
                <img
                  src={imageProps.src}
                  srcSet={imageProps.srcSet}
                  sizes={imageProps.sizes}
                  alt={`${variant.name} — вариант товара`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  decoding="async"
                  onError={applyProductImageFallback}
                />
              </div>

              <div className="space-y-2 p-3">
                <div className="min-h-[2.75rem] text-sm font-bold leading-5 text-[#15171A]">
                  {attributeSummary || variant.name}
                </div>

                {variant.article ? (
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Код: {variant.article}
                  </div>
                ) : null}

                <div className="text-lg font-black text-[#05C3D4]">
                  {formatPrice(variant.price)}
                </div>

                <div
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                    isAvailable
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isAvailable ? "В наличии" : "Нет в наличии"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
