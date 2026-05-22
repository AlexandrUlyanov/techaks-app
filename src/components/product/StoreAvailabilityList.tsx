import { StoreAvailabilityItem, type ProductStoreAvailability } from "./StoreAvailabilityItem";

export default function StoreAvailabilityList({
  stores,
  reservedStoreId,
  loadingStoreId,
  onReserve,
}: {
  stores: ProductStoreAvailability[];
  reservedStoreId?: number | null;
  loadingStoreId?: number | null;
  onReserve: (store: ProductStoreAvailability) => void;
}) {
  if (stores.length === 0) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        Сейчас в магазинах нет доступного остатка для резерва.
      </div>
    );
  }

  return (
    <div>
      {stores.map((store, index) => (
        <div key={store.storeId} className={index > 0 ? "border-t border-[#F1F2F3]" : ""}>
          <StoreAvailabilityItem
            store={store}
            singleStore={stores.length === 1}
            isReserved={reservedStoreId === store.storeId}
            isLoading={loadingStoreId === store.storeId}
            onReserve={onReserve}
          />
        </div>
      ))}
    </div>
  );
}
