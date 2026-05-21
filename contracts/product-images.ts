export type ProductImageVariantSet = {
  original?: string | null;
  thumb?: string | null;
  card?: string | null;
  medium?: string | null;
  hash?: string | null;
  width?: number | null;
  height?: number | null;
};

export function isProductImageVariantSet(
  value: unknown
): value is ProductImageVariantSet {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    "original" in candidate ||
    "thumb" in candidate ||
    "card" in candidate ||
    "medium" in candidate
  );
}

export function normalizeProductImageVariantSet(
  value: unknown,
  fallbackOriginal?: string | null
): ProductImageVariantSet | null {
  if (isProductImageVariantSet(value)) {
    const candidate = value as ProductImageVariantSet;
    return {
      original: candidate.original ?? fallbackOriginal ?? null,
      thumb: candidate.thumb ?? null,
      card: candidate.card ?? null,
      medium: candidate.medium ?? null,
      hash: candidate.hash ?? null,
      width: candidate.width ?? null,
      height: candidate.height ?? null,
    };
  }

  if (typeof fallbackOriginal === "string" && fallbackOriginal.trim()) {
    return {
      original: fallbackOriginal,
      thumb: null,
      card: null,
      medium: null,
      hash: null,
      width: null,
      height: null,
    };
  }

  return null;
}
