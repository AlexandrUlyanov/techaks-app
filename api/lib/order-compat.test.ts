import { describe, expect, it } from "vitest";
import {
  buildOrdersCsv,
  buildOrdersExportTable,
  legacyDeliveryStatusFromRow,
  mapLegacyListOrderRow,
  mapLegacyOrderDetailsRow,
  mapLegacyOrderItemRow,
  normalizeOrderExportRow,
} from "./order-compat";

describe("order legacy compatibility helpers", () => {
  it("maps legacy order list rows with safe fallbacks", () => {
    const row = mapLegacyListOrderRow({
      id: "17",
      status: "pending",
      totalPrice: "3950",
      deliveryType: "delivery",
      customerName: "",
      customerEmail: null,
      customerPhone: null,
    });

    expect(row.id).toBe(17);
    expect(row.orderNumber).toBeNull();
    expect(row.totalPrice).toBe(3950);
    expect(row.subtotal).toBe(3950);
    expect(row.customerName).toBe("Клиент не указан");
    expect(row.customerEmail).toBe("");
    expect(row.customerPhone).toBe("");
    expect(row.deliveryStatus).toBe("unknown");
    expect(row.source).toBe("legacy");
  });

  it("maps legacy order details rows without customer fields", () => {
    const row = mapLegacyOrderDetailsRow({
      id: 21,
      status: "completed",
      totalPrice: 4990,
      deliveryType: "pickup",
      paymentStatus: null,
      paymentType: null,
    });

    expect(row.id).toBe(21);
    expect(row.deliveryStatus).toBe("not_required");
    expect(row.paymentStatus).toBe("unknown");
    expect(row.paymentType).toBe("cash");
  });

  it("maps legacy order items even when product snapshot is missing", () => {
    const row = mapLegacyOrderItemRow({
      id: "9",
      orderId: "5",
      productId: "470",
      quantity: "2",
      price: "2990",
      productName: "",
      total: undefined,
    });

    expect(row.id).toBe(9);
    expect(row.orderId).toBe(5);
    expect(row.productId).toBe(470);
    expect(row.productName).toBe("Товар #470");
    expect(row.total).toBe(5980);
    expect(row.stockStatus).toBe("unknown");
  });

  it("normalizes export rows for legacy orders without user or email", () => {
    const row = normalizeOrderExportRow({
      id: 11,
      status: "mystery_status",
      paymentStatus: "mystery_payment",
      totalPrice: 22490,
      deliveryType: "pickup",
      createdAt: "2026-05-15T10:00:00.000Z",
    });

    expect(row.orderNumber).toBe(11);
    expect(row.customerName).toBe("Клиент не указан");
    expect(row.customerEmail).toBe("");
    expect(row.deliveryStatus).toBe("not_required");
    expect(row.source).toBe("legacy");
  });

  it("builds export table and csv for legacy-shaped orders", () => {
    const rows = [
      {
        id: 1,
        totalPrice: 1000,
        status: "pending",
        paymentStatus: "unpaid",
        deliveryType: "pickup",
        createdAt: "2026-05-15T11:00:00.000Z",
      },
      {
        id: 2,
        orderNumber: "TA-100",
        customerName: "Александр",
        customerEmail: "a@example.com",
        totalPrice: 2500,
        subtotal: 2400,
        discountTotal: 100,
        deliveryPrice: 200,
        status: "completed",
        paymentStatus: "paid",
        deliveryType: "delivery",
        deliveryStatus: "delivered",
        source: "site",
        address: "Пенза",
        createdAt: "2026-05-15T12:00:00.000Z",
      },
    ];

    const table = buildOrdersExportTable(rows);
    const csv = buildOrdersCsv(rows);

    expect(table).toHaveLength(2);
    expect(table[0]["Номер заказа"]).toBe(1);
    expect(table[0]["Покупатель"]).toBe("Клиент не указан");
    expect(table[1]["Статус доставки"]).toBe("delivered");
    expect(csv).toContain("Номер заказа");
    expect(csv).toContain("TA-100");
    expect(csv).toContain("Клиент не указан");
  });

  it("derives delivery status for legacy statuses safely", () => {
    expect(legacyDeliveryStatusFromRow({ status: "completed", deliveryType: "delivery" })).toBe(
      "delivered"
    );
    expect(legacyDeliveryStatusFromRow({ status: "cancelled", deliveryType: "delivery" })).toBe(
      "delivery_error"
    );
    expect(legacyDeliveryStatusFromRow({ status: "pending", deliveryType: "pickup" })).toBe(
      "not_required"
    );
  });
});
