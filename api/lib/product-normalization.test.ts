import { describe, expect, it } from "vitest";
import { previewProductNormalization } from "./product-normalization";

describe("previewProductNormalization", () => {
  it("moves key-value description lines into specs", () => {
    const result = previewProductNormalization(
      "Тип устройства: Зонт автоматический\nПроизводитель: HOCO\nЦвет: Черный",
      { "Гарантия": "1 месяц" }
    );

    expect(result.newDescription).toBe("");
    expect(result.movedSpecCount).toBe(3);
    expect(result.mergedSpecs).toEqual({
      "Гарантия": "1 месяц",
      "Тип": "Зонт автоматический",
      "Производитель": "HOCO",
      "Цвет": "Черный",
    });
  });

  it("keeps non-spec text in description", () => {
    const result = previewProductNormalization(
      "Компактная зарядка для дома.\nМощность: 20W\nПодходит для поездок.",
      {}
    );

    expect(result.newDescription).toBe(
      "Компактная зарядка для дома.\nПодходит для поездок."
    );
    expect(result.mergedSpecs).toEqual({ "Мощность": "20W" });
  });

  it("normalizes common key aliases and typos", () => {
    const result = previewProductNormalization(
      "Прозводитель: Hoco\nМатериалы: пластик\nЦвета: белый",
      {}
    );

    expect(result.parsedSpecs).toEqual({
      "Производитель": "Hoco",
      "Материал": "пластик",
      "Цвет": "белый",
    });
  });

  it("reports conflicts without overwriting existing specs", () => {
    const result = previewProductNormalization("Цвет: Черный", {
      "Цвет": "Белый",
    });

    expect(result.movedSpecCount).toBe(0);
    expect(result.mergedSpecs["Цвет"]).toBe("Белый");
    expect(result.conflicts).toEqual([
      {
        key: "Цвет",
        existingValue: "Белый",
        parsedValue: "Черный",
      },
    ]);
  });
});
