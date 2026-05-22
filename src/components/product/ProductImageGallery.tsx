import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import ProductImageLightbox from "./ProductImageLightbox";
import {
  applyProductImageFallback,
  getProductGalleryImageProps,
} from "@/lib/product-images";
import type { ProductImageVariantSet } from "@contracts/product-images";

type ProductImageGalleryProps = {
  images: ProductImageVariantSet[];
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
    () =>
      images.filter(
        (image, index, collection) =>
          Boolean(image?.original || image?.medium || image?.card || image?.thumb) &&
          collection.findIndex(item => item.original === image.original) === index
      ),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const hasMultipleImages = normalizedImages.length > 1;
  const activeImage = normalizedImages[activeIndex] ?? normalizedImages[0] ?? null;
  const activeImageProps = getProductGalleryImageProps({
    image: activeImage?.original ?? "",
    imageVariants: activeImage,
  });

  const openLightbox = (index: number) => {
    setActiveIndex(index);
    setLightboxIndex(index);
  };

  return (
    <>
      <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-[92px_minmax(0,1fr)] md:gap-6 xl:grid-cols-[96px_minmax(0,1fr)]">
        {hasMultipleImages ? (
          <div className="order-2 md:order-1">
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:sticky md:top-24 md:grid-cols-1">
              {normalizedImages.map((image, index) => {
                const thumbnailProps = getProductGalleryImageProps({
                  image: image.original,
                  imageVariants: image,
                });

                return (
                  <button
                    key={`${image.original}-${index}`}
                    type="button"
                    onClick={() => openLightbox(index)}
                    aria-label={`Открыть изображение ${index + 1} товара ${productName}`}
                    className={`overflow-hidden rounded-[1.4rem] border bg-white p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      index === activeIndex
                        ? "border-[#05C3D4] shadow-[0_12px_26px_rgba(5,195,212,0.18)]"
                        : "border-border hover:border-[#05C3D4]/50"
                    }`}
                  >
                    <img
                      src={image.thumb || image.card || thumbnailProps.src}
                      srcSet={thumbnailProps.srcSet}
                      sizes="80px"
                      alt={`${productName} — миниатюра ${index + 1}`}
                      className="h-16 w-full object-contain sm:h-20 md:h-[76px]"
                      loading="lazy"
                      decoding="async"
                      onError={applyProductImageFallback}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          className={`relative order-1 md:order-2 overflow-hidden rounded-[2.2rem] border border-border bg-[radial-gradient(circle_at_top,rgba(5,195,212,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f9fbfc_100%)] p-8 shadow-sm md:min-h-[720px] md:p-14 xl:p-16 ${hasMultipleImages ? "" : "md:col-span-2"}`}
        >
          {badges}
          {manufacturerBadge}

          <button
            type="button"
            onClick={() => openLightbox(activeIndex)}
            aria-label={`Увеличить изображение товара ${productName}`}
            className="relative z-10 flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-4 focus-visible:ring-offset-white"
          >
            <img
              src={activeImageProps.src}
              srcSet={activeImageProps.srcSet}
              sizes={activeImageProps.sizes}
              alt={productName}
              className="max-h-[430px] w-full cursor-zoom-in object-contain transition-transform duration-500 hover:scale-[1.03] md:max-h-[640px] xl:max-h-[720px]"
              decoding="async"
              onError={applyProductImageFallback}
            />
          </button>

          {hasMultipleImages ? (
            <div className="pointer-events-none absolute bottom-5 right-5 z-20 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground shadow-sm">
              {activeIndex + 1} / {normalizedImages.length}
            </div>
          ) : null}
        </div>
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
