import { trpc } from "@/providers/trpc";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2, MessageSquarePlus, Printer, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const utils = trpc.useUtils();
  const [comment, setComment] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");

  const {
    data: order,
    isLoading,
    error: orderError,
  } = trpc.ecommerce.getOrderById.useQuery(
    { id: orderId },
    { enabled: Number.isFinite(orderId) }
  );
  const { data: feed, error: historyError } = trpc.ecommerce.getOrderHistory.useQuery(
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
  const updateOrderDetails = trpc.ecommerce.updateOrderDetails.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ecommerce.getOrderById.invalidate({ id: orderId }),
        utils.ecommerce.getOrderHistory.invalidate({ orderId }),
        utils.ecommerce.listOrders.invalidate(),
      ]);
      toast.success("Данные заказа обновлены");
    },
    onError: err => toast.error(err.message || "Ошибка обновления заказа"),
  });
  const updateItemQuantity = trpc.ecommerce.updateOrderItemQuantity.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ecommerce.getOrderById.invalidate({ id: orderId }),
        utils.ecommerce.getOrderHistory.invalidate({ orderId }),
        utils.ecommerce.listOrders.invalidate(),
      ]);
      toast.success("Количество обновлено");
    },
    onError: err => toast.error(err.message || "Ошибка изменения позиции"),
  });
  const removeItem = trpc.ecommerce.removeOrderItem.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ecommerce.getOrderById.invalidate({ id: orderId }),
        utils.ecommerce.getOrderHistory.invalidate({ orderId }),
        utils.ecommerce.listOrders.invalidate(),
      ]);
      toast.success("Позиция удалена");
    },
    onError: err => toast.error(err.message || "Ошибка удаления позиции"),
  });

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("ru-RU").format(value || 0) + " ₽";

  useEffect(() => {
    if (!order) return;
    setCustomerName(order.customerName || "");
    setCustomerPhone(order.customerPhone || "");
    setCustomerEmail(order.customerEmail || "");
    setAddress(order.address || "");
  }, [order]);

  const printDocument = (mode: "order" | "picking" | "invoice") => {
    if (!order) return;
    const titleMap = {
      order: "Заказ",
      picking: "Лист сборки",
      invoice: "Накладная",
    } as const;
    const rows = order.items
      .map(
        (item: any) => `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;">${item.productName || `Товар #${item.productId}`}</td>
            <td style="padding:8px;border:1px solid #ddd;">${item.sku || "-"}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatPrice(item.total || item.price * item.quantity)}</td>
          </tr>`
      )
      .join("");
    const html = `
      <html>
      <head><meta charset="utf-8"/><title>${titleMap[mode]} ${order.orderNumber || order.id}</title></head>
      <body style="font-family:Arial,sans-serif;padding:24px;color:#111;">
        <h2>${titleMap[mode]}: ${order.orderNumber || `#${order.id}`}</h2>
        <p>Дата: ${new Date(order.createdAt).toLocaleString("ru-RU")}</p>
        <p>Покупатель: ${order.customerName || "—"} / ${order.customerPhone || "—"}</p>
        <p>Адрес: ${order.address || "—"}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Товар</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">SKU</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:center;">Кол-во</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right;">Сумма</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <h3 style="margin-top:16px;">Итого: ${formatPrice(order.totalPrice)}</h3>
      </body>
      </html>
    `;
    const w = window.open("", "_blank", "width=1024,height=800");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

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

  if (orderError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Ошибка загрузки заказа: {orderError.message}
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => printDocument("order")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold uppercase tracking-wider text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
          >
            <Printer size={14} />
            Печать заказа
          </button>
          <button
            type="button"
            onClick={() => printDocument("picking")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold uppercase tracking-wider text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
          >
            <Printer size={14} />
            Лист сборки
          </button>
          <button
            type="button"
            onClick={() => printDocument("invoice")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold uppercase tracking-wider text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
          >
            <Printer size={14} />
            Накладная
          </button>
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
          <input
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm font-bold"
          />
          <input
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
          />
          <input
            value={customerEmail}
            onChange={e => setCustomerEmail(e.target.value)}
            className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
          />
          <p className="mt-3 text-xs text-gray-500">Адрес</p>
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              updateOrderDetails.mutate({
                id: orderId,
                customerName,
                customerPhone,
                customerEmail,
                address,
              })
            }
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#05C3D4] px-3 text-xs font-bold text-white"
          >
            <Save size={14} />
            Сохранить
          </button>
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
          {order.items.map((item: any) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-lg border border-gray-100 p-3"
            >
              <div>
                <p className="font-semibold">{item.productName || `Товар #${item.productId}`}</p>
                <p className="text-xs text-gray-500">SKU: {item.sku || "—"}</p>
              </div>
              <input
                type="number"
                min={1}
                defaultValue={item.quantity}
                onBlur={e => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next) && next > 0 && next !== item.quantity) {
                    updateItemQuantity.mutate({
                      orderId,
                      itemId: item.id,
                      quantity: next,
                    });
                  }
                }}
                className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm"
              />
              <p className="font-bold">{formatPrice(item.total || item.price * item.quantity)}</p>
              <button
                type="button"
                onClick={() => removeItem.mutate({ orderId, itemId: item.id })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600"
                title="Удалить позицию"
              >
                <Trash2 size={14} />
              </button>
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
            {historyError ? (
              <p className="text-sm text-red-600">Ошибка истории: {historyError.message}</p>
            ) : feed?.history.length ? (
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
