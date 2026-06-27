import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
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
};

export default function ProductImageGallery({
  images,
  productName,
  badges,
}: ProductImageGalleryProps) {
  const thumbsRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Record<string, HTMLButtonElement | null>>({});
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
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const hasMultipleImages = normalizedImages.length > 1;
  const activeImage = normalizedImages[activeIndex] ?? normalizedImages[0] ?? null;
  const activeImageProps = getProductGalleryImageProps({
    image: activeImage?.original ?? "",
    imageVariants: activeImage,
  });
  const getImageRefKey = useCallback(
    (image: ProductImageVariantSet, index: number) =>
      image.original ?? image.medium ?? image.card ?? image.thumb ?? `image-${index}`,
    []
  );

  const updateScrollState = useCallback(() => {
    const container = thumbsRef.current;
    if (!container || typeof window === "undefined" || window.innerWidth < 768) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }

    setCanScrollUp(container.scrollTop > 2);
    setCanScrollDown(container.scrollTop + container.clientHeight < container.scrollHeight - 2);
  }, []);

  const scrollThumbs = useCallback((direction: "up" | "down") => {
    const container = thumbsRef.current;
    if (!container) return;

    container.scrollBy({
      top: direction === "up" ? -96 : 96,
      behavior: "smooth",
    });
  }, []);

  const ensureActiveThumbVisible = useCallback(
    (index: number) => {
      const image = normalizedImages[index];
      if (!image) return;
      const refKey = getImageRefKey(image, index);

      requestAnimationFrame(() => {
        thumbRefs.current[refKey]?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      });
    },
    [getImageRefKey, normalizedImages]
  );

  const selectImage = useCallback(
    (index: number) => {
      setActiveIndex(index);
      ensureActiveThumbVisible(index);
    },
    [ensureActiveThumbVisible]
  );

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

  useEffect(() => {
    if (activeIndex <= normalizedImages.length - 1) return;
    setActiveIndex(0);
  }, [activeIndex, normalizedImages.length]);

  useEffect(() => {
    updateScrollState();
    if (!hasMultipleImages) return;

    const container = thumbsRef.current;
    if (!container) return;

    container.addEventListener("scroll", updateScrollState, { passive: true });
    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", handleResize);
    };
  }, [hasMultipleImages, updateScrollState]);

  useEffect(() => {
    if (!hasMultipleImages) return;
    ensureActiveThumbVisible(activeIndex);
    updateScrollState();
  }, [activeIndex, ensureActiveThumbVisible, hasMultipleImages, updateScrollState]);

  return (
    <>
      <div
        className={`grid gap-3 sm:gap-4 md:gap-6 ${
          hasMultipleImages
            ? "grid-cols-1 md:grid-cols-[92px_minmax(0,1fr)] xl:grid-cols-[96px_minmax(0,1fr)]"
            : "grid-cols-1"
        }`}
      >
        {hasMultipleImages ? (
          <div className="order-2 flex flex-col gap-4 md:order-1 md:gap-3">
            <button
              type="button"
              onClick={() => scrollThumbs("up")}
              disabled={!canScrollUp}
              aria-label="Прокрутить миниатюры вверх"
              className={`hidden h-9 w-9 items-center justify-center self-center rounded-full bg-[var(--tech-color-surface-muted)] text-[var(--tech-color-text-muted)] transition md:flex ${
                canScrollUp
                  ? "hover:bg-[#EAFBFD] hover:text-[#05C3D4]"
                  : "cursor-default opacity-35"
              }`}
            >
              <ChevronUp size={18} />
            </button>

            <div
              ref={thumbsRef}
              className="flex max-h-none flex-row gap-3 overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:max-h-[700px] md:flex-col md:overflow-x-hidden md:overflow-y-auto md:px-1"
            >
              {normalizedImages.map((image, index) => {
                const thumbnailProps = getProductGalleryImageProps({
                  image: image.original,
                  imageVariants: image,
                });
                const refKey = getImageRefKey(image, index);

                return (
                  <button
                    key={refKey}
                    ref={node => {
                      thumbRefs.current[refKey] = node;
                    }}
                    type="button"
                    onClick={() => selectImage(index)}
                    aria-label={`Показать изображение ${index + 1} товара ${productName}`}
                    title={`${productName} — изображение ${index + 1}`}
                    className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[1rem] border bg-white p-1.5 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-[76px] sm:w-[76px] md:h-[76px] md:w-[76px] ${
                      index === activeIndex
                        ? "border-[#05C3D4] shadow-[0_0_0_3px_rgba(5,195,212,0.12)]"
                        : "border-[#E1E7EF] hover:border-[#05C3D4]"
                    }`}
                  >
                    <img
                      src={image.thumb || image.card || thumbnailProps.src}
                      srcSet={thumbnailProps.srcSet}
                      sizes="80px"
                      alt={`${productName} — миниатюра ${index + 1}`}
                      title={`${productName} — миниатюра ${index + 1}`}
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                      decoding="async"
                      width={thumbnailProps.width}
                      height={thumbnailProps.height}
                      onError={applyProductImageFallback}
                    />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollThumbs("down")}
              disabled={!canScrollDown}
              aria-label="Прокрутить миниатюры вниз"
              className={`hidden h-9 w-9 items-center justify-center self-center rounded-full bg-[var(--tech-color-surface-muted)] text-[var(--tech-color-text-muted)] transition md:flex ${
                canScrollDown
                  ? "hover:bg-[#EAFBFD] hover:text-[#05C3D4]"
                  : "cursor-default opacity-35"
              }`}
            >
              <ChevronDown size={18} />
            </button>
          </div>
        ) : null}

        <div
          className={`relative order-1 min-w-0 overflow-hidden rounded-[2rem] bg-transparent min-h-[360px] md:order-2 md:min-h-[620px] xl:min-h-[720px] ${hasMultipleImages ? "" : "md:col-span-2"}`}
        >
          {badges}

          {hasMultipleImages ? (
            <>
              <button
                type="button"
                onClick={goToPrevious}
                className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-surface)_90%,white)] text-[var(--tech-color-text-main)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 md:left-5"
                aria-label="Предыдущее изображение"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-surface)_90%,white)] text-[var(--tech-color-text-main)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 md:right-5"
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
            title={`${productName} — открыть изображение`}
            className="relative z-10 flex h-full w-full items-center justify-center px-3 py-3 md:px-4 md:py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--tech-color-surface)]"
          >
            <img
              src={activeImageProps.src}
              srcSet={activeImageProps.srcSet}
              sizes={activeImageProps.sizes}
              alt={productName}
              title={productName}
              className="h-full max-h-[340px] w-full cursor-zoom-in rounded-[1.75rem] object-contain transition-transform duration-500 hover:scale-[1.02] md:max-h-[620px] xl:max-h-[720px]"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={activeImageProps.width}
              height={activeImageProps.height}
              onError={applyProductImageFallback}
            />
          </button>

          {hasMultipleImages ? (
            <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-surface)_90%,white)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
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
