import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
  const sliderValue: [number, number] = [
    typeof priceFrom === "number" ? priceFrom : minPrice,
    typeof priceTo === "number" ? priceTo : maxPrice,
  ];

  return (
    <div className="space-y-6 rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          Фильтры
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Сбросить
        </Button>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-black uppercase tracking-widest text-foreground">
          Цена
        </div>
        <Slider
          value={sliderValue}
          min={minPrice}
          max={Math.max(maxPrice, minPrice + 1)}
          step={10}
          onValueChange={value => onPriceChange(value[0] ?? minPrice, value[1] ?? maxPrice)}
        />
        <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>{new Intl.NumberFormat("ru-RU").format(sliderValue[0])} ₽</span>
          <span>{new Intl.NumberFormat("ru-RU").format(sliderValue[1])} ₽</span>
        </div>
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
