import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  RefreshCw,
  ChevronRight,
  Store,
  FolderTree,
  Package,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";

type RuntimeSettingsForm = {
  webhookWorkerEnabled: boolean;
  webhookWorkerIntervalSeconds: number;
  reconcileEnabled: boolean;
  reconcileIntervalMinutes: number;
  fullSyncEnabled: boolean;
  fullSyncTime: string;
  fullSyncTimezone: string;
  fullSyncMaxDurationMinutes: number;
  fullSyncHeartbeatTimeoutMinutes: number;
};

type ProgressSnapshot = {
  phase?: string;
  message?: string;
  productsProcessed?: number;
  categoriesProcessed?: number;
  stocksProcessed?: number;
  assortmentOffset?: number;
  assortmentBatchSize?: number;
  stockOffset?: number;
  stockBatchSize?: number;
};

export default function AdminSyncMoySklad() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeView, setActiveView] = useState<
    "overview" | "setup" | "automation" | "queue"
  >("overview");
  const [profileName, setProfileName] = useState("Конфиг по умолчанию");
  const [stopReason, setStopReason] = useState("");
  const [runtimeForm, setRuntimeForm] = useState<RuntimeSettingsForm>({
    webhookWorkerEnabled: true,
    webhookWorkerIntervalSeconds: 60,
    reconcileEnabled: true,
    reconcileIntervalMinutes: 30,
    fullSyncEnabled: true,
    fullSyncTime: "03:00",
    fullSyncTimezone: "UTC",
    fullSyncMaxDurationMinutes: 120,
    fullSyncHeartbeatTimeoutMinutes: 15,
  });

  // Credentials
  const [login, setLogin] = useState(() => localStorage.getItem("ms_login") || "");
  const [password, setPassword] = useState(
    () => localStorage.getItem("ms_password") || ""
  );

  // Data
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<
    { id: string; name: string; parentId: string | null }[]
  >([]);

  // Selections
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Sync options
  const [syncProducts, setSyncProducts] = useState(true);
  const [syncStocks, setSyncStocks] = useState(true);
  const [syncPrices, setSyncPrices] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedWebhookIds, setSelectedWebhookIds] = useState<number[]>([]);

  const { data: msSettings } = trpc.settings.getMoySklad.useQuery();
  const { data: savedConfig } = trpc.sync.getSavedConfig.useQuery();
  const { data: syncOverview } = trpc.sync.getSyncOverview.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const { data: lockStatus } = trpc.sync.getSyncLockStatus.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: profiles = [], refetch: refetchProfiles } =
    trpc.sync.listProfiles.useQuery();
  const { data: webhookQueue, refetch: refetchWebhookQueue } =
    trpc.sync.getWebhookQueueStats.useQuery(undefined, {
      refetchInterval: 15000,
    });
  const { data: webhookSetup } = trpc.sync.getWebhookSetupStatus.useQuery(
    undefined,
    { refetchInterval: 15000 }
  );
  const {
    data: runtimeSettings,
    refetch: refetchRuntimeSettings,
  } = trpc.sync.getRuntimeSettings.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const {
    data: currentRunStatus,
    refetch: refetchCurrentRunStatus,
  } = trpc.sync.getCurrentRunStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: reconcileRuns = [], refetch: refetchReconcileRuns } =
    trpc.sync.getRecentReconcileRuns.useQuery(undefined, {
      refetchInterval: 30000,
    });

  const saveCredentials = () => {
    if (login && password) {
      localStorage.setItem("ms_login", login);
      localStorage.setItem("ms_password", password);
    }
  };

  // tRPC Hooks
  const storesQuery = trpc.sync.getStores.useQuery(
    { login: login || undefined, password: password || undefined },
    { enabled: false }
  );
  const categoriesQuery = trpc.sync.getCategories.useQuery(
    { login: login || undefined, password: password || undefined },
    { enabled: false }
  );
  const syncMutation = trpc.sync.runSync.useMutation({
    onSuccess: (data: { message: string }) => {
      toast.success(data.message);
      setStep(1); // Reset after success
    },
    onError: error => toast.error(error.message),
  });
  const saveConfigMutation = trpc.sync.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("Конфигурация синхронизации сохранена");
    },
    onError: error => toast.error(error.message),
  });
  const createProfileMutation = trpc.sync.upsertProfile.useMutation({
    onSuccess: () => {
      toast.success("Профиль синхронизации сохранён");
      refetchProfiles();
    },
    onError: error => toast.error(error.message),
  });
  const setActiveProfileMutation = trpc.sync.setActiveProfile.useMutation({
    onSuccess: () => {
      toast.success("Активный профиль обновлён");
      refetchProfiles();
    },
    onError: error => toast.error(error.message),
  });

  const wipeCatalogMutation = trpc.sync.wipeCatalog.useMutation({
    onSuccess: (data: { message: string }) => {
      toast.success(data.message);
    },
    onError: error => toast.error(error.message),
  });
  const processWebhookQueueMutation = trpc.sync.processWebhookQueue.useMutation({
    onSuccess: data => {
      toast.success(
        `Очередь обработана: выполнено ${data.done}, с ошибкой ${data.failed}, безнадёжно ${data.dead}`
      );
      refetchWebhookQueue();
    },
    onError: error => toast.error(error.message),
  });
  const retryWebhookEventsMutation = trpc.sync.retryWebhookEvents.useMutation({
    onSuccess: data => {
      toast.success(`Отправлено в retry: ${data.retried}`);
      setSelectedWebhookIds([]);
      refetchWebhookQueue();
    },
    onError: error => toast.error(error.message),
  });
  const reconcileMutation = trpc.sync.runStocksReconcile.useMutation({
    onSuccess: data => {
      if (data.skipped) {
        toast.message("Сверка остатков пропущена: сейчас выполняется полная синхронизация");
      } else {
        toast.success(`Сверка остатков завершена, записей: ${data.rowsProcessed ?? 0}`);
      }
      refetchReconcileRuns();
    },
    onError: error => toast.error(error.message),
  });
  const saveRuntimeSettingsMutation = trpc.sync.saveRuntimeSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки расписания и watchdog сохранены");
      refetchRuntimeSettings();
    },
    onError: error => toast.error(error.message),
  });
  const stopFullSyncMutation = trpc.sync.requestFullSyncStop.useMutation({
    onSuccess: data => {
      toast.success(data.message);
      setStopReason("");
      refetchCurrentRunStatus();
    },
    onError: error => toast.error(error.message),
  });
  const clearStaleLockMutation = trpc.sync.clearStaleFullSyncLock.useMutation({
    onSuccess: data => {
      toast.success(data.message);
      refetchCurrentRunStatus();
    },
    onError: error => toast.error(error.message),
  });
  const watchdogCheckMutation = trpc.sync.runFullSyncWatchdogCheck.useMutation({
    onSuccess: data => {
      if ((data.staleRuns ?? 0) > 0) {
        toast.warning(`Watchdog восстановил запусков: ${data.staleRuns}`);
      } else {
        toast.success("Watchdog проверил активные запуски, зависших не найдено");
      }
      refetchCurrentRunStatus();
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!savedConfig) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncProducts(savedConfig.syncProducts);
    setSyncStocks(savedConfig.syncStocks);
    setSyncPrices(savedConfig.syncPrices);
    if (savedConfig.selectedStores.length > 0) {
      setSelectedStores(savedConfig.selectedStores);
    }
    if (savedConfig.selectedCategories.length > 0) {
      setSelectedCategories(savedConfig.selectedCategories);
    }
  }, [savedConfig]);

  useEffect(() => {
    if (!runtimeSettings) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRuntimeForm({
      webhookWorkerEnabled: runtimeSettings.webhookWorkerEnabled,
      webhookWorkerIntervalSeconds: runtimeSettings.webhookWorkerIntervalSeconds,
      reconcileEnabled: runtimeSettings.reconcileEnabled,
      reconcileIntervalMinutes: runtimeSettings.reconcileIntervalMinutes,
      fullSyncEnabled: runtimeSettings.fullSyncEnabled,
      fullSyncTime: runtimeSettings.fullSyncTime,
      fullSyncTimezone: runtimeSettings.fullSyncTimezone,
      fullSyncMaxDurationMinutes: runtimeSettings.fullSyncMaxDurationMinutes,
      fullSyncHeartbeatTimeoutMinutes:
        runtimeSettings.fullSyncHeartbeatTimeoutMinutes,
    });
  }, [runtimeSettings]);

  const handleFetchStores = async () => {
    if (!msSettings?.hasToken && (!login || !password)) {
      return toast.error("Укажите логин/пароль или настройте токен в настройках");
    }
    setConnectionError(null);
    saveCredentials();
    const res = await storesQuery.refetch();
    if (res.error) {
      setConnectionError(res.error.message);
      toast.error(res.error.message);
      return;
    }
    if (res.data) {
      if (res.data.length === 0) {
        const message = "МойСклад ответил успешно, но склады не найдены";
        setConnectionError(message);
        toast.warning(message);
        return;
      }
      setStores(res.data);
      setSelectedStores(res.data.map(s => s.id)); // Select all by default
      setStep(2);
      toast.success(`Получено складов: ${res.data.length}`);
      return;
    }
    const message = "Не удалось получить склады из МойСклад";
    setConnectionError(message);
    toast.error(message);
  };

  const handleFetchCategories = async () => {
    setConnectionError(null);
    const res = await categoriesQuery.refetch();
    if (res.error) {
      setConnectionError(res.error.message);
      toast.error(res.error.message);
      return;
    }
    if (res.data) {
      if (res.data.length === 0) {
        const message = "МойСклад ответил успешно, но категории не найдены";
        setConnectionError(message);
        toast.warning(message);
        return;
      }
      setCategories(res.data);
      setSelectedCategories(res.data.map(c => c.id)); // Select all by default
      setStep(3);
      toast.success(`Получено категорий: ${res.data.length}`);
      return;
    }
    const message = "Не удалось получить категории из МойСклад";
    setConnectionError(message);
    toast.error(message);
  };

  const getDescendants = (parentId: string): string[] => {
    const children = categories.filter(c => c.parentId === parentId).map(c => c.id);
    let descendants = [...children];
    for (const childId of children) {
      descendants = [...descendants, ...getDescendants(childId)];
    }
    return descendants;
  };

  const handleRunSync = () => {
    syncMutation.mutate({
      login: login || undefined,
      password: password || undefined,
      syncProducts,
      syncStocks,
      syncPrices,
      selectedStores,
      selectedCategories,
    });
  };

  const handleSaveConfig = () => {
    saveConfigMutation.mutate({
      selectedStores,
      selectedCategories,
      syncProducts,
      syncStocks,
      syncPrices,
    });
  };

  const handleCreateProfile = () => {
    createProfileMutation.mutate({
      name: profileName.trim() || "Профиль синхронизации",
      config: {
        selectedStores,
        selectedCategories,
        syncProducts,
        syncStocks,
        syncPrices,
      },
    });
  };

  const renderCategoryTree = (parentId: string | null = null, level: number = 0) => {
    const children = categories.filter(c => c.parentId === parentId);
    if (children.length === 0) return null;
    
    return (
      <div className={`space-y-1 ${level > 0 ? "mt-1" : ""}`}>
        {children.map(cat => {
          const isSelected = selectedCategories.includes(cat.id);
          
          return (
            <div key={cat.id}>
              <label 
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${level === 0 ? 'bg-white shadow-sm' : 'hover:bg-white border-l-2 border-transparent hover:border-gray-200'}`}
                style={{ marginLeft: level > 0 ? `${level * 20}px` : '0px' }}
              >
                <input 
                  type="checkbox" 
                  checked={isSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const descendants = getDescendants(cat.id);
                      setSelectedCategories(prev => Array.from(new Set([...prev, cat.id, ...descendants])));
                    } else {
                      setSelectedCategories(prev => prev.filter(id => id !== cat.id));
                    }
                  }}
                  className="w-4 h-4 accent-[#05C3D4] rounded" 
                />
                <div className="flex items-center gap-2">
                  {level === 0 && <FolderTree size={16} className="text-gray-400" />}
                  <span className={`text-sm ${level === 0 ? 'font-bold' : 'text-gray-700'}`}>{cat.name}</span>
                </div>
              </label>
              {renderCategoryTree(cat.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const queueByStatus = webhookQueue?.byStatus ?? {};
  const webhookRows = webhookQueue?.recent ?? [];
  const failedOrDeadRows = webhookRows.filter(
    row => row.status === "failed" || row.status === "dead"
  );
  const allFailedOrDeadSelected =
    failedOrDeadRows.length > 0 &&
    failedOrDeadRows.every(row => selectedWebhookIds.includes(row.id));

  const getRunStats = (statsJson: unknown) => {
    if (!statsJson || typeof statsJson !== "object" || Array.isArray(statsJson)) {
      return { rowsProcessed: 0, storesFiltered: 0 };
    }
    const obj = statsJson as Record<string, unknown>;
    return {
      rowsProcessed: Number(obj.rowsProcessed ?? 0),
      storesFiltered: Number(obj.storesFiltered ?? 0),
    };
  };

  const getDurationLabel = (startedAt: string | Date, finishedAt?: string | Date | null) => {
    if (!finishedAt) return "—";
    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(finishedAt).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return "—";
    const sec = Math.floor((endMs - startMs) / 1000);
    if (sec < 60) return `${sec}с`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}м ${rem}с`;
  };

  const formatDateTime = (value?: string | Date | null) =>
    value ? new Date(value).toLocaleString("ru-RU") : "—";

  const getProgressSnapshot = (value: unknown): ProgressSnapshot => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as ProgressSnapshot;
  };

  const currentProgress = getProgressSnapshot(currentRunStatus?.progressJson);
  const activeProfile = profiles.find(profile => profile.isDefault) ?? null;
  const latestReconcileRun = reconcileRuns[0];
  const latestReconcileStats = latestReconcileRun
    ? getRunStats(latestReconcileRun.statsJson)
    : { rowsProcessed: 0, storesFiltered: 0 };
  const currentStepLabel =
    step === 1
      ? "Подключение"
      : step === 2
        ? "Склады"
        : "Категории и запуск";
  const hasRunningFullSync = currentRunStatus?.status === "running";
  const failedWebhookCount = (queueByStatus.failed ?? 0) + (queueByStatus.dead ?? 0);
  const pressure = syncOverview?.pressure;
  const pressureLabel =
    pressure?.level === "high"
      ? "Высокая"
      : pressure?.level === "elevated"
        ? "Повышенная"
        : "Нормальная";

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="МойСклад"
        title="Синхронизация и контроль"
        description="Экран для повседневной работы: запускайте полную синхронизацию, следите за очередью вебхуков и управляйте автоматическими процессами без прыжков между разными зонами."
        meta={
          <>
            <span>Активный профиль: {activeProfile?.name ?? "не выбран"}</span>
            <span>Текущий шаг: {currentStepLabel}</span>
            <span>
              Full sync: {runtimeForm.fullSyncEnabled ? `${runtimeForm.fullSyncTime} ${runtimeForm.fullSyncTimezone}` : "отключен"}
            </span>
          </>
        }
        actions={
          <>
            <Link
              to="/admin/sync"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] transition hover:border-gray-300 hover:bg-white"
            >
              Назад к разделу
            </Link>
            <button
              onClick={() => {
                refetchRuntimeSettings();
                refetchCurrentRunStatus();
                refetchWebhookQueue();
                refetchReconcileRuns();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#15171A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
            >
              <RefreshCw size={16} />
              Обновить экран
            </button>
          </>
        }
      />

      {connectionError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {connectionError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard
          label="Последний full sync"
          value={
            syncOverview?.lastFullSuccess
              ? new Date(syncOverview.lastFullSuccess).toLocaleString("ru-RU")
              : "—"
          }
          hint={
            runtimeForm.fullSyncEnabled
              ? `По расписанию: ${runtimeForm.fullSyncTime} ${runtimeForm.fullSyncTimezone}`
              : "Автоматический запуск выключен"
          }
          tone="accent"
        />
        <AdminStatCard
          label="Задержка вебхуков"
          value={`${syncOverview?.webhookLagMinutes ?? 0}м`}
          hint={
            webhookSetup?.lastEventAt
              ? `Последнее событие: ${new Date(webhookSetup.lastEventAt).toLocaleString("ru-RU")}`
              : "Событий пока не было"
          }
          tone={(syncOverview?.webhookLagMinutes ?? 0) > 10 ? "warning" : "success"}
        />
        <AdminStatCard
          label="Ошибки очереди"
          value={String(failedWebhookCount)}
          hint={`failed: ${queueByStatus.failed ?? 0}, dead: ${queueByStatus.dead ?? 0}`}
          tone={failedWebhookCount > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Последняя сверка остатков"
          value={latestReconcileRun ? getDurationLabel(latestReconcileRun.startedAt, latestReconcileRun.finishedAt) : "—"}
          hint={
            latestReconcileRun
              ? `Строк: ${latestReconcileStats.rowsProcessed}, складов: ${latestReconcileStats.storesFiltered}`
              : "Запусков пока не было"
          }
          tone="default"
        />
        <AdminStatCard
          label="Давление API"
          value={pressureLabel}
          hint={
            pressure?.lastSeenAt
              ? `Последний сигнал: ${new Date(pressure.lastSeenAt).toLocaleString("ru-RU")}`
              : "Transient-сбоев не видно"
          }
          tone={
            pressure?.level === "high"
              ? "warning"
              : pressure?.level === "elevated"
                ? "accent"
                : "success"
          }
        />
      </div>

      {pressure?.orderSyncSlowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Сейчас идёт full sync, поэтому order sync автоматически замедлен и берёт меньше job за цикл.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { key: "overview", label: "Обзор" },
          { key: "setup", label: "Настройка и запуск" },
          { key: "automation", label: "Автоматизация" },
          { key: "queue", label: "Очередь и сверка" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() =>
              setActiveView(tab.key as "overview" | "setup" | "automation" | "queue")
            }
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeView === tab.key
                ? "bg-[#05C3D4] text-[#15171A]"
                : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-[#15171A]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeView === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <AdminSection
              title="Операционное состояние"
              description="Главное, что стоит проверить в начале дня: жив ли full sync, как чувствует себя lock и не накопились ли ошибки в очереди."
              tone="accent"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#05C3D4]/20 bg-white/70 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                        Full sync
                      </div>
                      <div className="mt-1 text-lg font-bold text-[#15171A]">
                        {hasRunningFullSync ? "Запуск идет сейчас" : "Сейчас простоя нет"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        hasRunningFullSync
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {currentRunStatus?.status ?? "idle"}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Фаза</span>
                      <span className="font-semibold text-[#15171A]">
                        {currentRunStatus?.phase ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Heartbeat</span>
                      <span className="font-semibold text-[#15171A]">
                        {formatDateTime(currentRunStatus?.heartbeatAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Товаров обработано</span>
                      <span className="font-semibold text-[#15171A]">
                        {currentProgress.productsProcessed ?? 0}
                      </span>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                      {currentProgress.message ??
                        currentRunStatus?.message ??
                        "Сейчас активного запуска нет."}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <div className="mb-4 text-lg font-bold text-[#15171A]">
                    Lock и watchdog
                  </div>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Lock</span>
                      <span className="font-semibold text-[#15171A]">
                        {lockStatus?.locked ? "активен" : "свободен"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Owner</span>
                      <span className="font-mono text-xs text-[#15171A]">
                        {lockStatus?.owner ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Возраст lock</span>
                      <span className="font-semibold text-[#15171A]">
                        {formatDateTime(lockStatus?.startedAt ? new Date(lockStatus.startedAt) : null)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Истекает</span>
                      <span className="font-semibold text-[#15171A]">
                        {lockStatus?.expiresAt
                          ? formatDateTime(new Date(lockStatus.expiresAt))
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => watchdogCheckMutation.mutate()}
                      disabled={watchdogCheckMutation.isPending}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300 disabled:opacity-50"
                    >
                      {watchdogCheckMutation.isPending
                        ? "Проверка..."
                        : "Проверить watchdog"}
                    </button>
                    <button
                      onClick={() => clearStaleLockMutation.mutate()}
                      disabled={clearStaleLockMutation.isPending}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300 disabled:opacity-50"
                    >
                      {clearStaleLockMutation.isPending
                        ? "Очистка..."
                        : "Очистить stale lock"}
                    </button>
                  </div>
                </div>
              </div>
            </AdminSection>

            <AdminSection
              title="Быстрые действия"
              description="Отсюда удобно стартовать ручные операторские сценарии без погружения в длинные таблицы."
            >
              <div className="grid gap-3">
                <button
                  onClick={() => reconcileMutation.mutate()}
                  disabled={reconcileMutation.isPending}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#15171A] hover:border-gray-300 disabled:opacity-50"
                >
                  {reconcileMutation.isPending ? "Сверка..." : "Сверить остатки"}
                </button>
                <button
                  onClick={() => processWebhookQueueMutation.mutate({ limit: 100 })}
                  disabled={processWebhookQueueMutation.isPending}
                  className="inline-flex items-center justify-center rounded-xl bg-[#15171A] px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  {processWebhookQueueMutation.isPending
                    ? "Обработка..."
                    : "Обработать очередь"}
                </button>
                <button
                  onClick={() => setActiveView("setup")}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-[#15171A] hover:border-gray-300"
                >
                  Открыть мастер полного запуска
                </button>
              </div>
            </AdminSection>
          </div>

          <AdminSection
            title="Последние запуски сверки остатков"
            description="Это safety net по остаткам: она догоняет расхождения, если вебхуки отстали или часть событий не обработалась."
          >
            <div className="space-y-3">
              {reconcileRuns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                  Пока запусков нет.
                </div>
              ) : (
                reconcileRuns.slice(0, 5).map(run => (
                  <div
                    key={run.id}
                    className="grid gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-4 md:grid-cols-5"
                  >
                    <div className="font-semibold text-[#15171A]">{run.status}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(run.startedAt).toLocaleString("ru-RU")}
                    </div>
                    <div className="text-sm text-gray-600">
                      строк: {getRunStats(run.statsJson).rowsProcessed}
                    </div>
                    <div className="text-sm text-gray-600">
                      фильтр складов: {getRunStats(run.statsJson).storesFiltered}
                    </div>
                    <div className="text-sm text-gray-500">
                      длительность: {getDurationLabel(run.startedAt, run.finishedAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </AdminSection>
        </div>
      )}

      {activeView === "setup" && (
        <div className="space-y-6">
          <AdminSection
            title="Пошаговый запуск полной синхронизации"
            description="Сначала подтверждаем доступ, потом склады, затем категории и параметры запуска. Это основной сценарий ручного full sync."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={saveConfigMutation.isPending}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300 disabled:opacity-50"
                >
                  {saveConfigMutation.isPending
                    ? "Сохранение..."
                    : "Сохранить конфиг по умолчанию"}
                </button>
                <button
                  onClick={handleRunSync}
                  disabled={syncMutation.isPending || lockStatus?.locked}
                  className="rounded-xl bg-[#15171A] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  {syncMutation.isPending
                    ? "Синхронизация..."
                    : lockStatus?.locked
                      ? "Синхронизация уже запущена"
                      : "Запустить синхронизацию"}
                </button>
              </div>
            }
          >
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { num: 1, label: "Подключение", icon: Store },
                  { num: 2, label: "Склады", icon: FolderTree },
                  { num: 3, label: "Категории и запуск", icon: Package },
                ].map(item => (
                  <div key={item.num} className="flex items-center gap-3">
                    <div
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                        step === item.num
                          ? "border-[#05C3D4] bg-[#05C3D4]/10 text-[#15171A]"
                          : step > item.num
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-500"
                      }`}
                    >
                      <item.icon size={16} />
                      <span className="text-sm font-semibold">{item.label}</span>
                    </div>
                    {item.num < 3 && (
                      <ChevronRight size={16} className="text-gray-300" />
                    )}
                  </div>
                ))}
              </div>

              {step === 1 && (
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    {msSettings?.hasToken ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                        <div className="font-semibold">API токен уже настроен</div>
                        <div className="mt-1">
                          Используется сохраненный токен {msSettings.tokenMasked}. Логин и пароль можно не заполнять.
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                        <div className="font-semibold">Токен пока не настроен</div>
                        <div className="mt-1">
                          Для стабильной работы лучше добавить его в{" "}
                          <Link to="/admin/settings/integrations" className="font-semibold underline">
                            настройках
                          </Link>
                          .
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700">
                          Логин
                        </span>
                        <input
                          type="text"
                          value={login}
                          onChange={e => setLogin(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                          placeholder="admin@moysklad.ru"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-700">
                          Пароль
                        </span>
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                          placeholder="********"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5">
                    <div className="text-lg font-bold text-[#15171A]">
                      Дальше на этом шаге
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-gray-600">
                      <li>1. Проверяем авторизацию в МойСклад.</li>
                      <li>2. Получаем список складов для текущего профиля.</li>
                      <li>3. Переходим к отбору складов и категорий.</li>
                    </ul>
                    <button
                      onClick={handleFetchStores}
                      disabled={storesQuery.isFetching}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#15171A] px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                    >
                      {storesQuery.isFetching
                        ? "Подключение..."
                        : "Подключиться и получить склады"}
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
                    <div>
                      <div className="text-lg font-bold text-[#15171A]">
                        Выбор складов
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        Отметьте склады, остатки которых должны участвовать в витрине и заказах.
                      </div>
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300"
                    >
                      Назад
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {stores.map(store => (
                      <label
                        key={store.id}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-4 transition ${
                          selectedStores.includes(store.id)
                            ? "border-[#05C3D4] bg-[#05C3D4]/5"
                            : "border-gray-100 bg-white hover:border-gray-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStores.includes(store.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedStores([...selectedStores, store.id]);
                            } else {
                              setSelectedStores(
                                selectedStores.filter(id => id !== store.id)
                              );
                            }
                          }}
                          className="h-5 w-5 rounded accent-[#05C3D4]"
                        />
                        <div>
                          <div className="font-semibold text-[#15171A]">
                            {store.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {store.id}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                    <div className="text-sm text-gray-500">
                      Выбрано складов: {selectedStores.length}
                    </div>
                    <button
                      onClick={handleFetchCategories}
                      disabled={categoriesQuery.isFetching}
                      className="rounded-xl bg-[#15171A] px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                    >
                      {categoriesQuery.isFetching
                        ? "Получаем категории..."
                        : "Далее: выбрать категории"}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-[#15171A]">
                          Категории МойСклад
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          Отберите дерево категорий, которое должно участвовать в полном запуске.
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setSelectedCategories(
                            selectedCategories.length === categories.length
                              ? []
                              : categories.map(category => category.id)
                          )
                        }
                        className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-[#15171A] hover:border-gray-300"
                      >
                        {selectedCategories.length === categories.length
                          ? "Снять все"
                          : "Выбрать все"}
                      </button>
                    </div>
                    <div className="max-h-[520px] overflow-y-auto rounded-2xl bg-gray-50 p-4">
                      {renderCategoryTree(null, 0)}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5">
                      <div className="text-lg font-bold text-[#15171A]">
                        Параметры запуска
                      </div>
                      <div className="mt-4 space-y-3">
                        <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-4">
                          <input
                            type="checkbox"
                            checked={syncProducts}
                            onChange={e => setSyncProducts(e.target.checked)}
                            className="h-5 w-5 rounded accent-[#05C3D4]"
                          />
                          <div>
                            <div className="font-semibold text-[#15171A]">
                              Обновлять товары
                            </div>
                            <div className="text-xs text-gray-500">
                              Названия, описания, изображения и характеристики
                            </div>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-4">
                          <input
                            type="checkbox"
                            checked={syncStocks}
                            onChange={e => setSyncStocks(e.target.checked)}
                            className="h-5 w-5 rounded accent-[#05C3D4]"
                          />
                          <div>
                            <div className="font-semibold text-[#15171A]">
                              Обновлять остатки
                            </div>
                            <div className="text-xs text-gray-500">
                              Только по выбранным складам ({selectedStores.length})
                            </div>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-4">
                          <input
                            type="checkbox"
                            checked={syncPrices}
                            onChange={e => setSyncPrices(e.target.checked)}
                            className="h-5 w-5 rounded accent-[#05C3D4]"
                          />
                          <div>
                            <div className="font-semibold text-[#15171A]">
                              Обновлять цены
                            </div>
                            <div className="text-xs text-gray-500">
                              Розничная цена и связанные прайсовые поля
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5">
                      <div className="grid gap-4">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-gray-700">
                            Активный профиль
                          </span>
                          <select
                            value={activeProfile?.id ?? ""}
                            onChange={e => {
                              const id = Number(e.target.value);
                              if (id) setActiveProfileMutation.mutate({ id });
                            }}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#05C3D4]"
                          >
                            <option value="">Выберите профиль</option>
                            {profiles.map(profile => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-gray-700">
                            Сохранить как новый профиль
                          </span>
                          <div className="flex gap-2">
                            <input
                              value={profileName}
                              onChange={e => setProfileName(e.target.value)}
                              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#05C3D4]"
                              placeholder="Название профиля"
                            />
                            <button
                              onClick={handleCreateProfile}
                              disabled={createProfileMutation.isPending}
                              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-[#15171A] hover:border-gray-300 disabled:opacity-50"
                            >
                              Сохранить
                            </button>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-2">
                      <button
                        onClick={() => setStep(2)}
                        className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-[#15171A] hover:border-gray-300"
                      >
                        Назад к складам
                      </button>
                      <div className="text-sm text-gray-500">
                        Категорий выбрано: {selectedCategories.length}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AdminSection>

          <AdminSection
            title="Опасная зона"
            description="Эта операция не относится к повседневной работе. Держим её отдельно, чтобы она не спорила с обычным workflow."
          >
            <div className="flex flex-col gap-4 rounded-2xl border border-red-100 bg-red-50 px-5 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-red-900">
                  Полная очистка каталога
                </div>
                <div className="mt-1 text-sm text-red-700">
                  Удаляет категории, товары, модификации, остатки, поиск, отзывы и заказы. Откат возможен только из backup.
                </div>
              </div>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Вы уверены, что хотите ПОЛНОСТЬЮ очистить каталог? Будут удалены категории, товары, модификации, остатки, поиск, отзывы и заказы."
                    )
                  ) {
                    wipeCatalogMutation.mutate();
                  }
                }}
                disabled={wipeCatalogMutation.isPending}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {wipeCatalogMutation.isPending
                  ? "Удаление..."
                  : "Удалить всё и очистить базу"}
              </button>
            </div>
          </AdminSection>
        </div>
      )}

      {activeView === "automation" && (
        <div className="space-y-6">
          <AdminSection
            title="Расписание и watchdog"
            description="Здесь мы настраиваем регулярные фоновые процессы и контролируем их здоровье. Блок специально отделен от ручного full sync, чтобы оператор быстрее различал автоматизацию и ручные действия."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => watchdogCheckMutation.mutate()}
                  disabled={watchdogCheckMutation.isPending}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300 disabled:opacity-50"
                >
                  {watchdogCheckMutation.isPending
                    ? "Проверка..."
                    : "Проверить watchdog"}
                </button>
                <button
                  onClick={() => saveRuntimeSettingsMutation.mutate(runtimeForm)}
                  disabled={saveRuntimeSettingsMutation.isPending}
                  className="rounded-xl bg-[#15171A] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  {saveRuntimeSettingsMutation.isPending
                    ? "Сохранение..."
                    : "Сохранить настройки"}
                </button>
              </div>
            }
          >
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Вебхук worker включен
                  </span>
                  <select
                    value={runtimeForm.webhookWorkerEnabled ? "true" : "false"}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        webhookWorkerEnabled: e.target.value === "true",
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  >
                    <option value="true">Да</option>
                    <option value="false">Нет</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Интервал worker (сек.)
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    value={runtimeForm.webhookWorkerIntervalSeconds}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        webhookWorkerIntervalSeconds: Number(e.target.value || 60),
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Сверка остатков включена
                  </span>
                  <select
                    value={runtimeForm.reconcileEnabled ? "true" : "false"}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        reconcileEnabled: e.target.value === "true",
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  >
                    <option value="true">Да</option>
                    <option value="false">Нет</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Интервал reconcile (мин.)
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={runtimeForm.reconcileIntervalMinutes}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        reconcileIntervalMinutes: Number(e.target.value || 30),
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Ночной full sync включен
                  </span>
                  <select
                    value={runtimeForm.fullSyncEnabled ? "true" : "false"}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        fullSyncEnabled: e.target.value === "true",
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  >
                    <option value="true">Да</option>
                    <option value="false">Нет</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Время full sync
                  </span>
                  <input
                    type="time"
                    value={runtimeForm.fullSyncTime}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        fullSyncTime: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Часовой пояс
                  </span>
                  <input
                    type="text"
                    value={runtimeForm.fullSyncTimezone}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        fullSyncTimezone: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                    placeholder="UTC или Europe/Moscow"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Макс. длительность full sync (мин.)
                  </span>
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    value={runtimeForm.fullSyncMaxDurationMinutes}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        fullSyncMaxDurationMinutes: Number(
                          e.target.value || 120
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Timeout heartbeat (мин.)
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={runtimeForm.fullSyncHeartbeatTimeoutMinutes}
                    onChange={e =>
                      setRuntimeForm(prev => ({
                        ...prev,
                        fullSyncHeartbeatTimeoutMinutes: Number(
                          e.target.value || 15
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#05C3D4]"
                  />
                </label>
              </div>

              <div className="space-y-4 rounded-2xl bg-[#15171A] p-5 text-white">
                <div className="text-lg font-bold">Текущий full sync и lock</div>
                {currentRunStatus ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white/10 p-4">
                        <div className="text-xs font-bold text-white/60">
                          Статус
                        </div>
                        <div className="mt-1 font-semibold">
                          {currentRunStatus.status}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/10 p-4">
                        <div className="text-xs font-bold text-white/60">
                          Фаза
                        </div>
                        <div className="mt-1 font-semibold">
                          {currentRunStatus.phase ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/10 p-4">
                        <div className="text-xs font-bold text-white/60">
                          Старт
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatDateTime(currentRunStatus.startedAt)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/10 p-4">
                        <div className="text-xs font-bold text-white/60">
                          Heartbeat
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatDateTime(currentRunStatus.heartbeatAt)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#05C3D4]/30 bg-[#05C3D4]/15 p-4">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#9debf3]">
                        Прогресс
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {currentProgress.message ??
                          currentRunStatus.message ??
                          "Синхронизация выполняется"}
                      </div>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div>
                          Товаров:{" "}
                          <span className="font-bold">
                            {currentProgress.productsProcessed ?? 0}
                          </span>
                        </div>
                        <div>
                          Категорий:{" "}
                          <span className="font-bold">
                            {currentProgress.categoriesProcessed ?? 0}
                          </span>
                        </div>
                        <div>
                          Остатков:{" "}
                          <span className="font-bold">
                            {currentProgress.stocksProcessed ?? 0}
                          </span>
                        </div>
                        <div>
                          Assortment offset:{" "}
                          <span className="font-bold">
                            {currentProgress.assortmentOffset ?? "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                        Причина остановки
                      </span>
                      <input
                        type="text"
                        value={stopReason}
                        onChange={e => setStopReason(e.target.value)}
                        className="w-full rounded-xl border-0 bg-white px-4 py-3 text-[#15171A] outline-none"
                        placeholder="Например: окно работ завершено"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          stopFullSyncMutation.mutate({
                            reason: stopReason.trim() || undefined,
                          })
                        }
                        disabled={stopFullSyncMutation.isPending}
                        className="rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {stopFullSyncMutation.isPending
                          ? "Остановка..."
                          : "Остановить синхронизацию"}
                      </button>
                      <button
                        onClick={() => clearStaleLockMutation.mutate()}
                        disabled={clearStaleLockMutation.isPending}
                        className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                      >
                        {clearStaleLockMutation.isPending
                          ? "Очистка..."
                          : "Очистить stale lock"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-white/10 p-4 text-sm">
                      Сейчас активного full sync нет.
                    </div>
                    <button
                      onClick={() => clearStaleLockMutation.mutate()}
                      disabled={clearStaleLockMutation.isPending}
                      className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                    >
                      {clearStaleLockMutation.isPending
                        ? "Очистка..."
                        : "Очистить lock, если он завис"}
                    </button>
                  </div>
                )}

                <div className="rounded-xl bg-white/5 p-4 text-xs text-white/80">
                  <div>
                    Lock:{" "}
                    <span className="font-semibold">
                      {lockStatus?.locked ? "активен" : "свободен"}
                    </span>
                  </div>
                  <div className="mt-1">
                    Owner:{" "}
                    <span className="font-mono">{lockStatus?.owner ?? "—"}</span>
                  </div>
                  <div className="mt-1">
                    Возраст lock:{" "}
                    <span className="font-semibold">
                      {formatDateTime(lockStatus?.startedAt ? new Date(lockStatus.startedAt) : null)}
                    </span>
                  </div>
                  <div className="mt-1">
                    Истекает:{" "}
                    <span className="font-semibold">
                      {lockStatus?.expiresAt
                        ? formatDateTime(new Date(lockStatus.expiresAt))
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Последний slot key:{" "}
              <span className="font-mono">
                {runtimeSettings?.schedulerLastFullSyncKey ?? "—"}
              </span>
            </div>
          </AdminSection>
        </div>
      )}

      {activeView === "queue" && (
        <div className="space-y-6">
          <AdminSection
            title="Очередь вебхуков"
            description="Тут живут оперативные события из МойСклад. Это не полная синхронизация, а быстрый поток изменений, который поддерживает актуальность между большими прогонами."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => reconcileMutation.mutate()}
                  disabled={reconcileMutation.isPending}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-[#15171A] hover:border-gray-300 disabled:opacity-50"
                >
                  {reconcileMutation.isPending ? "Сверка..." : "Сверить остатки"}
                </button>
                <button
                  onClick={() => processWebhookQueueMutation.mutate({ limit: 100 })}
                  disabled={processWebhookQueueMutation.isPending}
                  className="rounded-xl bg-[#15171A] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  {processWebhookQueueMutation.isPending
                    ? "Обработка..."
                    : "Обработать очередь"}
                </button>
              </div>
            }
          >
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    Проверка вебхука
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {webhookSetup?.hasSecret ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <AlertTriangle size={16} className="text-amber-600" />
                        )}
                        <span>Секрет задан</span>
                      </div>
                      <span className="font-semibold text-[#15171A]">
                        {webhookSetup?.hasSecret ? "Да" : "Нет"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(webhookSetup?.events24h ?? 0) > 0 ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <AlertTriangle size={16} className="text-amber-600" />
                        )}
                        <span>События за 24 часа</span>
                      </div>
                      <span className="font-semibold text-[#15171A]">
                        {webhookSetup?.events24h ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(syncOverview?.webhookLagMinutes ?? 0) <= 10 ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <AlertTriangle size={16} className="text-amber-600" />
                        )}
                        <span>Задержка в норме</span>
                      </div>
                      <span className="font-semibold text-[#15171A]">
                        {syncOverview?.webhookLagMinutes ?? 0}м
                      </span>
                    </div>
                    <div className="pt-1 text-xs text-gray-500">
                      Последнее событие:{" "}
                      {webhookSetup?.lastEventAt
                        ? new Date(webhookSetup.lastEventAt).toLocaleString(
                            "ru-RU"
                          )
                        : "не было"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                  {[
                    { key: "new", label: "Новые" },
                    { key: "processing", label: "В обработке" },
                    { key: "done", label: "Готово" },
                    { key: "failed", label: "С ошибкой" },
                    { key: "dead", label: "Остановлены" },
                  ].map(item => (
                    <div
                      key={item.key}
                      className="rounded-2xl border border-gray-100 bg-white px-4 py-4"
                    >
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                        {item.label}
                      </div>
                      <div className="mt-2 text-2xl font-black text-[#15171A]">
                        {queueByStatus[item.key] ?? 0}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4 text-xs text-gray-500">
                  Эти счетчики заполняются только если в МойСклад настроен вебхук
                  на <span className="font-mono">/api/webhooks/moysklad</span>.
                  Нули — это нормально, если вебхук ещё не подключен или событий
                  пока не было.
                </div>
              </div>

              <div className="space-y-4">
                {failedOrDeadRows.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-semibold text-amber-800">
                        <AlertTriangle size={18} />
                        Ошибочные события: {failedOrDeadRows.length}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            if (allFailedOrDeadSelected) {
                              setSelectedWebhookIds(prev =>
                                prev.filter(
                                  id =>
                                    !failedOrDeadRows.some(row => row.id === id)
                                )
                              );
                            } else {
                              setSelectedWebhookIds(
                                Array.from(
                                  new Set([
                                    ...selectedWebhookIds,
                                    ...failedOrDeadRows.map(row => row.id),
                                  ])
                                )
                              );
                            }
                          }}
                          className="rounded-xl border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800"
                        >
                          {allFailedOrDeadSelected
                            ? "Снять выделение"
                            : "Выделить все"}
                        </button>
                        <button
                          onClick={() =>
                            retryWebhookEventsMutation.mutate({
                              ids:
                                selectedWebhookIds.length > 0
                                  ? selectedWebhookIds
                                  : failedOrDeadRows.map(row => row.id),
                            })
                          }
                          disabled={retryWebhookEventsMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          <RotateCcw size={14} />
                          {retryWebhookEventsMutation.isPending
                            ? "Повтор..."
                            : "Повторить выбранные"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-100 bg-gray-50">
                        <tr>
                          <th className="w-10 px-3 py-3 text-left font-semibold text-gray-500">
                            #
                          </th>
                          <th className="px-3 py-3 text-left font-semibold text-gray-500">
                            Тип
                          </th>
                          <th className="px-3 py-3 text-left font-semibold text-gray-500">
                            Статус
                          </th>
                          <th className="px-3 py-3 text-left font-semibold text-gray-500">
                            Попытки
                          </th>
                          <th className="px-3 py-3 text-left font-semibold text-gray-500">
                            Ошибка
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {webhookRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-sm text-gray-500"
                            >
                              Событий пока нет. Проверьте вебхук в МойСклад и
                              секрет в настройках.
                            </td>
                          </tr>
                        ) : (
                          webhookRows.map(row => (
                            <tr
                              key={row.id}
                              className="border-b border-gray-50 last:border-b-0"
                            >
                              <td className="px-3 py-3">
                                {(row.status === "failed" ||
                                  row.status === "dead") && (
                                  <input
                                    type="checkbox"
                                    checked={selectedWebhookIds.includes(row.id)}
                                    onChange={e =>
                                      setSelectedWebhookIds(prev =>
                                        e.target.checked
                                          ? [...prev, row.id]
                                          : prev.filter(id => id !== row.id)
                                      )
                                    }
                                    className="h-4 w-4 accent-[#05C3D4]"
                                  />
                                )}
                              </td>
                              <td className="px-3 py-3 font-medium text-[#15171A]">
                                {row.eventType}
                              </td>
                              <td className="px-3 py-3 text-gray-600">
                                {row.status}
                              </td>
                              <td className="px-3 py-3 text-gray-600">
                                {row.attempts}
                              </td>
                              <td className="max-w-[320px] truncate px-3 py-3 text-xs text-gray-500">
                                {row.lastError || "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </AdminSection>
        </div>
      )}
    </div>
  );
}
