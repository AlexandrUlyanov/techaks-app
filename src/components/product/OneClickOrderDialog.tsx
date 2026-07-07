import { useEffect, useState } from "react";
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
import { ConfirmReserveIcon, OneClickIcon } from "./ProductActionIcons";
import PersonalDataConsent from "@/components/PersonalDataConsent";

type OrderSuccessPayload = {
  orderId: number;
  orderNumber?: string | null;
};

export default function OneClickOrderDialog({
  open,
  onOpenChange,
  product,
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
}) {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<OrderSuccessPayload | null>(null);

  const createOneClickOrder = trpc.ecommerce.createOneClickOrder.useMutation({
    onSuccess: result => {
      setSuccessState({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
      });
    },
    onError: error => {
      setFieldError(error.message || "Не удалось создать заказ. Попробуйте ещё раз.");
      toast.error(error.message || "Не удалось создать заказ. Попробуйте ещё раз.");
    },
  });

  useEffect(() => {
    if (!open) {
      setFieldError(null);
      setSuccessState(null);
      setPhone("");
      setCustomerName("");
      setConsentChecked(false);
      return;
    }

    setPhone(user?.phone || "");
    setCustomerName(user?.fullName || "");
  }, [open, user?.fullName, user?.phone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-xl overflow-hidden rounded-3xl border border-border p-0 sm:max-h-[min(92dvh,860px)]">
        {successState ? (
          <div className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:max-h-[min(92dvh,860px)]">
            <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#05C3D4]/10 text-[#05C3D4]">
                <ConfirmReserveIcon />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-xl font-black text-[#15171A]">
                  Заказ создан
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-gray-600">
                  Мы получили вашу заявку. Менеджер свяжется с вами для подтверждения.
                </DialogDescription>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Понятно
              </Button>
            </DialogFooter>
            </div>
          </div>
        ) : (
          <form
            className="max-h-[calc(100dvh-1rem)] space-y-5 overflow-y-auto p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:max-h-[min(92dvh,860px)]"
            onSubmit={event => {
              event.preventDefault();
              setFieldError(null);
              if (!consentChecked) {
                setFieldError("Подтвердите согласие на обработку персональных данных.");
                toast.error("Подтвердите согласие на обработку персональных данных.");
                return;
              }
              createOneClickOrder.mutate({
                productId: product.id,
                variantId: product.variantId ?? null,
                quantity: 1,
                phone: phone || user?.phone || undefined,
                customerName: customerName || user?.fullName || undefined,
              });
            }}
          >
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#05C3D4]/10 text-[#05C3D4]">
                  <OneClickIcon />
                </div>
                <div className="space-y-2">
                  <DialogTitle className="text-xl font-black text-[#15171A]">
                    Покупка в 1 клик
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-6 text-gray-600">
                    Мы получим заявку и быстро свяжемся для подтверждения.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-2xl border border-border bg-gray-50 p-4 text-sm">
              <div className="font-semibold text-[#15171A]">{product.name}</div>
              {product.variantName ? (
                <div className="mt-2 text-sm text-gray-600">
                  Вариант: {product.variantName}
                </div>
              ) : null}
              {product.article ? (
                <div className="mt-1 text-[11px] text-gray-500">Артикул: {product.article}</div>
              ) : null}
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-400">
                Количество: 1 шт.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-gray-600">
              Менеджер подтвердит наличие и подберёт удобный магазин для выдачи или доставки.
            </div>

            <label className="space-y-2 block">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                Телефон для связи
              </span>
              <input
                value={phone}
                onChange={event => setPhone(event.target.value)}
                placeholder="+7 / +34 ..."
                className="h-12 w-full rounded-2xl border border-border px-4 text-sm outline-none transition focus:border-[#05C3D4]"
              />
            </label>

            {!user?.fullName ? (
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
              <p className="text-sm text-red-600">{fieldError}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createOneClickOrder.isPending}>
                {createOneClickOrder.isPending ? "Оформляем..." : "Подтвердить заказ"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
