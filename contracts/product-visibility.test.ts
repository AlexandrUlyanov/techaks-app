import { describe, expect, it } from "vitest";
import {
  AUTO_BLOCK_REASON_ZERO_PRICE,
  applyProductAutoBlockState,
  deriveProductAutoBlockState,
  hasInvalidProductPrice,
  isProductVisibleOnSite,
} from "./product-visibility";

describe("product visibility", () => {
  it("treats missing or non-positive prices as invalid", () => {
    expect(hasInvalidProductPrice(null)).toBe(true);
    expect(hasInvalidProductPrice(undefined)).toBe(true);
    expect(hasInvalidProductPrice("")).toBe(true);
    expect(hasInvalidProductPrice(0)).toBe(true);
    expect(hasInvalidProductPrice(-10)).toBe(true);
    expect(hasInvalidProductPrice("abc")).toBe(true);
    expect(hasInvalidProductPrice(100)).toBe(false);
  });

  it("auto-blocks products with zero price", () => {
    expect(deriveProductAutoBlockState(0, null, false)).toEqual({
      isAutoBlocked: true,
      autoBlockReason: AUTO_BLOCK_REASON_ZERO_PRICE,
    });
  });

  it("removes zero-price auto-block after valid price returns", () => {
    expect(
      deriveProductAutoBlockState(1500, AUTO_BLOCK_REASON_ZERO_PRICE, true)
    ).toEqual({
      isAutoBlocked: false,
      autoBlockReason: null,
    });
  });

  it("does not make manually inactive product visible", () => {
    const product = applyProductAutoBlockState({
      price: 1500,
      isActive: false,
      isAutoBlocked: false,
      autoBlockReason: null,
    });

    expect(isProductVisibleOnSite(product)).toBe(false);
    expect(product.isActive).toBe(false);
    expect(product.isAutoBlocked).toBe(false);
  });

  it("keeps an enabled out-of-stock product visible", () => {
    expect(isProductVisibleOnSite({
      price: 1500,
      isActive: true,
      isPublishedFromMoySklad: true,
      isAutoBlocked: false,
    })).toBe(true);
  });

  it("hides a product disabled in MoySklad", () => {
    expect(isProductVisibleOnSite({
      price: 1500,
      isActive: true,
      isPublishedFromMoySklad: false,
      isAutoBlocked: false,
    })).toBe(false);
  });

  it("keeps MoySklad publication and automatic blocking independent", () => {
    expect(isProductVisibleOnSite({
      price: 1500,
      isActive: true,
      isPublishedFromMoySklad: true,
      isAutoBlocked: true,
    })).toBe(false);
  });
});
