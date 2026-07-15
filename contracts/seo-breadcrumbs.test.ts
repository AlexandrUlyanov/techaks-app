import { describe, expect, it } from "vitest";

import { buildSeoBreadcrumbStructuredData } from "./seo-breadcrumbs";

describe("buildSeoBreadcrumbStructuredData", () => {
  it("builds absolute same-site URLs and numeric positions", () => {
    const result = buildSeoBreadcrumbStructuredData([
      { name: "Главная", url: "/" },
      { name: "Каталог", url: "/catalog" },
    ]);

    expect(result?.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Главная",
        item: "https://techaks.ru/",
        url: "https://techaks.ru/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Каталог",
        item: "https://techaks.ru/catalog",
        url: "https://techaks.ru/catalog",
      },
    ]);
  });

  it("keeps at most three useful levels for Yandex breadcrumbs", () => {
    const result = buildSeoBreadcrumbStructuredData([
      { name: "Главная", url: "/" },
      { name: "Каталог", url: "/catalog" },
      { name: "Смартфоны и гаджеты", url: "/catalog?cat=smartfony" },
      { name: "Умный дом", url: "/catalog?cat=umnyy-dom" },
      { name: "Яндекс Станция", url: "/product/yandex-stanciya" },
    ]);

    expect(result?.itemListElement.map(item => item.name)).toEqual([
      "Каталог",
      "Умный дом",
      "Яндекс Станция",
    ]);
    expect(result?.itemListElement.map(item => item.position)).toEqual([1, 2, 3]);
  });

  it("deduplicates URLs and ignores external links", () => {
    const result = buildSeoBreadcrumbStructuredData([
      { name: "Главная", url: "/" },
      { name: "Каталог", url: "/catalog#top" },
      { name: "Каталог повторно", url: "https://techaks.ru/catalog" },
      { name: "Чужой сайт", url: "https://example.com/catalog" },
    ]);

    expect(result?.itemListElement).toHaveLength(2);
    expect(result?.itemListElement[1].name).toBe("Каталог");
  });

  it("does not emit a one-item BreadcrumbList", () => {
    expect(
      buildSeoBreadcrumbStructuredData([{ name: "Главная", url: "/" }])
    ).toBeNull();
  });
});
