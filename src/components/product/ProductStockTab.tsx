import type { ProductStoreAvailability } from "./StoreAvailabilityItem";

function getStatusMeta(quantity: number) {
  if (quantity <= 0) {
    return {
      label: "Нет в наличии",
      className: "bg-[var(--tech-color-surface-muted)] text-[var(--tech-color-text-muted)]",
    };
  }
  if (quantity <= 3) {
    return {
      label: "Осталось мало",
      className: "bg-orange-50 text-orange-600",
    };
  }
  return {
    label: "В наличии",
    className: "bg-emerald-100 text-emerald-700",
  };
}

export default function ProductStockTab({
  stores,
  reservedStoreId,
  onReserve,
  onNotify,
}: {
  stores: ProductStoreAvailability[];
  reservedStoreId?: number | null;
  onReserve: (store: ProductStoreAvailability) => void;
  onNotify: () => void;
}) {
  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 py-8">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[var(--tech-color-text-main)] md:text-3xl">
            Наличие в магазинах
          </h2>
          <p className="mt-4 text-sm leading-6 text-[var(--tech-color-text-muted)]">
            Сейчас товара нет в наличии в магазинах.
          </p>
        </div>
        <button
          type="button"
          onClick={onNotify}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--tech-color-surface-muted)] px-5 text-sm font-semibold text-[var(--tech-color-text-main)] transition hover:brightness-95"
        >
          Сообщить о поступлении
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-[var(--tech-color-text-main)] md:text-3xl">
          Наличие в магазинах
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--tech-color-text-muted)]">
          Актуальные остатки по магазинам ТЕХАКС. Резерв доступен только для точек, где товар есть в наличии.
        </p>
      </div>

      <div className="space-y-0">
        {stores.map((store, index) => {
          const status = getStatusMeta(store.availableQty);
          const isReserved = reservedStoreId === store.storeId;
          return (
            <div
              key={store.storeId}
              className={`grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${
                index > 0 ? "border-t border-[var(--tech-color-border)]/55" : ""
              }`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-base font-semibold text-[var(--tech-color-text-main)]">{store.storeName}</div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="text-sm text-[var(--tech-color-text-muted)]">{store.storeAddress}</div>
                <div className="text-sm font-medium text-[var(--tech-color-text-main)]">
                  {store.availableQty > 0
                    ? `Доступно: ${store.availableQty} шт.`
                    : "Сейчас остатка нет."}
                </div>
              </div>

              {store.availableQty > 0 ? (
                <button
                  type="button"
                  onClick={() => onReserve(store)}
                  disabled={isReserved}
                  className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${
                    isReserved
                      ? "cursor-not-allowed bg-[color:color-mix(in_srgb,var(--tech-color-primary)_18%,var(--tech-color-surface))] text-[var(--tech-color-primary)]"
                      : "bg-[var(--tech-color-surface-muted)] text-[var(--tech-color-text-main)] hover:brightness-95"
                  }`}
                >
                  {isReserved ? "В резерве" : "Зарезервировать в этом магазине"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
