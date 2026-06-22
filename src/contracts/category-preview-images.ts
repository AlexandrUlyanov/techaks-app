export const CATEGORY_PREVIEW_IMAGE_LIMIT = 8;

function sanitizeCategoryPreviewImage(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return null;
  }
  return normalized;
}

export function normalizeCategoryPreviewImages(
  input: unknown,
  maxItems = CATEGORY_PREVIEW_IMAGE_LIMIT
) {
  const result: string[] = [];

  if (Array.isArray(input)) {
    for (const item of input) {
      const normalized = sanitizeCategoryPreviewImage(item);
      if (!normalized || result.includes(normalized)) continue;
      result.push(normalized);
      if (result.length >= maxItems) break;
    }
  }

  return result;
}

export function resolveCategoryPreviewImages(
  input: unknown,
  fallbackImage?: string | null,
  maxItems = CATEGORY_PREVIEW_IMAGE_LIMIT
) {
  const normalized = normalizeCategoryPreviewImages(input, maxItems);
  const fallback = sanitizeCategoryPreviewImage(fallbackImage);

  if (normalized.length > 0) {
    return normalized;
  }

  return fallback ? [fallback] : [];
}
