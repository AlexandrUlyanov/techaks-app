import { describe, expect, it } from "vitest";
import { calculateCustomerDeliveryPrice } from "./delivery-pricing";

const basePolicy = {
  markupPercent: 0,
  markupFixed: 0,
  subsidyFixed: 0,
  freeDeliveryThreshold: 0,
  minCustomerPrice: 0,
  maxCustomerPrice: 0,
};

describe("calculateCustomerDeliveryPrice", () => {
  it("keeps provider price without commercial rules", () => {
    expect(
      calculateCustomerDeliveryPrice({
        providerPrice: 321,
        orderSubtotal: 1_000,
        policy: basePolicy,
      }).customerPrice,
    ).toBe(321);
  });

  it("applies markup, subsidy and price bounds", () => {
    const result = calculateCustomerDeliveryPrice({
      providerPrice: 300,
      orderSubtotal: 1_000,
      policy: {
        ...basePolicy,
        markupPercent: 10,
        markupFixed: 50,
        subsidyFixed: 20,
        maxCustomerPrice: 350,
      },
    });
    expect(result.customerPrice).toBe(350);
  });

  it("makes delivery free above threshold without losing provider cost", () => {
    const result = calculateCustomerDeliveryPrice({
      providerPrice: 420,
      orderSubtotal: 5_000,
      policy: { ...basePolicy, freeDeliveryThreshold: 5_000 },
    });
    expect(result).toMatchObject({
      providerPrice: 420,
      customerPrice: 0,
      discount: 420,
      isFree: true,
    });
  });
});
