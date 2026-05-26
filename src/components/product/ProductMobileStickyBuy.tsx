import { ShoppingCart } from "lucide-react";

type ProductMobileStickyBuyProps = {
  disabled?: boolean;
  onAddToCart: () => void;
  visible?: boolean;
};

export default function ProductMobileStickyBuy({
  disabled = false,
  onAddToCart,
  visible = true,
}: ProductMobileStickyBuyProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[72px] z-50 flex justify-center bg-[color:color-mix(in_srgb,var(--tech-color-surface)_94%,white)] px-4 py-3 backdrop-blur md:hidden">
      <div className="w-full max-w-[220px]">
        <button
          type="button"
          onClick={onAddToCart}
          disabled={disabled}
          aria-label="Положить в корзину"
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-[18px] px-5 text-sm font-black uppercase tracking-wide transition ${
            disabled
              ? "cursor-not-allowed bg-[color:color-mix(in_srgb,var(--tech-color-surface-muted)_82%,white)] text-[var(--tech-color-text-muted)]"
              : "bg-[#05C3D4] text-white hover:bg-[#27E6F2] active:scale-[0.99]"
          }`}
        >
          <ShoppingCart size={16} strokeWidth={2.4} />
          <span>Положить в корзину</span>
        </button>
      </div>
    </div>
  );
}
