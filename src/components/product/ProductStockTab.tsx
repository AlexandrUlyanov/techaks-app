import { useState } from "react";
import { MapPin, PackageCheck, Store } from "lucide-react";
import type { ProductStoreAvailability } from "./StoreAvailabilityItem";

function getStatusMeta(quantity: number) {
  if (quantity <= 0) {
    return {
      label: "Нет в наличии",
      className: "bg-slate-100 text-slate-500",
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
  mobile = false,
}: {
  stores: ProductStoreAvailability[];
  reservedStoreId?: number | null;
  onReserve: (store: ProductStoreAvailability) => void;
  onNotify: () => void;
  mobile?: boolean;
}) {
  const [showAllStores, setShowAllStores] = useState(false);
  if (stores.length === 0) {
    return (
      <div className="rounded-[1.5rem] bg-[radial-gradient(circle_at_top,rgba(5,195,212,0.10),transparent_45%)] px-6 py-14 text-center dark:bg-[radial-gradient(circle_at_top,rgba(5,195,212,0.14),transparent_45%)]">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-card text-[#05C3D4]">
          <Store size={24} />
        </div>
        <h2 className="mt-5 text-2xl font-black tracking-tight text-foreground md:text-3xl">
          Наличие в магазинах
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          Сейчас товара нет в наличии в магазинах.
        </p>
        <button
          type="button"
          onClick={onNotify}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-muted/70 px-5 text-sm font-bold text-foreground transition hover:-translate-y-px hover:bg-[rgba(5,195,212,0.10)] dark:hover:bg-[#05C3D4]/10"
        >
          Сообщить о поступлении
        </button>
      </div>
    );
  }

  if (mobile) {
    const visibleStores = showAllStores ? stores : stores.slice(0, 2);

    return (
      <div className="space-y-4 text-foreground">
        <div>
          <h2 className="text-xl font-black tracking-tight">Наличие в магазинах</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Смотрите ближайшие точки и оформляйте резерв, если товар доступен.
          </p>
        </div>

        <div className="space-y-3">
          {visibleStores.map(store => {
            const status = getStatusMeta(store.availableQty);
            const isReserved = reservedStoreId === store.storeId;
            const isAvailable = store.availableQty > 0;

            return (
              <article key={store.storeId} className="rounded-[1.1rem] bg-muted/60 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-foreground">{store.storeName}</div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">{store.storeAddress}</div>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="mt-3 text-sm font-medium text-foreground">
                  {isAvailable ? `${store.availableQty} шт. доступно` : "Уточните ближайшее поступление"}
                </div>
                <button
                  type="button"
                  onClick={() => onReserve(store)}
                  disabled={!isAvailable || isReserved}
                  className={`mt-3 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-bold transition ${
                    isReserved
                      ? "cursor-not-allowed bg-[rgba(5,195,212,0.12)] text-[#047E8A]"
                      : isAvailable
                        ? "bg-[#05C3D4] text-white dark:text-black"
                        : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  {isReserved ? "Уже в резерве" : "Забронировать"}
                </button>
              </article>
            );
          })}
        </div>

        {stores.length > 2 ? (
          <button
            type="button"
            onClick={() => setShowAllStores(prev => !prev)}
            className="text-sm font-bold text-[#05C3D4]"
          >
            {showAllStores ? "Скрыть магазины" : "Показать все магазины"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8 text-foreground">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
            Наличие
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
            Наличие в магазинах
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Остатки по точкам ТЕХАКС. Для товаров в наличии можно сразу оформить резерв.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-[rgba(5,195,212,0.1)] px-3 py-2 text-xs font-bold text-[#047E8A]">
          {stores.length} {stores.length === 1 ? "магазин" : stores.length < 5 ? "магазина" : "магазинов"}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {stores.map(store => {
          const status = getStatusMeta(store.availableQty);
          const isReserved = reservedStoreId === store.storeId;
          const isAvailable = store.availableQty > 0;

          return (
            <article
              key={store.storeId}
              className="rounded-[1.4rem] bg-muted/60 p-5 transition-[background,transform] duration-200 ease-out hover:-translate-y-[2px] hover:bg-[rgba(5,195,212,0.07)] dark:hover:bg-[#05C3D4]/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground">
                      {store.storeName}
                    </h3>
                    <div className="mt-2 inline-flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                      <MapPin size={16} className="mt-1 shrink-0 text-[#05C3D4]" />
                      <span>{store.storeAddress}</span>
                    </div>
                  </div>
                </div>
                <span className={`inline-flex rounded-full px-3 py-2 text-xs font-bold ${status.className}`}>
                  {status.label}
                </span>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-card/70 px-4 py-3">
                <PackageCheck size={18} className="text-[#05C3D4]" />
                <div className="text-sm font-semibold text-foreground">
                  {isAvailable ? `Доступно: ${store.availableQty} шт.` : "Под этот магазин остатка нет."}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onReserve(store)}
                disabled={!isAvailable || isReserved}
                className={`mt-5 inline-flex h-11 w-full items-center justify-center rounded-[14px] text-sm font-extrabold transition ${
                  isReserved
                    ? "cursor-not-allowed bg-[rgba(5,195,212,0.12)] text-[#047E8A]"
                    : isAvailable
                      ? "bg-[#05C3D4] text-white hover:-translate-y-px hover:bg-[#27E6F2] dark:text-black"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
              >
                {isReserved ? "Уже в резерве" : "Забронировать"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
