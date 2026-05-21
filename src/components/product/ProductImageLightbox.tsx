import { useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  applyProductImageFallback,
  getProductGalleryImageProps,
  getProductLightboxImageSrc,
} from "@/lib/product-images";
import type { ProductImageVariantSet } from "@contracts/product-images";

type ProductImageLightboxProps = {
  images: ProductImageVariantSet[];
  productName: string;
  selectedIndex: number | null;
  onClose: () => void;
  onSelect: (index: number) => void;
};

export default function ProductImageLightbox({
  images,
  productName,
  selectedIndex,
  onClose,
  onSelect,
}: ProductImageLightboxProps) {
  const touchStartXRef = useRef<number | null>(null);
  const open = selectedIndex !== null && images.length > 0;
  const safeIndex = selectedIndex ?? 0;
  const currentImage = useMemo(
    () => images[safeIndex] ?? images[0] ?? null,
    [images, safeIndex]
  );
  const currentImageProps = getProductGalleryImageProps({
    image: currentImage?.original ?? "",
    imageVariants: currentImage,
  });
  const hasMultipleImages = images.length > 1;

  const goToPrevious = () => {
    if (!hasMultipleImages) return;
    onSelect((safeIndex - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    if (!hasMultipleImages) return;
    onSelect((safeIndex + 1) % images.length);
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => (!nextOpen ? onClose() : undefined)}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/75 backdrop-blur-[4px]"
        aria-describedby={undefined}
        className="max-w-none border-none bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">
          Просмотр изображения товара {productName}
        </DialogTitle>

        <div className="relative flex h-[100dvh] w-screen items-center justify-center px-3 py-6 sm:px-6">
          <DialogClose
            aria-label="Закрыть просмотр изображения"
            className="absolute right-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/90 transition hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-6 sm:top-6"
          >
            <X size={20} />
          </DialogClose>

          {hasMultipleImages ? (
            <button
              type="button"
              aria-label="Показать предыдущее изображение"
              onClick={goToPrevious}
              className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/90 transition hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:left-6"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}

          <div
            className="flex h-full w-full items-center justify-center"
            onTouchStart={event => {
              touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={event => {
              if (!hasMultipleImages || touchStartXRef.current === null) return;
              const touchEndX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
              const deltaX = touchEndX - touchStartXRef.current;
              touchStartXRef.current = null;
              if (Math.abs(deltaX) < 40) return;
              if (deltaX > 0) {
                goToPrevious();
              } else {
                goToNext();
              }
            }}
          >
            <img
              src={getProductLightboxImageSrc(currentImageProps.variantSet)}
              srcSet={currentImageProps.srcSet}
              sizes="90vw"
              alt={`${productName} — увеличенное изображение ${safeIndex + 1}`}
              onError={applyProductImageFallback}
              decoding="async"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
            />
          </div>

          {hasMultipleImages ? (
            <>
              <button
                type="button"
                aria-label="Показать следующее изображение"
                onClick={goToNext}
                className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/90 transition hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-6"
              >
                <ChevronRight size={22} />
              </button>

              <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-sm">
                {images.map((image, index) => (
                  <button
                    key={`${image.original}-${index}`}
                    type="button"
                    aria-label={`Показать изображение ${index + 1}`}
                    onClick={() => onSelect(index)}
                    className={`h-2.5 w-2.5 rounded-full transition ${index === safeIndex ? "bg-white" : "bg-white/35 hover:bg-white/60"}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
