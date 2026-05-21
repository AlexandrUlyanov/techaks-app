export const PRODUCT_NOFOTO_SRC = "/images/nofoto.jpg";

export function resolveProductImageSrc(image?: string | null) {
  const value = typeof image === "string" ? image.trim() : "";
  if (!value || value === "undefined" || value === "null") {
    return PRODUCT_NOFOTO_SRC;
  }

  return value;
}

export function applyProductImageFallback(
  event: { currentTarget: HTMLImageElement }
) {
  if (event.currentTarget.src.endsWith(PRODUCT_NOFOTO_SRC)) return;
  event.currentTarget.src = PRODUCT_NOFOTO_SRC;
}
