import ProductActionButtons from "./ProductActionButtons";

type ProductPurchasePanelProps = {
  priceLabel: string;
  oldPriceLabel?: string | null;
  discountLabel?: string | null;
  summaryTitle: string;
  summaryText: string;
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
  onAddToCart,
  onOpenOneClick,
  onReserveClick,
  disableCart = false,
  disableOneClick = false,
  disableReserve = false,
}: ProductPurchasePanelProps) {
  return (
    <aside className="lg:sticky lg:top-24">
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="text-[2.2rem] font-black leading-none tracking-tight text-[#1F2328] md:text-[3rem]">
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
        </div>

        <div className="space-y-4">
          <ProductActionButtons
            onAddToCart={onAddToCart}
            onOpenOneClick={onOpenOneClick}
            disableCart={disableCart}
            disableOneClick={disableOneClick}
          />

          <button
            type="button"
            onClick={onReserveClick}
            disabled={disableReserve}
            className={`text-left text-sm font-medium transition ${
              disableReserve
                ? "cursor-not-allowed text-[#A0A7AE]"
                : "text-[#464A50] hover:text-[#1F2328]"
            }`}
          >
            Зарезервировать в магазине
          </button>
        </div>

        <div className="rounded-[1.4rem] bg-[#F6F7F8] px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A7F87]">
            {summaryTitle}
          </div>
          <div className="mt-2 text-sm leading-6 text-[#1F2328]">{summaryText}</div>
        </div>
      </div>
    </aside>
  );
}
