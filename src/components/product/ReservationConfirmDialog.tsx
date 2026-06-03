import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";
import { ConfirmReserveIcon, ReserveStoreIcon } from "./ProductActionIcons";
import type { ProductStoreAvailability } from "./StoreAvailabilityItem";
import PersonalDataConsent from "@/components/PersonalDataConsent";

type ReservationSuccessPayload = {
  id: number;
  reservedUntil: string | Date;
  store: {
    id: number;
    name: string;
    address: string;
  };
};

export default function ReservationConfirmDialog({
  open,
  onOpenChange,
  product,
  store,
  onReserved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: number;
    name: string;
    variantId?: number | null;
    variantName?: string | null;
    article?: string | null;
  };
  store: ProductStoreAvailability | null;
  onReserved: (payload: ReservationSuccessPayload) => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [allowPhoneEdit, setAllowPhoneEdit] = useState(false);
  const [successState, setSuccessState] = useState<ReservationSuccessPayload | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createReservation = trpc.ecommerce.createReservation.useMutation({
    onSuccess: async result => {
      setSuccessState({
        id: result.id,
        reservedUntil: result.reservedUntil,
        store: {
          id: result.store.id,
          name: result.store.name,
          address: result.store.address,
        },
      });
      await utils.product.getStockBySlug.invalidate();
      onReserved({
        id: result.id,
        reservedUntil: result.reservedUntil,
        store: {
          id: result.store.id,
          name: result.store.name,
          address: result.store.address,
        },
      });
    },
    onError: error => {
      setFieldError(error.message || "Не удалось создать резерв. Попробуйте ещё раз.");
      toast.error(error.message || "Не удалось создать резерв. Попробуйте ещё раз.");
    },
  });

  useEffect(() => {
    if (!open) {
      setSuccessState(null);
      setFieldError(null);
      setPhone("");
      setCustomerName("");
      setConsentChecked(false);
      setAllowPhoneEdit(false);
      return;
    }

    setFieldError(null);
    setPhone(user?.phone || "");
    setCustomerName(user?.fullName || "");
    setAllowPhoneEdit(false);
  }, [open, user?.fullName, user?.phone]);

  const hasSavedPhone = isAuthenticated && Boolean(user?.phone);
  const showNameField = !isAuthenticated;
  const reservedUntilLabel = useMemo(() => {
    if (!successState?.reservedUntil) return "";
    return new Date(successState.reservedUntil).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [successState?.reservedUntil]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl border border-border p-0">
        {successState ? (
          <div className="space-y-5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#05C3D4]/10 text-[#05C3D4]">
                <ConfirmReserveIcon />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-xl font-black text-[#15171A]">
                  Товар зарезервирован
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-gray-600">
                  Мы закрепили товар за вами в магазине:
                  <span className="block font-semibold text-[#15171A]">
                    {successState.store.name}
                  </span>
                </DialogDescription>
              </div>
            </div>
            <div className="rounded-2xl border border-[#05C3D4]/15 bg-[#F7FEFF] p-4 text-sm text-[#15171A]">
              <div className="font-semibold">Резерв действует до {reservedUntilLabel}.</div>
              <div className="mt-1 text-gray-600">
                Менеджер свяжется с вами для подтверждения.
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Понятно
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-5 p-6"
            onSubmit={event => {
              event.preventDefault();
              if (!store) return;
              setFieldError(null);
              if (!consentChecked) {
                setFieldError("Подтвердите согласие на обработку персональных данных.");
                toast.error("Подтвердите согласие на обработку персональных данных.");
                return;
              }
              createReservation.mutate({
                productId: product.id,
                variantId: product.variantId ?? null,
                storeId: store.storeId,
                quantity: 1,
                phone: phone || user?.phone || undefined,
                customerName: customerName || user?.fullName || undefined,
                source: "product_page",
              });
            }}
          >
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#05C3D4]/10 text-[#05C3D4]">
                  <ReserveStoreIcon />
                </div>
                <div className="space-y-2">
                  <DialogTitle className="text-xl font-black text-[#15171A]">
                    Резерв товара
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-6 text-gray-600">
                    Товар будет временно закреплён за вами в выбранном магазине.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {store ? (
              <div className="rounded-2xl border border-border bg-gray-50 p-4 text-sm">
                <div className="font-semibold text-[#15171A]">{store.storeName}</div>
                <div className="mt-1 text-gray-500">{store.storeAddress}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-gray-400">
                  {product.name}
                  {product.variantName ? ` · ${product.variantName}` : ""} · 1 шт.
                </div>
                {product.article ? (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Артикул: {product.article}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-4">
              {hasSavedPhone && !allowPhoneEdit ? (
                <div className="rounded-2xl border border-border bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                    Телефон для связи
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold text-[#15171A]">{user?.phone}</span>
                    <button
                      type="button"
                      onClick={() => setAllowPhoneEdit(true)}
                      className="text-xs font-bold uppercase tracking-[0.14em] text-[#05C3D4]"
                    >
                      Изменить номер
                    </button>
                  </div>
                </div>
              ) : (
                <label className="space-y-2 block">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                    Телефон для связи
                  </span>
                  <input
                    value={phone}
                    onChange={event => setPhone(event.target.value)}
                    placeholder="+7 / +34 ..."
                    aria-describedby={fieldError ? "reservation-phone-error" : undefined}
                    className="h-12 w-full rounded-2xl border border-border px-4 text-sm outline-none transition focus:border-[#05C3D4]"
                  />
                </label>
              )}

              {showNameField ? (
                <label className="space-y-2 block">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                    Имя, необязательно
                  </span>
                  <input
                    value={customerName}
                    onChange={event => setCustomerName(event.target.value)}
                    placeholder="Имя"
                    className="h-12 w-full rounded-2xl border border-border px-4 text-sm outline-none transition focus:border-[#05C3D4]"
                  />
                </label>
              ) : null}

              <PersonalDataConsent
                checked={consentChecked}
                onCheckedChange={setConsentChecked}
                withOffer
              />

              {fieldError ? (
                <p className="text-sm text-red-600" id="reservation-phone-error">
                  {fieldError}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createReservation.isPending}>
                {createReservation.isPending ? "Резервируем..." : "Подтвердить резерв"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
