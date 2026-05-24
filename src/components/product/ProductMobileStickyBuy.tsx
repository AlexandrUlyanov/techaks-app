type ProductMobileStickyBuyProps = {
  priceLabel: string;
  disabled?: boolean;
  onAddToCart: () => void;
};

export default function ProductMobileStickyBuy({
  priceLabel,
  disabled = false,
  onAddToCart,
}: ProductMobileStickyBuyProps) {
  return (
    <div className="fixed inset-x-0 bottom-[72px] z-50 border-t border-[var(--tech-color-border)]/60 bg-[color:color-mix(in_srgb,var(--tech-color-surface)_92%,var(--tech-color-background))] px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--tech-color-text-muted)]">
            Цена
          </div>
          <div className="truncate text-xl font-black text-[var(--tech-color-text-main)]">
            {priceLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onAddToCart}
          disabled={disabled}
          className={`h-12 min-w-[170px] rounded-[14px] px-5 text-sm font-semibold text-white transition ${
            disabled
              ? "cursor-not-allowed bg-[color:color-mix(in_srgb,var(--tech-color-surface-muted)_82%,var(--tech-color-background))] text-[var(--tech-color-text-muted)]"
              : "bg-[#F0642B] hover:bg-[#db5823] active:scale-[0.99]"
          }`}
        >
          {disabled ? "Нет в наличии" : "В корзину"}
        </button>
      </div>
    </div>
  );
}
