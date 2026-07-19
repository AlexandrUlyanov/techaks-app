import { describe, expect, it } from "vitest";

import { buildAccountDataExport } from "./account-export";

describe("buildAccountDataExport", () => {
  it("exports customer data without infrastructure details", () => {
    const result = buildAccountDataExport({
      profile: {
        id: 42,
        email: "customer@example.com",
        fullName: "Иван Иванов",
        loyaltyBalance: 500,
        loyaltyLastError: "POS API bonus detail failed: HTTP 401",
        moyskladCounterpartyHref:
          "https://api.moysklad.ru/private/counterparty/1",
        passwordHash: "secret-hash",
      },
      addresses: [
        { id: 7, userId: 42, city: "Пенза", street: "Ленина", house: "7" },
      ],
      orders: [
        {
          id: 10,
          orderNumber: "TA-100",
          totalPrice: 1_000,
          status: "completed",
          moyskladOrderId: "internal-ms-id",
          paymentId: "provider-payment-id",
          paymentRawResponseJson: { token: "secret" },
          deliveryProviderRawJson: { courierPhone: "+70000000000" },
          deliveryProviderError: "provider stack trace",
          internalComment: "manager-only note",
        },
      ],
      favorites: [
        {
          productId: 99,
          productName: "Кабель",
          productSlug: "kabel",
          createdAt: "2026-07-19",
        },
      ],
      securityEvents: [
        {
          id: 3,
          action: "password_changed",
          metadataJson: { ip: "127.0.0.1", token: "secret" },
          createdAt: "2026-07-19",
        },
      ],
    });

    expect(result.profile.email).toBe("customer@example.com");
    expect(result.loyalty.balance).toBe(500);
    expect(result.orders[0]).toMatchObject({
      orderNumber: "TA-100",
      totalPrice: 1_000,
    });
    expect(result.favorites[0].productUrl).toBe(
      "https://techaks.ru/product/kabel"
    );
    expect(result.securityEvents[0].action).toBe("Пароль изменён");

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "moysklad",
      "POS API",
      "passwordHash",
      "secret-hash",
      "internal-ms-id",
      "provider-payment-id",
      "provider stack trace",
      "manager-only note",
      "127.0.0.1",
      "courierPhone",
      "metadataJson",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
