import { trpc } from "@/providers/trpc";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const utils = trpc.useUtils();
  const [comment, setComment] = useState("");

  const { data: order, isLoading } = trpc.ecommerce.getOrderById.useQuery(
    { id: orderId },
    { enabled: Number.isFinite(orderId) }
  );
  const { data: feed } = trpc.ecommerce.getOrderHistory.useQuery(
    { orderId },
    { enabled: Number.isFinite(orderId) }
  );

  const addComment = trpc.ecommerce.addOrderComment.useMutation({
    onSuccess: async () => {
      setComment("");
      await Promise.all([
        utils.ecommerce.getOrderHistory.invalidate({ orderId }),
        utils.ecommerce.getOrderById.invalidate({ id: orderId }),
      ]);
      toast.success("Комментарий добавлен");
    },
    onError: err => toast.error(err.message || "Ошибка добавления комментария"),
  });

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("ru-RU").format(value || 0) + " ₽";

  if (!Number.isFinite(orderId)) {
    return <div className="text-sm text-red-600">Некорректный ID заказа</div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-[#05C3D4]" size={40} />
      </div>
    );
  }

  if (!order) {
    return <div className="text-sm text-gray-500">Заказ не найден</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/leads"
            className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-[#05C3D4]"
          >
            <ArrowLeft size={14} />
            Назад к списку
          </Link>
          <h2 className="text-2xl font-black text-[#0a0a0a]">
            Заказ {order.orderNumber || `#${order.id}`}
          </h2>
          <p className="text-sm text-gray-500">
            Создан: {new Date(order.createdAt).toLocaleString("ru-RU")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Статус заказа</p>
          <p className="mt-1 font-bold">{order.status}</p>
          <p className="mt-3 text-xs text-gray-500">Оплата</p>
          <p className="mt-1 font-bold">{order.paymentStatus}</p>
          <p className="mt-3 text-xs text-gray-500">Доставка</p>
          <p className="mt-1 font-bold">{order.deliveryStatus}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Покупатель</p>
          <p className="mt-1 font-bold">{order.customerName || "Без имени"}</p>
          <p className="text-sm text-gray-600">{order.customerPhone || "—"}</p>
          <p className="text-sm text-gray-600">{order.customerEmail || "—"}</p>
          <p className="mt-3 text-xs text-gray-500">Адрес</p>
          <p className="mt-1 text-sm">{order.address || "—"}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Финансы</p>
          <p className="mt-1 text-sm">Товары: {formatPrice(order.subtotal)}</p>
          <p className="text-sm">Скидка: {formatPrice(order.discountTotal)}</p>
          <p className="text-sm">Доставка: {formatPrice(order.deliveryPrice)}</p>
          <p className="mt-2 text-lg font-black text-[#05C3D4]">
            Итого: {formatPrice(order.totalPrice)}
          </p>
          <p className="text-sm">Оплачено: {formatPrice(order.paidAmount)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-gray-700">
          Состав заказа
        </h3>
        <div className="space-y-2">
          {order.items.map(item => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-gray-100 p-3"
            >
              <div>
                <p className="font-semibold">{item.productName || `Товар #${item.productId}`}</p>
                <p className="text-xs text-gray-500">SKU: {item.sku || "—"}</p>
              </div>
              <p className="text-sm text-gray-600">{item.quantity} шт.</p>
              <p className="font-bold">{formatPrice(item.total || item.price * item.quantity)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-gray-700">
            Добавить внутренний комментарий
          </h3>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-[#05C3D4]"
            placeholder="Например: клиент просил звонок после 18:00"
          />
          <button
            type="button"
            onClick={() =>
              addComment.mutate({ orderId, comment, commentType: "internal" })
            }
            disabled={addComment.isPending || comment.trim().length === 0}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#05C3D4] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <MessageSquarePlus size={16} />
            Добавить комментарий
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-gray-700">
            История заказа
          </h3>
          <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
            {feed?.history.length ? (
              feed.history.map(row => (
                <div key={row.id} className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs font-semibold text-gray-700">{row.actionType}</p>
                  <p className="text-[11px] text-gray-500">
                    {new Date(row.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Событий пока нет</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

