import {
  isProductImageVariantSet,
  normalizeProductImageVariantSet,
  type ProductImageVariantSet,
} from "@contracts/product-images";

export const PRODUCT_NOFOTO_SRC = "/images/nofoto.jpg";

function inferVariantPathFromOriginal(
  originalPath: string | null,
  variant: "thumb" | "card" | "medium"
) {
  if (!originalPath) return null;
  const normalized = originalPath.trim();
  if (!normalized.startsWith("/images/")) return null;
  const replaced = normalized.replace(/-original\.[a-z0-9]+$/i, `-${variant}.webp`);
  return replaced !== normalized ? replaced : null;
}

function sanitizeImagePath(value?: string | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return null;
  }
  return normalized;
}

export function resolveProductImageSrc(image?: string | null) {
  return sanitizeImagePath(image) || PRODUCT_NOFOTO_SRC;
}

export function resolveProductImageVariantSet(
  image?: string | null,
  imageVariants?: unknown
): ProductImageVariantSet {
  const fallbackOriginal = resolveProductImageSrc(image);
  const parsed = normalizeProductImageVariantSet(imageVariants, fallbackOriginal);
  const parsedOriginal = sanitizeImagePath(parsed?.original) || fallbackOriginal;

  return {
    original: parsedOriginal,
    thumb:
      sanitizeImagePath(parsed?.thumb) || inferVariantPathFromOriginal(parsedOriginal, "thumb"),
    card:
      sanitizeImagePath(parsed?.card) || inferVariantPathFromOriginal(parsedOriginal, "card"),
    medium:
      sanitizeImagePath(parsed?.medium) || inferVariantPathFromOriginal(parsedOriginal, "medium"),
    hash: typeof parsed?.hash === "string" ? parsed.hash : null,
    width: typeof parsed?.width === "number" ? parsed.width : null,
    height: typeof parsed?.height === "number" ? parsed.height : null,
  };
}

export function resolveProductImageCollection(
  primaryImage?: string | null,
  primaryImageVariants?: unknown,
  images?: unknown
) {
  const primary = resolveProductImageVariantSet(primaryImage, primaryImageVariants);
  const collection: ProductImageVariantSet[] = [primary];

  if (Array.isArray(images)) {
    for (const item of images) {
      const candidate = isProductImageVariantSet(item)
        ? resolveProductImageVariantSet(item.original ?? primaryImage, item)
        : resolveProductImageVariantSet(String(item ?? ""), null);

      if (!collection.some(existing => existing.original === candidate.original)) {
        collection.push(candidate);
      }
    }
  }

  return collection;
}

function buildSrcSetEntries(variantSet: ProductImageVariantSet) {
  const entries = [
    variantSet.thumb ? `${variantSet.thumb} 120w` : null,
    variantSet.card ? `${variantSet.card} 400w` : null,
    variantSet.medium ? `${variantSet.medium} 800w` : null,
    variantSet.original ? `${variantSet.original} 1200w` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return Array.from(new Set(entries));
}

function buildLimitedSrcSetEntries(
  variantSet: ProductImageVariantSet,
  maxVariant: "thumb" | "card" | "medium" | "original"
) {
  const priorityOrder = ["thumb", "card", "medium", "original"] as const;
  const allowed = new Set(
    priorityOrder.slice(0, priorityOrder.indexOf(maxVariant) + 1)
  );
  const entries = [
    allowed.has("thumb") && variantSet.thumb ? `${variantSet.thumb} 120w` : null,
    allowed.has("card") && variantSet.card ? `${variantSet.card} 400w` : null,
    allowed.has("medium") && variantSet.medium ? `${variantSet.medium} 800w` : null,
    allowed.has("original") && variantSet.original ? `${variantSet.original} 1200w` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return Array.from(new Set(entries));
}

export function getProductCardImageProps(args: {
  image?: string | null;
  imageVariants?: unknown;
  priority?: boolean;
  sizes?: string;
  maxVariant?: "thumb" | "card" | "medium" | "original";
}) {
  const variantSet = resolveProductImageVariantSet(args.image, args.imageVariants);
  const maxVariant = args.maxVariant ?? "card";
  const src =
    (maxVariant === "thumb"
      ? variantSet.thumb
      : maxVariant === "card"
        ? variantSet.card || variantSet.thumb
        : maxVariant === "medium"
          ? variantSet.medium || variantSet.card || variantSet.thumb
          : variantSet.original || variantSet.medium || variantSet.card || variantSet.thumb) ||
    variantSet.card ||
    variantSet.thumb ||
    variantSet.medium ||
    variantSet.original ||
    PRODUCT_NOFOTO_SRC;
  const srcSetEntries = buildLimitedSrcSetEntries(variantSet, maxVariant);
  const loading: "eager" | "lazy" = args.priority ? "eager" : "lazy";

  return {
    src,
    srcSet: srcSetEntries.length > 1 ? srcSetEntries.join(", ") : undefined,
    sizes: args.sizes || "(max-width: 768px) 45vw, 300px",
    loading,
    fetchPriority: (args.priority ? "high" : "auto") as "high" | "auto",
    decoding: "async" as const,
    width: variantSet.width ?? undefined,
    height: variantSet.height ?? undefined,
  };
}

export function getProductGalleryImageProps(args: {
  image?: string | null;
  imageVariants?: unknown;
}) {
  const variantSet = resolveProductImageVariantSet(args.image, args.imageVariants);
  const src =
    variantSet.medium ||
    variantSet.card ||
    variantSet.original ||
    variantSet.thumb ||
    PRODUCT_NOFOTO_SRC;
  const srcSetEntries = buildSrcSetEntries(variantSet);

  return {
    variantSet,
    src,
    srcSet: srcSetEntries.length > 1 ? srcSetEntries.join(", ") : undefined,
    sizes: "(max-width: 768px) 92vw, 800px",
    decoding: "async" as const,
    width: variantSet.width ?? undefined,
    height: variantSet.height ?? undefined,
  };
}

export function getProductLightboxImageSrc(variantSet: ProductImageVariantSet) {
  return (
    variantSet.original ||
    variantSet.medium ||
    variantSet.card ||
    variantSet.thumb ||
    PRODUCT_NOFOTO_SRC
  );
}

export function applyProductImageFallback(
  event: { currentTarget: HTMLImageElement }
) {
  if (event.currentTarget.src.endsWith(PRODUCT_NOFOTO_SRC)) return;
  event.currentTarget.src = PRODUCT_NOFOTO_SRC;
}
