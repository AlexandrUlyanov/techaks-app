import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  const selectImage = (index: number) => {
    setActiveIndex(index);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const goToPrevious = () => {
    if (!hasMultipleImages) return;
    setActiveIndex((activeIndex - 1 + normalizedImages.length) % normalizedImages.length);
  };

  const goToNext = () => {
    if (!hasMultipleImages) return;
    setActiveIndex((activeIndex + 1) % normalizedImages.length);
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
                    onClick={() => selectImage(index)}
                    aria-label={`Показать изображение ${index + 1} товара ${productName}`}
                    className={`overflow-hidden rounded-xl bg-[#F6F7F8] p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      index === activeIndex
                        ? "outline outline-2 outline-[#05C3D4] outline-offset-2"
                        : "hover:bg-[#ECEFF1]"
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
          className={`relative order-1 md:order-2 overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(5,195,212,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#ffffff_100%)] p-4 md:min-h-[620px] md:p-8 xl:min-h-[720px] xl:p-10 ${hasMultipleImages ? "" : "md:col-span-2"}`}
        >
          {badges}
          {manufacturerBadge}

          {hasMultipleImages ? (
            <>
              <button
                type="button"
                onClick={goToPrevious}
                className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1F2328] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 md:left-5"
                aria-label="Предыдущее изображение"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1F2328] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 md:right-5"
                aria-label="Следующее изображение"
              >
                <ChevronRight size={20} />
              </button>
            </>
          ) : null}

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
              className="max-h-[420px] w-full cursor-zoom-in object-contain transition-transform duration-500 hover:scale-[1.03] md:max-h-[620px] xl:max-h-[720px]"
              decoding="async"
              onError={applyProductImageFallback}
            />
          </button>

          {hasMultipleImages ? (
            <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#6B7280]">
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
