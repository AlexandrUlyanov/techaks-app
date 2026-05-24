import ProductActionButtons from "./ProductActionButtons";

type ProductPurchasePanelProps = {
  priceLabel: string;
  oldPriceLabel?: string | null;
  discountLabel?: string | null;
  summaryTitle: string;
  summaryText: string;
  reserveLabel?: string;
  onAddToCart: () => void;
  onOpenOneClick: () => void;
  onReserveClick: () => void;
  disableCart?: boolean;
  disableOneClick?: boolean;
  disableReserve?: boolean;
};

export default function ProductPurchasePanel({
  priceLabel,
  oldPriceLabel,
  discountLabel,
  summaryTitle,
  summaryText,
  reserveLabel = "Зарезервировать в магазине",
  onAddToCart,
  onOpenOneClick,
  onReserveClick,
  disableCart = false,
  disableOneClick = false,
  disableReserve = false,
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

      <div className="rounded-[1.4rem] bg-[var(--tech-color-surface)] px-5 py-4 shadow-[var(--tech-shadow-card)]">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">
          {summaryTitle}
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--tech-color-text-main)]">{summaryText}</div>
        <button
          type="button"
          onClick={onReserveClick}
          disabled={disableReserve}
          className={`mt-3 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition ${
            disableReserve
              ? "cursor-not-allowed bg-[color:color-mix(in_srgb,var(--tech-color-surface-muted)_85%,var(--tech-color-background))] text-[var(--tech-color-text-muted)]/80"
              : "bg-[var(--tech-color-surface-muted)] text-[var(--tech-color-text-main)] hover:brightness-95"
          }`}
        >
          {reserveLabel}
        </button>
      </div>
    </div>
  );
}
