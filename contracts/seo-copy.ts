type SeoSpecRecord = Record<string, unknown> | null | undefined;

const LOCALITY = "Пензе";

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(value: string | null | undefined) {
  return cleanText((value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " "));
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

export function toSeoReadableName(value: string | null | undefined) {
  const normalized = cleanText(value);
  if (!normalized) return "";
  const hasLetters = /[A-Za-zА-Яа-яЁё]/.test(normalized);
  if (!hasLetters) return normalized;
  if (normalized !== normalized.toUpperCase()) return normalized;
  const lower = normalized.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normalizeSpecsRecord(specs: SeoSpecRecord) {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return {} as Record<string, unknown>;
  return specs as Record<string, unknown>;
}

function getSpecValue(specs: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(specs);
  for (const candidate of candidates) {
    const found = entries.find(([key, value]) => {
      if (String(value ?? "").trim().length === 0) return false;
      return key.trim().toLowerCase() === candidate.trim().toLowerCase();
    });
    if (found) return cleanText(String(found[1]));
  }
  return "";
}

function pickKeyFeature(specs: Record<string, unknown>, productName: string) {
  const feature = getSpecValue(specs, [
    "Цвет",
    "Встроенная память",
    "Память",
    "Объем памяти",
    "Диагональ экрана",
    "Экран",
    "Мощность",
    "Аккумулятор",
    "Емкость аккумулятора",
    "Подключение",
    "Размер",
    "Объем",
  ]);

  if (!feature) return "";
  if (productName.toLowerCase().includes(feature.toLowerCase())) return "";
  return feature;
}

function buildSummaryLine(specs: Record<string, unknown>, productName: string) {
  const type = getSpecValue(specs, ["Тип"]);
  const model = getSpecValue(specs, ["Модель"]);
  const keyFeature = pickKeyFeature(specs, productName);

  const parts = [type, model, keyFeature].filter(Boolean);
  if (parts.length === 0) return "";

  return truncate(parts.join(" • "), 140);
}

export function buildProductSeoCopy(input: {
  productName: string;
  manufacturerName?: string | null;
  categoryName?: string | null;
  description?: string | null;
  specs?: SeoSpecRecord;
  price?: number | null;
  inStock: boolean;
}) {
  const productName = cleanText(input.productName);
  const categoryName = toSeoReadableName(input.categoryName);
  const manufacturerName = cleanText(input.manufacturerName);
  const specs = normalizeSpecsRecord(input.specs);
  const keyFeature = pickKeyFeature(specs, productName);
  const summaryLine = buildSummaryLine(specs, productName);
  const descriptionText = stripHtml(input.description);
  const priceLabel =
    typeof input.price === "number" && Number.isFinite(input.price)
      ? `${new Intl.NumberFormat("ru-RU").format(input.price)} ₽`
      : "";
  const titleBase = keyFeature ? `${productName}, ${keyFeature}` : productName;
  const title = input.inStock
    ? `${titleBase} — купить в ${LOCALITY} в ТЕХАКС`
    : `${titleBase} — цена и характеристики в ТЕХАКС`;

  const stockSentence = input.inStock
    ? `Товар есть в наличии, доступен самовывоз в ${LOCALITY} и доставка по России.`
    : "Сейчас товара нет в наличии, но карточка сохранена с актуальными характеристиками и ценой для сравнения.";

  const openingParts = [
    productName,
    manufacturerName ? `бренд ${manufacturerName}` : "",
    categoryName ? `категория ${categoryName}` : "",
  ].filter(Boolean);

  const baseIntro = openingParts.join(" • ");
  const detailSentence = summaryLine
    ? `Кратко: ${summaryLine}.`
    : descriptionText
      ? truncate(descriptionText, 180)
      : "";

  const description = truncate(
    [
      baseIntro,
      priceLabel ? `Цена: ${priceLabel}.` : "",
      detailSentence,
      stockSentence,
    ]
      .filter(Boolean)
      .join(" "),
    320
  );

  return {
    title,
    description,
    summaryLine,
  };
}

export function buildCategorySeoCopy(input: {
  categoryName: string;
  description?: string | null;
  hasChildren?: boolean;
}) {
  const categoryName = toSeoReadableName(input.categoryName);
  const customDescription = stripHtml(input.description);
  const title = `${categoryName} в ${LOCALITY} — ТЕХАКС`;
  const fallback = input.hasChildren
    ? `${categoryName} в ТЕХАКС: дочерние категории, популярные товары, наличие, самовывоз в ${LOCALITY} и доставка по России.`
    : `${categoryName} в ТЕХАКС: цены, характеристики, наличие, самовывоз в ${LOCALITY} и доставка по России.`;

  return {
    title,
    description: truncate(customDescription || fallback, 320),
  };
}

export function buildBrandSeoCopy(input: {
  brandName: string;
  description?: string | null;
}) {
  const brandName = cleanText(input.brandName);
  const customDescription = stripHtml(input.description);

  return {
    title: `${brandName} в ${LOCALITY} — товары бренда в ТЕХАКС`,
    description: truncate(
      customDescription ||
        `Товары бренда ${brandName} в ТЕХАКС: цены, наличие, самовывоз в ${LOCALITY} и доставка по России.`,
      320
    ),
  };
}

export function buildRootCatalogSeoCopy() {
  return {
    title: "Каталог техники и аксессуаров в Пензе — ТЕХАКС",
    description:
      "Каталог ТЕХАКС: смартфоны, гаджеты, аксессуары и техника для дома с актуальными ценами, самовывозом в Пензе и доставкой по России.",
  };
}
