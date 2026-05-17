import { trpc } from "@/providers/trpc";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  Loader2,
  MessageSquarePlus,
  Package,
  Printer,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAbility } from "@/providers/AbilityProvider";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";

type OrderItem = {
  id: number;
  productId: number;
  productName?: string | null;
  sku?: string | null;
  quantity: number;
  price: number;
  total?: number | null;
};

export default function AdminOrderDetails() {
  const ability = useAbility();
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const utils = trpc.useUtils();
  const [comment, setComment] = useState("");
  const [clientReply, setClientReply] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [markedClientReadAt, setMarkedClientReadAt] = useState<string | null>(null);

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
    onSuccess: async result => {
      setComment("");
      setClientReply("");
      await Promise.all([
        utils.ecommerce.getOrderHistory.invalidate({ orderId }),
        utils.ecommerce.getOrderById.invalidate({ id: orderId }),
      ]);
      if (result?.warning) {
        toast.warning(result.warning);
      } else {
        toast.success("Комментарий добавлен");
      }
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
  const deleteOrder = trpc.ecommerce.deleteOrder.useMutation({
    onSuccess: async data => {
      await utils.ecommerce.listOrders.invalidate();
      toast.success(`Заказ ${data.orderNumber} удалён`);
      window.location.href = "/admin/leads";
    },
    onError: err => toast.error(err.message || "Ошибка удаления заказа"),
  });
  const markConversationRead = trpc.ecommerce.markOrderConversationRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ecommerce.getOrderHistory.invalidate({ orderId }),
        utils.ecommerce.listOrders.invalidate(),
      ]);
    },
  });

  const formatPrice = (value: number | null | undefined) =>
    new Intl.NumberFormat("ru-RU").format(value || 0) + " ₽";
  const formatDateTime = (value: string | Date | null | undefined) =>
    value ? new Date(value).toLocaleString("ru-RU") : "Дата не указана";

  useEffect(() => {
    if (!order) return;
    setCustomerName(order.customerName || "");
    setCustomerPhone(order.customerPhone || "");
    setCustomerEmail(order.customerEmail || "");
    setAddress(order.address || "");
  }, [order]);

  useEffect(() => {
    const latestClientCommentAt = feed?.readState?.latestClientCommentAt;
    if (!latestClientCommentAt || markedClientReadAt === String(latestClientCommentAt)) {
      return;
    }
    const latestClientMs = new Date(latestClientCommentAt).getTime();
    const latestReadMs = feed?.readState?.latestAdminReadClientAt
      ? new Date(feed.readState.latestAdminReadClientAt).getTime()
      : 0;
    if (Number.isFinite(latestClientMs) && latestClientMs > latestReadMs) {
      setMarkedClientReadAt(String(latestClientCommentAt));
      markConversationRead.mutate({ orderId });
    }
  }, [
    feed?.readState?.latestAdminReadClientAt,
    feed?.readState?.latestClientCommentAt,
    markedClientReadAt,
    markConversationRead,
    orderId,
  ]);

  const printDocument = (mode: "order" | "picking" | "invoice") => {
    if (!order) return;
    const titleMap = {
      order: "Заказ",
      picking: "Лист сборки",
      invoice: "Накладная",
    } as const;
    const rows = order.items
      .map(
        (item: OrderItem) => `
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
        <p>Дата: ${formatDateTime(order.createdAt)}</p>
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

  const compatibilityWarnings = [
    ...(order.compatibilityWarnings ?? []),
    ...(feed?.warning ? [feed.warning] : []),
  ];
  const conversationComments = (feed?.comments ?? []).filter(
    item => item.commentType === "client" || item.commentType === "manager"
  );
  const internalComments = (feed?.comments ?? []).filter(
    item => item.commentType === "internal"
  );
  const latestClientCommentMs = feed?.readState?.latestClientCommentAt
    ? new Date(feed.readState.latestClientCommentAt).getTime()
    : 0;
  const latestAdminReadClientMs = feed?.readState?.latestAdminReadClientAt
    ? new Date(feed.readState.latestAdminReadClientAt).getTime()
    : 0;
  const hasUnreadClientMessage =
    latestClientCommentMs > 0 && latestClientCommentMs > latestAdminReadClientMs;

  const itemTotal = useMemo(
    () =>
      order.items.reduce(
        (acc: number, item: OrderItem) =>
          acc + Number(item.total || item.price * item.quantity || 0),
        0
      ),
    [order.items]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Заказы"
        title={`Заказ ${order.orderNumber || `#${order.id}`}`}
        description={`Создан ${formatDateTime(order.createdAt)}. Здесь собраны все рабочие данные по клиенту, составу, деньгам и переписке без лишнего служебного шума.`}
        meta={
          <div className="flex flex-wrap gap-2">
            {compatibilityWarnings.length > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                <ShieldAlert size={14} />
                Режим совместимости
              </span>
            ) : null}
            {conversationComments.some(item => item.commentType === "client") ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#05C3D4]/20 bg-[#F7FEFF] px-3 py-1 text-xs font-bold text-[#0099A8]">
                <MessageSquarePlus size={14} />
                Есть переписка с клиентом
              </span>
            ) : null}
            {hasUnreadClientMessage ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                <MessageSquarePlus size={14} />
                Новое сообщение клиента
              </span>
            ) : null}
          </div>
        }
        actions={
          <>
            <Link
              to="/admin/leads"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
            >
              <ArrowLeft size={16} />
              Назад к списку
            </Link>
            <button
              type="button"
              onClick={() => printDocument("order")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
            >
              <Printer size={16} />
              Печать заказа
            </button>
            <button
              type="button"
              onClick={() => printDocument("picking")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
            >
              <Printer size={16} />
              Лист сборки
            </button>
            <button
              type="button"
              onClick={() => printDocument("invoice")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
            >
              <Printer size={16} />
              Накладная
            </button>
            {ability.can("manage", "all") ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Удалить заказ ${order.orderNumber || `#${order.id}`}? Это действие необратимо.`
                    )
                  ) {
                    deleteOrder.mutate({ id: Number(order.id) });
                  }
                }}
                disabled={deleteOrder.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Удалить
              </button>
            ) : null}
          </>
        }
      />

      {compatibilityWarnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-semibold">Режим совместимости заказа</div>
          <ul className="mt-2 space-y-1">
            {compatibilityWarnings.map(warning => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Статус заказа"
          value={order.status || "Не задан"}
          hint={order.source === "legacy" ? "Legacy-режим" : order.source || "Источник не указан"}
          icon={Package}
          tone="accent"
        />
        <AdminStatCard
          label="Оплата"
          value={order.paymentStatus || "Не задан"}
          hint={`Оплачено: ${formatPrice(order.paidAmount)}`}
          icon={Wallet}
        />
        <AdminStatCard
          label="Доставка"
          value={order.deliveryStatus || "Не задано"}
          hint={order.deliveryType === "delivery" ? "Курьер / доставка" : "Самовывоз"}
        />
        <AdminStatCard
          label="Итого"
          value={formatPrice(order.totalPrice)}
          hint={`Позиции: ${order.items.length}`}
          tone="success"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.95fr)]">
        <div className="space-y-6">
          <AdminSection
            title="Покупатель и доставка"
            description="Редактируйте только рабочие данные, которые реально нужны менеджеру: имя, телефон, почта и адрес."
            actions={
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
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-bold text-white"
              >
                <Save size={16} />
                Сохранить данные
              </button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#15171A]">
                    <UserRound size={16} />
                    Контакт клиента
                  </div>
                  <div className="space-y-3">
                    <input
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#05C3D4]"
                      placeholder="Клиент не указан"
                    />
                    <input
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#05C3D4]"
                      placeholder="Телефон"
                    />
                    <input
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#05C3D4]"
                      placeholder="Электронная почта не указана"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="mb-3 text-sm font-bold text-[#15171A]">
                  Адрес и способ получения
                </div>
                <div className="mb-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
                  {order.deliveryType === "delivery"
                    ? "Курьерская доставка"
                    : "Самовывоз"}
                </div>
                <textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#05C3D4]"
                  placeholder="Адрес доставки"
                />
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Состав заказа"
            description="Рабочая зона по позициям: количество, сумма строки и удаление лишних товаров."
          >
            <div className="space-y-3">
              {order.items.map((item: OrderItem) => (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 lg:grid-cols-[minmax(0,1fr)_90px_120px_44px]"
                >
                  <div>
                    <p className="font-semibold text-[#15171A]">
                      {item.productName || `Товар #${item.productId}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      SKU: {item.sku || "—"}
                    </p>
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
                    className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                  <div className="flex items-center justify-start text-sm font-black text-[#15171A] lg:justify-end">
                    {formatPrice(item.total || item.price * item.quantity)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem.mutate({ orderId, itemId: item.id })}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600"
                    title="Удалить позицию"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </AdminSection>

          <AdminSection
            title="Переписка с клиентом"
            description="Это главный диалоговый блок по заказу. Здесь менеджер видит сообщения клиента и отвечает в ту же ленту."
            tone="accent"
          >
            <div className="space-y-4">
              <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
                {conversationComments.length > 0 ? (
                  conversationComments.map(row => (
                    <div
                      key={`conversation-${row.id}`}
                      className={`rounded-2xl p-4 ${
                        row.commentType === "client"
                          ? "border border-amber-200 bg-amber-50"
                          : "border border-[#05C3D4]/20 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={`text-xs font-black uppercase tracking-wider ${
                            row.commentType === "client"
                              ? "text-amber-700"
                              : "text-[#0099A8]"
                          }`}
                        >
                          {row.commentType === "client" ? "Клиент" : "Менеджер"}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {formatDateTime(row.createdAt)}
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-700">
                        {row.comment}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#05C3D4]/30 bg-white p-4 text-sm text-gray-500">
                    Клиент пока не писал по этому заказу.
                  </div>
                )}
              </div>

              <textarea
                value={clientReply}
                onChange={e => setClientReply(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-[#05C3D4]/20 bg-white p-3 text-sm outline-none focus:border-[#05C3D4]"
                placeholder="Ответ клиенту появится в его истории заказа."
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    addComment.mutate({
                      orderId,
                      comment: clientReply,
                      commentType: "manager",
                    })
                  }
                  disabled={addComment.isPending || clientReply.trim().length === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Send size={16} />
                  Отправить клиенту
                </button>
              </div>
            </div>
          </AdminSection>
        </div>

        <div className="space-y-6">
          <AdminSection title="Финансы" description="Короткая сводка по суммам заказа.">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Товары</span>
                <span className="font-semibold">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Скидка</span>
                <span className="font-semibold">{formatPrice(order.discountTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Доставка</span>
                <span className="font-semibold">{formatPrice(order.deliveryPrice)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm text-gray-600">
                <span>Сумма по позициям</span>
                <span className="font-semibold">{formatPrice(itemTotal)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#F7FEFF] px-4 py-3">
                <span className="font-semibold text-[#15171A]">Итого</span>
                <span className="text-lg font-black text-[#05C3D4]">
                  {formatPrice(order.totalPrice)}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Оплачено: <span className="font-semibold">{formatPrice(order.paidAmount)}</span>
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Внутренний комментарий"
            description="Служебные заметки команды. Этот блок остаётся рабочим, но не конкурирует с клиентской перепиской."
            tone="subtle"
          >
            <div className="space-y-4">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-gray-200 p-3 text-sm outline-none focus:border-[#05C3D4]"
                placeholder="Например: клиент просил звонок после 18:00"
              />
              <button
                type="button"
                onClick={() =>
                  addComment.mutate({ orderId, comment, commentType: "internal" })
                }
                disabled={addComment.isPending || comment.trim().length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#15171A] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <MessageSquarePlus size={16} />
                Добавить комментарий
              </button>

              {internalComments.length > 0 ? (
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  {internalComments.map(row => (
                    <div key={`internal-${row.id}`} className="rounded-2xl bg-white p-3">
                      <p className="text-sm text-gray-700">{row.comment}</p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {formatDateTime(row.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </AdminSection>

          <AdminSection
            title="История заказа"
            description="Служебная timeline изменений заказа. Это вторичный диагностический блок, а не основной центр внимания."
          >
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {historyError ? (
                <p className="text-sm text-red-600">Ошибка истории: {historyError.message}</p>
              ) : feed?.history.length ? (
                feed.history.map(row => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                      {row.actionType}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Событий пока нет</p>
              )}
            </div>
          </AdminSection>
        </div>
      </div>
    </div>
  );
}
