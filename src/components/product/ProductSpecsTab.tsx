import { Boxes, Layers3, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
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

const groupIcons = [Layers3, Boxes, SlidersHorizontal];

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
      <div className="py-6 text-sm leading-7 text-[#6B7280]">
        Характеристики пока не добавлены. Мы обновим их после следующей синхронизации.
      </div>
    );
  }

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleLimit = 12;
  let remainingVisible = visibleLimit;

  return (
    <div className="space-y-8 text-[#20262E]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
            Характеристики
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
            Основные параметры товара
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#6B7280]">
            Параметры, которые помогут быстро сравнить модель и понять, подходит ли она под ваш сценарий.
          </p>
        </div>
        <div className="inline-flex items-center gap-3">
          <span className="inline-flex rounded-full bg-[rgba(5,195,212,0.1)] px-3 py-2 text-xs font-bold text-[#047E8A]">
            {totalItems} параметров
          </span>
          {totalItems > visibleLimit ? (
            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 text-sm font-bold text-[#20262E] transition hover:-translate-y-px hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
            >
              {expanded ? "Свернуть" : "Показать все характеристики"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((group, groupIndex) => {
          const visibleItems = expanded
            ? group.items
            : (() => {
                const chunk = group.items.slice(0, Math.max(remainingVisible, 0));
                remainingVisible -= chunk.length;
                return chunk;
              })();

          if (visibleItems.length === 0) return null;

          const Icon = groupIcons[groupIndex % groupIcons.length];

          return (
            <section
              key={group.title}
              className="rounded-[1.375rem] border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] md:p-[22px]"
            >
              <div className="flex items-center gap-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#20262E]">
                    {group.title}
                  </h3>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    {group.items.length} {group.items.length === 1 ? "параметр" : group.items.length < 5 ? "параметра" : "параметров"}
                  </p>
                </div>
              </div>

              <dl className="mt-5 space-y-0">
                {visibleItems.map(([key, value], index) => (
                  <div
                    key={`${group.title}-${key}`}
                    className={cn(
                      "grid gap-2 rounded-xl py-[14px] transition-[background,padding-left] duration-200 ease-out md:grid-cols-[minmax(180px,280px)_1fr] md:gap-6",
                      index > 0 ? "border-t border-[#EEF2F7]" : "",
                      "hover:bg-[linear-gradient(90deg,rgba(5,195,212,0.055),transparent)] hover:pl-2.5"
                    )}
                  >
                    <dt className="text-sm font-medium text-[#6B7280]">{key}</dt>
                    <dd className="text-[15px] font-semibold leading-7 text-[#20262E]">
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
