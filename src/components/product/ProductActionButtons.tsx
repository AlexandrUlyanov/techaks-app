import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        className="product-action-button h-14 rounded-2xl text-sm tracking-[0.18em]"
        onClick={onAddToCart}
        disabled={isAddingToCart || disableCart}
      >
        <span className="product-action-icon product-action-icon-cart">
          <CartIcon />
        </span>
        В корзину
      </Button>

      <OneClickOrderButton onClick={onOpenOneClick} disabled={disableOneClick} />
    </div>
  );
}
