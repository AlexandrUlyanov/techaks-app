import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";

type Facet = { id: number; name: string; count: number };

export default function SearchFilters({
  facets,
  selectedCategoryId,
  selectedBrandId,
  inStockOnly,
  priceFrom,
  priceTo,
  onCategoryChange,
  onBrandChange,
  onInStockChange,
  onPriceChange,
  onReset,
}: {
  facets: {
    categories: Facet[];
    brands: Facet[];
    price: { min: number; max: number };
  };
  selectedCategoryId?: number;
  selectedBrandId?: number;
  inStockOnly: boolean;
  priceFrom?: number;
  priceTo?: number;
  onCategoryChange: (value?: number) => void;
  onBrandChange: (value?: number) => void;
  onInStockChange: (value: boolean) => void;
  onPriceChange: (from: number, to: number) => void;
  onReset: () => void;
}) {
  const minPrice = facets.price.min || 0;
  const maxPrice = facets.price.max || Math.max(minPrice, 1000);
  const normalizedSliderValue = useMemo<[number, number]>(
    () => [
      typeof priceFrom === "number" ? priceFrom : minPrice,
      typeof priceTo === "number" ? priceTo : maxPrice,
    ],
    [maxPrice, minPrice, priceFrom, priceTo]
  );
  const [draftPrice, setDraftPrice] = useState<[number, number]>(normalizedSliderValue);

  useEffect(() => {
    setDraftPrice(normalizedSliderValue);
  }, [normalizedSliderValue]);

  const sliderMax = Math.max(maxPrice, minPrice + 1);
  const isPriceChanged = useMemo(
    () =>
      draftPrice[0] !== normalizedSliderValue[0] ||
      draftPrice[1] !== normalizedSliderValue[1],
    [draftPrice, normalizedSliderValue]
  );

  return (
    <div className="space-y-6 rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraftPrice([minPrice, maxPrice]);
            onReset();
          }}
        >
          Сбросить
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-black uppercase tracking-widest text-foreground">
          Цена
        </div>
        <Slider
          value={draftPrice}
          min={minPrice}
          max={sliderMax}
          step={10}
          onValueChange={value =>
            setDraftPrice([
              value[0] ?? minPrice,
              value[1] ?? sliderMax,
            ])
          }
          onValueCommit={value => {
            const nextFrom = value[0] ?? minPrice;
            const nextTo = value[1] ?? sliderMax;
            if (
              nextFrom === normalizedSliderValue[0] &&
              nextTo === normalizedSliderValue[1]
            ) {
              return;
            }
            onPriceChange(nextFrom, nextTo);
          }}
        />
        <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>{new Intl.NumberFormat("ru-RU").format(draftPrice[0])} ₽</span>
          <span>{new Intl.NumberFormat("ru-RU").format(draftPrice[1])} ₽</span>
        </div>
        {isPriceChanged ? (
          <div className="text-[11px] font-medium text-muted-foreground">
            Диапазон применится после отпускания ползунка.
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 text-sm font-medium text-foreground">
          <Checkbox checked={inStockOnly} onCheckedChange={checked => onInStockChange(Boolean(checked))} />
          Только в наличии
        </label>
      </div>

      {facets.categories.length > 0 ? (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-widest text-foreground">
            Категории
          </div>
          <div className="space-y-2">
            {facets.categories.slice(0, 12).map(item => (
              <button
                key={`category-${item.id}`}
                type="button"
                onClick={() => onCategoryChange(selectedCategoryId === item.id ? undefined : item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedCategoryId === item.id
                    ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,white)] text-foreground"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <span>{item.name}</span>
                <span className="text-[11px] font-black">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {facets.brands.length > 0 ? (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-widest text-foreground">
            Бренды
          </div>
          <div className="space-y-2">
            {facets.brands.slice(0, 12).map(item => (
              <button
                key={`brand-${item.id}-${item.name}`}
                type="button"
                onClick={() => onBrandChange(selectedBrandId === item.id ? undefined : item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  selectedBrandId === item.id
                    ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,white)] text-foreground"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <span>{item.name}</span>
                <span className="text-[11px] font-black">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
