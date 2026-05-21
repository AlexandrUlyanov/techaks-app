import { describe, expect, it } from "vitest";
import {
  buildProductSearchDocument,
  calculateSearchScore,
  expandTokensWithSynonymMap,
  normalizeSearchQuery,
} from "./search";

describe("normalizeSearchQuery", () => {
  it("normalizes punctuation, spaces and ё", () => {
    expect(normalizeSearchQuery("  АйфЁн!!!   15   Pro  ")).toBe("айфен 15 pro");
  });
});

describe("expandTokensWithSynonymMap", () => {
  it("expands tokens using configured synonym groups", () => {
    const expanded = expandTokensWithSynonymMap(
      ["айфон", "зарядка"],
      new Map([
        ["айфон", ["айфон", "iphone"]],
        ["зарядка", ["зарядка", "адаптер", "блок питания"]],
      ])
    );

    expect(expanded).toEqual(
      expect.arrayContaining(["айфон", "iphone", "зарядка", "адаптер", "блок питания"])
    );
  });
});

describe("buildProductSearchDocument", () => {
  it("builds a search document with exact identifiers and availability", () => {
    const document = buildProductSearchDocument({
      id: 7,
      msId: "ms-7",
      slug: "iphone-cable",
      name: "Кабель для iPhone",
      description: "Быстрая зарядка и передача данных",
      specs: {
        Артикул: "ABC-123",
        SKU: "SKU-777",
        Штрихкод: "460000000001",
        Цвет: "Белый",
      },
      price: 990,
      oldPrice: 1290,
      isActive: true,
      isAutoBlocked: false,
      categoryId: 5,
      categoryName: "Кабели",
      image: "/images/cable.jpg",
      imageVariants: { thumb: "/images/cable-thumb.webp" },
      stockCount: 3,
      brandName: "Apple",
      reviewCount: 12,
      totalScore: 44,
    });

    expect(document.url).toBe("/product/iphone-cable");
    expect(document.imageUrl).toBe("/images/cable-thumb.webp");
    expect(document.article).toBe("ABC-123");
    expect(document.sku).toBe("SKU-777");
    expect(document.barcode).toBe("460000000001");
    expect(document.inStock).toBe(true);
  });
});

describe("calculateSearchScore", () => {
  it("prioritizes exact article matches over weaker text matches", () => {
    const exact = calculateSearchScore(
      {
        id: 1,
        entityType: "product",
        entityId: 1,
        title: "Кабель USB-C",
        subtitle: "Кабели · В наличии",
        contentText: "Кабель для зарядки телефона",
        attributesText: "цвет черный длина 1 метр",
        exactText: "abc-123",
        url: "/product/usb-cable",
        imageUrl: null,
        price: 1000,
        oldPrice: null,
        brandId: null,
        brandName: "Baseus",
        categoryId: 1,
        categoryName: "Кабели",
        sku: null,
        article: "ABC-123",
        barcode: null,
        externalCode: null,
        moyskladId: null,
        isActive: true,
        isVisible: true,
        inStock: true,
        stockCount: 5,
        sortWeight: 10,
        popularityScore: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        indexedAt: new Date(),
        titleScore: 0,
        contentScore: 0,
        attributesScore: 0,
        exactScore: 4,
        exactMatchScore: 1,
        fallbackScore: 0,
      },
      ["abc", "123"],
      "ABC-123"
    );

    const fuzzy = calculateSearchScore(
      {
        id: 2,
        entityType: "product",
        entityId: 2,
        title: "Кабель USB-C для телефона",
        subtitle: "Кабели · В наличии",
        contentText: "Кабель для зарядки и передачи данных",
        attributesText: "цвет белый длина 1 метр",
        exactText: "usb cable",
        url: "/product/usb-cable-2",
        imageUrl: null,
        price: 900,
        oldPrice: null,
        brandId: null,
        brandName: "Baseus",
        categoryId: 1,
        categoryName: "Кабели",
        sku: null,
        article: null,
        barcode: null,
        externalCode: null,
        moyskladId: null,
        isActive: true,
        isVisible: true,
        inStock: true,
        stockCount: 5,
        sortWeight: 10,
        popularityScore: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        indexedAt: new Date(),
        titleScore: 2,
        contentScore: 1,
        attributesScore: 1,
        exactScore: 0,
        exactMatchScore: 0,
        fallbackScore: 0,
      },
      ["кабель", "usb"],
      "кабель usb"
    );

    expect(exact).toBeGreaterThan(fuzzy);
  });
});
