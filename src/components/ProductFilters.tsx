import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

type FilterValue = {
  value: string;
  normalizedValue: string;
  count: number;
};

type FilterGroup = {
  key: string;
  normalizedKey: string;
  values: FilterValue[];
};

export type SelectedSpecFilter = {
  normalizedKey: string;
  normalizedValue: string;
};

type ProductFiltersProps = {
  filters: FilterGroup[];
  selected: SelectedSpecFilter[];
  onToggle: (filter: SelectedSpecFilter) => void;
  onClear: () => void;
};

const KEY_PRIORITY = [
  "тип",
  "производитель",
  "бренд",
  "модель",
  "цвет",
  "материал",
  "мощность",
  "емкость",
  "разъем",
  "вход",
  "выход",
  "длина",
  "питание",
  "совместимость",
];

function isSelected(selected: SelectedSpecFilter[], filter: SelectedSpecFilter) {
  return selected.some(
    item =>
      item.normalizedKey === filter.normalizedKey &&
      item.normalizedValue === filter.normalizedValue
  );
}

export default function ProductFilters({
  filters,
  selected,
  onToggle,
  onClear: _onClear,
}: ProductFiltersProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const { data: manufacturers = [] } = trpc.manufacturer.getAll.useQuery(
    { onlyVisible: true, withProductsOnly: true },
    { placeholderData: prev => prev }
  );

  const manufacturerLogoByName = useMemo(() => {
    const map = new Map<string, string>();
    manufacturers.forEach(item => {
      if (item.logoUrl) {
        map.set(item.name.trim().toLowerCase(), item.logoUrl);
      }
    });
    return map;
  }, [manufacturers]);

  const visibleFilters = useMemo(() => {
    return filters
      .map(group => ({
        ...group,
        values: group.values
          .filter(value => value.count > 0)
          .slice()
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
          .slice(0, 12),
      }))
      .filter(group => group.values.length > 1 && group.values.length <= 12)
      .sort((a, b) => {
        const aPriority = KEY_PRIORITY.indexOf(a.normalizedKey);
        const bPriority = KEY_PRIORITY.indexOf(b.normalizedKey);
        const aScore = aPriority === -1 ? 999 : aPriority;
        const bScore = bPriority === -1 ? 999 : bPriority;
        if (aScore !== bScore) return aScore - bScore;
        const aTotal = a.values.reduce((sum, value) => sum + value.count, 0);
        const bTotal = b.values.reduce((sum, value) => sum + value.count, 0);
        return bTotal - aTotal;
      })
      .slice(0, 10);
  }, [filters]);

  if (visibleFilters.length === 0) return null;

  return (
    <aside className="space-y-5">
      <div className="px-1">
        <div className="space-y-5">
          {visibleFilters.map(group => (
            <div key={group.normalizedKey} className="pb-5 last:pb-0">
            <button
              type="button"
              onClick={() =>
                setExpandedGroups(prev => ({
                  ...prev,
                  [group.normalizedKey]: !prev[group.normalizedKey],
                }))
              }
              className="mb-3 flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {group.key}
              </span>
              <span className="flex items-center gap-2 text-[10px] font-black text-muted-foreground">
                {group.values.length}
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform duration-200",
                    expandedGroups[group.normalizedKey] ? "rotate-180" : ""
                  )}
                />
              </span>
            </button>
            <div className="space-y-1.5">
              {(expandedGroups[group.normalizedKey] ? group.values : group.values.slice(0, 6)).map(value => {
                const filter = {
                  normalizedKey: group.normalizedKey,
                  normalizedValue: value.normalizedValue,
                };
                const checked = isSelected(selected, filter);
                const isManufacturerGroup =
                  group.normalizedKey === "производитель" ||
                  group.normalizedKey === "бренд";
                const manufacturerLogo = isManufacturerGroup
                  ? manufacturerLogoByName.get(value.value.trim().toLowerCase())
                  : undefined;

                return (
                  <button
                    key={`${group.normalizedKey}:${value.normalizedValue}`}
                    type="button"
                    onClick={() => onToggle(filter)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/35"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`relative h-4 w-4 shrink-0 rounded-[5px] border transition-colors ${
                          checked
                            ? "border-[#05C3D4] bg-[#05C3D4] shadow-[0_0_0_3px_rgba(5,195,212,0.14)]"
                            : "border-border/70 bg-background"
                        }`}
                      >
                        {checked ? (
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-black">
                            ✓
                          </span>
                        ) : null}
                      </span>
                      {manufacturerLogo && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border/60">
                          <img
                            src={manufacturerLogo}
                            alt={value.value}
                            className="h-4 w-4 object-contain"
                            loading="lazy"
                          />
                        </span>
                      )}
                      <span className="truncate text-sm font-semibold text-foreground">
                        {value.value}
                      </span>
                    </span>
                    <span className="rounded-full bg-[var(--tech-color-surface-muted)]/80 px-2 py-1 text-[10px] font-black text-muted-foreground">
                      {value.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {group.values.length > 6 ? (
              <button
                type="button"
                onClick={() =>
                  setExpandedGroups(prev => ({
                    ...prev,
                    [group.normalizedKey]: !prev[group.normalizedKey],
                  }))
                }
                className="mt-3 text-[11px] font-bold text-[var(--tech-color-primary)] transition hover:opacity-80"
              >
                {expandedGroups[group.normalizedKey] ? "Свернуть" : "Показать все"}
              </button>
            ) : null}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
