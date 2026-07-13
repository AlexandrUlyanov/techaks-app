export type PriceBounds = {
  min: number;
  max: number;
};

export type NormalizedPriceRange = PriceBounds & {
  sliderMin: number;
  sliderMax: number;
  currentMin: number;
  currentMax: number;
  isActive: boolean;
};

function finiteOr(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizePriceRange(
  bounds: PriceBounds,
  selected?: { from?: number; to?: number }
): NormalizedPriceRange {
  const rawMin = finiteOr(bounds.min, 0);
  const rawMax = finiteOr(bounds.max, rawMin);
  const min = Math.max(0, Math.floor(Math.min(rawMin, rawMax)));
  const max = Math.max(min, Math.ceil(Math.max(rawMin, rawMax)));
  const sliderMax = Math.max(max, min + 1);
  const requestedMin = finiteOr(selected?.from, min);
  const requestedMax = finiteOr(selected?.to, max);
  const currentMin = Math.min(Math.max(requestedMin, min), max);
  const currentMax = Math.max(currentMin, Math.min(Math.max(requestedMax, min), max));

  return {
    min,
    max,
    sliderMin: min,
    sliderMax,
    currentMin,
    currentMax,
    isActive: currentMin > min || currentMax < max,
  };
}

export function isFullPriceRange(
  bounds: PriceBounds,
  selected: { from: number; to: number }
) {
  const normalized = normalizePriceRange(bounds, selected);
  return normalized.currentMin <= normalized.min && normalized.currentMax >= normalized.max;
}
