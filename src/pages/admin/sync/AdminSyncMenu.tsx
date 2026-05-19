import { Link } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  PackageOpen,
  Clock3,
  ShoppingBag,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { trpc } from "@/providers/trpc";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";

type SyncLog = {
  id: number;
  createdAt: string | Date;
  type: string;
  status: "success" | "error" | "running";
  message: string;
  details?: {
    stats?: {
      products?: number;
      categories?: number;
      stocks?: number;
    };
    logFileUrl?: string;
  } | null;
};

export default function AdminSyncMenu() {
  const { data: logs = [], isLoading } = trpc.sync.getLogs.useQuery();
  const typedLogs = logs as SyncLog[];
  const successCount = typedLogs.filter(log => log.status === "success").length;
  const errorCount = typedLogs.filter(log => log.status === "error").length;
  const runningCount = typedLogs.filter(log => log.status === "running").length;
  const latestLog = typedLogs[0] ?? null;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Интеграции"
        title="Синхронизация"
        description="Здесь собраны операционные экраны обмена данными. Входной экран теперь показывает только ключевой маршрут и историю запусков, без лишнего шума."
        meta={
          <>
            <span>Активных процессов: {runningCount}</span>
            <span>Последний запуск: {latestLog ? format(new Date(latestLog.createdAt), "d MMM, HH:mm", { locale: ru }) : "—"}</span>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Успешные запуски"
          value={successCount}
          hint="По видимому журналу синхронизаций"
          tone="success"
        />
        <AdminStatCard
          label="Ошибки"
          value={errorCount}
          hint="Требуют проверки логов и очереди"
          tone={errorCount > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Сейчас в работе"
          value={runningCount}
          hint="Full sync или текущие операции"
          tone={runningCount > 0 ? "accent" : "default"}
        />
        <AdminStatCard
          label="Последний тип"
          value={latestLog?.type ?? "—"}
          hint={latestLog?.message ?? "Запусков пока не было"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminSection
          title="Основные маршруты"
          description="Разделили товарный контур и order-sync, чтобы оператору было проще быстро попасть в нужный сценарий и не тонуть в одном длинном экране."
        >
          <div className="grid gap-4">
            <Link
              to="/admin/sync/moysklad"
              className="group block rounded-2xl border border-gray-200 bg-white px-6 py-6 transition hover:border-[#05C3D4] hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15171A] text-white">
                    <PackageOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#15171A]">
                      Каталог, остатки и очереди
                    </h3>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">
                      Товары, остатки, цены, очереди вебхуков, reconcile,
                      scheduler и watchdog для full sync.
                    </p>
                  </div>
                </div>
                <div className="rounded-full border border-gray-200 p-2 text-gray-400 transition group-hover:border-[#05C3D4] group-hover:text-[#05C3D4]">
                  <ArrowRight size={18} />
                </div>
              </div>
            </Link>

            <Link
              to="/admin/sync/moysklad/orders"
              className="group block rounded-2xl border border-gray-200 bg-white px-6 py-6 transition hover:border-[#05C3D4] hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#15171A] text-white">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#15171A]">
                      Заказы в МойСклад
                    </h3>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">
                      Очередь customerorder, маппинг статусов, ошибки, ручной
                      retry и диагностика проблемных заказов.
                    </p>
                  </div>
                </div>
                <div className="rounded-full border border-gray-200 p-2 text-gray-400 transition group-hover:border-[#05C3D4] group-hover:text-[#05C3D4]">
                  <ArrowRight size={18} />
                </div>
              </div>
            </Link>
          </div>
        </AdminSection>

        <AdminSection
          title="История синхронизаций"
          description="Это high-level журнал. Для детального разбора используйте экран МойСклад и прикреплённые лог-файлы."
        >
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                      Дата
                    </th>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                      Тип
                    </th>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                      Статус
                    </th>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                      Сообщение
                    </th>
                    <th className="px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                      Результат
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-gray-400"
                      >
                        Загрузка логов...
                      </td>
                    </tr>
                  ) : typedLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-gray-400"
                      >
                        Истории пока нет.
                      </td>
                    </tr>
                  ) : (
                    typedLogs.map(log => (
                      <tr
                        key={log.id}
                        className="transition-colors hover:bg-gray-50/60"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-[#15171A]">
                            <Clock3 size={14} className="text-gray-300" />
                            {format(new Date(log.createdAt), "d MMM, HH:mm", {
                              locale: ru,
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold uppercase text-[#15171A]">
                          {log.type}
                        </td>
                        <td className="px-5 py-4">
                          {log.status === "success" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1 text-[10px] font-black uppercase text-green-600">
                              <CheckCircle2 size={12} /> Успешно
                            </span>
                          ) : log.status === "error" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase text-red-600">
                              <AlertCircle size={12} /> Ошибка
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-600">
                              <RefreshCw size={12} className="animate-spin" /> В
                              процессе
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {log.message}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">
                          {log.details?.stats ? (
                            <div className="mb-2 flex flex-wrap gap-3">
                              <span>📦 {logDetails(log).products}</span>
                              <span>📁 {logDetails(log).categories}</span>
                              <span>🏠 {logDetails(log).stocks}</span>
                            </div>
                          ) : null}
                          {log.details?.logFileUrl ? (
                            <a
                              href={log.details.logFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#05C3D4] transition hover:underline"
                            >
                              <FileText size={12} /> Скачать лог
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </AdminSection>
      </div>
    </div>
  );
}

function logDetails(log: SyncLog) {
  return {
    products: log.details?.stats?.products || 0,
    categories: log.details?.stats?.categories || 0,
    stocks: log.details?.stats?.stocks || 0,
  };
}
