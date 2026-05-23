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
    <div className="fixed inset-x-0 bottom-[72px] z-50 border-t border-black/5 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-[#7A7F87]">
            Цена
          </div>
          <div className="truncate text-xl font-black text-[#1F2328]">
            {priceLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onAddToCart}
          disabled={disabled}
          className={`h-12 min-w-[170px] rounded-[14px] px-5 text-sm font-semibold text-white transition ${
            disabled
              ? "cursor-not-allowed bg-[#D5DADD] text-[#7F8A96]"
              : "bg-[#F0642B] hover:bg-[#db5823] active:scale-[0.99]"
          }`}
        >
          {disabled ? "Нет в наличии" : "В корзину"}
        </button>
      </div>
    </div>
  );
}
