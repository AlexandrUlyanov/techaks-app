import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  MessageCircle,
  Package,
  Receipt,
  RotateCcw,
  Send,
  Settings,
  ShoppingBag,
  Star,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useSeo } from "@/lib/seo";
import { trpc } from "@/providers/trpc";
import { Can } from "@/providers/AbilityProvider";
import ReviewComposer from "@/components/reviews/ReviewComposer";

type AccountOrder = {
  id: number;
  orderNumber?: string | null;
  status: string;
  totalPrice: number;
  deliveryType?: string | null;
  address?: string | null;
  paymentType?: string | null;
  paymentStatus?: string | null;
  createdAt?: string | Date | null;
  latestManagerCommentAt?: string | Date | null;
  latestClientCommentAt?: string | Date | null;
  latestCustomerReadManagerAt?: string | Date | null;
};

const orderStatusLabels: Record<string, string> = {
  pending: "Новый",
  waiting_call: "Ждёт звонка",
  confirmed: "Подтверждён",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  processing: "В обработке",
  confirmed_by_customer: "Подтверждён клиентом",
  ready_for_pickup: "Готов к выдаче",
  assembling: "Собирается",
  assembled: "Собран",
  awaiting_dispatch: "Ожидает отправки",
  handed_to_delivery: "Передан в доставку",
  in_delivery: "В пути",
  delivered: "Доставлен",
  completed: "Выполнен",
  cancelled: "Отменён",
  return_requested: "Возврат",
  problem: "Проблемный",
};

const paymentStatusLabels: Record<string, string> = {
  unpaid: "Не оплачен",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  partially_paid: "Частично оплачен",
  payment_error: "Ошибка оплаты",
  refund: "Возврат",
  partial_refund: "Частичный возврат",
};

const deliveryStatusLabels: Record<string, string> = {
  not_required: "Не требуется",
  unknown: "Не задано",
  awaiting_processing: "Ожидает обработки",
  prepared: "Подготовлен",
  handed_to_delivery: "Передан в доставку",
  in_delivery: "В пути",
  delivered: "Доставлен",
  return_in_transit: "Возврат в пути",
  delivery_error: "Ошибка доставки",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleDateString("ru-RU");
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleString("ru-RU");
}

function getOrderStatusLabel(status?: string | null) {
  if (!status) return "Не задан";
  return orderStatusLabels[status] || status;
}

function getPaymentStatusLabel(status?: string | null) {
  if (!status) return "Не задан";
  return paymentStatusLabels[status] || status;
}

function getDeliveryStatusLabel(status?: string | null) {
  if (!status) return "Не задано";
  return deliveryStatusLabels[status] || status;
}

function getPaymentStatusTone(status?: string | null) {
  if (status === "paid") {
    return {
      className: "bg-emerald-100 text-emerald-700",
      dot: "bg-emerald-500",
      title: "Оплачено",
      subtitle: "Платёж успешно получен",
    };
  }
  if (status === "awaiting_payment") {
    return {
      className: "bg-sky-100 text-sky-700",
      dot: "bg-sky-500",
      title: "Ожидаем оплату",
      subtitle: "Платёж ещё не подтверждён",
    };
  }
  if (status === "refund" || status === "partial_refund") {
    return {
      className: "bg-violet-100 text-violet-700",
      dot: "bg-violet-500",
      title: status === "partial_refund" ? "Частичный возврат" : "Возврат выполнен",
      subtitle: "Деньги возвращены покупателю",
    };
  }
  if (status === "payment_error") {
    return {
      className: "bg-red-100 text-red-700",
      dot: "bg-red-500",
      title: "Оплата не прошла",
      subtitle: "Нужно повторить оплату",
    };
  }
  return {
    className: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    title: "Не оплачено",
    subtitle: "Ожидаем оплату заказа",
  };
}

function extractReceiptMeta(rawPayload: unknown): {
  receiptUrl?: string;
  receiptPdfUrl?: string;
  receiptStatus: "pending" | "ready" | "failed" | "not_required";
} {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { receiptStatus: "not_required" };
  }
  const payload = rawPayload as Record<string, any>;
  const candidateUrl =
    payload?.receiptUrl ||
    payload?.receipt_url ||
    payload?.receiptPdfUrl ||
    payload?.receipt_pdf_url ||
    payload?.receipt?.url ||
    payload?.receipt_registration?.url ||
    payload?.fiscal_receipt?.url ||
    null;
  const candidatePdf =
    payload?.receiptPdfUrl ||
    payload?.receipt_pdf_url ||
    payload?.receipt?.pdf_url ||
    payload?.fiscal_receipt?.pdf_url ||
    null;
  const rawStatus =
    payload?.receiptStatus ||
    payload?.receipt_status ||
    payload?.receipt?.status ||
    payload?.receipt_registration?.status ||
    null;
  if (candidateUrl || candidatePdf) {
    return {
      receiptUrl: typeof candidateUrl === "string" ? candidateUrl : undefined,
      receiptPdfUrl: typeof candidatePdf === "string" ? candidatePdf : undefined,
      receiptStatus: "ready",
    };
  }
  if (typeof rawStatus === "string") {
    if (rawStatus === "failed" || rawStatus === "error") {
      return { receiptStatus: "failed" };
    }
    if (rawStatus === "pending" || rawStatus === "processing") {
      return { receiptStatus: "pending" };
    }
  }
  return { receiptStatus: "not_required" };
}

function getPaymentTypeLabel(type?: string | null) {
  if (!type) return "Не указан";
  if (type === "cash") return "Наличными";
  if (type === "card") return "Картой";
  if (type === "sbp") return "СБП";
  if (type === "yookassa") return "Онлайн-оплата YooKassa";
  return type;
}

function getDeliveryTypeLabel(type?: string | null) {
  if (!type) return "Не указан";
  if (type === "pickup") return "Самовывоз";
  if (type === "delivery") return "Доставка";
  return type;
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
    case "customer_comment_added":
      return "Ваше сообщение сохранено";
    case "comment_added":
      return "Добавлен комментарий";
    case "delivery_updated":
      return "Доставка обновлена";
    case "delivery_update_skipped_not_required":
      return "Доставка не требуется";
    case "delivery_update_skipped_legacy":
      return "Доставка не обновлена";
    case "order_details_updated":
      return "Данные заказа обновлены";
    case "order_item_quantity_updated":
      return "Количество товара изменено";
    case "order_item_removed":
      return "Товар удалён из заказа";
    case "bulk_status_changed":
      return "Статус изменён массово";
    case "customer_review_created":
      return "Отзыв отправлен";
    case "customer_review_updated":
      return "Отзыв обновлён";
    case "customer_comment_skipped_legacy":
      return "Сообщение клиента не сохранено";
    case "comment_skipped_legacy":
      return "Комментарий не сохранён";
    case "customer_conversation_read":
    case "manager_conversation_read":
      return "Сообщения прочитаны";
    default:
      return actionType || "Событие заказа";
  }
}

function resolveOrderActions(params: {
  orderStatus?: string | null;
  paymentStatus?: string | null;
  hasReceipt: boolean;
}) {
  const { orderStatus, paymentStatus, hasReceipt } = params;
  const isPaid = paymentStatus === "paid";
  const isCancelled = orderStatus === "cancelled";
  const isCompleted = orderStatus === "completed";
  const needsPayment =
    paymentStatus === "unpaid" ||
    paymentStatus === "awaiting_payment" ||
    paymentStatus === "payment_error";

  return {
    showPay: needsPayment && !isCancelled,
    showReceipt: hasReceipt && (isPaid || isCancelled || isCompleted),
    showReceiptPending: isPaid && !hasReceipt,
    showRepeat: isPaid || isCancelled || isCompleted,
    showSupport: true,
    showReview: isCompleted,
  };
}

function AccountOrderCard({
  order,
  expanded,
  onToggle,
  myReviewsByProductId,
}: {
  order: AccountOrder;
  expanded: boolean;
  onToggle: () => void;
  myReviewsByProductId: Record<number, any>;
}) {
  const utils = trpc.useUtils();
  const [message, setMessage] = useState("");
  const [editingReviewProductId, setEditingReviewProductId] = useState<number | null>(null);
  const [lastMarkedManagerCommentIso, setLastMarkedManagerCommentIso] = useState<string | null>(null);

  const {
    data: details,
    isLoading: detailsLoading,
    error: detailsError,
  } = trpc.ecommerce.getMyOrderDetails.useQuery(
    { orderId: order.id },
    { enabled: expanded }
  );

  const {
    data: feed,
    isLoading: feedLoading,
    error: feedError,
  } = trpc.ecommerce.getMyOrderHistory.useQuery(
    { orderId: order.id },
    { enabled: expanded }
  );

  const addComment = trpc.ecommerce.addMyOrderComment.useMutation({
    onSuccess: async result => {
      setMessage("");
      await Promise.all([
        utils.ecommerce.getMyOrderHistory.invalidate({ orderId: order.id }),
        utils.ecommerce.getOrderHistory.invalidate({ orderId: order.id }),
      ]);
      if (result?.warning) {
        toast.warning(result.warning);
      } else {
        toast.success("Сообщение отправлено");
      }
    },
    onError: err => {
      toast.error(err.message || "Не удалось отправить сообщение");
    },
  });
  const markConversationRead = trpc.ecommerce.markMyOrderConversationRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ecommerce.getMyOrders.invalidate(),
        utils.ecommerce.getMyOrderNotifications.invalidate(),
        utils.ecommerce.getMyOrderHistory.invalidate({ orderId: order.id }),
      ]);
    },
  });

  const compatibilityWarnings = useMemo(
    () => [
      ...(details?.compatibilityWarnings ?? []),
      ...(feed?.warning ? [feed.warning] : []),
    ],
    [details?.compatibilityWarnings, feed?.warning]
  );
  const latestManagerCommentIso = useMemo(() => {
    const managerComments = (feed?.comments ?? [])
      .filter(comment => comment.commentType === "manager")
      .map(comment => new Date(comment.createdAt).toISOString())
      .sort()
      .reverse();

    if (managerComments.length > 0) return managerComments[0];
    if (order.latestManagerCommentAt) {
      return new Date(order.latestManagerCommentAt).toISOString();
    }
    return null;
  }, [feed?.comments, order.latestManagerCommentAt]);

  const hasUnreadManagerReply = useMemo(() => {
    if (!latestManagerCommentIso) return false;
    const serverSeenAt =
      feed?.readState?.latestCustomerReadManagerAt ??
      order.latestCustomerReadManagerAt ??
      null;
    if (!serverSeenAt) return true;
    return (
      new Date(latestManagerCommentIso).getTime() >
      new Date(serverSeenAt).getTime()
    );
  }, [
    feed?.readState?.latestCustomerReadManagerAt,
    latestManagerCommentIso,
    order.latestCustomerReadManagerAt,
  ]);

  useEffect(() => {
    if (!latestManagerCommentIso) return;
    const serverSeenAt =
      feed?.readState?.latestCustomerReadManagerAt ??
      order.latestCustomerReadManagerAt ??
      null;
    if (
      serverSeenAt &&
      new Date(serverSeenAt).getTime() >= new Date(latestManagerCommentIso).getTime()
    ) {
      setLastMarkedManagerCommentIso(current =>
        current === latestManagerCommentIso ? current : latestManagerCommentIso
      );
    }
  }, [
    feed?.readState?.latestCustomerReadManagerAt,
    latestManagerCommentIso,
    order.latestCustomerReadManagerAt,
  ]);

  const detailsAny = details as Record<string, any> | undefined;
  const paymentTone = getPaymentStatusTone(
    detailsAny?.paymentStatus ?? order.paymentStatus
  );
  const receiptMeta = extractReceiptMeta(detailsAny?.paymentRawResponseJson);
  const canDownloadReceipt = Boolean(receiptMeta.receiptPdfUrl || receiptMeta.receiptUrl);
  const receiptActionHref = receiptMeta.receiptPdfUrl || receiptMeta.receiptUrl;
  const orderNumberLabel = order.orderNumber || `#${order.id}`;
  const supportPrefill = encodeURIComponent(
    `Здравствуйте! У меня вопрос по заказу ${orderNumberLabel}.`
  );
  const supportTelegramHref = `https://t.me/tech_aks?text=${supportPrefill}`;
  const actions = resolveOrderActions({
    orderStatus: detailsAny?.status ?? order.status,
    paymentStatus: detailsAny?.paymentStatus ?? order.paymentStatus,
    hasReceipt: canDownloadReceipt,
  });
  const listPaymentTone = getPaymentStatusTone(order.paymentStatus);

  useEffect(() => {
    if (expanded && latestManagerCommentIso) {
      const serverSeenAt =
        feed?.readState?.latestCustomerReadManagerAt ??
        order.latestCustomerReadManagerAt ??
        null;
      const shouldMark =
        !serverSeenAt ||
        new Date(latestManagerCommentIso).getTime() > new Date(serverSeenAt).getTime();
      if (
        shouldMark &&
        latestManagerCommentIso !== lastMarkedManagerCommentIso &&
        !markConversationRead.isPending
      ) {
        setLastMarkedManagerCommentIso(latestManagerCommentIso);
        markConversationRead.mutate(
          { orderId: order.id },
          {
            onError: () => {
              setLastMarkedManagerCommentIso(null);
            },
          }
        );
      }
    }
  }, [
    expanded,
    feed?.readState?.latestCustomerReadManagerAt,
    lastMarkedManagerCommentIso,
    latestManagerCommentIso,
    markConversationRead,
    order.id,
    order.latestCustomerReadManagerAt,
  ]);

  return (
    <div className="bg-card border border-border/70 rounded-3xl transition-colors hover:border-[#05C3D4]/30">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-8 text-left"
      >
        <div className="flex flex-wrap justify-between gap-6 mb-6">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Заказ
            </span>
            <div className="flex items-center gap-2">
              <p className="text-lg font-black font-heading tracking-tight">
                {order.orderNumber || `#${order.id}`}
              </p>
              {hasUnreadManagerReply && (
                <span className="inline-flex h-6 items-center rounded-full bg-amber-500 px-2 text-[10px] font-black uppercase tracking-wider text-white">
                  Новый ответ
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Оплата
            </span>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${listPaymentTone.className}`}
            >
              <div className={`h-1.5 w-1.5 rounded-full ${listPaymentTone.dot}`} />
              <p>{getPaymentStatusLabel(order.paymentStatus)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {getOrderStatusLabel(order.status)}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Статус заказа
            </span>
            <p className="text-sm font-bold text-foreground">
              {getOrderStatusLabel(order.status)}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Дата
            </span>
            <p className="text-sm font-bold">{formatDate(order.createdAt)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Сумма
            </span>
            <p className="text-lg font-black text-[#05C3D4] font-heading">
              {formatPrice(order.totalPrice)}
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <MapPin size={12} />
              {getDeliveryTypeLabel(order.deliveryType)}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Clock size={12} />
              {getPaymentTypeLabel(order.paymentType)}
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#05C3D4]">
            {expanded ? "СВЕРНУТЬ" : "ДЕТАЛИ"}
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-8 pb-8">
          {(detailsLoading || feedLoading) && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-[#05C3D4]" size={28} />
            </div>
          )}

          {(detailsError || feedError) && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Ошибка загрузки деталей заказа:{" "}
              {detailsError?.message || feedError?.message}
            </div>
          )}

          {!detailsLoading && !feedLoading && !detailsError && !feedError && details && (
            <div className="space-y-6 pt-6">
              <div className="rounded-3xl bg-muted/35 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Заказ {orderNumberLabel}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      от {formatDate(detailsAny?.createdAt ?? order.createdAt)}
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${paymentTone.className}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${paymentTone.dot}`} />
                      {paymentTone.title}
                    </div>
                    <p className="text-xs text-muted-foreground">{paymentTone.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-[#05C3D4]">
                      {formatPrice(Number(detailsAny?.totalPrice ?? order.totalPrice ?? 0))}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Статус: {getOrderStatusLabel(detailsAny?.status ?? order.status)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getDeliveryTypeLabel(detailsAny?.deliveryType ?? order.deliveryType)} ·{" "}
                      {getPaymentTypeLabel(detailsAny?.paymentType ?? order.paymentType)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  {actions.showReceipt ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (receiptActionHref) window.open(receiptActionHref, "_blank", "noopener,noreferrer");
                      }}
                      className="w-full sm:w-auto"
                    >
                      <Receipt size={16} className="mr-2" />
                      Скачать чек
                    </Button>
                  ) : null}
                  {actions.showPay ? (
                    <Button type="button" disabled className="w-full sm:w-auto">
                      Оплатить заказ
                    </Button>
                  ) : null}
                  {actions.showReceiptPending ? (
                    <Button type="button" variant="outline" disabled className="w-full sm:w-auto">
                      Чек формируется
                    </Button>
                  ) : null}
                  {actions.showRepeat ? (
                    <Button type="button" variant="outline" className="w-full sm:w-auto">
                    <RotateCcw size={16} className="mr-2" />
                    Повторить заказ
                    </Button>
                  ) : null}
                  {actions.showSupport ? (
                    <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
                    <a href={supportTelegramHref} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} className="mr-2" />
                      Написать по заказу
                    </a>
                    </Button>
                  ) : null}
                  {actions.showReview ? (
                    <Button type="button" variant="outline" className="w-full sm:w-auto">
                      <MessageSquare size={16} className="mr-2" />
                      Оставить отзыв
                    </Button>
                  ) : null}
                </div>
              </div>
              {compatibilityWarnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="font-semibold">Режим совместимости</div>
                  <ul className="mt-2 space-y-1">
                    {compatibilityWarnings.map(warning => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-muted/45 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Статус заказа
                  </div>
                  <div className="mt-2 font-bold">
                    {getOrderStatusLabel(details.status)}
                  </div>
                </div>
                <div className="rounded-2xl bg-muted/45 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Оплата
                  </div>
                  <div className="mt-2 font-bold">
                    {getPaymentStatusLabel(details.paymentStatus)}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {getPaymentTypeLabel(details.paymentType)}
                  </div>
                </div>
                <div className="rounded-2xl bg-muted/45 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Доставка
                  </div>
                  <div className="mt-2 font-bold">
                    {getDeliveryStatusLabel(details.deliveryStatus)}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {getDeliveryTypeLabel(details.deliveryType)}
                  </div>
                </div>
                <div className="rounded-2xl bg-muted/45 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Итого
                  </div>
                  <div className="mt-2 font-black text-[#05C3D4]">
                    {formatPrice(Number(details.totalPrice ?? 0))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/35 p-5">
                <h3 className="text-sm font-black uppercase tracking-wider">Оплата</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="text-sm">
                    <div className="text-muted-foreground">Статус</div>
                    <div className="font-semibold">{getPaymentStatusLabel(detailsAny?.paymentStatus)}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Способ</div>
                    <div className="font-semibold">{getPaymentTypeLabel(detailsAny?.paymentType)}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Сумма</div>
                    <div className="font-semibold">
                      {formatPrice(Number(detailsAny?.paidAmount || detailsAny?.totalPrice || 0))}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Дата оплаты</div>
                    <div className="font-semibold">{formatDateTime(detailsAny?.paidAt)}</div>
                  </div>
                  <div className="text-sm md:col-span-2">
                    <div className="text-muted-foreground">ID платежа</div>
                    <div className="font-semibold break-all">{detailsAny?.paymentId || "—"}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canDownloadReceipt}
                    onClick={() => {
                      if (receiptActionHref) window.open(receiptActionHref, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <Receipt size={16} className="mr-2" />
                    {canDownloadReceipt
                      ? "Скачать чек"
                      : receiptMeta.receiptStatus === "pending"
                      ? "Чек формируется"
                      : "Чек временно недоступен"}
                  </Button>
                  {!canDownloadReceipt && (
                    <Button asChild type="button" variant="outline">
                      <a href={supportTelegramHref} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} className="mr-2" />
                        Запросить чек в поддержке
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-2xl bg-muted/35 p-5">
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Состав заказа
                  </h3>
                  <div className="mt-4 space-y-3">
                    {details.items.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        В заказе пока нет позиций.
                      </div>
                    ) : (
                      details.items.map(item => (
                        <div key={item.id} className="rounded-2xl bg-background p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-semibold leading-snug">
                                {item.productName || `Товар #${item.productId}`}
                              </div>
                              {item.variantName ? (
                                <div className="mt-1 text-xs font-medium text-foreground/75">
                                  Вариант: {item.variantName}
                                </div>
                              ) : null}
                              <div className="mt-1 text-xs text-muted-foreground">
                                Артикул: {item.article || item.sku || "—"}
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {item.quantity} шт. × {formatPrice(item.price)}
                              </div>
                              {item.productId ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {myReviewsByProductId[item.productId]?.isVerifiedPurchase ? (
                                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                      Подтверждённая покупка
                                    </span>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setEditingReviewProductId(current =>
                                        current === item.productId ? null : item.productId
                                      )
                                    }
                                  >
                                    <Star size={14} className="mr-2" />
                                    {myReviewsByProductId[item.productId]
                                      ? "Редактировать отзыв"
                                      : "Оставить отзыв"}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <div className="text-sm font-bold text-[#05C3D4] whitespace-nowrap">
                              {formatPrice(item.total || item.price * item.quantity)}
                            </div>
                          </div>
                          {editingReviewProductId === item.productId && item.productId ? (
                            <div className="mt-4">
                              <ReviewComposer
                                compact
                                productId={item.productId}
                                productName={item.productName || `Товар #${item.productId}`}
                                verifiedPurchase
                                existingReview={myReviewsByProductId[item.productId] ?? undefined}
                                onSuccess={async () => {
                                  setEditingReviewProductId(null);
                                  await utils.reviews.myReviews.invalidate();
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl bg-muted/35 p-5">
                    <h3 className="text-sm font-black uppercase tracking-wider">
                      Доставка и оплата
                    </h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <Truck size={16} className="mt-0.5 text-[#05C3D4]" />
                        <div>
                          <div className="font-semibold">
                            {getDeliveryTypeLabel(details.deliveryType)}
                          </div>
                          <div className="text-muted-foreground">
                            {details.address || "Адрес не указан"}
                          </div>
                          {details.deliveryService && (
                            <div className="text-muted-foreground">
                              Служба: {details.deliveryService}
                            </div>
                          )}
                          {details.deliveryTrackNumber && (
                            <div className="text-muted-foreground">
                              Трек-номер: {details.deliveryTrackNumber}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CreditCard size={16} className="mt-0.5 text-[#05C3D4]" />
                        <div>
                          <div className="font-semibold">
                            {getPaymentTypeLabel(details.paymentType)}
                          </div>
                          <div className="text-muted-foreground">
                            {getPaymentStatusLabel(details.paymentStatus)}
                          </div>
                        </div>
                      </div>
                      {details.customerComment && (
                        <div className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                          <div className="mb-1 text-[10px] font-black uppercase tracking-widest">
                            Ваш комментарий к заказу
                          </div>
                          {details.customerComment}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-5">
                    <h3 className="text-sm font-black uppercase tracking-wider">
                      Написать по заказу
                    </h3>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={4}
                      className="mt-4 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-[#05C3D4]"
                      placeholder="Например: уточнить время доставки, попросить связаться или задать вопрос по заказу."
                    />
                    <Button
                      type="button"
                      onClick={() =>
                        addComment.mutate({
                          orderId: order.id,
                          comment: message,
                        })
                      }
                      disabled={message.trim().length === 0 || addComment.isPending}
                      className="mt-4 h-11 px-6"
                    >
                      {addComment.isPending ? (
                        <Loader2 className="mr-2 animate-spin" size={16} />
                      ) : (
                        <Send className="mr-2" size={16} />
                      )}
                      Отправить сообщение
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl bg-muted/35 p-5">
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Лента заказа
                  </h3>
                  <div className="mt-4 space-y-3">
                    {(feed?.history ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        История изменений пока пуста.
                      </div>
                    ) : (
                      (feed?.history ?? []).map(entry => (
                        <div key={`history-${entry.id}`} className="rounded-2xl bg-background p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">
                              {getOrderHistoryActionLabel(entry.actionType)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDateTime(entry.createdAt)}
                            </div>
                          </div>
                          {entry.comment && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              {entry.comment}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/35 p-5">
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Сообщения по заказу
                  </h3>
                  <div className="mt-4 space-y-3">
                    {(feed?.comments ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Сообщений пока нет.
                      </div>
                    ) : (
                      (feed?.comments ?? []).map(comment => (
                        <div key={`comment-${comment.id}`} className="rounded-2xl bg-background p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-2 text-sm font-semibold">
                              <MessageSquare size={16} className="text-[#05C3D4]" />
                              {comment.commentType === "client"
                                ? "Ваше сообщение"
                                : comment.commentType === "manager"
                                ? "Ответ менеджера"
                                : "Комментарий"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDateTime(comment.createdAt)}
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {comment.comment}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  useSeo({
    title: "Личный кабинет — ТЕХАКС",
    description: "Личный кабинет покупателя в интернет-магазине ТЕХАКС.",
    canonicalPath: "/account",
    noindex: true,
  });

  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const {
    data: orders = [],
    isLoading,
    error,
  } = trpc.ecommerce.getMyOrders.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const { data: myReviews = [] } = trpc.reviews.myReviews.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const myReviewsByProductId = useMemo(
    () =>
      Object.fromEntries(myReviews.map(review => [review.productId, review])) as Record<
        number,
        any
      >,
    [myReviews]
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <section className="bg-card border-b border-border py-16 md:py-24 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[40%] h-full bg-[#05C3D4]/5 blur-[120px] rounded-full" />
        <div className="container-main relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[2rem] bg-[#05C3D4] flex items-center justify-center text-black shadow-xl glow-cyan">
                <UserIcon size={40} />
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase font-heading tracking-tighter">
                  {user?.fullName}
                </h1>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-1">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-fit h-12 px-8 border-border text-muted-foreground hover:text-destructive hover:border-destructive/20 transition-all"
            >
              <LogOut size={16} className="mr-2" />
              ВЫЙТИ
            </Button>
          </div>
        </div>
      </section>

      <div className="container-main py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <Package size={20} className="text-[#05C3D4]" />
              <h2 className="text-xl font-black uppercase font-heading tracking-tight">
                История заказов
              </h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#05C3D4]" size={32} />
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                Не удалось загрузить историю заказов: {error.message}
              </div>
            ) : orders.length === 0 ? (
              <div className="p-12 bg-card rounded-3xl border border-border text-center space-y-6">
                <ShoppingBag
                  size={48}
                  className="mx-auto text-muted-foreground/20"
                />
                <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">
                  У вас пока нет заказов
                </p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Перейдите в каталог и выберите аксессуары для телефона, авто или гаджета.
                </p>
                <Link
                  to="/catalog"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-border px-10 text-sm font-bold"
                >
                  Перейти в каталог
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <AccountOrderCard
                    key={order.id}
                    order={order as AccountOrder}
                    expanded={expandedOrderId === order.id}
                    onToggle={() =>
                      setExpandedOrderId(current =>
                        current === order.id ? null : order.id
                      )
                    }
                    myReviewsByProductId={myReviewsByProductId}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-8">
              <div className="flex items-center gap-3">
                <Star size={18} className="text-[#05C3D4]" />
                <h3 className="text-lg font-black uppercase tracking-tight">
                  Мои отзывы
                </h3>
              </div>
              <div className="mt-5 space-y-3">
                {myReviews.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Отзывов пока нет. Их удобно оставлять прямо из состава заказа.
                  </div>
                ) : (
                  myReviews.slice(0, 4).map(review => (
                    <Link
                      key={review.id}
                      to={`/product/${review.productSlug}#reviews`}
                      className="block rounded-2xl border border-border p-4 transition hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold leading-snug text-[#15171A]">
                          {review.productName}
                        </div>
                        <div className="text-sm font-black text-[#05C3D4]">
                          {review.rating}/5
                        </div>
                      </div>
                      <div className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        {review.status === "pending_moderation"
                          ? "На модерации"
                          : review.status === "published"
                          ? "Опубликован"
                          : review.status === "rejected"
                          ? "Отклонён"
                          : review.status === "hidden"
                          ? "Скрыт"
                          : review.status}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <Can I="read" a="AdminPanel">
              <Link to="/admin" className="block">
                <div className="p-8 bg-black text-white rounded-3xl relative overflow-hidden group border border-border shadow-xl">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black uppercase font-heading tracking-tight leading-none text-[#05C3D4]">
                        Админ Панель
                      </h3>
                      <p className="mt-2 text-sm font-medium text-white/60">
                        Управление магазином
                      </p>
                    </div>
                    <Settings
                      className="text-[#05C3D4] group-hover:rotate-90 transition-transform duration-500"
                      size={32}
                    />
                  </div>
                </div>
              </Link>
            </Can>

            <div className="p-8 bg-[#05C3D4] rounded-3xl text-black relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xl font-black uppercase font-heading tracking-tight leading-none">
                  ТЕХАКС <br /> ПРИВИЛЕГИИ
                </h3>
                <p className="mt-4 text-sm font-bold text-black/60 leading-relaxed">
                  Ваша персональная скидка 5% на все аксессуары активна.
                </p>
                <div className="mt-8 text-[10px] font-black uppercase tracking-widest py-2 px-4 bg-black/10 rounded-lg w-fit">
                  СТАТУС: ПОСТОЯННЫЙ КЛИЕНТ
                </div>
              </div>
              <Star
                size={120}
                className="absolute -bottom-10 -right-10 text-black/10 transform rotate-12 group-hover:scale-110 transition-transform duration-700"
              />
            </div>

            <div className="p-8 bg-muted rounded-3xl border border-border">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6">
                Поддержка
              </h3>
              <p className="mb-5 text-sm text-muted-foreground">
                Поможем с оплатой, чеком и статусом заказа.
              </p>
              <div className="space-y-3">
                <a
                  href="tel:+79273750555"
                  className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-sm font-bold transition-colors hover:text-[#05C3D4]"
                >
                  <span>Позвонить нам</span>
                  <ChevronRight size={16} />
                </a>
                <a
                  href="https://t.me/tech_aks"
                  target="_blank"
                  className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-sm font-bold transition-colors hover:text-[#05C3D4]"
                  rel="noreferrer"
                >
                  <span>Написать в Telegram</span>
                  <ChevronRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
