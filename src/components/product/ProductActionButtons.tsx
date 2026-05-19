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
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        className={`product-action-button relative overflow-hidden flex h-14 items-center justify-center gap-2 rounded-2xl px-4 text-[11px] font-black uppercase tracking-widest transition-all duration-300 shadow-[0_4px_20px_rgba(5,195,212,0.3)] ${
          isAddingToCart || disableCart
            ? "cursor-not-allowed border border-[#D7E0E7] bg-[#F3F6F8] text-[#7F8A96] shadow-none"
            : "bg-[#05C3D4] text-white hover:bg-[#27E6F2] active:scale-[0.99]"
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
