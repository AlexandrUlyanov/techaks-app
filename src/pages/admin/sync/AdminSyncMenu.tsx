import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Clock3,
} from "lucide-react";
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
            <span>Последний запуск: {latestLog ? formatSyncDate(latestLog.createdAt) : "—"}</span>
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
          title="Контур интеграции"
          description="Все рабочие маршруты вынесены в главное меню слева. Этот экран теперь оставляем обзорным: здесь видно текущее состояние обмена, последние типы запусков и общий журнал."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                Каталог и остатки
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Очереди вебхуков, reconcile, scheduler, watchdog, полный прогон каталога,
                цены и остатки живут в ветке МойСклад.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                Заказы customerorder
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Отдельная ветка для order-sync: статусы, retry, маппинг customerorder и
                разбор проблемных заказов без смешивания с товарным контуром.
              </p>
            </div>
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
                            {formatSyncDate(log.createdAt)}
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

function formatSyncDate(value: string | Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
