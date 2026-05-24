import { useMemo, useState } from "react";

type SpecGroup = {
  title: string;
  items: Array<[string, unknown]>;
};

const GROUP_RULES: Array<{ title: string; patterns: string[] }> = [
  { title: "Общие характеристики", patterns: ["тип", "модель", "версия", "цвет", "бренд"] },
  { title: "Совместимость", patterns: ["совместим", "поддерж", "android", "ios", "iphone", "samsung"] },
  { title: "Материалы", patterns: ["материал", "корпус", "покрыт"] },
  { title: "Размеры и вес", patterns: ["размер", "вес", "длина", "ширина", "высота", "диагон"] },
  { title: "Комплектация", patterns: ["комплект", "упаков", "кабель", "адаптер", "в комплекте"] },
  { title: "Дополнительно", patterns: ["гарант", "особен", "дополн", "функц"] },
];

function resolveGroupTitle(key: string) {
  const normalized = key.trim().toLowerCase();
  const group = GROUP_RULES.find(rule =>
    rule.patterns.some(pattern => normalized.includes(pattern))
  );
  return group?.title ?? "Основные характеристики";
}

export default function ProductSpecsTab({
  specs,
  isManufacturerSpec,
}: {
  specs: Record<string, unknown> | null;
  isManufacturerSpec?: (key: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo<SpecGroup[]>(() => {
    if (!specs) return [];

    const entries = Object.entries(specs).filter(([key]) =>
      isManufacturerSpec ? !isManufacturerSpec(key) : true
    );
    if (entries.length === 0) return [];

    const groupMap = new Map<string, Array<[string, unknown]>>();
    for (const entry of entries) {
      const title = resolveGroupTitle(entry[0]);
      const list = groupMap.get(title) ?? [];
      list.push(entry);
      groupMap.set(title, list);
    }

    return Array.from(groupMap.entries()).map(([title, items]) => ({ title, items }));
  }, [isManufacturerSpec, specs]);

  if (groups.length === 0) {
    return (
      <div className="py-8 text-sm leading-6 text-[var(--tech-color-text-muted)]">
        Характеристики пока не добавлены. Мы обновим их после следующей синхронизации.
      </div>
    );
  }

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleLimit = 12;
  let remainingVisible = visibleLimit;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-black tracking-tight text-[var(--tech-color-text-main)] md:text-3xl">
          Характеристики
        </h2>
        {totalItems > visibleLimit ? (
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            className="text-sm font-semibold text-[var(--tech-color-primary)] transition hover:opacity-80"
          >
            {expanded ? "Свернуть" : "Показать все характеристики"}
          </button>
        ) : null}
      </div>

      <div className="space-y-8">
        {groups.map(group => {
          const visibleItems = expanded
            ? group.items
            : (() => {
                const chunk = group.items.slice(0, Math.max(remainingVisible, 0));
                remainingVisible -= chunk.length;
                return chunk;
              })();

          if (visibleItems.length === 0) return null;

          return (
            <section key={group.title} className="space-y-4">
              <h3 className="text-lg font-semibold text-[var(--tech-color-text-main)] md:text-xl">
                {group.title}
              </h3>
              <dl className="space-y-0">
                {visibleItems.map(([key, value], index) => (
                  <div
                    key={`${group.title}-${key}`}
                    className={`grid gap-3 py-3 md:grid-cols-[minmax(220px,320px)_1fr] md:gap-8 ${
                      index > 0 ? "border-t border-[var(--tech-color-border)]/55" : ""
                    }`}
                  >
                    <dt className="text-sm font-medium text-[var(--tech-color-text-muted)] md:text-[15px]">
                      {key}
                    </dt>
                    <dd className="text-sm font-semibold text-[var(--tech-color-text-main)] md:text-[15px]">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
