import { Slider } from "@/components/ui/slider";
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
  priceRange?: {
    min: number;
    max: number;
    currentMin: number;
    currentMax: number;
  } | null;
  onToggle: (filter: SelectedSpecFilter) => void;
  onPriceChange?: (min: number, max: number) => void;
  onClear: () => void;
};

function CatalogPriceSlider({
  priceRange,
  onPriceChange,
}: {
  priceRange: {
    sliderMin: number;
    sliderMax: number;
    currentMin: number;
    currentMax: number;
  };
  onPriceChange: (min: number, max: number) => void;
}) {
  const [draftPrice, setDraftPrice] = useState<[number, number]>([
    priceRange.currentMin,
    priceRange.currentMax,
  ]);

  return (
    <div className="pb-5">
      <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        Цена
      </div>
      <div className="space-y-3">
        <Slider
          value={draftPrice}
          min={priceRange.sliderMin}
          max={priceRange.sliderMax}
          step={10}
          onValueChange={value =>
            setDraftPrice([
              value[0] ?? priceRange.sliderMin,
              value[1] ?? priceRange.sliderMax,
            ])
          }
          onValueCommit={value => {
            const nextMin = value[0] ?? priceRange.sliderMin;
            const nextMax = value[1] ?? priceRange.sliderMax;
            onPriceChange(nextMin, nextMax);
          }}
        />
        <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>{new Intl.NumberFormat("ru-RU").format(draftPrice[0])} ₽</span>
          <span>{new Intl.NumberFormat("ru-RU").format(draftPrice[1])} ₽</span>
        </div>
      </div>
    </div>
  );
}

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
  priceRange,
  onToggle,
  onPriceChange,
  onClear,
}: ProductFiltersProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showAllGroups, setShowAllGroups] = useState<Record<string, boolean>>({});
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

  const normalizedPriceRange = useMemo(() => {
    if (!priceRange) return null;
    const sliderMin = Math.max(0, Math.floor(priceRange.min));
    const sliderMax = Math.max(Math.ceil(priceRange.max), sliderMin + 1);
    const currentMin = Math.min(Math.max(priceRange.currentMin, sliderMin), sliderMax);
    const currentMax = Math.max(Math.min(priceRange.currentMax, sliderMax), currentMin);
    return {
      sliderMin,
      sliderMax,
      currentMin,
      currentMax,
    };
  }, [priceRange]);

  if (visibleFilters.length === 0 && !normalizedPriceRange) return null;

  return (
    <aside className="space-y-5">
      <div className="px-1">
        <div className="space-y-5">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-bold text-[var(--tech-color-primary)] transition hover:opacity-80"
            >
              Сбросить
            </button>
          </div>

          {normalizedPriceRange && onPriceChange ? (
            <CatalogPriceSlider
              key={`${normalizedPriceRange.sliderMin}-${normalizedPriceRange.sliderMax}-${normalizedPriceRange.currentMin}-${normalizedPriceRange.currentMax}`}
              priceRange={normalizedPriceRange}
              onPriceChange={onPriceChange}
            />
          ) : null}

          {visibleFilters.map((group, index) => {
            const isOpen = openGroups[group.normalizedKey] ?? index < 2;
            const isExpanded = showAllGroups[group.normalizedKey] ?? false;
            const valuesToRender = !isOpen
              ? []
              : isExpanded
                ? group.values
                : group.values.slice(0, 6);

            return (
              <div key={group.normalizedKey} className="pb-5 last:pb-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups(prev => ({
                      ...prev,
                      [group.normalizedKey]: !isOpen,
                    }))
                  }
                  className="mb-3 flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {group.key}
                  </span>
                  <span className="flex items-center gap-2 text-[10px] font-black text-muted-foreground">
                    {!isOpen ? group.values.length : null}
                    <ChevronDown
                      size={14}
                      className={cn(
                        "transition-transform duration-200",
                        isOpen ? "rotate-180" : ""
                      )}
                    />
                  </span>
                </button>
                {isOpen ? <div className="space-y-1.5">
              {valuesToRender.map(value => {
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
            </div> : null}
                {isOpen && group.values.length > 6 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setShowAllGroups(prev => ({
                        ...prev,
                        [group.normalizedKey]: !isExpanded,
                      }))
                    }
                    className="mt-3 text-[11px] font-bold text-[var(--tech-color-primary)] transition hover:opacity-80"
                  >
                    {isExpanded ? "Свернуть" : "Показать все"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
