import { describe, expect, it } from "vitest";
import { buildDeliveryCustomerView, extractDeliveryEtaLabel, normalizeDeliveryCustomerStatus } from "./delivery-customer-status";

describe("delivery customer status", () => {
  it.each([
    ["performer_lookup", "delivery_searching"],
    ["performer_found", "courier_assigned"],
    ["pickup_arrived", "courier_arriving_to_pickup"],
    ["pickuped", "picked_up"],
    ["delivery_arrived", "arriving_to_customer"],
    ["delivered_finish", "delivered"],
    ["cancelled_by_taxi", "delivery_cancelled"],
    ["performer_not_found", "delivery_problem"],
  ])("maps %s to %s", (providerStatus, expected) => {
    expect(normalizeDeliveryCustomerStatus(providerStatus)).toBe(expected);
  });

  it("uses local status as a safe fallback", () => {
    expect(normalizeDeliveryCustomerStatus("unexpected_code", "in_delivery")).toBe("in_transit");
  });

  it("extracts ETA from a supported timestamp", () => {
    expect(extractDeliveryEtaLabel({ expected_delivery_at: "2026-07-13T14:30:00.000Z" })).toMatch(/^Ожидаемое время:/);
  });

  it("treats numeric ETA as minutes instead of a Unix timestamp", () => {
    expect(extractDeliveryEtaLabel({ eta: 25 })).toBe("Ориентировочно 25 мин.");
  });

  it("keeps a current timeline step for intermediate provider states", () => {
    const searching = buildDeliveryCustomerView({ providerStatus: "performer_lookup" });
    const arriving = buildDeliveryCustomerView({ providerStatus: "pickup_arrived" });

    expect(searching.timeline.find(step => step.state === "current")?.key).toBe("delivery_pending");
    expect(arriving.timeline.find(step => step.state === "current")?.key).toBe("courier_assigned");
  });

  it("builds a Russian problem view", () => {
    const view = buildDeliveryCustomerView({ providerStatus: "failed" });
    expect(view.label).toBe("Нужно уточнить доставку");
    expect(view.isProblem).toBe(true);
    expect(view.timeline).toHaveLength(5);
  });
});
