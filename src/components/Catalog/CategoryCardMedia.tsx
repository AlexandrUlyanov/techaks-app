import { useCallback, useMemo, useState } from "react";
import { CategoryIcon } from "@/lib/category-icons";
import {
  applyProductImageFallback,
  getProductCardImageProps,
} from "@/lib/product-images";
import { resolveCategoryPreviewImages } from "@/contracts/category-preview-images";

type CategoryCardMediaProps = {
  categoryName: string;
  categorySlug: string;
  imageUrl?: string | null;
  previewImages?: unknown;
  imageSizes: string;
  iconSize?: number;
  className?: string;
};

export default function CategoryCardMedia({
  categoryName,
  categorySlug,
  imageUrl,
  previewImages,
  imageSizes,
  iconSize = 44,
  className = "flex h-[132px] items-center justify-center rounded-[1.25rem] bg-white p-4 dark:bg-white",
}: CategoryCardMediaProps) {
  const images = useMemo(
    () => resolveCategoryPreviewImages(previewImages, imageUrl),
    [previewImages, imageUrl]
  );
  const hasImagePreview = images.length > 1;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImagePreviewActive, setIsImagePreviewActive] = useState(false);

  const imageProps = getProductCardImageProps({
    image: images[activeImageIndex] ?? imageUrl,
    imageVariants: null,
    sizes: imageSizes,
  });

  const updatePreviewFromPointer = useCallback(
    (
      event:
        | React.MouseEvent<HTMLDivElement>
        | React.PointerEvent<HTMLDivElement>
    ) => {
      if (!hasImagePreview) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const offsetX = Math.min(
        Math.max(event.clientX - bounds.left, 0),
        bounds.width
      );
      const nextIndex = Math.min(
        images.length - 1,
        Math.floor((offsetX / bounds.width) * images.length)
      );
      setActiveImageIndex(nextIndex);
    },
    [hasImagePreview, images.length]
  );

  const handleImagePreviewLeave = useCallback(() => {
    setIsImagePreviewActive(false);
    setActiveImageIndex(0);
  }, []);

  const handleImagePreviewEnter = useCallback(() => {
    if (!hasImagePreview) return;
    setIsImagePreviewActive(true);
  }, [hasImagePreview]);

  return (
    <div
      className={className}
      onMouseEnter={handleImagePreviewEnter}
      onMouseMove={updatePreviewFromPointer}
      onMouseLeave={handleImagePreviewLeave}
      onPointerEnter={handleImagePreviewEnter}
      onPointerMove={updatePreviewFromPointer}
      onPointerLeave={handleImagePreviewLeave}
    >
      {images.length > 0 ? (
        <>
          {hasImagePreview ? (
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1.5 transition-opacity duration-200 ${
                isImagePreviewActive ? "opacity-100" : "opacity-0"
              }`}
            >
              <div
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.92)] px-2.5 py-1"
              >
                {images.map((_, index) => (
                  <span
                    key={`category-dot-${categorySlug}-${index}`}
                    className={`h-1 rounded-full transition-all duration-200 ${
                      index === activeImageIndex
                        ? "w-4 bg-[var(--tech-color-primary)]"
                        : "w-2 bg-[rgba(148,163,184,0.55)]"
                    }`}
                      />
                ))}
              </div>
            </div>
          ) : null}
          <img
            src={imageProps.src}
            srcSet={imageProps.srcSet}
            sizes={imageProps.sizes}
            alt={categoryName}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
            onError={applyProductImageFallback}
          />
        </>
      ) : (
        <CategoryIcon
          name={categoryName}
          slug={categorySlug}
          size={iconSize}
          className="text-[var(--tech-color-primary)]"
        />
      )}
    </div>
  );
}
