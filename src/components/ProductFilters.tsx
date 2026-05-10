import { useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { trpc } from "@/providers/trpc";

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
  onClear,
}: ProductFiltersProps) {
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground">
          <SlidersHorizontal size={16} className="text-[#05C3D4]" />
          Фильтры
        </div>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-[#05C3D4] transition-colors"
          >
            <X size={12} />
            Сбросить
          </button>
        )}
      </div>

      <div className="space-y-6">
        {visibleFilters.map(group => (
          <div key={group.normalizedKey} className="border-b border-border pb-5 last:border-b-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
              {group.key}
            </div>
            <div className="space-y-2">
              {group.values.map(value => {
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
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-4 w-4 rounded border shrink-0 transition-colors ${
                          checked
                            ? "border-[#05C3D4] bg-[#05C3D4]"
                            : "border-border bg-background"
                        }`}
                      />
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
                    <span className="text-[10px] font-black text-muted-foreground">
                      {value.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
