import ReserveStoreButton from "./ReserveStoreButton";

export type ProductStoreAvailability = {
  storeId: number;
  storeName: string;
  storeAddress: string;
  storePhone?: string | null;
  storeHours?: string | null;
  rawStockQty: number;
  activeReservedQty: number;
  availableQty: number;
  hasConflict?: boolean;
};

function formatQuantityLabel(quantity: number) {
  return quantity > 0 ? `Доступно: ${quantity} шт.` : "Нет в наличии";
}

export function StoreAvailabilityItem({
  store,
  singleStore = false,
  isReserved = false,
  isLoading = false,
  onReserve,
}: {
  store: ProductStoreAvailability;
  singleStore?: boolean;
  isReserved?: boolean;
  isLoading?: boolean;
  onReserve: (store: ProductStoreAvailability) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-black text-[#15171A]">{store.storeName}</div>
          <div className="text-sm text-muted-foreground">{store.storeAddress}</div>
          <div
            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
              store.availableQty > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {formatQuantityLabel(store.availableQty)}
          </div>
        </div>

        <ReserveStoreButton
          singleStore={singleStore}
          isReserved={isReserved}
          isLoading={isLoading}
          isAvailable={store.availableQty > 0}
          onClick={() => onReserve(store)}
        />
      </div>
    </div>
  );
}
