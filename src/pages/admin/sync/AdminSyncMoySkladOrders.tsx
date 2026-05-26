import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { trpc } from "@/providers/trpc";

type OrderSyncSettingsForm = {
  enabled: boolean;
  organizationHref: string;
  storeHref: string;
  salesChannelHref: string;
  createCounterparties: boolean;
  statusMapping: Record<string, string>;
};

const LOCAL_STATUSES = [
  "new",
  "pending",
  "waiting_call",
  "confirmed",
  "assembling",
  "shipped",
  "completed",
  "cancelled",
  "returned",
];

export default function AdminSyncMoySkladOrders() {
  const [draftSettings, setDraftSettings] = useState<OrderSyncSettingsForm | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const overviewQuery = trpc.sync.getMoyskladOrderSyncOverview.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const metadataQuery = trpc.sync.loadMoyskladOrderMetadata.useQuery();
  const queueQuery = trpc.sync.getMoyskladOrderSyncQueue.useQuery(
    { limit: 100 },
    { refetchInterval: 15000 }
  );
  const orderLogQuery = trpc.sync.getOrderMoyskladSyncLog.useQuery(
    { orderId: selectedOrderId ?? 0 },
    { enabled: Boolean(selectedOrderId) }
  );

  const saveSettingsMutation = trpc.sync.saveMoyskladOrderSyncSettings.useMutation({
    onSuccess: async () => {
      toast.success("Настройки синхронизации заказов сохранены");
      setDraftSettings(null);
      await Promise.all([overviewQuery.refetch(), metadataQuery.refetch()]);
    },
    onError: error => toast.error(error.message),
  });

  const runWorkerMutation = trpc.sync.runMoyskladOrderSyncWorker.useMutation({
    onSuccess: async data => {
      toast.success(
        `Очередь обработана: ${data.success} успешно, ${data.failed} с ошибкой`
      );
      await Promise.all([overviewQuery.refetch(), queueQuery.refetch()]);
    },
    onError: error => toast.error(error.message),
  });

  const retryJobMutation = trpc.sync.retryMoyskladOrderSyncJob.useMutation({
    onSuccess: async () => {
      toast.success("Job поставлен в retry");
      await queueQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const syncOrderMutation = trpc.sync.syncOrderToMoyskladManually.useMutation({
    onSuccess: async () => {
      toast.success("Заказ поставлен в очередь синхронизации");
      await Promise.all([overviewQuery.refetch(), queueQuery.refetch()]);
    },
    onError: error => toast.error(error.message),
  });

  const settingsForm = useMemo<OrderSyncSettingsForm>(() => {
    if (draftSettings) return draftSettings;
    if (overviewQuery.data?.settings) {
      return {
        enabled: overviewQuery.data.settings.enabled,
        organizationHref: overviewQuery.data.settings.organizationHref ?? "",
        storeHref: overviewQuery.data.settings.storeHref ?? "",
        salesChannelHref: overviewQuery.data.settings.salesChannelHref ?? "",
        createCounterparties: overviewQuery.data.settings.createCounterparties,
        statusMapping: overviewQuery.data.settings.statusMapping ?? {},
      };
    }
    return {
      enabled: true,
      organizationHref: "",
      storeHref: "",
      salesChannelHref: "",
      createCounterparties: true,
      statusMapping: {},
    };
  }, [draftSettings, overviewQuery.data?.settings]);

  useEffect(() => {
    if (draftSettings) return;
    if (!overviewQuery.data?.settings || !metadataQuery.data) return;

    const nextOrganizationHref =
      overviewQuery.data.settings.organizationHref ??
      metadataQuery.data.organization?.href ??
      "";
    const nextStoreHref =
      overviewQuery.data.settings.storeHref ?? metadataQuery.data.store?.href ?? "";

    if (
      nextOrganizationHref === (overviewQuery.data.settings.organizationHref ?? "") &&
      nextStoreHref === (overviewQuery.data.settings.storeHref ?? "")
    ) {
      return;
    }

    setDraftSettings({
      enabled: overviewQuery.data.settings.enabled,
      organizationHref: nextOrganizationHref,
      storeHref: nextStoreHref,
      salesChannelHref: overviewQuery.data.settings.salesChannelHref ?? "",
      createCounterparties: overviewQuery.data.settings.createCounterparties,
      statusMapping: overviewQuery.data.settings.statusMapping ?? {},
    });
  }, [draftSettings, metadataQuery.data, overviewQuery.data?.settings]);

  const queueCounts = overviewQuery.data?.queueCounts;
  const config = overviewQuery.data?.config;
  const connectionTone =
    config?.ok && config.organizationOk && config.storeOk
      ? "success"
      : config?.tokenOk
        ? "warning"
        : "default";

  const states = metadataQuery.data?.states ?? overviewQuery.data?.config?.states ?? [];
  const defaults = metadataQuery.data ?? overviewQuery.data?.config?.defaults;
  const recentErrors = useMemo(
    () =>
      (queueQuery.data ?? []).filter(
        item => item.status === "error" || (item.lastError ?? "").trim().length > 0
      ),
    [queueQuery.data]
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Интеграции / МойСклад"
        title="Синхронизация заказов"
        description="Заказы уходят в МойСклад через очередь: checkout не ждёт API, ретраи не создают дубли, а оператор видит ошибки и может повторить синхронизацию вручную."
        meta={
          <>
            <span>Очередь: {queueCounts?.pending ?? 0} pending</span>
            <span>Ошибки: {queueCounts?.errors ?? 0}</span>
          </>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Link
          to="/admin/sync/moysklad"
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:text-[#15171A]"
        >
          Каталог и остатки
        </Link>
        <span className="rounded-full bg-[#05C3D4] px-4 py-2 text-sm font-semibold text-[#15171A]">
          Заказы
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Подключение"
          value={config?.ok ? "OK" : "Проверить"}
          hint={config?.message ?? "Проверяем настройки"}
          tone={connectionTone as "default" | "success" | "warning" | "accent"}
        />
        <AdminStatCard
          label="Pending jobs"
          value={queueCounts?.pending ?? 0}
          hint={`processing: ${queueCounts?.processing ?? 0}`}
          tone={(queueCounts?.pending ?? 0) > 0 ? "accent" : "default"}
        />
        <AdminStatCard
          label="Ошибки"
          value={queueCounts?.errors ?? 0}
          hint={(recentErrors[0]?.lastError as string | undefined) ?? "Без ошибок"}
          tone={(queueCounts?.errors ?? 0) > 0 ? "warning" : "success"}
        />
        <AdminStatCard
          label="Успешно"
          value={queueCounts?.success ?? 0}
          hint="Счётчик по журналу очереди"
          tone="success"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminSection
          title="Настройки синхронизации заказов"
          description="Тут задаём, включён ли order-sync, какие organization/store используются в payload и как локальные статусы маппятся в состояния customerorder."
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraftSettings(prev => ({
                    ...(prev ?? settingsForm),
                    organizationHref:
                      defaults?.organization?.href ?? (prev ?? settingsForm).organizationHref,
                    storeHref:
                      defaults?.store?.href ?? (prev ?? settingsForm).storeHref,
                  }))
                }
                disabled={!defaults?.organization?.href && !defaults?.store?.href}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Подставить найденные
              </button>
              <button
                onClick={() => saveSettingsMutation.mutate(settingsForm)}
                disabled={saveSettingsMutation.isPending}
                className="rounded-xl bg-[#15171A] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {saveSettingsMutation.isPending ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-700">
                  Organization href
                </span>
                <input
                  value={settingsForm.organizationHref}
                  onChange={e =>
                    setDraftSettings(prev => ({
                      ...(prev ?? settingsForm),
                      organizationHref: e.target.value,
                    }))
                  }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                    placeholder={defaults?.organization?.href ?? "https://api.moysklad.ru/..."}
                  />
                  {defaults?.organization?.name ? (
                    <div className="text-xs text-gray-500">
                      Найдено по API: {defaults.organization.name}
                    </div>
                  ) : null}
                </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-700">Store href</span>
                <input
                  value={settingsForm.storeHref}
                  onChange={e =>
                    setDraftSettings(prev => ({
                      ...(prev ?? settingsForm),
                      storeHref: e.target.value,
                    }))
                  }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                    placeholder={defaults?.store?.href ?? "https://api.moysklad.ru/..."}
                  />
                  {defaults?.store?.name ? (
                    <div className="text-xs text-gray-500">
                      Найдено по API: {defaults.store.name}
                    </div>
                  ) : null}
                </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-700">
                  Sales channel href
                </span>
                <input
                  value={settingsForm.salesChannelHref}
                  onChange={e =>
                    setDraftSettings(prev => ({
                      ...(prev ?? settingsForm),
                      salesChannelHref: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  placeholder="Необязательно"
                />
              </label>
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-[#15171A]">
                  <input
                    type="checkbox"
                    checked={settingsForm.enabled}
                    onChange={e =>
                      setDraftSettings(prev => ({
                        ...(prev ?? settingsForm),
                        enabled: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-[#05C3D4] focus:ring-[#05C3D4]"
                  />
                  Включить синхронизацию заказов
                </label>
                <label className="flex items-center gap-3 text-sm font-semibold text-[#15171A]">
                  <input
                    type="checkbox"
                    checked={settingsForm.createCounterparties}
                    onChange={e =>
                      setDraftSettings(prev => ({
                        ...(prev ?? settingsForm),
                        createCounterparties: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-[#05C3D4] focus:ring-[#05C3D4]"
                  />
                  Создавать контрагентов автоматически
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white">
              <div className="border-b border-gray-100 px-5 py-4 text-sm font-bold text-[#15171A]">
                Маппинг статусов магазина → customerorder state
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                {LOCAL_STATUSES.map(status => (
                  <label key={status} className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                      {status}
                    </span>
                    <select
                      value={settingsForm.statusMapping[status] ?? ""}
                      onChange={e =>
                        setDraftSettings(prev => ({
                          ...(prev ?? settingsForm),
                          statusMapping: {
                            ...(prev ?? settingsForm).statusMapping,
                            [status]: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                    >
                      <option value="">Не маппить</option>
                      {states.map(state => (
                        <option key={state.href} value={state.href}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="Статус подключения"
          description="Здесь быстро видно, жив ли токен, найден ли organization/store и доступны ли customerorder states."
          actions={
            <button
              onClick={() => {
                void Promise.all([overviewQuery.refetch(), metadataQuery.refetch()]);
              }}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300"
            >
              Обновить
            </button>
          }
        >
          <div className="space-y-4">
            {[
              {
                ok: config?.tokenOk,
                label: "Токен",
                value: config?.tokenOk ? "Работает" : "Не работает",
              },
              {
                ok: config?.organizationOk,
                label: "Organization",
                value: config?.organizationSelected
                  ? "Сохранена"
                  : config?.organizationDetected
                    ? "Найдена, не выбрана"
                    : "Не найдена",
              },
              {
                ok: config?.storeOk,
                label: "Store",
                value: config?.storeSelected
                  ? "Сохранён"
                  : config?.storeDetected
                    ? "Найден, не выбран"
                    : "Не найден",
              },
              {
                ok: config?.customerOrderOk,
                label: "customerorder",
                value: config?.customerOrderOk ? "Доступен" : "Недоступен",
              },
            ].map(item => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  {item.ok ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-600" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-[#15171A]">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500">{item.value}</div>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-xs text-gray-600">
              Для webhook заказов используется токен из ENV или сохранённый
              секрет вебхука из настроек МойСклад. Если ни один из них не
              задан, endpoint остаётся выключенным.
            </div>
          </div>
        </AdminSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminSection
          title="Очередь sync jobs"
          description="Checkout только создаёт локальный заказ и ставит job. Тут видно, что ждёт отправки, что зависло и что стоит отправить заново."
          actions={
            <button
              onClick={() => runWorkerMutation.mutate({ limit: 10 })}
              disabled={runWorkerMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#15171A] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              <RefreshCw size={14} className={runWorkerMutation.isPending ? "animate-spin" : ""} />
              {runWorkerMutation.isPending ? "Обработка..." : "Прогнать очередь"}
            </button>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500">Job</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500">Заказ</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500">Action</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500">Статус</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500">Ошибка</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(queueQuery.data ?? []).map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#15171A]">#{item.id}</div>
                        <div className="text-xs text-gray-500">
                          попыток: {item.attempts}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#15171A]">
                          {item.orderNumber ? item.orderNumber : `#${item.entityId}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.storeName || item.customerName || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{item.action}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-[#15171A]">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {item.lastError || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => retryJobMutation.mutate({ jobId: item.id })}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#15171A] hover:border-gray-300"
                          >
                            Повторить
                          </button>
                          {item.entityId ? (
                            <>
                              <button
                                onClick={() => syncOrderMutation.mutate({ orderId: item.entityId })}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#15171A] hover:border-gray-300"
                              >
                                Синхр. заказ
                              </button>
                              <button
                                onClick={() => setSelectedOrderId(item.entityId)}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#15171A] hover:border-gray-300"
                              >
                                Лог заказа
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(queueQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                        Очередь пока пуста.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="Лог конкретного заказа"
          description="Отсюда удобно разбирать проблемный заказ: что лежит в его истории, какие jobs уже были и какая последняя ошибка."
        >
          {selectedOrderId && orderLogQuery.data ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-[#15171A]">
                      Заказ #{orderLogQuery.data.order.id}
                    </div>
                    <div className="text-sm text-gray-500">
                      sync status: {orderLogQuery.data.order.moyskladSyncStatus ?? "—"}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrderId(null)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#15171A] hover:border-gray-300"
                  >
                    Закрыть
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {orderLogQuery.data.jobs.slice(0, 8).map(job => (
                  <div
                    key={job.id}
                    className="rounded-2xl border border-gray-100 bg-white px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-[#15171A]">
                        Job #{job.id} / {job.action}
                      </div>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-[#15171A]">
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {job.lastError || "Ошибок не зафиксировано"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
              Выбери job из очереди, чтобы открыть лог конкретного заказа.
            </div>
          )}
        </AdminSection>
      </div>

      <AdminSection
        title="Последние заказы и ошибки"
        description="Здесь видно, какие заказы ждут синхронизации и где сейчас нужен оператор."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            {(overviewQuery.data?.recentOrders ?? []).map(order => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-4"
              >
                <div>
                  <div className="font-semibold text-[#15171A]">
                    {order.orderNumber || `#${order.id}`}
                  </div>
                  <div className="text-xs text-gray-500">
                    store sync: {order.moyskladSyncStatus}
                  </div>
                </div>
                <button
                  onClick={() => syncOrderMutation.mutate({ orderId: order.id })}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300"
                >
                  Синхронизировать
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {recentErrors.slice(0, 8).map(job => (
              <div
                key={job.id}
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"
              >
                <div className="font-semibold text-amber-900">
                  Job #{job.id} / {job.action}
                </div>
                <div className="mt-1 text-sm text-amber-800">{job.lastError}</div>
              </div>
            ))}
            {recentErrors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                Ошибок очереди сейчас не видно.
              </div>
            ) : null}
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
