import { Boxes, Layers3, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useRef, useState } from "react";

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
  mobile = false,
}: {
  specs: Record<string, unknown> | null;
  isManufacturerSpec?: (key: string) => boolean;
  mobile?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const mobileSectionRef = useRef<HTMLDivElement | null>(null);

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
      <div className="py-6 text-sm leading-7 text-muted-foreground">
        Характеристики пока не добавлены. Мы обновим их после следующей синхронизации.
      </div>
    );
  }

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleLimit = 12;
  let remainingVisible = visibleLimit;

  if (mobile) {
    const flatItems = groups.flatMap(group =>
      group.items.map(item => ({ groupTitle: group.title, item }))
    );
    const mobileVisibleLimit = 7;
    const visibleFlatItems = expanded ? flatItems : flatItems.slice(0, mobileVisibleLimit);

    return (
      <div
        ref={node => {
          mobileSectionRef.current = node;
        }}
        className="space-y-4 text-foreground"
      >
        <div>
          <h2 className="text-xl font-black tracking-tight">Характеристики</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Основные параметры товара, которые помогут быстро сравнить модель.
          </p>
        </div>

        <div className="space-y-3">
          {visibleFlatItems.map(({ groupTitle, item: [key, value] }, index) => (
            <div
              key={`${groupTitle}-${key}-${index}`}
              className="rounded-[20px] bg-[var(--tech-color-surface-muted)]/65 px-4 py-3.5"
            >
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {key}
              </div>
              <div className="mt-1.5 text-[15px] font-semibold leading-7 text-foreground">
                {String(value)}
              </div>
            </div>
          ))}
        </div>

        {flatItems.length > mobileVisibleLimit ? (
          <button
            type="button"
            onClick={() => {
              if (expanded) {
                setExpanded(false);
                mobileSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
              }
              setExpanded(true);
            }}
            className="text-sm font-bold text-[#05C3D4]"
          >
            {expanded ? "Скрыть характеристики" : "Показать все характеристики"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8 text-foreground">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
            Характеристики
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
            Основные параметры товара
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
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
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-muted/70 px-5 text-sm font-bold text-foreground transition hover:-translate-y-px hover:bg-[rgba(5,195,212,0.10)] dark:hover:bg-[#05C3D4]/10"
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
              className="space-y-5 rounded-[1.9rem] bg-[var(--tech-color-surface-muted)]/28 px-5 py-5 md:px-6 md:py-6"
            >
              <div className="flex items-center gap-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">
                    {group.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {group.items.length} {group.items.length === 1 ? "параметр" : group.items.length < 5 ? "параметра" : "параметров"}
                  </p>
                </div>
              </div>

              <dl className="space-y-0">
                {visibleItems.map(([key, value], index) => {
                  const isLast = index === visibleItems.length - 1;

                  return (
                  <div
                    key={`${group.title}-${key}`}
                    className={cn(
                      "grid items-start gap-2 rounded-[20px] px-4 py-4 transition-colors duration-200 md:grid-cols-[minmax(180px,220px)_minmax(44px,1fr)_minmax(260px,1.3fr)] md:gap-4 md:px-5",
                      "hover:bg-white/50 dark:hover:bg-white/[0.03]",
                      !isLast && "border-b border-[var(--tech-color-border)]/55"
                    )}
                  >
                    <dt className="pt-0.5 text-sm font-medium text-muted-foreground">
                      {key}
                    </dt>
                    <span className="hidden translate-y-[12px] border-b border-dotted border-[var(--tech-color-border)]/75 md:block" />
                    <dd className="text-[15px] font-semibold leading-7 text-foreground md:text-left">
                      {String(value)}
                    </dd>
                  </div>
                )})}
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
