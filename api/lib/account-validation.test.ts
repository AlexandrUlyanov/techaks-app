import { describe, expect, it } from "vitest";
import { normalizeAccountPhone } from "./account-validation";

describe("normalizeAccountPhone", () => {
  it("normalizes a Russian number starting with eight", () => {
    expect(normalizeAccountPhone("8 (927) 123-45-67")).toBe("+79271234567");
  });

  it("keeps an international number in normalized form", () => {
    expect(normalizeAccountPhone("+7 937 418 44 04")).toBe("+79374184404");
  });

  it("allows an empty optional value", () => {
    expect(normalizeAccountPhone(" ")).toBeNull();
  });

  it("rejects an incomplete number", () => {
    expect(() => normalizeAccountPhone("12345")).toThrow("Проверьте номер телефона");
  });
});
