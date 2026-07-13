import { describe, expect, it } from "vitest";

import { isDeliveryDispatchPaymentReady } from "./yandex-delivery-orders";

describe("delivery dispatch payment guard", () => {
  it("allows dispatch only after the order is fully paid", () => {
    expect(
      isDeliveryDispatchPaymentReady({
        paymentStatus: "paid",
        paidAmount: 1500,
        totalPrice: 1500,
      }),
    ).toBe(true);
    expect(
      isDeliveryDispatchPaymentReady({
        paymentStatus: "paid",
        paidAmount: 1200,
        totalPrice: 1500,
      }),
    ).toBe(false);
    expect(
      isDeliveryDispatchPaymentReady({
        paymentStatus: "awaiting_payment",
        paidAmount: 0,
        totalPrice: 1500,
      }),
    ).toBe(false);
  });
});
