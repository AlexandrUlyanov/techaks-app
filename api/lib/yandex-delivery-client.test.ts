import { describe, expect, it } from "vitest";

import { buildYandexDeliveryExternalOrderCost } from "./yandex-delivery-client";

describe("Yandex Delivery claim payload", () => {
  it("uses the API v2 currency_sign field for external order cost", () => {
    expect(buildYandexDeliveryExternalOrderCost(8890)).toEqual({
      value: "8890.00",
      currency_sign: "RUB",
    });
    expect(buildYandexDeliveryExternalOrderCost(8890)).not.toHaveProperty(
      "currency",
    );
  });
});
