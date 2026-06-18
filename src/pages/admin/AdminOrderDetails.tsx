import { trpc } from "@/providers/trpc";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAbility } from "@/providers/AbilityProvider";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import {
  buildSellerRequisitesLines,
  buildSellerSignatureLine,
} from "@/lib/site-profile-formatters";

type OrderItem = {
  id: number;
  productId: number;
  variantId?: number | null;
  variantName?: string | null;
  article?: string | null;
  productName?: string | null;
  sku?: string | null;
  quantity: number;
  price: number;
  total?: number | null;
};

function getOrderStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "pending":
    case "new":
      return "Новый";
    case "waiting_call":
      return "Ждёт звонка";
    case "confirmed":
      return "Подтверждён";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "Оплачен";
    case "processing":
      return "В обработке";
    case "confirmed_by_customer":
      return "Подтверждён клиентом";
    case "ready_for_pickup":
      return "Готов к выдаче";
    case "assembling":
      return "Собирается";
    case "assembled":
      return "Собран";
    case "awaiting_dispatch":
      return "Ожидает отправки";
    case "shipped":
      return "Отгружен";
    case "handed_to_delivery":
      return "Передан в доставку";
    case "in_delivery":
      return "Доставляется";
    case "delivered":
      return "Доставлен";
    case "completed":
      return "Выполнен";
    case "return_requested":
      return "Запрошен возврат";
    case "problem":
      return "Проблемный";
    case "cancelled":
      return "Отменён";
    default:
      return value || "Не задан";
  }
}

function getPaymentStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "unpaid":
      return "Не оплачен";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "Оплачен";
    case "partially_paid":
      return "Частично оплачен";
    case "payment_error":
      return "Ошибка оплаты";
    case "refund":
      return "Возврат";
    case "partial_refund":
      return "Частичный возврат";
    default:
      return value || "Не задан";
  }
}

function getPaymentMethodLabel(value: string | null | undefined) {
  switch (value) {
    case "cash":
      return "Наличными";
    case "card":
      return "Банковской картой";
    case "sbp":
      return "СБП";
    case "yookassa":
      return "Онлайн-оплата";
    default:
      return value || "Не задан";
  }
}

function getOrderHistoryActionLabel(actionType?: string | null) {
  switch (actionType) {
    case "status_changed":
      return "Статус заказа изменён";
    case "status_changed_from_moysklad":
      return "Статус обновлён из МойСклад";
    case "payment_updated":
      return "Оплата обновлена";
    case "order_created":
      return "Заказ создан";
    case "one_click_order_created":
      return "Заказ в один клик создан";
    case "order_created_from_reservation":
      return "Заказ создан из резерва";
    case "order_details_updated":
      return "Данные заказа обновлены";
    case "delivery_updated":
      return "Доставка обновлена";
    case "delivery_update_skipped_not_required":
      return "Доставка не требуется";
    case "delivery_update_skipped_legacy":
      return "Доставка не обновлена";
    case "order_item_quantity_updated":
      return "Количество товара изменено";
    case "order_item_removed":
      return "Товар удалён из заказа";
    case "bulk_status_changed":
      return "Статус изменён массово";
    case "comment_added":
      return "Комментарий добавлен";
    case "customer_comment_added":
      return "Сообщение клиента";
    case "customer_comment_skipped_legacy":
      return "Сообщение клиента не сохранено";
    case "comment_skipped_legacy":
      return "Комментарий не сохранён";
    case "customer_conversation_read":
      return "Клиент прочитал сообщения";
    case "manager_conversation_read":
      return "Менеджер прочитал сообщения";
    default:
      return actionType || "Событие заказа";
  }
}

function getYooKassaPaymentStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "pending":
      return "Ожидает оплаты";
    case "waiting_for_capture":
      return "Ожидает подтверждения";
    case "succeeded":
      return "Оплачен";
    case "canceled":
      return "Отменён";
    default:
      return value || "Не задан";
  }
}

function getYooKassaCancellationPartyLabel(value: string | null | undefined) {
  switch (value) {
    case "merchant":
      return "Магазин";
    case "yoo_money":
      return "YooKassa";
    case "payment_network":
      return "Платёжная система";
    default:
      return value || "—";
  }
}

function getYooKassaCancellationReasonLabel(value: string | null | undefined) {
  switch (value) {
    case "3d_secure_failed":
      return "Не пройдена 3-D Secure проверка";
    case "call_issuer":
      return "Нужно обратиться в банк";
    case "canceled_by_merchant":
      return "Отменено магазином";
    case "card_expired":
      return "Срок действия карты истёк";
    case "country_forbidden":
      return "Страна карты не поддерживается";
    case "expired_on_capture":
      return "Истёк срок подтверждения платежа";
    case "expired_on_confirmation":
      return "Истёк срок подтверждения оплаты";
    case "fraud_suspected":
      return "Платёж отклонён системой безопасности";
    case "general_decline":
      return "Платёж отклонён";
    case "identification_required":
      return "Требуется идентификация";
    case "insufficient_funds":
      return "Недостаточно средств";
    case "internal_timeout":
      return "Внутренняя ошибка по таймауту";
    case "invalid_card_number":
      return "Некорректный номер карты";
    case "invalid_csc":
      return "Некорректный код CVC/CVV";
    case "issuer_unavailable":
      return "Банк недоступен";
    case "payment_method_limit_exceeded":
      return "Превышен лимит способа оплаты";
    case "payment_method_restricted":
      return "Способ оплаты ограничен";
    case "permission_revoked":
      return "Разрешение на оплату отозвано";
    case "unsupported_mobile_operator":
      return "Оператор не поддерживается";
    default:
      return value || "—";
  }
}

function getDeliveryStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "not_required":
      return "Не требуется";
    case "awaiting_processing":
      return "Готовится";
    case "prepared":
      return "Подготовлен";
    case "handed_to_delivery":
      return "Передан в доставку";
    case "in_delivery":
      return "В пути";
    case "delivered":
      return "Доставлен";
    case "return_in_transit":
      return "Возврат в пути";
    case "delivery_error":
      return "Проблема с доставкой";
    default:
      return value || "Не задано";
  }
}

function getLoyaltySyncStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "pending":
      return "Ожидает синхронизации";
    case "synced":
      return "Синхронизирован";
    case "cancelled":
      return "Отменён";
    case "rolled_back":
      return "Сторнирован";
    case "error":
      return "Ошибка";
    default:
      return value || "Не задан";
  }
}

function getOrderSourceLabel(value: string | null | undefined) {
  switch (value) {
    case "legacy":
      return "Режим совместимости";
    case "one_click":
      return "Заказ в 1 клик";
    case "reservation":
      return "Оформлен из резерва";
    case "site":
      return "Интернет-магазин";
    default:
      return value || "Источник не указан";
  }
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">
        {label}
      </span>
      <span
        className={`max-w-[220px] break-all text-right font-semibold text-[#15171A] ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

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
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();

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
  const refreshYooKassaPayment = trpc.ecommerce.refreshYooKassaPayment.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.ecommerce.getOrderById.invalidate({ id: orderId }),
        utils.ecommerce.getOrderHistory.invalidate({ orderId }),
      ]);
      toast.success(`Платёж YooKassa обновлён: ${getYooKassaPaymentStatusLabel(result.status)}`);
    },
    onError: err => toast.error(err.message || "Ошибка проверки платежа YooKassa"),
  });
  const resyncLoyaltyOrder = trpc.loyalty.resyncOrder.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ecommerce.getOrderById.invalidate({ id: orderId }),
        utils.ecommerce.getOrderHistory.invalidate({ orderId }),
        utils.loyalty.getOverview.invalidate(),
        utils.loyalty.listOrders.invalidate(),
        utils.loyalty.listJobs.invalidate(),
        utils.loyalty.listJournal.invalidate(),
      ]);
      toast.success("Бонусная синхронизация заказа запущена");
    },
    onError: err => toast.error(err.message || "Ошибка бонусной синхронизации"),
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
            <td style="padding:8px;border:1px solid #ddd;">${item.article || item.sku || "-"}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatPrice(item.total || item.price * item.quantity)}</td>
          </tr>`
      )
      .join("");
    const sellerLines = buildSellerRequisitesLines(siteProfile);
    const signatureFooter = buildSellerSignatureLine(siteProfile);
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
        ${
          sellerLines.length > 0
            ? `
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #ddd;">
          <div style="font-weight:700;margin-bottom:8px;">Реквизиты продавца</div>
          <div style="white-space:pre-line;line-height:1.6;">${sellerLines.join("\n")}</div>
          ${
            signatureFooter
              ? `<div style="margin-top:28px;">${signatureFooter}</div>`
              : ""
          }
        </div>`
            : ""
        }
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
  const storeId = "storeId" in order ? order.storeId : null;
  const reservationId = "reservationId" in order ? order.reservationId : null;
  const moyskladOrderId = "moyskladOrderId" in order ? order.moyskladOrderId : null;
  const moyskladOrderHref = "moyskladOrderHref" in order ? order.moyskladOrderHref : null;
  const moyskladExternalCode =
    "moyskladExternalCode" in order ? order.moyskladExternalCode : null;
  const moyskladSyncStatus = "moyskladSyncStatus" in order ? order.moyskladSyncStatus : null;
  const isStatusManagedByMoysklad = Boolean(
    moyskladOrderId?.trim() || moyskladOrderHref?.trim()
  );
  const yookassaDiagnostics = order as typeof order & {
    paymentProviderStatus?: string | null;
    paymentTest?: boolean | null;
    paymentCancellationParty?: string | null;
    paymentCancellationReason?: string | null;
  };

  const itemTotal = order.items.reduce(
    (acc: number, item: OrderItem) =>
      acc + Number(item.total || item.price * item.quantity || 0),
    0
  );
  const moyskladSyncLabel =
    moyskladSyncStatus === "success"
      ? "Синхронизация активна"
      : moyskladSyncStatus === "processing"
        ? "Синхронизируется"
        : moyskladSyncStatus === "error"
          ? "Ошибка синхронизации"
          : moyskladSyncStatus === "pending"
            ? "Ждёт синхронизации"
            : "Состояние не определено";

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
            {isStatusManagedByMoysklad ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#05C3D4]/20 bg-[#F7FEFF] px-3 py-1 text-xs font-bold text-[#0099A8]">
                <Package size={14} />
                Статус из МойСклад
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
          value={getOrderStatusLabel(order.status)}
          hint={getOrderSourceLabel(order.source)}
          icon={Package}
          tone="accent"
        />
        <AdminStatCard
          label="Оплата"
          value={getPaymentStatusLabel(order.paymentStatus)}
          hint={`${getPaymentMethodLabel(order.paymentMethod)} · оплачено: ${formatPrice(order.paidAmount)}`}
          icon={Wallet}
        />
        <AdminStatCard
          label="Доставка"
          value={getDeliveryStatusLabel(order.deliveryStatus)}
          hint={order.deliveryType === "delivery" ? "Курьер / доставка" : "Самовывоз"}
        />
        <AdminStatCard
          label="Итого"
          value={formatPrice(order.totalPrice)}
          hint={`Позиции: ${order.items.length}`}
          tone="success"
        />
      </div>

      {isStatusManagedByMoysklad ? (
        <AdminSection
          title="Связь с МойСклад"
          description="Этот заказ уже связан с МойСклад. Статус на сайте только отображается и обновляется обратной синхронизацией."
          tone="subtle"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-3 text-sm text-gray-600">
              <div className="rounded-2xl bg-[#F7FEFF] px-4 py-4 text-[#15171A]">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0099A8]">
                  Источник статуса
                </div>
                <div className="mt-2 text-base font-bold">МойСклад</div>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Если менеджер меняет статус в МойСклад, сайт подтягивает его автоматически.
                  Локально менять статус такого заказа больше не нужно.
                </p>
              </div>
              {moyskladOrderHref ? (
                <a
                  href={moyskladOrderHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#0099A8] hover:text-[#05C3D4]"
                >
                  <ExternalLink size={15} />
                  Открыть документ МойСклад
                </a>
              ) : null}
              <div className="rounded-2xl bg-white px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                  Единый номер заказа
                </div>
                <div className="mt-2 text-base font-bold text-[#15171A]">
                  {order.orderNumber || `#${order.id}`}
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Для новых и обновляемых заказов этот же номер отправляется в МойСклад, чтобы менеджеры не путались между сайтом и складом.
                </p>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl bg-gray-50 px-4 py-4 text-sm text-gray-600">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                  Состояние синхронизации
                </div>
                <div className="mt-1 font-semibold text-[#15171A]">{moyskladSyncLabel}</div>
              </div>
              {moyskladExternalCode ? (
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                    Внешний код связи
                  </div>
                  <div className="mt-1 break-all font-medium text-[#15171A]">
                    {moyskladExternalCode}
                  </div>
                </div>
              ) : null}
              {moyskladOrderId ? (
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                    ID документа МойСклад
                  </div>
                  <div className="mt-1 break-all font-medium text-[#15171A]">
                    {moyskladOrderId}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </AdminSection>
      ) : null}

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
                {(storeId || reservationId) ? (
                  <div className="mb-3 rounded-xl border border-[#05C3D4]/15 bg-[#F7FEFF] px-3 py-3 text-sm text-gray-700">
                    {storeId ? (
                      <div>
                        Магазин получения:{" "}
                        <span className="font-semibold text-[#15171A]">
                          #{storeId}
                        </span>
                      </div>
                    ) : null}
                    {reservationId ? (
                      <div className="mt-1">
                        Связанный резерв:{" "}
                        <span className="font-semibold text-[#15171A]">
                          #{reservationId}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                    {item.variantName ? (
                      <p className="mt-1 text-xs text-gray-500">
                        Вариант: {item.variantName}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-500">
                      Артикул: {item.article || item.sku || "—"}
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

          {order.paymentMethod === "yookassa" || order.paymentId ? (
            <AdminSection
              title="YooKassa"
              description="Диагностика payment из YooKassa. Secret Key здесь не отображается."
              actions={
                order.paymentId ? (
                  <button
                    type="button"
                    onClick={() => refreshYooKassaPayment.mutate({ id: orderId })}
                    disabled={refreshYooKassaPayment.isPending}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#E8FAFC] px-4 text-sm font-black text-[#047987] disabled:opacity-50"
                  >
                    {refreshYooKassaPayment.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CreditCard size={16} />
                    )}
                    Проверить платёж
                  </button>
                ) : null
              }
            >
              <div className="space-y-3 text-sm">
                <InfoRow label="ID платежа YooKassa" value={order.paymentId || "Не задан"} mono />
                <InfoRow
                  label="Тестовый платёж"
                  value={
                    typeof yookassaDiagnostics.paymentTest === "boolean"
                      ? yookassaDiagnostics.paymentTest
                        ? "Да"
                        : "Нет"
                      : "Неизвестно"
                  }
                />
                <InfoRow
                  label="Статус YooKassa"
                  value={getYooKassaPaymentStatusLabel(
                    yookassaDiagnostics.paymentProviderStatus || order.paymentStatus
                  )}
                />
                <InfoRow
                  label="Кто отменил"
                  value={getYooKassaCancellationPartyLabel(
                    yookassaDiagnostics.paymentCancellationParty
                  )}
                />
                <InfoRow
                  label="Причина отмены"
                  value={getYooKassaCancellationReasonLabel(
                    yookassaDiagnostics.paymentCancellationReason
                  )}
                />
              </div>
            </AdminSection>
          ) : null}

          {(order.loyaltyBonusSpent > 0 ||
            order.loyaltyBonusExpectedAccrued > 0 ||
            order.loyaltyActualSpent > 0 ||
            order.loyaltyActualAccrued > 0 ||
            order.loyaltySyncStatus ||
            order.loyaltyLastSyncedAt ||
            order.loyaltyLastSyncError) ? (
            <AdminSection
              title="Бонусная программа"
              description="Сводка по списанию, начислению и статусу синхронизации бонусов с МойСклад."
              actions={
                <button
                  type="button"
                  onClick={() => resyncLoyaltyOrder.mutate({ orderId })}
                  disabled={resyncLoyaltyOrder.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#E8FAFC] px-4 text-sm font-black text-[#047987] disabled:opacity-50"
                >
                  {resyncLoyaltyOrder.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Wallet size={16} />
                  )}
                  Пересинхронизировать бонусы
                </button>
              }
            >
              <div className="space-y-3 text-sm">
                <InfoRow
                  label="Баланс до заказа"
                  value={formatPrice(order.loyaltyBalanceBefore)}
                />
                <InfoRow
                  label="Запрошено к списанию"
                  value={formatPrice(order.loyaltyBonusRequested)}
                />
                <InfoRow
                  label="Списано по факту"
                  value={formatPrice(order.loyaltyActualSpent || order.loyaltyBonusSpent)}
                />
                <InfoRow
                  label="Ожидалось к начислению"
                  value={formatPrice(order.loyaltyBonusExpectedAccrued)}
                />
                <InfoRow
                  label="Начислено по факту"
                  value={formatPrice(order.loyaltyActualAccrued || order.loyaltyBonusAccrued)}
                />
                <InfoRow
                  label="Статус синхронизации"
                  value={getLoyaltySyncStatusLabel(order.loyaltySyncStatus)}
                />
                <InfoRow
                  label="Последняя синхронизация"
                  value={formatDateTime(order.loyaltyLastSyncedAt)}
                />
                {order.loyaltyLastSyncError ? (
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <span className="font-black">Последняя ошибка:</span>{" "}
                    {order.loyaltyLastSyncError}
                  </div>
                ) : null}
              </div>
            </AdminSection>
          ) : null}

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
                      {getOrderHistoryActionLabel(row.actionType)}
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
