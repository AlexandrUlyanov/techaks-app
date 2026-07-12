import { describe, expect, it } from "vitest";

import {
  buildLoyaltyJobActiveKey,
  buildLoyaltyPosAuthHeaders,
  getLoyaltyAvailability,
  readScopedNumber,
} from "./loyalty-domain";

describe("loyalty domain", () => {
  it("does not pick unrelated deeply nested numbers", () => {
    const value = readScopedNumber(
      { delivery: { balance: 9999 }, result: { availableBonuses: 420 } },
      ["balance", "availableBonuses"]
    );
    expect(value).toBe(420);
  });

  it("rejects an errored loyalty state", () => {
    const availability = getLoyaltyAvailability({
      enabled: true,
      participant: true,
      status: "error",
      lastSyncedAt: new Date(),
      lastError: "POS API 401",
    });
    expect(availability.canSpend).toBe(false);
    expect(availability.reason).toContain("без бонусов");
  });

  it("builds one stable active key per entity and job type", () => {
    expect(
      buildLoyaltyJobActiveKey({ jobType: "customer_loyalty_sync", userId: 7 })
    ).toBe("customer_loyalty_sync:u7:o0");
  });

  it("uses the documented POS cashier header", () => {
    expect(buildLoyaltyPosAuthHeaders(" pos-token ", " cashier@company ")).toEqual({
      "Content-Type": "application/json",
      "Lognex-Pos-Auth-Token": "pos-token",
      "Lognex-Pos-Auth-Cashier-Uid": "cashier@company",
    });
  });
});
