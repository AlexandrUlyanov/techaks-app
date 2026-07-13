import { describe, expect, it } from "vitest";
import { isFullPriceRange, normalizePriceRange } from "./price-range";

describe("normalizePriceRange", () => {
  it("uses the complete available range by default", () => {
    expect(normalizePriceRange({ min: 250, max: 3_700 })).toMatchObject({
      currentMin: 250,
      currentMax: 3_700,
      isActive: false,
    });
  });

  it("never produces an inverted 250-0 range", () => {
    expect(normalizePriceRange({ min: 250, max: 3_700 }, { from: 250, to: 0 })).toMatchObject({
      currentMin: 250,
      currentMax: 250,
      isActive: true,
    });
  });

  it("clamps stale URL values to current bounds", () => {
    expect(normalizePriceRange({ min: 300, max: 900 }, { from: 1_500, to: 2_000 })).toMatchObject({
      currentMin: 900,
      currentMax: 900,
    });
  });

  it("recognizes a complete range so URL filters can be removed", () => {
    expect(isFullPriceRange({ min: 250, max: 3_700 }, { from: 250, to: 3_700 })).toBe(true);
    expect(isFullPriceRange({ min: 250, max: 3_700 }, { from: 300, to: 3_700 })).toBe(false);
  });
});
