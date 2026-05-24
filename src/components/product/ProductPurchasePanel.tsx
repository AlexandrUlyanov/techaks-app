import ProductActionButtons from "./ProductActionButtons";

type ProductPurchasePanelProps = {
  priceLabel: string;
  oldPriceLabel?: string | null;
  discountLabel?: string | null;
  onAddToCart: () => void;
  onOpenOneClick: () => void;
  disableCart?: boolean;
  disableOneClick?: boolean;
};

export default function ProductPurchasePanel({
  priceLabel,
  oldPriceLabel,
  discountLabel,
  onAddToCart,
  onOpenOneClick,
  disableCart = false,
  disableOneClick = false,
}: ProductPurchasePanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-[2.35rem] font-black leading-none tracking-tight text-[var(--tech-color-text-main)] md:text-[3.1rem]">
          {priceLabel}
        </div>

        {oldPriceLabel ? (
          <div className="pb-1 text-xl font-medium text-[var(--tech-color-text-muted)]/75 line-through">
            {oldPriceLabel}
          </div>
        ) : null}

        {discountLabel ? (
          <div className="rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-warning)_16%,var(--tech-color-surface))] px-3 py-1 text-xs font-semibold text-[var(--tech-color-warning)]">
            {discountLabel}
          </div>
        ) : null}
      </div>

      <ProductActionButtons
        onAddToCart={onAddToCart}
        onOpenOneClick={onOpenOneClick}
        disableCart={disableCart}
        disableOneClick={disableOneClick}
      />
    </div>
  );
}
