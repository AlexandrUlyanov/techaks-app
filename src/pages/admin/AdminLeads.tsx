import { trpc } from "@/providers/trpc";
import { Link } from "react-router";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Package,
  Phone,
  Search,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "pending", label: "Новый" },
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
  { key: "completed", label: "Выполненные" },
  { key: "cancelled", label: "Отмененные" },
  { key: "problem", label: "Проблемные" },
];

export default function AdminLeads() {
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
    onSuccess: () => {
      utils.ecommerce.listOrders.invalidate();
      toast.success("Статус заказа обновлен");
    },
  });
  const bulkStatusMutation = trpc.ecommerce.bulkUpdateOrderStatus.useMutation({
    onSuccess: async data => {
      setSelectedIds([]);
      await utils.ecommerce.listOrders.invalidate();
      toast.success(`Обновлено заказов: ${data.updated}`);
    },
    onError: err => toast.error(err.message || "Ошибка массового обновления"),
  });

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "Новый", color: "bg-blue-100 text-blue-700", icon: Clock };
      case "confirmed":
        return { label: "Подтвержден", color: "bg-cyan-100 text-cyan-700", icon: CheckCircle2 };
      case "shipped":
        return { label: "Отгружен", color: "bg-yellow-100 text-yellow-700", icon: Truck };
      case "delivered":
        return { label: "Доставлен", color: "bg-green-100 text-green-700", icon: CheckCircle2 };
      case "cancelled":
        return { label: "Отменен", color: "bg-red-100 text-red-700", icon: XCircle };
      case "processing":
        return { label: "В обработке", color: "bg-indigo-100 text-indigo-700", icon: Clock };
      case "assembling":
        return { label: "Собирается", color: "bg-violet-100 text-violet-700", icon: Package };
      case "awaiting_dispatch":
        return { label: "Ожидает отправки", color: "bg-amber-100 text-amber-700", icon: Truck };
      case "in_delivery":
        return { label: "Доставляется", color: "bg-sky-100 text-sky-700", icon: Truck };
      case "completed":
        return { label: "Выполнен", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
      case "problem":
        return { label: "Проблемный", color: "bg-rose-100 text-rose-700", icon: XCircle };
      default:
        return { label: status, color: "bg-gray-100 text-gray-700", icon: Clock };
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-RU").format(price) + " ₽";

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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#0a0a0a]">Заказы</h2>
        <div className="text-sm text-gray-500">Всего: {total}</div>
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 lg:grid-cols-[1fr_220px_220px_220px_130px]">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Поиск: №, телефон, email, SKU, трек..."
            className="h-10 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
          />
        </label>
        <select
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
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
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
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
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
        >
          {DELIVERY_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={limit}
          onChange={e => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
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
            className={`h-9 rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              quickTab === tab.key
                ? "bg-[#05C3D4] text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:border-[#05C3D4] hover:text-[#05C3D4]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">
          Выбрано заказов: <span className="font-bold">{selectedIds.length}</span>
        </p>
        <div className="flex items-center gap-2">
          <select
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            <option value="processing">В обработке</option>
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
            disabled={selectedIds.length === 0 || bulkStatusMutation.isPending}
            className="h-9 rounded-lg bg-[#05C3D4] px-4 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            Применить массово
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
            Заказов пока нет
          </div>
        ) : (
          orders.map(order => {
            const status = getStatusInfo(order.status);
            const StatusIcon = status.icon;

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-xl p-6 transition-all ${
                  order.status === "pending"
                    ? "border-[#05C3D4] shadow-sm"
                    : "border-gray-200"
                }`}
              >
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  <div className="space-y-4 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
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
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        <ShoppingBag size={16} className="text-gray-400" />
                        <span className="font-bold text-[#0a0a0a]">
                          Заказ {order.orderNumber || `#${order.id}`}
                        </span>
                      </div>
                      {order.customerPhone && (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="flex items-center gap-2 bg-[#05C3D4]/10 text-[#0099A8] px-3 py-1.5 rounded-lg border border-[#05C3D4]/20 hover:bg-[#05C3D4]/20 transition-colors"
                        >
                          <Phone size={16} />
                          <span className="font-bold">{order.customerPhone}</span>
                        </a>
                      )}
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${status.color}`}
                      >
                        <StatusIcon size={14} />
                        {status.label}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">Клиент</div>
                        <div className="font-semibold text-[#0a0a0a]">
                          {order.customerName || order.customerEmail || "Без имени"}
                        </div>
                        {order.customerEmail && (
                          <div className="text-xs text-gray-500 mt-1">
                            {order.customerEmail}
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">Сумма</div>
                        <div className="font-black text-[#05C3D4] text-lg">
                          {formatPrice(order.totalPrice)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Позиций: {order.itemsCount}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {new Date(order.createdAt).toLocaleString("ru-RU")}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {order.deliveryType === "delivery" ? (
                          <>
                            <Truck size={14} />
                            Доставка
                          </>
                        ) : (
                          <>
                            <Package size={14} />
                            Самовывоз
                          </>
                        )}
                      </div>
                      {order.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={14} />
                          {order.address}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:border-l lg:pl-6 border-gray-100">
                    <Link
                      to={`/admin/leads/${order.id}`}
                      className="inline-flex h-10 items-center rounded-lg border border-gray-200 px-3 text-xs font-bold uppercase tracking-wider text-gray-600 hover:border-[#05C3D4] hover:text-[#05C3D4]"
                    >
                      Открыть
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
                      disabled={updateStatusMutation.isPending}
                      className="h-10 min-w-[170px] rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] disabled:opacity-50"
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
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-sm text-gray-500">
            Страница {page} из {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
