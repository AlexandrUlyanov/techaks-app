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
      <div className="rounded-2xl border border-border bg-white p-4 text-sm text-muted-foreground">
        Сейчас в магазинах нет доступного остатка для резерва.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stores.map(store => (
        <StoreAvailabilityItem
          key={store.storeId}
          store={store}
          singleStore={stores.length === 1}
          isReserved={reservedStoreId === store.storeId}
          isLoading={loadingStoreId === store.storeId}
          onReserve={onReserve}
        />
      ))}
    </div>
  );
}
