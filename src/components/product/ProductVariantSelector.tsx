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

function normalizeAttributeKey(key: string) {
  return key.trim().toLowerCase();
}

function isColorAttribute(key: string) {
  const normalized = normalizeAttributeKey(key);
  return normalized.includes("цвет") || normalized.includes("color");
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

  const selectedVariant =
    variants.find(variant => variant.id === selectedVariantId) ?? variants[0];
  const attributeKeys = Array.from(
    new Set(
      variants.flatMap(variant =>
        Object.keys(variant.attributes ?? {}).filter(Boolean)
      )
    )
  ).filter(key => {
    const values = new Set(
      variants
        .map(variant => variant.attributes?.[key]?.trim())
        .filter((value): value is string => Boolean(value))
    );
    return values.size > 1;
  });

  const groupedMode = attributeKeys.length > 0;
  const colorAttributeKey =
    attributeKeys.find(attributeKey => isColorAttribute(attributeKey)) ?? null;
  const visualMode = variants.some(variant =>
    Boolean(
      variant.image || variant.imageVariants || fallbackImage || fallbackImageVariants
    )
  );

  const pickVariantForAttribute = (attributeKey: string, nextValue: string) => {
    const activeSelections = new Map<string, string>();
    for (const key of attributeKeys) {
      const selectedValue = selectedVariant?.attributes?.[key]?.trim();
      if (selectedValue) activeSelections.set(key, selectedValue);
    }
    activeSelections.set(attributeKey, nextValue);

    const exactCandidate =
      variants.find(variant =>
        attributeKeys.every(key => {
          const expectedValue = activeSelections.get(key);
          if (!expectedValue) return true;
          return (variant.attributes?.[key] ?? "").trim() === expectedValue;
        })
      ) ?? null;

    if (exactCandidate) return exactCandidate;

    return (
      variants.find(
        variant => (variant.attributes?.[attributeKey] ?? "").trim() === nextValue
      ) ?? null
    );
  };

  if (groupedMode && visualMode) {
    return (
      <div className="space-y-4">
        {colorAttributeKey && selectedVariant?.attributes?.[colorAttributeKey] ? (
          <div className="text-sm font-bold text-[var(--tech-color-text-main)]">
            {colorAttributeKey}
            <span className="text-muted-foreground">
              : {selectedVariant.attributes[colorAttributeKey]}
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {variants.map(variant => {
            const isAvailable = variant.isActive && variant.stock > 0;
            const isSelected = selectedVariantId === variant.id;
            const imageProps = getProductCardImageProps({
              image: variant.image || fallbackImage,
              imageVariants: variant.imageVariants || fallbackImageVariants,
              sizes: "(max-width: 640px) 42vw, (max-width: 1280px) 180px, 150px",
            });
            const colorLabel = colorAttributeKey
              ? variant.attributes?.[colorAttributeKey]?.trim() || variant.name
              : variant.name;
            const metaLabel = Object.entries(variant.attributes ?? {})
              .filter(([key, value]) => Boolean(value) && key !== colorAttributeKey)
              .map(([, value]) => String(value))
              .join(" · ");

            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => onSelect(variant.id)}
                disabled={!isAvailable}
                className={`overflow-hidden rounded-[1.2rem] bg-[var(--tech-color-surface)] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isSelected
                    ? "outline outline-2 outline-[#05C3D4] outline-offset-2"
                    : "hover:brightness-[1.03]"
                } ${!isAvailable ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <div className="aspect-square bg-white p-3">
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
                  <div className="min-h-[1.5rem] text-sm font-bold leading-5 text-[var(--tech-color-text-main)]">
                    {colorLabel}
                  </div>

                  {metaLabel ? (
                    <div className="text-[11px] leading-4 text-muted-foreground">
                      {metaLabel}
                    </div>
                  ) : null}

                  <div className="text-lg font-black text-[var(--tech-color-primary)]">
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

  if (groupedMode) {
    return (
      <div className="space-y-6">
        <div className="space-y-5">
          {attributeKeys.map(attributeKey => {
            const values = Array.from(
              new Set(
                variants
                  .map(variant => variant.attributes?.[attributeKey]?.trim())
                  .filter((value): value is string => Boolean(value))
              )
            );
            const colorMode = isColorAttribute(attributeKey);

            return (
              <div key={attributeKey} className="space-y-3">
                <div className="text-sm font-bold text-[var(--tech-color-text-main)]">
                  {attributeKey}
                  {selectedVariant?.attributes?.[attributeKey] ? (
                    <span className="text-muted-foreground">
                      : {selectedVariant.attributes[attributeKey]}
                    </span>
                  ) : null}
                </div>

                <div className={`flex flex-wrap gap-3 ${colorMode ? "items-start" : "items-center"}`}>
                  {values.map(value => {
                    const candidateVariant = pickVariantForAttribute(attributeKey, value);
                    const isAvailable = Boolean(
                      candidateVariant &&
                        candidateVariant.isActive &&
                        candidateVariant.stock > 0
                    );
                    const isSelected =
                      (selectedVariant?.attributes?.[attributeKey] ?? "").trim() === value;

                    if (colorMode && candidateVariant) {
                      const imageProps = getProductCardImageProps({
                        image: candidateVariant.image || fallbackImage,
                        imageVariants:
                          candidateVariant.imageVariants || fallbackImageVariants,
                        sizes: "76px",
                      });

                      return (
                        <button
                          key={`${attributeKey}-${value}`}
                          type="button"
                          onClick={() => candidateVariant && onSelect(candidateVariant.id)}
                          disabled={!isAvailable}
                          className={`overflow-hidden rounded-[1rem] bg-white p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                            isSelected
                              ? "outline outline-2 outline-[#05C3D4] outline-offset-2"
                              : "hover:brightness-95"
                          } ${!isAvailable ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <div className="flex h-[76px] w-[76px] items-center justify-center rounded-2xl bg-muted/35 p-2">
                            <img
                              src={imageProps.src}
                              srcSet={imageProps.srcSet}
                              sizes={imageProps.sizes}
                              alt={`${value} — вариант товара`}
                              className="h-full w-full object-contain"
                              loading="lazy"
                              decoding="async"
                              onError={applyProductImageFallback}
                            />
                          </div>
                          <div className="px-1 pb-1 pt-2 text-center text-[11px] font-bold leading-4 text-[var(--tech-color-text-main)]">
                            {value}
                          </div>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={`${attributeKey}-${value}`}
                        type="button"
                        onClick={() => candidateVariant && onSelect(candidateVariant.id)}
                        disabled={!isAvailable}
                        className={`inline-flex min-h-11 items-center justify-center rounded-xl border-none bg-[var(--tech-color-surface-muted)] px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          isSelected
                            ? "bg-[var(--tech-color-brand-dark)] text-white"
                            : "text-[var(--tech-color-text-main)] hover:brightness-95"
                        } ${!isAvailable ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
              className={`overflow-hidden rounded-[1.2rem] bg-[var(--tech-color-surface)] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isSelected
                  ? "outline outline-2 outline-[#05C3D4] outline-offset-2"
                  : "hover:brightness-[1.03]"
              } ${!isAvailable ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <div className="aspect-square bg-white p-3">
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
                <div className="min-h-[2.75rem] text-sm font-bold leading-5 text-[var(--tech-color-text-main)]">
                  {attributeSummary || variant.name}
                </div>

                {variant.article ? (
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Код: {variant.article}
                  </div>
                ) : null}

                <div className="text-lg font-black text-[var(--tech-color-primary)]">
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
