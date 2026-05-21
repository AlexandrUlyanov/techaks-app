import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import ProductImageLightbox from "./ProductImageLightbox";
import { applyProductImageFallback } from "@/lib/product-images";

type ProductImageGalleryProps = {
  images: string[];
  productName: string;
  badges?: ReactNode;
  manufacturerBadge?: ReactNode;
};

export default function ProductImageGallery({
  images,
  productName,
  badges,
  manufacturerBadge,
}: ProductImageGalleryProps) {
  const normalizedImages = useMemo(
    () => Array.from(new Set(images.filter(Boolean))),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const hasMultipleImages = normalizedImages.length > 1;
  const activeImage = normalizedImages[activeIndex] ?? normalizedImages[0] ?? "";

  const openLightbox = (index: number) => {
    setActiveIndex(index);
    setLightboxIndex(index);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="relative group bg-white border border-border rounded-[2rem] p-8 md:p-16 flex items-center justify-center overflow-hidden shadow-sm">
          {badges}
          {manufacturerBadge}

          <button
            type="button"
            onClick={() => openLightbox(activeIndex)}
            aria-label={`Увеличить изображение товара ${productName}`}
            className="relative z-10 flex w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-4 focus-visible:ring-offset-white"
          >
            <img
              src={activeImage}
              alt={productName}
              className="max-h-[450px] cursor-zoom-in object-contain transform transition-transform duration-700 group-hover:scale-110"
              onError={applyProductImageFallback}
            />
          </button>
        </div>

        {hasMultipleImages ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {normalizedImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => openLightbox(index)}
                aria-label={`Открыть изображение ${index + 1} товара ${productName}`}
                className={`overflow-hidden rounded-2xl border bg-white p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  index === activeIndex
                    ? "border-[#05C3D4] shadow-[0_8px_24px_rgba(5,195,212,0.14)]"
                    : "border-border hover:border-[#05C3D4]/50"
                }`}
              >
                <img
                  src={image}
                  alt={`${productName} — миниатюра ${index + 1}`}
                  className="h-16 w-full object-contain sm:h-20"
                  onError={applyProductImageFallback}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <ProductImageLightbox
        images={normalizedImages}
        productName={productName}
        selectedIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onSelect={index => {
          setActiveIndex(index);
          setLightboxIndex(index);
        }}
      />
    </>
  );
}
