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
  product: { id: number; name: string };
}) {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
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
      return;
    }

    setPhone(user?.phone || "");
    setCustomerName(user?.fullName || "");
  }, [open, user?.fullName, user?.phone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl border border-border p-0">
        {successState ? (
          <div className="space-y-5 p-6">
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
        ) : (
          <form
            className="space-y-5 p-6"
            onSubmit={event => {
              event.preventDefault();
              setFieldError(null);
              createOneClickOrder.mutate({
                productId: product.id,
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
