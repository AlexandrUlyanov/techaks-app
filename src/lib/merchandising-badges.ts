export const MERCH_BADGE_LABELS: Record<string, string> = {
  top_category: "Топ категории",
  excellent_price: "Отличная цена",
  store_choice: "Выбор магазина",
  new: "Новинка",
  recommend: "Рекомендуем",
  profitable: "Выгодно",
  in_stock: "В наличии",
  low_stock: "Осталось мало",
};

export const MERCH_BADGE_STYLES: Record<string, string> = {
  top_category: "bg-[#15171A] text-white",
  excellent_price: "bg-[#05C3D4] text-black",
  store_choice: "bg-violet-100 text-violet-800",
  new: "bg-emerald-100 text-emerald-800",
  recommend: "bg-cyan-100 text-cyan-800",
  profitable: "bg-amber-100 text-amber-800",
  in_stock: "bg-green-100 text-green-800",
  low_stock: "bg-orange-100 text-orange-800",
};

export function normalizeMerchandisingBadges(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.map(item => String(item)).filter(Boolean)))
    : [];
}

export function getMerchandisingBadgeLabel(value: string) {
  return MERCH_BADGE_LABELS[value] ?? value;
}

export function getMerchandisingBadgeStyle(value: string) {
  return MERCH_BADGE_STYLES[value] ?? "bg-gray-100 text-gray-700";
}
