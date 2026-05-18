import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRightLeft,
  Clock3,
  ExternalLink,
  Loader2,
  Phone,
  ShieldCheck,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/providers/trpc";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";

const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "active", label: "Активные" },
  { value: "expired", label: "Истёкшие" },
  { value: "cancelled", label: "Отменённые" },
  { value: "converted_to_order", label: "Переведены в заказ" },
] as const;

function getStatusMeta(status: string) {
  switch (status) {
    case "active":
      return {
        label: "Активный",
        className: "bg-emerald-100 text-emerald-700",
      };
    case "expired":
      return {
        label: "Истёк",
        className: "bg-amber-100 text-amber-700",
      };
    case "cancelled":
      return {
        label: "Отменён",
        className: "bg-rose-100 text-rose-700",
      };
    case "converted_to_order":
      return {
        label: "Переведён в заказ",
        className: "bg-cyan-100 text-cyan-700",
      };
    default:
      return {
        label: status,
        className: "bg-slate-100 text-slate-700",
      };
  }
}

export default function AdminReservations() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");

  const queryInput = useMemo(
    () =>
      statusFilter === "all"
        ? undefined
        : {
            status: statusFilter,
          },
    [statusFilter]
  );

  const { data: reservations = [], isLoading, error } =
    trpc.ecommerce.listReservations.useQuery(queryInput);

  const cancelReservation = trpc.ecommerce.cancelReservation.useMutation({
    onSuccess: async () => {
      await utils.ecommerce.listReservations.invalidate();
      toast.success("Резерв отменён");
    },
    onError: err => toast.error(err.message || "Не удалось отменить резерв"),
  });

  const convertReservation = trpc.ecommerce.convertReservationToOrder.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.ecommerce.listReservations.invalidate(),
        utils.ecommerce.listOrders.invalidate(),
      ]);
      toast.success(`Создан заказ ${result.orderNumber}`);
    },
    onError: err =>
      toast.error(err.message || "Не удалось перевести резерв в заказ"),
  });

  const activeCount = reservations.filter(row => row.status === "active").length;
  const expiredCount = reservations.filter(row => row.status === "expired").length;
  const convertedCount = reservations.filter(
    row => row.status === "converted_to_order"
  ).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Операции"
        title="Резервы товара"
        description="Резерв всегда привязан к конкретному магазину. Здесь видны клиент, телефон, срок действия и дальнейшие действия менеджера."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatCard
          label="Активные резервы"
          value={activeCount}
          hint="Уменьшают доступный остаток"
          tone={activeCount > 0 ? "accent" : "default"}
        />
        <AdminStatCard
          label="Истёкшие"
          value={expiredCount}
          hint="Больше не блокируют доступность"
          tone={expiredCount > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Переведены в заказ"
          value={convertedCount}
          hint="Конверсия из резерва"
          tone={convertedCount > 0 ? "success" : "default"}
        />
      </div>

      <AdminSection
        title="Список резервов"
        description="Рабочая очередь резервов по магазинам: проверка, отмена и перевод в заказ."
        actions={
          <select
            value={statusFilter}
            onChange={event =>
              setStatusFilter(
                event.target.value as (typeof STATUS_OPTIONS)[number]["value"]
              )
            }
            className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        }
      >
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Ошибка загрузки резервов: {error.message}
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-3 py-12 text-sm text-gray-500">
            <Loader2 className="animate-spin text-[#05C3D4]" size={18} />
            Загружаю резервы...
          </div>
        ) : reservations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            По текущему фильтру резервов пока нет.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Резерв</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Магазин</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Клиент</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Срок</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Статус</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reservations.map(row => {
                    const statusMeta = getStatusMeta(row.status);
                    const reservedUntilLabel = row.reservedUntil
                      ? new Date(row.reservedUntil).toLocaleString("ru-RU")
                      : "—";

                    return (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-[#15171A]">
                              {row.productName}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span>#{row.id}</span>
                              <span>·</span>
                              <span>{row.quantity} шт.</span>
                              <span>·</span>
                              <span>{row.source}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#15171A]">
                              <Store size={15} className="text-[#05C3D4]" />
                              {row.storeName}
                            </div>
                            <div className="text-xs text-gray-500">{row.storeAddress}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-[#15171A]">
                              {row.customerName || "Клиент"}
                            </div>
                            <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                              <Phone size={13} />
                              {row.phone}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                            <Clock3 size={14} className="text-gray-400" />
                            {reservedUntilLabel}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/product/${row.productSlug}`}
                              target="_blank"
                              className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
                            >
                              <ExternalLink size={14} />
                              Товар
                            </Link>

                            {row.status === "active" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    convertReservation.mutate({ reservationId: row.id })
                                  }
                                  disabled={convertReservation.isPending}
                                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#05C3D4] px-3 text-xs font-bold text-white disabled:opacity-50"
                                >
                                  <ArrowRightLeft size={14} />
                                  В заказ
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    cancelReservation.mutate({ reservationId: row.id })
                                  }
                                  disabled={cancelReservation.isPending}
                                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                  Отменить
                                </button>
                              </>
                            ) : row.status === "converted_to_order" ? (
                              <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-bold text-cyan-700">
                                <ShieldCheck size={14} />
                                Уже оформлен
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AdminSection>
    </div>
  );
}
