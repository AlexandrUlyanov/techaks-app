import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Heart,
  Loader2,
  LogOut,
  MessageSquare,
  Package,
  Receipt,
  Send,
  Settings,
  ShoppingBag,
  Star,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useSeo } from "@/lib/seo";
import { trackOrderMessage } from "@/lib/yandex-metrika";
import { trpc } from "@/providers/trpc";
import { Can } from "@/providers/AbilityProvider";
import ReviewComposer from "@/components/reviews/ReviewComposer";
import ProductCard from "@/components/ProductCard";

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
  if (type === "yookassa") return "Онлайн-оплата";
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
    showRepeat: false,
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
        trackOrderMessage({
          orderId: String(order.id),
        });
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
  const receiptMetaFromBackend =
    detailsAny?.receiptUrl || detailsAny?.receiptPdfUrl || detailsAny?.receiptStatus
      ? {
          receiptUrl:
            typeof detailsAny?.receiptUrl === "string" ? detailsAny.receiptUrl : undefined,
          receiptPdfUrl:
            typeof detailsAny?.receiptPdfUrl === "string"
              ? detailsAny.receiptPdfUrl
              : undefined,
          receiptStatus:
            detailsAny?.receiptStatus === "ready" ||
            detailsAny?.receiptStatus === "pending" ||
            detailsAny?.receiptStatus === "failed" ||
            detailsAny?.receiptStatus === "not_required"
              ? detailsAny.receiptStatus
              : "not_required",
        }
      : null;
  const receiptMeta = receiptMetaFromBackend ?? extractReceiptMeta(detailsAny?.paymentRawResponseJson);
  const canDownloadReceipt = Boolean(receiptMeta.receiptPdfUrl || receiptMeta.receiptUrl);
  const receiptActionHref = receiptMeta.receiptPdfUrl || receiptMeta.receiptUrl;
  const orderNumberLabel = order.orderNumber || `#${order.id}`;
  const openOrderConversation = () => {
    const target = document.getElementById(`order-conversation-${order.id}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
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
    <article className="rounded-[2rem] bg-card/95">
      <button type="button" onClick={onToggle} className="w-full px-6 py-6 text-left md:px-8 md:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-black uppercase tracking-[0.16em]">Заказ {orderNumberLabel}</span>
              <span className="hidden sm:inline">•</span>
              <span className="font-medium">{formatDate(order.createdAt)}</span>
              {hasUnreadManagerReply && (
                <span className="inline-flex h-6 items-center rounded-full bg-amber-500/95 px-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                  Новый ответ
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${listPaymentTone.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${listPaymentTone.dot}`} />
                {getPaymentStatusLabel(order.paymentStatus)}
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                Статус заказа: {getOrderStatusLabel(order.status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getDeliveryTypeLabel(order.deliveryType)} · {getPaymentTypeLabel(order.paymentType)}
            </p>
          </div>
          <div className="space-y-1 text-left lg:text-right">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Сумма
            </p>
            <p className="text-3xl font-black leading-none tracking-tight text-[#05C3D4]">
              {formatPrice(order.totalPrice)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {expanded ? "Свернуть детали заказа" : "Открыть детали заказа"}
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#05C3D4]">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? "Свернуть" : "Подробнее"}
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
            <div className="space-y-8 pt-8">
              <div className="flex flex-wrap gap-2">
                  {actions.showReceipt ? (
                    <Button
                      type="button"
                      onClick={() => {
                        if (receiptActionHref) window.open(receiptActionHref, "_blank", "noopener,noreferrer");
                      }}
                      className="w-full rounded-full bg-[#05C3D4] text-black sm:w-auto"
                    >
                      <Receipt size={16} className="mr-2" />
                      Открыть чек
                    </Button>
                  ) : actions.showPay ? (
                    <Button type="button" disabled className="w-full rounded-full sm:w-auto">
                      Оплатить заказ
                    </Button>
                  ) : actions.showReceiptPending ? (
                    <Button type="button" variant="outline" disabled className="w-full rounded-full sm:w-auto">
                      Чек формируется
                    </Button>
                  ) : null}
                  {actions.showSupport ? (
                    <Button type="button" variant="ghost" className="w-full rounded-full sm:w-auto" onClick={openOrderConversation}>
                      <MessageSquare size={16} className="mr-2" />
                      Написать по заказу
                    </Button>
                  ) : null}
                  {actions.showReview ? (
                    <Button type="button" variant="ghost" className="w-full rounded-full sm:w-auto">
                      <MessageSquare size={16} className="mr-2" />
                      Оставить отзыв
                    </Button>
                  ) : null}
              </div>

              {compatibilityWarnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="font-semibold">Режим совместимости</div>
                  <ul className="mt-2 space-y-1">
                    {compatibilityWarnings.map(warning => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.95fr)]">
                <div className="space-y-8">
                  <section className="rounded-[1.75rem] bg-muted/30 p-5 md:p-6">
                    <h3 className="text-lg font-black tracking-tight">Состав заказа</h3>
                    <div className="mt-4 space-y-3">
                      {details.items.length === 0 ? (
                        <div className="text-sm text-muted-foreground">В заказе пока нет позиций.</div>
                      ) : (
                        details.items.map(item => (
                          <div key={item.id} className="rounded-2xl bg-background/90 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-semibold leading-snug">
                                  {item.productName || `Товар #${item.productId}`}
                                </div>
                                {item.variantName ? (
                                  <div className="mt-1 text-xs font-medium text-foreground/75">Вариант: {item.variantName}</div>
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
                                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                        Подтверждённая покупка
                                      </span>
                                    ) : null}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setEditingReviewProductId(current =>
                                          current === item.productId ? null : item.productId
                                        )
                                      }
                                    >
                                      <Star size={14} className="mr-2" />
                                      {myReviewsByProductId[item.productId] ? "Редактировать отзыв" : "Оставить отзыв"}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                              <div className="text-sm font-bold whitespace-nowrap text-[#05C3D4]">
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
                  </section>

                  <section className="rounded-[1.75rem] bg-muted/25 p-5 md:p-6">
                    <h3 className="text-lg font-black tracking-tight">Лента заказа</h3>
                    {(feed?.history ?? []).length === 0 ? (
                      <div className="mt-4 text-sm text-muted-foreground">История изменений пока пуста.</div>
                    ) : (
                      <ul className="mt-4 divide-y divide-border/60">
                        {(feed?.history ?? []).map(entry => (
                          <li key={`history-${entry.id}`} className="py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="font-semibold">{getOrderHistoryActionLabel(entry.actionType)}</div>
                              <div className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</div>
                            </div>
                            {entry.comment ? (
                              <div className="mt-1 text-sm text-muted-foreground">{entry.comment}</div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="rounded-[1.75rem] bg-muted/25 p-5 md:p-6">
                    <h3 className="text-lg font-black tracking-tight">Сообщения по заказу</h3>
                    {(feed?.comments ?? []).length === 0 ? (
                      <div className="mt-4 text-sm text-muted-foreground">
                        Сообщений пока нет. Если у вас есть вопрос по заказу, напишите нам через форму выше.
                      </div>
                    ) : (
                      <ul className="mt-4 divide-y divide-border/60">
                        {(feed?.comments ?? []).map(comment => (
                          <li key={`comment-${comment.id}`} className="py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                <MessageSquare size={16} className="text-[#05C3D4]" />
                                {comment.commentType === "client"
                                  ? "Ваше сообщение"
                                  : comment.commentType === "manager"
                                  ? "Ответ менеджера"
                                  : "Комментарий"}
                              </div>
                              <div className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</div>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">{comment.comment}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-[1.75rem] bg-muted/30 p-5 md:p-6">
                    <h3 className="text-lg font-black tracking-tight">Оплата</h3>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-muted-foreground">Статус оплаты</div>
                        <div className="font-semibold">{getPaymentStatusLabel(detailsAny?.paymentStatus)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Способ оплаты</div>
                        <div className="font-semibold">{getPaymentTypeLabel(detailsAny?.paymentType)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Сумма оплаты</div>
                        <div className="font-semibold">{formatPrice(Number(detailsAny?.paidAmount || detailsAny?.totalPrice || 0))}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Дата оплаты</div>
                        <div className="font-semibold">{formatDateTime(detailsAny?.paidAt)}</div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-muted-foreground">ID платежа</div>
                        <div className="break-all font-semibold">{detailsAny?.paymentId || "—"}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canDownloadReceipt}
                        onClick={() => {
                          if (receiptActionHref) window.open(receiptActionHref, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <Receipt size={16} className="mr-2" />
                        {canDownloadReceipt ? "Открыть чек" : "Чек недоступен"}
                      </Button>
                      {!canDownloadReceipt ? (
                        <Button type="button" variant="ghost" onClick={openOrderConversation}>
                          <ExternalLink size={16} className="mr-2" />
                          Запросить чек
                        </Button>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-[1.75rem] bg-muted/30 p-5 md:p-6">
                    <h3 className="text-lg font-black tracking-tight">Получение заказа</h3>
                    <div className="mt-4 space-y-4 text-sm">
                      <div className="flex items-start gap-3">
                        <Truck size={16} className="mt-0.5 text-[#05C3D4]" />
                        <div>
                          <div className="font-semibold">{getDeliveryTypeLabel(details.deliveryType)}</div>
                          <div className="text-muted-foreground">{details.address || "Адрес не указан"}</div>
                          {details.deliveryService ? (
                            <div className="text-muted-foreground">Служба: {details.deliveryService}</div>
                          ) : null}
                          {details.deliveryTrackNumber ? (
                            <div className="text-muted-foreground">Трек-номер: {details.deliveryTrackNumber}</div>
                          ) : null}
                        </div>
                      </div>
                      {details.customerComment ? (
                        <div className="rounded-xl bg-background/90 p-3 text-sm text-muted-foreground">
                          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em]">Ваш комментарий</div>
                          {details.customerComment}
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section id={`order-conversation-${order.id}`} className="rounded-[1.75rem] bg-muted/30 p-5 md:p-6">
                    <h3 className="text-lg font-black tracking-tight">Написать по заказу</h3>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={4}
                      className="mt-4 w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-border/70 transition focus:ring-2 focus:ring-[#05C3D4]/50"
                      placeholder="Например: уточнить время доставки, запросить чек или задать вопрос по заказу."
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
                      className="mt-4 h-11 rounded-full px-6"
                    >
                      {addComment.isPending ? (
                        <Loader2 className="mr-2 animate-spin" size={16} />
                      ) : (
                        <Send className="mr-2" size={16} />
                      )}
                      Отправить сообщение
                    </Button>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
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
  const { data: favoriteProducts = [] } = trpc.user.getFavorites.useQuery(undefined, {
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
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <section className="pb-6 pt-8 md:pb-8 md:pt-10">
        <div className="container-main">
          <div className="rounded-[2rem] bg-muted/30 px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-[#05C3D4]/15 text-[#05C3D4]">
                  <UserIcon size={28} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                    Личный кабинет
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                    {user?.fullName}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="h-11 w-fit rounded-full px-6 text-muted-foreground"
              >
                <LogOut size={16} className="mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container-main py-10 md:py-12">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="flex items-center gap-3">
              <Package size={18} className="text-[#05C3D4]" />
              <h2 className="text-xl font-black tracking-tight">История заказов</h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#05C3D4]" size={30} />
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">
                Не удалось загрузить историю заказов: {error.message}
              </div>
            ) : orders.length === 0 ? (
              <div className="space-y-4 rounded-[1.75rem] bg-muted/30 p-10 text-center">
                <ShoppingBag size={44} className="mx-auto text-muted-foreground/25" />
                <p className="text-sm font-semibold text-muted-foreground">У вас пока нет заказов</p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Перейдите в каталог и выберите аксессуары для телефона, авто или гаджета.
                </p>
                <Link
                  to="/catalog"
                  className="mx-auto inline-flex h-11 items-center justify-center rounded-full bg-[#05C3D4] px-8 text-sm font-bold text-black"
                >
                  Перейти в каталог
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                {orders.map(order => (
                  <AccountOrderCard
                    key={order.id}
                    order={order as AccountOrder}
                    expanded={expandedOrderId === order.id}
                    onToggle={() =>
                      setExpandedOrderId(current => (current === order.id ? null : order.id))
                    }
                    myReviewsByProductId={myReviewsByProductId}
                  />
                ))}
              </div>
            )}

            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <Heart size={18} className="text-[#05C3D4]" />
                <h2 className="text-xl font-black tracking-tight">Избранное</h2>
              </div>

              {favoriteProducts.length === 0 ? (
                <div className="rounded-[1.75rem] bg-muted/25 p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Вы пока ничего не добавили в избранное
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Сохраняйте товары сердечком в каталоге, и они появятся здесь.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {favoriteProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="rounded-[1.75rem] bg-muted/25 p-6">
              <div className="flex items-center gap-2">
                <Star size={18} className="text-[#05C3D4]" />
                <h3 className="text-base font-black tracking-tight">Мои отзывы</h3>
              </div>
              <div className="mt-4 space-y-2.5">
                {myReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Отзывов пока нет. Их удобно оставлять прямо из состава заказа.
                  </p>
                ) : (
                  myReviews.slice(0, 4).map(review => (
                    <Link
                      key={review.id}
                      to={`/product/${review.productSlug}#reviews`}
                      className="block rounded-xl bg-background/85 px-4 py-3 transition-colors hover:bg-background"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="line-clamp-2 text-sm font-semibold leading-snug">{review.productName}</div>
                        <div className="text-xs font-black text-[#05C3D4]">{review.rating}/5</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
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
            </section>

            <Can I="read" a="AdminPanel">
              <Link to="/admin" className="block rounded-[1.75rem] bg-muted/25 p-6 transition-colors hover:bg-muted/35">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Служебный доступ</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight">Админ-панель</h3>
                  </div>
                  <Settings size={24} className="text-[#05C3D4]" />
                </div>
              </Link>
            </Can>

            <section className="rounded-[1.75rem] bg-muted/25 p-6">
              <h3 className="text-base font-black tracking-tight">Техакс привилегии</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Ваша персональная скидка 5% на аксессуары активна.
              </p>
              <div className="mt-4 inline-flex rounded-full bg-[#05C3D4]/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#047f8b]">
                Статус: постоянный клиент
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-muted/25 p-6">
              <h3 className="text-base font-black tracking-tight">Поддержка</h3>
              <p className="mt-3 text-sm text-muted-foreground">Поможем с оплатой, чеком и статусом заказа.</p>
              <div className="mt-4 space-y-2.5">
                <a
                  href="tel:+79273750555"
                  className="flex items-center justify-between rounded-xl bg-background/90 px-4 py-3 text-sm font-semibold transition-colors hover:bg-background hover:text-[#05C3D4]"
                >
                  <span>Позвонить нам</span>
                  <ChevronRight size={16} />
                </a>
                <div className="rounded-xl bg-background/90 px-4 py-3 text-sm text-muted-foreground">
                  Для вопросов по заказу используйте внутреннюю переписку в карточке заказа.
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
