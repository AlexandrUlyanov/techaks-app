import { describe, expect, it } from "vitest";

import {
  buildBonusPreviewFromState,
  buildOrderLoyaltySyncOutcome,
} from "./moysklad-loyalty";

describe("buildBonusPreviewFromState", () => {
  it("returns full default totals when loyalty is disabled", () => {
    const result = buildBonusPreviewFromState({
      state: {
        enabled: false,
        participant: false,
        status: null,
        groupName: "техакс",
        participantTag: "техакс",
        balance: 500,
        availableToSpend: 500,
        pendingAccrual: 0,
        programName: null,
        maxWriteoffPercent: 30,
        expectedAccrualPercent: 5,
        lastSyncedAt: null,
        lastError: null,
        counterpartyId: null,
        counterpartyHref: null,
        rawPayload: null,
        rulesSnapshot: null,
      },
      subtotal: 2500,
      requestedAmount: 300,
    });

    expect(result.enabled).toBe(false);
    expect(result.appliedAmount).toBe(0);
    expect(result.totalAfterWriteoff).toBe(2500);
    expect(result.warning).toContain("выключена");
  });

  it("caps writeoff by available balance and configured percent", () => {
    const result = buildBonusPreviewFromState({
      state: {
        enabled: true,
        participant: true,
        status: "active",
        groupName: "техакс",
        participantTag: "техакс",
        balance: 900,
        availableToSpend: 900,
        pendingAccrual: 0,
        programName: "Бонусы",
        maxWriteoffPercent: 30,
        expectedAccrualPercent: 7,
        lastSyncedAt: new Date("2026-06-19T10:00:00.000Z"),
        lastError: null,
        counterpartyId: "cp-1",
        counterpartyHref: "/entity/counterparty/1",
        rawPayload: null,
        rulesSnapshot: null,
      },
      subtotal: 2000,
      requestedAmount: 800,
    });

    expect(result.participant).toBe(true);
    expect(result.maxWriteoffAmount).toBe(600);
    expect(result.appliedAmount).toBe(600);
    expect(result.totalAfterWriteoff).toBe(1400);
    expect(result.expectedAccrualAmount).toBe(98);
  });
});

describe("buildOrderLoyaltySyncOutcome", () => {
  it("marks paid orders as synced and uses actual accrued amount from payload", () => {
    const result = buildOrderLoyaltySyncOutcome({
      order: {
        status: "processing",
        paymentStatus: "paid",
        loyaltyBonusSpent: 300,
        loyaltyBonusExpectedAccrued: 120,
        loyaltyActualSpent: 0,
        loyaltyActualAccrued: 0,
      },
      rawPayload: {
        bonusWriteoff: 300,
        bonusAccrued: 140,
      },
      stateAfter: null,
    });

    expect(result.syncStatus).toBe("synced");
    expect(result.actualSpent).toBe(300);
    expect(result.actualAccrued).toBe(140);
    expect(result.debitStatus).toBe("applied");
    expect(result.accrualStatus).toBe("applied");
  });

  it("rolls bonuses back for refunded orders", () => {
    const result = buildOrderLoyaltySyncOutcome({
      order: {
        status: "completed",
        paymentStatus: "refund",
        loyaltyBonusSpent: 450,
        loyaltyBonusExpectedAccrued: 100,
        loyaltyActualSpent: 450,
        loyaltyActualAccrued: 100,
      },
      rawPayload: null,
      stateAfter: null,
    });

    expect(result.syncStatus).toBe("rolled_back");
    expect(result.actualSpent).toBe(450);
    expect(result.actualAccrued).toBe(0);
    expect(result.needsRefundTransaction).toBe(true);
    expect(result.needsAccrualRollback).toBe(true);
  });

  it("cancels pending bonus movements for cancelled unpaid orders", () => {
    const result = buildOrderLoyaltySyncOutcome({
      order: {
        status: "cancelled",
        paymentStatus: "unpaid",
        loyaltyBonusSpent: 200,
        loyaltyBonusExpectedAccrued: 60,
        loyaltyActualSpent: 0,
        loyaltyActualAccrued: 0,
      },
      rawPayload: null,
      stateAfter: null,
    });

    expect(result.syncStatus).toBe("cancelled");
    expect(result.actualSpent).toBe(0);
    expect(result.actualAccrued).toBe(0);
    expect(result.debitStatus).toBe("cancelled");
    expect(result.accrualStatus).toBe("cancelled");
  });
});
