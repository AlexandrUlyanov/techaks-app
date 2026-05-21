import { describe, expect, it } from "vitest";
import {
  estimateReadingTimeMinutes,
  normalizeExcerpt,
  sanitizeBlogContent,
  slugifyBlogTitle,
} from "./blog-content";

describe("blog-content helpers", () => {
  it("sanitizes unsafe html", () => {
    const result = sanitizeBlogContent(
      '<p>Текст</p><script>alert(1)</script><a href="https://techaks.ru">Ссылка</a>'
    );

    expect(result).toContain("<p>Текст</p>");
    expect(result).toContain('href="https://techaks.ru"');
    expect(result).not.toContain("<script>");
  });

  it("builds safe html from plain text paragraphs", () => {
    const result = sanitizeBlogContent("Первый абзац\n\nВторой абзац");
    expect(result).toContain("<p>Первый абзац</p>");
    expect(result).toContain("<p>Второй абзац</p>");
  });

  it("normalizes excerpt and estimates reading time", () => {
    expect(normalizeExcerpt("<p>  Много   текста </p>")).toBe("Много текста");
    expect(estimateReadingTimeMinutes("короткий текст")).toBe(1);
  });

  it("slugifies russian blog titles", () => {
    expect(slugifyBlogTitle("Как выбрать кабель USB-C для зарядки")).toBe(
      "как-выбрать-кабель-usb-c-для-зарядки"
    );
  });
});
