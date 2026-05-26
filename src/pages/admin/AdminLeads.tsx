import { trpc } from "@/providers/trpc";
import { Link } from "react-router";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAbility } from "@/providers/AbilityProvider";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "pending", label: "Новый" },
  { value: "waiting_call", label: "Ждёт звонка" },
  { value: "confirmed", label: "Подтвержден" },
  { value: "processing", label: "В обработке" },
  { value: "assembling", label: "Собирается" },
  { value: "awaiting_dispatch", label: "Ожидает отправки" },
  { value: "in_delivery", label: "Доставляется" },
  { value: "delivered", label: "Доставлен" },
  { value: "completed", label: "Выполнен" },
  { value: "cancelled", label: "Отменен" },
  { value: "problem", label: "Проблемный" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Любая оплата" },
  { value: "unpaid", label: "Не оплачен" },
  { value: "awaiting_payment", label: "Ожидает оплаты" },
  { value: "paid", label: "Оплачен" },
  { value: "payment_error", label: "Ошибка оплаты" },
  { value: "refund", label: "Возврат" },
];

const DELIVERY_TYPE_OPTIONS = [
  { value: "", label: "Любая доставка" },
  { value: "pickup", label: "Самовывоз" },
  { value: "delivery", label: "Курьер/доставка" },
];

const LIMIT_OPTIONS = [25, 50, 100];

type QuickTabKey =
  | "all"
  | "new"
  | "awaiting_payment"
  | "paid"
  | "assembly"
  | "in_delivery"
  | "needs_response"
  | "unread_messages"
  | "completed"
  | "cancelled"
  | "problem";

const QUICK_TABS: Array<{ key: QuickTabKey; label: string }> = [
  { key: "all", label: "Все заказы" },
  { key: "new", label: "Новые" },
  { key: "awaiting_payment", label: "Ожидают оплаты" },
  { key: "paid", label: "Оплаченные" },
  { key: "assembly", label: "К сборке" },
  { key: "in_delivery", label: "В доставке" },
  { key: "needs_response", label: "Требуют ответа" },
  { key: "unread_messages", label: "Новые сообщения" },
  { key: "completed", label: "Выполненные" },
  { key: "cancelled", label: "Отмененные" },
  { key: "problem", label: "Проблемные" },
];

function OrderStatusPill({ status }: { status: string }) {
  const getStatusInfo = (value: string) => {
    switch (value) {
      case "new":
      case "pending":
        return { label: "Новый", color: "bg-blue-100 text-blue-700", icon: Clock };
      case "waiting_call":
        return {
          label: "Ждёт звонка",
          color: "bg-fuchsia-100 text-fuchsia-700",
          icon: Phone,
        };
      case "confirmed":
        return {
          label: "Подтвержден",
          color: "bg-cyan-100 text-cyan-700",
          icon: CheckCircle2,
        };
      case "awaiting_payment":
        return {
          label: "Ожидает оплаты",
          color: "bg-orange-100 text-orange-700",
          icon: Wallet,
        };
      case "paid":
        return {
          label: "Оплачен",
          color: "bg-emerald-100 text-emerald-700",
          icon: Wallet,
        };
      case "shipped":
        return { label: "Отгружен", color: "bg-yellow-100 text-yellow-700", icon: Truck };
      case "handed_to_delivery":
        return {
          label: "Передан в доставку",
          color: "bg-sky-100 text-sky-700",
          icon: Truck,
        };
      case "delivered":
        return {
          label: "Доставлен",
          color: "bg-green-100 text-green-700",
          icon: CheckCircle2,
        };
      case "cancelled":
        return { label: "Отменен", color: "bg-red-100 text-red-700", icon: XCircle };
      case "processing":
        return {
          label: "В обработке",
          color: "bg-indigo-100 text-indigo-700",
          icon: Clock,
        };
      case "assembling":
        return {
          label: "Собирается",
          color: "bg-violet-100 text-violet-700",
          icon: Package,
        };
      case "assembled":
        return {
          label: "Собран",
          color: "bg-purple-100 text-purple-700",
          icon: Package,
        };
      case "ready_for_pickup":
        return {
          label: "Готов к выдаче",
          color: "bg-teal-100 text-teal-700",
          icon: Package,
        };
      case "confirmed_by_customer":
        return {
          label: "Подтверждён клиентом",
          color: "bg-cyan-100 text-cyan-700",
          icon: CheckCircle2,
        };
      case "awaiting_dispatch":
        return {
          label: "Ожидает отправки",
          color: "bg-amber-100 text-amber-700",
          icon: Truck,
        };
      case "in_delivery":
        return {
          label: "Доставляется",
          color: "bg-sky-100 text-sky-700",
          icon: Truck,
        };
      case "completed":
        return {
          label: "Выполнен",
          color: "bg-emerald-100 text-emerald-700",
          icon: CheckCircle2,
        };
      case "return_requested":
        return {
          label: "Запрошен возврат",
          color: "bg-rose-100 text-rose-700",
          icon: RotateCcw,
        };
      case "problem":
        return { label: "Проблемный", color: "bg-rose-100 text-rose-700", icon: XCircle };
      default:
        return { label: value, color: "bg-gray-100 text-gray-700", icon: Clock };
    }
  };

  const info = getStatusInfo(status);
  const Icon = info.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${info.color}`}
    >
      <Icon size={13} />
      {info.label}
    </span>
  );
}

export default function AdminLeads() {
  const ability = useAbility();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState("");
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(1);
  const [quickTab, setQuickTab] = useState<QuickTabKey>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState("processing");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const offset = (page - 1) * limit;
  const queryInput = useMemo(
    () => ({
      limit,
      offset,
      search: search.trim() || undefined,
      statuses:
        quickTab === "new"
          ? ["pending"]
          : quickTab === "assembly"
            ? ["ready_for_pickup", "assembling", "assembled"]
            : quickTab === "in_delivery"
              ? ["shipped", "in_delivery", "delivered"]
              : quickTab === "completed"
                ? ["completed"]
                : quickTab === "cancelled"
                  ? ["cancelled"]
                  : quickTab === "problem"
                    ? ["problem"]
                    : statusFilter
                      ? [statusFilter]
                      : undefined,
      paymentStatuses:
        quickTab === "awaiting_payment"
          ? ["awaiting_payment", "unpaid"]
          : quickTab === "paid"
            ? ["paid", "partially_paid"]
            : paymentFilter
              ? [paymentFilter]
              : undefined,
      deliveryTypes: deliveryTypeFilter ? [deliveryTypeFilter] : undefined,
      conversationState:
        quickTab === "needs_response"
          ? ("needs_response" as const)
          : quickTab === "unread_messages"
            ? ("unread" as const)
            : undefined,
    }),
    [
      limit,
      offset,
      search,
      statusFilter,
      paymentFilter,
      deliveryTypeFilter,
      quickTab,
    ]
  );

  const { data, isLoading, error } = trpc.ecommerce.listOrders.useQuery(queryInput);

  const updateStatusMutation = trpc.ecommerce.updateOrderStatus.useMutation({
    onSuccess: async () => {
      await utils.ecommerce.listOrders.invalidate();
      toast.success("Статус заказа обновлен");
    },
    onError: err => toast.error(err.message || "Ошибка обновления статуса"),
  });
  const bulkStatusMutation = trpc.ecommerce.bulkUpdateOrderStatus.useMutation({
    onSuccess: async result => {
      setSelectedIds([]);
      await utils.ecommerce.listOrders.invalidate();
      toast.success(`Обновлено заказов: ${result.updated}`);
    },
    onError: err => toast.error(err.message || "Ошибка массового обновления"),
  });
  const deleteOrderMutation = trpc.ecommerce.deleteOrder.useMutation({
    onSuccess: async result => {
      setSelectedIds(prev => prev.filter(id => id !== result.deletedOrderId));
      await utils.ecommerce.listOrders.invalidate();
      toast.success(`Заказ ${result.orderNumber} удалён`);
    },
    onError: err => toast.error(err.message || "Ошибка удаления заказа"),
  });

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const compatibilityWarnings = data?.compatibilityWarnings ?? [];
  const selectedOrders = orders.filter(order => selectedIds.includes(order.id));
  const hasSelectedMoyskladManagedOrders = selectedOrders.some(
    order => Boolean((order as any).moyskladOrderId || (order as any).moyskladOrderHref)
  );

  const pendingConversations = orders.filter(order => {
    const clientCommentsCount = Number((order as any).clientCommentsCount ?? 0);
    const latestClientCommentAt = (order as any).latestClientCommentAt
      ? new Date((order as any).latestClientCommentAt).getTime()
      : 0;
    const latestManagerCommentAt = (order as any).latestManagerCommentAt
      ? new Date((order as any).latestManagerCommentAt).getTime()
      : 0;

    return (
      clientCommentsCount > 0 &&
      latestClientCommentAt > 0 &&
      latestClientCommentAt >= latestManagerCommentAt
    );
  }).length;
  const unreadConversations = orders.filter(order => {
    const latestClientCommentAt = (order as any).latestClientCommentAt
      ? new Date((order as any).latestClientCommentAt).getTime()
      : 0;
    const latestAdminReadClientAt = (order as any).latestAdminReadClientAt
      ? new Date((order as any).latestAdminReadClientAt).getTime()
      : 0;
    return latestClientCommentAt > 0 && latestClientCommentAt > latestAdminReadClientAt;
  }).length;

  const deliveryOrders = orders.filter(order => order.deliveryType === "delivery").length;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  const formatDateTime = (value: string | Date | null | undefined) =>
    value ? new Date(value).toLocaleString("ru-RU") : "Дата не указана";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Ошибка загрузки заказов: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Операции"
        title="Заказы"
        description="Рабочая очередь менеджера: статусы, переписка, оплата, доставка и быстрый переход в карточку заказа."
        meta={
          <div className="flex flex-wrap gap-2">
            {compatibilityWarnings.length > 0 ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                Режим совместимости активен
              </span>
            ) : null}
            {selectedIds.length > 0 ? (
              <span className="inline-flex items-center rounded-full border border-[#05C3D4]/20 bg-[#F7FEFF] px-3 py-1 text-xs font-bold text-[#0099A8]">
                Выбрано: {selectedIds.length}
              </span>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Всего заказов"
          value={total}
          hint={`Страница ${page} из ${totalPages}`}
          icon={ShoppingBag}
          tone="accent"
        />
        <AdminStatCard
          label="Новые и ожидают"
          value={
            orders.filter(order =>
              ["pending", "waiting_call", "awaiting_payment", "processing"].includes(
                order.status
              )
            ).length
          }
          hint="Текущая выборка"
          icon={Clock}
        />
        <AdminStatCard
          label="Ждут ответа"
          value={pendingConversations}
          hint={`Новых сообщений: ${unreadConversations}`}
          icon={MessageSquare}
          tone={pendingConversations > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Доставка"
          value={deliveryOrders}
          hint="Заказы с курьерской доставкой"
          icon={Truck}
        />
      </div>

      {compatibilityWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="font-semibold">Режим совместимости заказов</div>
          <ul className="mt-2 space-y-1">
            {compatibilityWarnings.map(warning => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <AdminSection
        title="Поиск и фильтры"
        description="Сначала находите нужные заказы по номеру, клиенту или быстрым сценариям. Расширенные фильтры разворачивайте только когда они действительно нужны."
        actions={
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(prev => !prev)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
          >
            <Filter size={16} />
            {showAdvancedFilters ? "Скрыть фильтры" : "Расширенные фильтры"}
            <ChevronDown
              size={16}
              className={`transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`}
            />
          </button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Поиск: №, телефон, email, SKU, трек..."
                className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
              />
            </label>
            <select
              value={limit}
              onChange={e => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            >
              {LIMIT_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size} / стр
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setQuickTab(tab.key);
                  setPage(1);
                }}
                className={`h-10 rounded-xl px-4 text-xs font-bold uppercase tracking-wider transition-colors ${
                  quickTab === tab.key
                    ? "bg-[#05C3D4] text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-[#05C3D4] hover:text-[#05C3D4]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {showAdvancedFilters ? (
            <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 lg:grid-cols-3">
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              >
                {ORDER_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={paymentFilter}
                onChange={e => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              >
                {PAYMENT_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={deliveryTypeFilter}
                onChange={e => {
                  setDeliveryTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              >
                {DELIVERY_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection
        title="Массовые действия"
        description="Эта зона становится полезной только когда выбраны конкретные заказы. Обычная навигация и работа со списком не должны от неё зависеть."
        tone="subtle"
        actions={
          <div className="text-sm font-semibold text-gray-500">
            Выбрано: {selectedIds.length}
          </div>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-gray-600">
            Меняйте статус сразу у группы заказов, когда это действительно нужно.
            Заказы, уже связанные с МойСклад, обновляют статус только оттуда.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            >
              <option value="processing">В обработке</option>
              <option value="waiting_call">Ждёт звонка</option>
              <option value="assembling">Собирается</option>
              <option value="awaiting_dispatch">Ожидает отправки</option>
              <option value="in_delivery">Доставляется</option>
              <option value="completed">Выполнен</option>
              <option value="cancelled">Отменен</option>
              <option value="problem">Проблемный</option>
            </select>
            <button
              type="button"
              onClick={() =>
                bulkStatusMutation.mutate({ orderIds: selectedIds, status: bulkStatus })
              }
              disabled={
                selectedIds.length === 0 ||
                bulkStatusMutation.isPending ||
                hasSelectedMoyskladManagedOrders
              }
              className="h-10 rounded-xl bg-[#05C3D4] px-4 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
            >
              Применить массово
            </button>
          </div>
        </div>
        {hasSelectedMoyskladManagedOrders ? (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            В выборке есть заказы, синхронизированные с МойСклад. Их статусы нужно менять в МойСклад.
          </div>
        ) : null}
      </AdminSection>

      <div className="grid grid-cols-1 gap-4">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-500 shadow-sm">
            Заказов пока нет
          </div>
        ) : (
          orders.map(order => {
            const isStatusManagedByMoysklad = Boolean(
              (order as any).moyskladOrderId || (order as any).moyskladOrderHref
            );
            const clientCommentsCount = Number((order as any).clientCommentsCount ?? 0);
            const latestClientCommentAt = (order as any).latestClientCommentAt
              ? new Date((order as any).latestClientCommentAt).getTime()
              : 0;
            const latestManagerCommentAt = (order as any).latestManagerCommentAt
              ? new Date((order as any).latestManagerCommentAt).getTime()
              : 0;
            const latestAdminReadClientAt = (order as any).latestAdminReadClientAt
              ? new Date((order as any).latestAdminReadClientAt).getTime()
              : 0;
            const hasPendingCustomerMessage =
              clientCommentsCount > 0 &&
              latestClientCommentAt > 0 &&
              latestClientCommentAt >= latestManagerCommentAt;
            const hasUnreadCustomerMessage =
              latestClientCommentAt > 0 && latestClientCommentAt > latestAdminReadClientAt;

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-[#05C3D4]/30"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(order.id)}
                          onChange={e =>
                            setSelectedIds(prev =>
                              e.target.checked
                                ? [...prev, order.id]
                                : prev.filter(id => id !== order.id)
                            )
                          }
                        />
                        <span className="text-xs font-semibold text-gray-500">Выбрать</span>
                      </label>

                      <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <ShoppingBag size={15} className="text-gray-400" />
                        <span className="text-sm font-black text-[#15171A]">
                          Заказ {order.orderNumber || `#${order.id}`}
                        </span>
                      </div>

                      <OrderStatusPill status={order.status} />

                      {isStatusManagedByMoysklad ? (
                        <span className="rounded-full border border-[#05C3D4]/20 bg-[#F7FEFF] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0099A8]">
                          Статус из МойСклад
                        </span>
                      ) : null}

                      {order.source === "legacy" ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                          Совместимость
                        </span>
                      ) : order.source === "one_click" ? (
                        <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-fuchsia-700">
                          Заказ в 1 клик
                        </span>
                      ) : order.source === "reservation" ? (
                        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-700">
                          Из резерва
                        </span>
                      ) : null}

                      {clientCommentsCount > 0 ? (
                        <Link
                          to={`/admin/leads/${order.id}`}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                            hasPendingCustomerMessage
                              ? "border border-amber-200 bg-amber-50 text-amber-700"
                              : "border border-sky-200 bg-sky-50 text-sky-700"
                          }`}
                          title="Клиент написал сообщение по заказу"
                        >
                          <MessageSquare size={14} />
                          {hasPendingCustomerMessage ? "Ждёт ответа" : "Есть переписка"}
                        </Link>
                      ) : null}

                      {hasUnreadCustomerMessage ? (
                        <Link
                          to={`/admin/leads/${order.id}`}
                          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-white"
                          title="Менеджер ещё не открывал последнее сообщение клиента"
                        >
                          <MessageSquare size={14} />
                          Новое сообщение
                        </Link>
                      ) : null}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                          Клиент
                        </div>
                        <div className="mt-2 text-base font-black text-[#15171A]">
                          {order.customerName || "Клиент не указан"}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-gray-500">
                          <div>{order.customerEmail || "Электронная почта не указана"}</div>
                          {order.customerPhone ? (
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="inline-flex items-center gap-2 text-[#0099A8] hover:text-[#05C3D4]"
                            >
                              <Phone size={14} />
                              {order.customerPhone}
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                          Сумма и состав
                        </div>
                        <div className="mt-2 text-2xl font-black text-[#05C3D4]">
                          {formatPrice(order.totalPrice)}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          Позиций: {order.itemsCount}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-5 text-xs text-gray-500">
                      <div className="inline-flex items-center gap-2">
                        <Calendar size={14} />
                        {formatDateTime(order.createdAt)}
                      </div>
                      <div className="inline-flex items-center gap-2">
                        {order.deliveryType === "delivery" ? (
                          <>
                            <Truck size={14} />
                            {order.deliveryStatus
                              ? `Доставка · ${order.deliveryStatus}`
                              : "Доставка · Не задано"}
                          </>
                        ) : (
                          <>
                            <Package size={14} />
                            Самовывоз
                          </>
                        )}
                      </div>
                      {order.address ? (
                        <div className="inline-flex items-center gap-2">
                          <MapPin size={14} />
                          {order.address}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 xl:min-w-[240px] xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                    <Link
                      to={`/admin/leads/${order.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 px-3 text-xs font-bold uppercase tracking-wider text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
                    >
                      Открыть заказ
                    </Link>

                    <select
                      value={order.status}
                      onChange={e =>
                        updateStatusMutation.mutate({
                          id: order.id,
                          status: e.target.value as
                            | "pending"
                            | "confirmed"
                            | "shipped"
                            | "delivered"
                            | "cancelled"
                            | "processing"
                            | "assembling"
                            | "awaiting_dispatch"
                            | "in_delivery"
                            | "completed"
                            | "problem",
                        })
                      }
                      disabled={updateStatusMutation.isPending || isStatusManagedByMoysklad}
                      className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] disabled:opacity-50"
                    >
                      <option value="pending">Новый</option>
                      <option value="confirmed">Подтвержден</option>
                      <option value="processing">В обработке</option>
                      <option value="assembling">Собирается</option>
                      <option value="awaiting_dispatch">Ожидает отправки</option>
                      <option value="in_delivery">Доставляется</option>
                      <option value="shipped">Отгружен</option>
                      <option value="delivered">Доставлен</option>
                      <option value="completed">Выполнен</option>
                      <option value="problem">Проблемный</option>
                      <option value="cancelled">Отменен</option>
                    </select>

                    {isStatusManagedByMoysklad ? (
                      <p className="text-xs leading-5 text-gray-500">
                        Статус этого заказа приходит из МойСклад. Меняйте его там, сайт обновится автоматически.
                      </p>
                    ) : null}

                    {ability.can("manage", "all") ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Удалить заказ ${order.orderNumber || `#${order.id}`}? Это действие необратимо.`
                            )
                          ) {
                            deleteOrderMutation.mutate({ id: order.id });
                          }
                        }}
                        disabled={deleteOrderMutation.isPending}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Удалить заказ
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-gray-500">
            Страница {page} из {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
