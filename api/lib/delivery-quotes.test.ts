import { describe, expect, it } from "vitest";

import { buildDeliveryCartFingerprint } from "./delivery-quotes";

const items = [
  { productId: 2, variantId: null, quantity: 1, price: 900 },
  { productId: 1, variantId: 4, quantity: 2, price: 450 },
];

describe("delivery quote fingerprint", () => {
  it("does not depend on cart item order or harmless address whitespace", () => {
    const first = buildDeliveryCartFingerprint({
      items,
      sourceStoreId: 7,
      destinationAddress: "Пенза,  улица Ленина, 1",
    });
    const second = buildDeliveryCartFingerprint({
      items: [...items].reverse(),
      sourceStoreId: 7,
      destinationAddress: " пенза, улица ленина, 1 ",
    });
    expect(first).toBe(second);
  });

  it("changes when cart, source store or destination changes", () => {
    const base = buildDeliveryCartFingerprint({
      items,
      sourceStoreId: 7,
      destinationAddress: "Пенза, улица Ленина, 1",
    });
    expect(
      buildDeliveryCartFingerprint({
        items: [{ ...items[0], quantity: 2 }, items[1]],
        sourceStoreId: 7,
        destinationAddress: "Пенза, улица Ленина, 1",
      }),
    ).not.toBe(base);
    expect(
      buildDeliveryCartFingerprint({
        items,
        sourceStoreId: 8,
        destinationAddress: "Пенза, улица Ленина, 1",
      }),
    ).not.toBe(base);
  });
});
