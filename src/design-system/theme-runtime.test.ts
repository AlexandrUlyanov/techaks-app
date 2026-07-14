import { describe, expect, it } from "vitest";
import { clearThemeFromElement } from "./theme-runtime";

describe("clearThemeFromElement", () => {
  it("removes persisted storefront palette variables before changing theme scope", () => {
    const element = document.createElement("div");
    element.style.setProperty("--tech-color-background", "#111827");
    element.style.setProperty("--background", "216 10% 9%");
    element.style.setProperty("--foreground", "0 0% 100%");
    element.style.setProperty("width", "100px");

    clearThemeFromElement(element);

    expect(element.style.getPropertyValue("--tech-color-background")).toBe("");
    expect(element.style.getPropertyValue("--background")).toBe("");
    expect(element.style.getPropertyValue("--foreground")).toBe("");
    expect(element.style.width).toBe("100px");
  });
});
