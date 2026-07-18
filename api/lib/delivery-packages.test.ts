import { describe, expect, it } from "vitest";

import { buildDeliveryPackageSnapshot } from "./delivery-packages";

describe("buildDeliveryPackageSnapshot", () => {
  it("keeps real cart lines and calculates total weight", () => {
    const snapshot = buildDeliveryPackageSnapshot(
      [
        { productId: 10, variantId: 20, name: "Кабель", quantity: 2, price: 350 },
        { productId: 11, name: "Зарядка", quantity: 1, price: 900 },
      ],
      { weightGrams: 400, lengthCm: 20, widthCm: 15, heightCm: 10 },
    );

    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0]).toMatchObject({
      id: "product-10-variant-20",
      quantity: 2,
      cost: 350,
      weightKg: 0.4,
    });
    expect(snapshot.totalWeightGrams).toBe(1200);
  });
});
