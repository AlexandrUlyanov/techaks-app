import { describe, expect, it } from "vitest";
import { mergeWordstatPhrases, normalizeWordstatQuery } from "./wordstat";

describe("normalizeWordstatQuery", () => {
  it("normalizes case, yo and repeated whitespace", () => {
    expect(normalizeWordstatQuery("  Ёмкий   ПАУЭРБАНК! ")).toBe(
      "емкий пауэрбанк"
    );
  });
});

describe("mergeWordstatPhrases", () => {
  it("deduplicates phrases and prefers a direct result", () => {
    expect(
      mergeWordstatPhrases(
        [{ phrase: "Купить смартфон", count: 120 }],
        [
          { phrase: "купить  смартфон", count: 90 },
          { phrase: "смартфоны пенза", count: 40 },
        ]
      )
    ).toEqual([
      {
        phrase: "Купить смартфон",
        count: 120,
        kind: "result",
        rank: 0,
      },
      {
        phrase: "смартфоны пенза",
        count: 40,
        kind: "association",
        rank: 1,
      },
    ]);
  });

  it("keeps the highest frequency for duplicate associations", () => {
    expect(
      mergeWordstatPhrases([], [
        { phrase: "кабель type c", count: 10 },
        { phrase: "Кабель  Type C", count: 25 },
      ])
    ).toEqual([
      {
        phrase: "кабель type c",
        count: 25,
        kind: "association",
        rank: 0,
      },
    ]);
  });
});
