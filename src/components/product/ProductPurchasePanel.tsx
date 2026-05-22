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
        <div className="text-[2.35rem] font-black leading-none tracking-tight text-[#1F2328] md:text-[3.1rem]">
          {priceLabel}
        </div>

        {oldPriceLabel ? (
          <div className="pb-1 text-xl font-medium text-[#9AA2AB] line-through">
            {oldPriceLabel}
          </div>
        ) : null}

        {discountLabel ? (
          <div className="rounded-full bg-[#FFF0EC] px-3 py-1 text-xs font-semibold text-[#F0642B]">
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

      <div className="rounded-[1.4rem] bg-[#F6F7F8] px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A7F87]">
          {summaryTitle}
        </div>
        <div className="mt-2 text-sm leading-6 text-[#1F2328]">{summaryText}</div>
        <button
          type="button"
          onClick={onReserveClick}
          disabled={disableReserve}
          className={`mt-3 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold transition ${
            disableReserve
              ? "cursor-not-allowed bg-[#E3E7EB] text-[#A0A7AE]"
              : "bg-white text-[#1F2328] hover:bg-[#ECEFF1]"
          }`}
        >
          {reserveLabel}
        </button>
      </div>
    </div>
  );
}
