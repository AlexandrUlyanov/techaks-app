import { trpc } from "@/providers/trpc";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminLeads() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ecommerce.listOrders.useQuery();

  const updateStatusMutation = trpc.ecommerce.updateOrderStatus.useMutation({
    onSuccess: () => {
      utils.ecommerce.listOrders.invalidate();
      toast.success("Статус заказа обновлен");
    },
  });

  const orders = data?.orders || [];

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#0a0a0a]">Заказы</h2>
        <div className="text-sm text-gray-500">Всего: {data?.total || 0}</div>
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
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        <ShoppingBag size={16} className="text-gray-400" />
                        <span className="font-bold text-[#0a0a0a]">
                          Заказ #{order.id}
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
                            | "cancelled",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                      className="h-10 min-w-[170px] rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] disabled:opacity-50"
                    >
                      <option value="pending">Новый</option>
                      <option value="confirmed">Подтвержден</option>
                      <option value="shipped">Отгружен</option>
                      <option value="delivered">Доставлен</option>
                      <option value="cancelled">Отменен</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
