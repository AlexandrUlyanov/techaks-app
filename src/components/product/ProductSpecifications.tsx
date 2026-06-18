import { useState } from "react";

type ProductSpecificationsProps = {
  specs: Record<string, unknown> | null;
  isManufacturerSpec?: (key: string) => boolean;
};

type SpecGroup = {
  title: string;
  items: Array<[string, unknown]>;
};

const GROUP_RULES: Array<{ title: string; patterns: string[] }> = [
  { title: "Основные характеристики", patterns: ["sim", "модель", "тип", "версия", "материал", "корпус"] },
  { title: "Дисплей", patterns: ["экран", "дисплей", "разреш", "диагон", "amoled", "oled", "ips", "частот"] },
  { title: "Производительность", patterns: ["процессор", "чип", "cpu", "snapdragon", "mediatek"] },
  { title: "Память", patterns: ["памят", "rom", "ram", "накопител", "storage"] },
  { title: "Камеры", patterns: ["камера", "мп", "объектив", "zoom", "вспыш"] },
  { title: "Связь и интерфейсы", patterns: ["wifi", "wi-fi", "bluetooth", "nfc", "usb", "5g", "4g", "связ", "интерфейс"] },
  { title: "Питание", patterns: ["аккум", "батар", "mah", "заряд", "питан"] },
  {
    title: "Размеры и вес",
    patterns: [
      "размер",
      "вес",
      "длина",
      "ширина",
      "высота",
      "глубина",
      "вес упаков",
      "длина упаков",
      "высота упаков",
      "глубина упаков",
      "габарит",
    ],
  },
  { title: "Комплектация", patterns: ["комплект", "кабель", "адаптер", "в комплекте"] },
];

function resolveGroupTitle(key: string) {
  const normalized = key.trim().toLowerCase();
  const group = GROUP_RULES.find(rule =>
    rule.patterns.some(pattern => normalized.includes(pattern))
  );
  return group?.title ?? "Прочее";
}

export default function ProductSpecifications({
  specs,
  isManufacturerSpec,
}: ProductSpecificationsProps) {
  const [showAll, setShowAll] = useState(false);
  if (!specs) return null;

  const sourceEntries = Object.entries(specs).filter(([key]) =>
    isManufacturerSpec ? !isManufacturerSpec(key) : true
  );
  if (sourceEntries.length === 0) return null;

  const groupMap = new Map<string, Array<[string, unknown]>>();
  for (const entry of sourceEntries) {
    const groupTitle = resolveGroupTitle(entry[0]);
    const existing = groupMap.get(groupTitle) ?? [];
    existing.push(entry);
    groupMap.set(groupTitle, existing);
  }

  const groups: SpecGroup[] = Array.from(groupMap.entries()).map(([title, items]) => ({
    title,
    items,
  }));
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleItemLimit = 24;
  let remainingSlots = visibleItemLimit;

  return (
    <section className="mt-16">
      <h2 className="text-3xl font-black tracking-tight text-[#1F2328] md:text-4xl">
        Характеристики
      </h2>
      <div className="mt-8 space-y-10">
        {groups.map(group => (
          <div key={group.title}>
            <h3 className="text-xl font-semibold text-[#1F2328] md:text-2xl">
              {group.title}
            </h3>
            <div className="mt-5">
              {(showAll
                ? group.items
                : (() => {
                    const slice = group.items.slice(0, Math.max(remainingSlots, 0));
                    remainingSlots -= slice.length;
                    return slice;
                  })()
              ).map(([key, value], index) => (
                <div
                  key={key}
                  className={`grid gap-3 py-3 md:grid-cols-[minmax(220px,360px)_1fr] md:gap-8 ${
                    index > 0 ? "border-t border-[#F1F2F3]" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-[#7A7F87] md:text-[15px]">
                    {key}
                  </div>
                  <div className="text-sm font-semibold text-[#1F2328] md:text-[15px]">
                    {String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!showAll && totalItems > visibleItemLimit ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-8 inline-flex items-center rounded-full bg-[#F4F5F6] px-5 py-3 text-sm font-semibold text-[#1F2328] transition hover:bg-[#E9ECEF]"
        >
          Показать все характеристики
        </button>
      ) : null}
    </section>
  );
}
