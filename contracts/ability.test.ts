import { describe, it, expect } from "vitest";
import { defineAbilityFor } from "./ability";
import { subject } from "@casl/ability";

describe("defineAbilityFor", () => {
  it("super_admin should be able to manage all", () => {
    const ability = defineAbilityFor({ id: 1, role: "super_admin" });
    expect(ability.can("manage", "all")).toBe(true);
    expect(ability.can("sync", "Sync")).toBe(true);
  });

  it("admin should be able to manage products but not all", () => {
    const ability = defineAbilityFor({ id: 2, role: "admin" });
    expect(ability.can("manage", "all")).toBe(false);
    expect(ability.can("manage", "Product")).toBe(true);
    expect(ability.can("sync", "Sync")).toBe(true);
    expect(ability.can("configure", "Settings")).toBe(true);
    expect(ability.can("manage_payment_settings", "Settings")).toBe(true);
  });

  it("merchandiser should be able to manage merchandising", () => {
    const ability = defineAbilityFor({ id: 3, role: "merchandiser" });
    expect(ability.can("manage", "Merchandising")).toBe(true);
    expect(ability.can("read", "Product")).toBe(true);
    expect(ability.can("delete", "Product")).toBe(false);
  });

  it("customer should be able to read products and create orders", () => {
    const ability = defineAbilityFor({ id: 4, role: "customer" });
    expect(ability.can("read", "Product")).toBe(true);
    expect(ability.can("create", "Order")).toBe(true);
    expect(ability.can("manage", "Product")).toBe(false);
  });

  it("customer should be able to read own orders", () => {
    const ability = defineAbilityFor({ id: 5, role: "customer" });
    expect(ability.can("read", subject("Order", { userId: 5 }) as any)).toBe(true);
    expect(ability.can("read", subject("Order", { userId: 6 }) as any)).toBe(false);
  });
});
