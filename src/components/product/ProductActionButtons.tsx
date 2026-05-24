import { CartIcon } from "./ProductActionIcons";
import OneClickOrderButton from "./OneClickOrderButton";

export default function ProductActionButtons({
  onAddToCart,
  onOpenOneClick,
  isAddingToCart = false,
  disableCart = false,
  disableOneClick = false,
}: {
  onAddToCart: () => void;
  onOpenOneClick: () => void;
  isAddingToCart?: boolean;
  disableCart?: boolean;
  disableOneClick?: boolean;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        className={`product-action-button relative flex h-14 w-full items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-semibold transition-all duration-300 ${
          isAddingToCart || disableCart
            ? "cursor-not-allowed bg-[color:color-mix(in_srgb,var(--tech-color-surface-muted)_82%,var(--tech-color-background))] text-[var(--tech-color-text-muted)]/85"
            : "bg-[#F0642B] text-white hover:bg-[#db5823] active:scale-[0.99]"
        }`}
        onClick={onAddToCart}
        disabled={isAddingToCart || disableCart}
      >
        <span className="product-action-icon product-action-icon-cart">
          <CartIcon />
        </span>
        {isAddingToCart ? "Добавляем..." : disableCart ? "Нет в наличии" : "В корзину"}
      </button>

      <OneClickOrderButton onClick={onOpenOneClick} disabled={disableOneClick} />
    </div>
  );
}
