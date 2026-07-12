import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Coins,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

function formatPrice(value?: number | null) {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value ?? 0))} ₽`;
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function getParticipantStatusLabel(status?: string | null) {
  switch (status) {
    case "active":
      return "Активен";
    case "linked":
      return "Связан";
    case "pending":
      return "Ожидает";
    case "error":
      return "Ошибка";
    default:
      return status || "—";
  }
}

function getOrderSyncStatusLabel(status?: string | null) {
  switch (status) {
    case "pending":
      return "Ожидает";
    case "synced":
      return "Синхронизирован";
    case "cancelled":
      return "Отменён";
    case "rolled_back":
      return "Сторнирован";
    case "error":
      return "Ошибка";
    default:
      return status || "—";
  }
}

function getToneClass(status?: string | null) {
  if (status === "active" || status === "synced" || status === "success") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "error") {
    return "bg-rose-100 text-rose-700";
  }
  if (status === "cancelled" || status === "rolled_back") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-sky-100 text-sky-700";
}

export default function AdminLoyalty() {
  const utils = trpc.useUtils();
  const overviewQuery = trpc.loyalty.getOverview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const settingsQuery = trpc.loyalty.getSettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const customersQuery = trpc.loyalty.listCustomers.useQuery(
    { limit: 80 },
    { refetchOnWindowFocus: false }
  );
  const ordersQuery = trpc.loyalty.listOrders.useQuery(
    { limit: 80 },
    { refetchOnWindowFocus: false }
  );
  const journalQuery = trpc.loyalty.listJournal.useQuery(
    { limit: 60 },
    { refetchOnWindowFocus: false }
  );
  const jobsQuery = trpc.loyalty.listJobs.useQuery(
    { limit: 40 },
    { refetchOnWindowFocus: false }
  );

  const [enabled, setEnabled] = useState(false);
  const [groupName, setGroupName] = useState("техакс");
  const [participantTag, setParticipantTag] = useState("техакс");
  const [maxWriteoffPercent, setMaxWriteoffPercent] = useState(30);
  const [posCashierUid, setPosCashierUid] = useState("");
  const [posStoreUid, setPosStoreUid] = useState("");
  const [posToken, setPosToken] = useState("");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(Boolean(settingsQuery.data.enabled));
    setGroupName(settingsQuery.data.groupName || "техакс");
    setParticipantTag(settingsQuery.data.participantTag || "техакс");
    setMaxWriteoffPercent(Number(settingsQuery.data.defaultMaxWriteoffPercent || 30));
    setPosCashierUid(settingsQuery.data.posCashierUid || "");
    setPosStoreUid(settingsQuery.data.posStoreUid || "");
  }, [settingsQuery.data]);

  const invalidateAll = async () => {
    await Promise.all([
      utils.loyalty.getOverview.invalidate(),
      utils.loyalty.getSettings.invalidate(),
      utils.loyalty.listCustomers.invalidate(),
      utils.loyalty.listOrders.invalidate(),
      utils.loyalty.listJournal.invalidate(),
      utils.loyalty.listJobs.invalidate(),
    ]);
  };

  const saveSettings = trpc.loyalty.saveSettings.useMutation({
    onSuccess: async () => {
      setPosToken("");
      toast.success("Настройки бонусной программы сохранены.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const runMaintenance = trpc.loyalty.runMaintenance.useMutation({
    onSuccess: async result => {
      toast.success(
        `Очередь обновлена: клиентов ${result.scheduled.usersQueued}, заказов ${result.scheduled.ordersQueued}, retry ${result.scheduled.retryQueued}.`
      );
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const testPosConnection = trpc.loyalty.testPosConnection.useMutation({
    onSuccess: async result => {
      toast.success(result.message);
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const resyncCustomer = trpc.loyalty.resyncCustomer.useMutation({
    onSuccess: async () => {
      toast.success("Клиент пересинхронизирован.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const assignGroup = trpc.loyalty.assignGroup.useMutation({
    onSuccess: async () => {
      toast.success("Группа техакс подтверждена в МойСклад.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const resyncOrder = trpc.loyalty.resyncOrder.useMutation({
    onSuccess: async () => {
      toast.success("Заказ пересинхронизирован.");
      await invalidateAll();
    },
    onError: error => toast.error(error.message),
  });

  const refreshing =
    overviewQuery.isFetching ||
    customersQuery.isFetching ||
    ordersQuery.isFetching ||
    journalQuery.isFetching ||
    jobsQuery.isFetching;

  const summary = overviewQuery.data?.summary;
  const activeCustomers = customersQuery.data ?? [];
  const activeOrders = ordersQuery.data ?? [];
  const journal = journalQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];

  const stats = useMemo(
    () => [
      {
        label: "Участники",
        value: summary?.participants ?? 0,
        hint: "Клиенты, привязанные к техакс",
        icon: Users,
      },
      {
        label: "Активные балансы",
        value: summary?.activeParticipants ?? 0,
        hint: "Профили без ошибки синхронизации",
        icon: Wallet,
      },
      {
        label: "Заказы с бонусами",
        value: summary?.ordersWithBonuses ?? 0,
        hint: `Списано ${formatPrice(summary?.bonusSpent ?? 0)}`,
        icon: Coins,
      },
      {
        label: "Ошибки / очередь",
        value: `${summary?.errors ?? 0} / ${summary?.queuedJobs ?? 0}`,
        hint: `Задач с ошибкой: ${summary?.failedJobs ?? 0}`,
        icon: Wrench,
      },
    ],
    [summary]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="CRM"
        title="Лояльность"
        description="Операционный контур бонусной программы Techaks на базе МоегоСклада: настройки, участники, бонусные заказы, фоновые sync-задачи и журнал."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => invalidateAll()} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Обновить
            </Button>
            <Button
              onClick={() => runMaintenance.mutate({ scheduleLimit: 25, processLimit: 12 })}
              disabled={runMaintenance.isPending}
            >
              {runMaintenance.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RotateCcw size={16} />
              )}
              Прогнать sync
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => (
          <AdminStatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
            icon={stat.icon}
          />
        ))}
      </div>

      <AdminSection
        title="Состояние интеграции"
        description="Перед включением бонусов здесь должны быть настроены POS-кассир и торговая точка, а очередь не должна содержать зависших задач."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Режим</div>
            <div className="mt-2 font-bold">{overviewQuery.data?.health.enabled ? "Включена" : "Выключена"}</div>
          </div>
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">POS-настройки</div>
            <div className="mt-2 font-bold">{overviewQuery.data?.health.configured ? "Заполнены" : "Нужна настройка"}</div>
          </div>
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Зависшие задачи</div>
            <div className="mt-2 font-bold">{summary?.staleProcessingJobs ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Итог</div>
            <div className="mt-2 font-bold">
              {overviewQuery.data?.health.healthy
                ? "Готово к работе"
                : overviewQuery.data?.health.enabled
                  ? "Требует внимания"
                  : "Безопасно остановлена"}
            </div>
          </div>
        </div>
        {!overviewQuery.data?.health.configured ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            Укажите корректные UID кассира и торговой точки из POS-контекста МоегоСклада. Обычный логин пользователя не всегда является UID кассира.
          </p>
        ) : null}
      </AdminSection>

      <AdminSection
        title="Контур программы"
        description="Базовые параметры участия. По умолчанию используем группу/тег «техакс» и правило списания, которое потом может прийти из МоегоСклада."
        actions={
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--tech-color-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--tech-color-text-main)]">
            <BadgeCheck size={16} className="text-[var(--tech-color-primary)]" />
            {enabled ? "Программа включена" : "Программа выключена"}
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-[var(--tech-color-text-main)]">
            <span>Группа / сегмент</span>
            <input
              value={groupName}
              onChange={event => setGroupName(event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-white px-4 outline-none transition focus:border-[#05C3D4]"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--tech-color-text-main)]">
            <span>Tag участия в МойСклад</span>
            <input
              value={participantTag}
              onChange={event => setParticipantTag(event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-white px-4 outline-none transition focus:border-[#05C3D4]"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--tech-color-text-main)]">
            <span>Fallback лимит списания, %</span>
            <input
              value={maxWriteoffPercent}
              onChange={event => setMaxWriteoffPercent(Number(event.target.value || 0))}
              type="number"
              min={1}
              max={100}
              className="h-11 w-full rounded-2xl border border-border bg-white px-4 outline-none transition focus:border-[#05C3D4]"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--tech-color-text-main)]">
            <span>UID кассира POS API</span>
            <input
              value={posCashierUid}
              onChange={event => setPosCashierUid(event.target.value)}
              placeholder="Обязателен для bonus detail из POS API"
              className="h-11 w-full rounded-2xl border border-border bg-white px-4 outline-none transition focus:border-[#05C3D4]"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--tech-color-text-main)]">
            <span>UID точки продаж / магазина</span>
            <input
              value={posStoreUid}
              onChange={event => setPosStoreUid(event.target.value)}
              placeholder="Опционально, если POS-контур требует контекст точки"
              className="h-11 w-full rounded-2xl border border-border bg-white px-4 outline-none transition focus:border-[#05C3D4]"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--tech-color-text-main)]">
            <span>POS-токен точки продаж</span>
            <input
              value={posToken}
              onChange={event => setPosToken(event.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder={
                settingsQuery.data?.posTokenConfigured
                  ? `Настроен, последние символы: ${settingsQuery.data.posTokenLast4 || "••••"}`
                  : "Отдельный токен кассы из МойСклад"
              }
              className="h-11 w-full rounded-2xl border border-border bg-white px-4 outline-none transition focus:border-[#05C3D4] dark:bg-[var(--tech-color-surface-muted)]"
            />
            <span className="block text-xs font-normal text-[var(--tech-color-text-muted)]">
              Поле оставьте пустым, чтобы сохранить текущий токен. Общий API-токен здесь не подходит.
            </span>
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-[var(--tech-color-text-main)]">
            <span>Включить программу</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={event => setEnabled(event.target.checked)}
              className="h-4 w-4 accent-[#05C3D4]"
            />
          </label>
        </div>
        {enabled && !settingsQuery.data?.posDetailConfigured ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Для получения реального бонусного баланса и pending-начислений из POS API
            нужно указать <span className="font-bold">UID кассира</span>. Пока он не
            настроен, участники программы будут синхронизироваться без POS detail.
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              saveSettings.mutate({
                enabled,
                groupName,
                participantTag,
                defaultMaxWriteoffPercent: maxWriteoffPercent,
                posCashierUid,
                posStoreUid,
                posToken,
              })
            }
            disabled={saveSettings.isPending}
          >
            {saveSettings.isPending ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            Сохранить настройки
          </Button>
          <Button
            variant="outline"
            onClick={() => testPosConnection.mutate()}
            disabled={testPosConnection.isPending || !settingsQuery.data?.posDetailConfigured}
          >
            {testPosConnection.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <KeyRound size={16} />
            )}
            Проверить POS API
          </Button>
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-3 text-sm text-[var(--tech-color-text-muted)]">
            Последний лог: {formatDateTime(summary?.lastLog?.createdAt)}
          </div>
        </div>
        {settingsQuery.data?.lastCheck?.at ? (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              settingsQuery.data.lastCheck.ok
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
            }`}
          >
            <div className="font-bold">
              Последняя проверка: {formatDateTime(settingsQuery.data.lastCheck.at)}
            </div>
            <div className="mt-1">{settingsQuery.data.lastCheck.message}</div>
          </div>
        ) : null}
      </AdminSection>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminSection
          title="Клиенты"
          description="Кого уже привязали к бонусной программе, какой сейчас баланс и где есть сбои."
          contentClassName="px-0 py-0"
        >
          <div className="divide-y divide-black/5">
            {activeCustomers.slice(0, 10).map(customer => (
              <div key={customer.id} className="grid gap-3 px-6 py-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr_auto] lg:items-center">
                <div>
                  <div className="font-semibold text-[var(--tech-color-text-main)]">
                    {customer.fullName || customer.email}
                  </div>
                  <div className="text-sm text-[var(--tech-color-text-muted)]">
                    {customer.email} {customer.phone ? `· ${customer.phone}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-[var(--tech-color-text-muted)]">
                    Counterparty: {customer.moyskladCounterpartyId || "не создан"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--tech-color-text-main)]">
                    Баланс {formatPrice(customer.loyaltyBalance)}
                  </div>
                  <div className="text-xs text-[var(--tech-color-text-muted)]">
                    Доступно {formatPrice(customer.loyaltyAvailableToSpend)} · pending {formatPrice(customer.loyaltyPendingAccrual)}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getToneClass(customer.loyaltyStatus)}`}>
                    {getParticipantStatusLabel(customer.loyaltyStatus)}
                  </span>
                  <div className="text-xs text-[var(--tech-color-text-muted)]">
                    {formatDateTime(customer.loyaltyLastSyncedAt)}
                  </div>
                  {customer.loyaltyLastError ? (
                    <div className="text-xs text-rose-600">{customer.loyaltyLastError}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resyncCustomer.mutate({ userId: customer.id })}
                    disabled={resyncCustomer.isPending}
                  >
                    sync
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => assignGroup.mutate({ userId: customer.id })}
                    disabled={assignGroup.isPending}
                  >
                    техакс
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </AdminSection>

        <AdminSection
          title="Очередь и фон"
          description="Что сейчас лежит в loyalty-очереди и где накопились ошибки."
          contentClassName="px-0 py-0"
        >
          <div className="divide-y divide-black/5">
            {jobs.slice(0, 8).map(job => (
              <div key={job.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--tech-color-text-main)]">{job.jobType}</div>
                    <div className="text-xs text-[var(--tech-color-text-muted)]">
                      user #{job.userId || "—"} · order #{job.orderId || "—"} · попытка {job.attempts}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getToneClass(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                {job.lastError ? (
                  <div className="mt-2 text-xs text-rose-600">{job.lastError}</div>
                ) : null}
              </div>
            ))}
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Бонусные заказы"
        description="Сюда попадают заказы, где было списание или ожидаемое начисление. Отсюда же удобно пересинхронизировать спорные кейсы."
        contentClassName="px-0 py-0"
      >
        <div className="divide-y divide-black/5">
          {activeOrders.slice(0, 12).map(order => (
            <div key={order.id} className="grid gap-3 px-6 py-4 lg:grid-cols-[1.1fr_1fr_0.8fr_auto] lg:items-center">
              <div>
                <div className="font-semibold text-[var(--tech-color-text-main)]">
                  {order.orderNumber || `Заказ #${order.id}`}
                </div>
                <div className="text-sm text-[var(--tech-color-text-muted)]">
                  {order.customerName || order.customerEmail || "Клиент не указан"}
                </div>
              </div>
              <div className="text-sm text-[var(--tech-color-text-main)]">
                <div>Списано: {formatPrice(order.loyaltyBonusSpent)}</div>
                <div>Начислено: {formatPrice(order.loyaltyActualAccrued || order.loyaltyBonusAccrued)}</div>
              </div>
              <div className="space-y-1">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getToneClass(order.loyaltySyncStatus)}`}>
                  {getOrderSyncStatusLabel(order.loyaltySyncStatus)}
                </span>
                <div className="text-xs text-[var(--tech-color-text-muted)]">
                  {formatDateTime(order.loyaltyLastSyncedAt)}
                </div>
                {order.loyaltyLastSyncError ? (
                  <div className="text-xs text-rose-600">{order.loyaltyLastSyncError}</div>
                ) : null}
              </div>
              <div className="flex justify-start lg:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resyncOrder.mutate({ orderId: order.id })}
                  disabled={resyncOrder.isPending}
                >
                  Пересинхронизировать
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        title="Журнал бонусной синхронизации"
        description="Полезен для диагностики: request/response payload, ошибки POS detail, повторные прогоны и финальные статусы."
        contentClassName="px-0 py-0"
      >
        <div className="divide-y divide-black/5">
          {journal.slice(0, 16).map(entry => (
            <details key={entry.id} className="group px-6 py-4 open:bg-[#F7FEFF]">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-[var(--tech-color-text-main)]">{entry.message}</div>
                  <div className="mt-1 text-xs text-[var(--tech-color-text-muted)]">
                    {formatDateTime(entry.createdAt)} · {entry.userName || entry.userEmail || "—"} · {entry.orderNumber || "без заказа"}
                  </div>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getToneClass(entry.status)}`}>
                  {entry.status}
                </span>
              </summary>
              <pre className="mt-4 overflow-x-auto rounded-2xl bg-[var(--tech-color-surface-muted)] p-4 text-xs leading-6 text-[var(--tech-color-text-muted)]">
                {JSON.stringify(entry.detailsJson ?? {}, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
