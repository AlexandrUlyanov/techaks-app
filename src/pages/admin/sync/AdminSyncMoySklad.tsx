import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  RefreshCw,
  Save,
  ChevronRight,
  Store,
  FolderTree,
  Package,
  Trash2,
  Lock,
  CheckCircle,
  Clock3,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

export default function AdminSyncMoySklad() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profileName, setProfileName] = useState("Конфиг по умолчанию");

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
      toast.success("Профиль синхронизации сохранен");
      refetchProfiles();
    },
    onError: error => toast.error(error.message),
  });
  const setActiveProfileMutation = trpc.sync.setActiveProfile.useMutation({
    onSuccess: () => {
      toast.success("Активный профиль обновлен");
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
        `Очередь обработана: done ${data.done}, failed ${data.failed}, dead ${data.dead}`
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
        toast.message("Reconcile пропущен: идет full sync");
      } else {
        toast.success(`Reconcile завершен, записей: ${data.rowsProcessed ?? 0}`);
      }
      refetchReconcileRuns();
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

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link
          to="/admin/sync"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-black hover:shadow-md transition-all"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-black font-heading tracking-tight text-[#15171A] uppercase">
            Мастер синхронизации
          </h1>
          <p className="text-gray-500 mt-1">
            Пошаговая настройка интеграции с МойСклад
          </p>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-4 mb-8">
        {[
          { num: 1, label: "Авторизация и Склады", icon: Store },
          { num: 2, label: "Категории", icon: FolderTree },
          { num: 3, label: "Запуск", icon: Package },
        ].map(s => (
          <div
            key={s.num}
            className={`flex items-center gap-3 ${step === s.num ? "text-[#05C3D4]" : step > s.num ? "text-green-500" : "text-gray-400"}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${step === s.num ? "border-[#05C3D4] bg-[#05C3D4]/10" : step > s.num ? "border-green-500 bg-green-50" : "border-gray-200"}`}
            >
              <s.icon size={18} />
            </div>
            <span className="font-bold text-sm hidden sm:block">{s.label}</span>
            {s.num < 3 && (
              <ChevronRight size={16} className="text-gray-300 ml-2" />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        {/* STEP 1: Auth & Stores */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold">Шаг 1. Параметры подключения</h3>
            
            {msSettings?.hasToken ? (
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-green-50 border border-green-100 mb-2">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-green-500 shadow-sm">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <div className="font-bold text-green-900">API токен настроен</div>
                  <div className="text-sm text-green-700">
                    Используется сохраненный токен {msSettings.tokenMasked}. 
                    Вы можете оставить логин и пароль пустыми.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-100 mb-2">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-amber-500 shadow-sm">
                  <Lock size={24} />
                </div>
                <div>
                  <div className="font-bold text-amber-900">Токен не настроен</div>
                  <div className="text-sm text-amber-700">
                    Рекомендуем настроить API токен в <Link to="/admin/settings" className="underline font-bold">настройках</Link> для безопасного подключения.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Логин (e-mail) <span className="text-gray-400 font-normal">(опционально, если есть токен)</span>
                </label>
                <input
                  type="text"
                  value={login}
                  onChange={e => setLogin(e.target.value)}
                  className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#05C3D4] outline-none"
                  placeholder="admin@moysklad.ru"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Пароль <span className="text-gray-400 font-normal">(опционально, если есть токен)</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#05C3D4] outline-none"
                  placeholder="********"
                />
              </div>
            </div>
            <div className="pt-4">
              <button
                onClick={handleFetchStores}
                disabled={storesQuery.isFetching}
                className="flex items-center justify-center gap-2 w-full py-4 bg-[#15171A] hover:bg-black text-white rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {storesQuery.isFetching ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  "Подключиться и получить склады"
                )}
              </button>
            </div>
            {connectionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {connectionError}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Categories (and showing selected stores) */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold">
              Шаг 2. Выбор складов для синхронизации
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Отметьте склады из МойСклад, остатки которых нужно выводить на
              сайте. Склады будут автоматически созданы в базе.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {stores.map(store => (
                <label
                  key={store.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedStores.includes(store.id) ? "border-[#05C3D4] bg-[#05C3D4]/5" : "border-gray-100 hover:border-gray-200"}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStores.includes(store.id)}
                    onChange={e => {
                      if (e.target.checked)
                        setSelectedStores([...selectedStores, store.id]);
                      else
                        setSelectedStores(
                          selectedStores.filter(id => id !== store.id)
                        );
                    }}
                    className="w-5 h-5 accent-[#05C3D4] rounded"
                  />
                  <span className="font-medium text-sm">{store.name}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl"
              >
                Назад
              </button>
              <button
                onClick={handleFetchCategories}
                disabled={categoriesQuery.isFetching}
                className="flex items-center gap-2 px-8 py-3 bg-[#15171A] hover:bg-black text-white rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {categoriesQuery.isFetching ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  "Далее: Выбор категорий"
                )}
              </button>
            </div>
            {connectionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {connectionError}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Sync Options & Run */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold">
              Шаг 3. Выбор категорий и запуск
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div>
                <div className="text-xs font-bold text-gray-500 mb-1">Активный профиль</div>
                <select
                  value={profiles.find(p => p.isDefault)?.id ?? ""}
                  onChange={e => {
                    const id = Number(e.target.value);
                    if (id) setActiveProfileMutation.mutate({ id });
                  }}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">Выберите профиль</option>
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 mb-1">Сохранить как новый профиль</div>
                <div className="flex gap-2">
                  <input
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="Название профиля"
                  />
                  <button
                    onClick={handleCreateProfile}
                    disabled={createProfileMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-[#15171A] text-white text-sm font-bold disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Categories Tree */}
              <div className="bg-gray-50 rounded-2xl p-6 max-h-[400px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold">Категории МойСклад</h4>
                  <button
                    onClick={() =>
                      setSelectedCategories(
                        selectedCategories.length === categories.length
                          ? []
                          : categories.map(c => c.id)
                      )
                    }
                    className="text-xs text-[#05C3D4] font-bold"
                  >
                    {selectedCategories.length === categories.length
                      ? "Снять все"
                      : "Выбрать все"}
                  </button>
                </div>
                <div className="space-y-2">
                  {renderCategoryTree(null, 0)}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-6">
                <h4 className="font-bold">Параметры обновления</h4>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer p-4 border border-gray-100 rounded-xl hover:border-[#05C3D4] transition-all">
                    <input
                      type="checkbox"
                      checked={syncProducts}
                      onChange={e => setSyncProducts(e.target.checked)}
                      className="w-5 h-5 accent-[#05C3D4] rounded"
                    />
                    <div>
                      <div className="font-bold text-sm">Обновлять товары</div>
                      <div className="text-xs text-gray-500">
                        Названия, описания, картинки, характеристики
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-4 border border-gray-100 rounded-xl hover:border-[#05C3D4] transition-all">
                    <input
                      type="checkbox"
                      checked={syncStocks}
                      onChange={e => setSyncStocks(e.target.checked)}
                      className="w-5 h-5 accent-[#05C3D4] rounded"
                    />
                    <div>
                      <div className="font-bold text-sm">Обновлять остатки</div>
                      <div className="text-xs text-gray-500">
                        Только для выбранных складов ({selectedStores.length})
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-4 border border-gray-100 rounded-xl hover:border-[#05C3D4] transition-all">
                    <input
                      type="checkbox"
                      checked={syncPrices}
                      onChange={e => setSyncPrices(e.target.checked)}
                      className="w-5 h-5 accent-[#05C3D4] rounded"
                    />
                    <div>
                      <div className="font-bold text-sm">Обновлять цены</div>
                      <div className="text-xs text-gray-500">
                        Розничная цена
                      </div>
                    </div>
                  </label>
                </div>

                <div className="pt-4">
                  {lockStatus?.locked && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                      Синхронизация уже выполняется. Повторите позже.
                    </div>
                  )}
                  <button
                    onClick={handleSaveConfig}
                    disabled={saveConfigMutation.isPending}
                    className="mb-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-white border border-gray-200 hover:border-[#05C3D4] disabled:opacity-50"
                  >
                    {saveConfigMutation.isPending ? (
                      <RefreshCw className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    {saveConfigMutation.isPending
                      ? "Сохранение..."
                      : "Сохранить как конфиг по умолчанию"}
                  </button>
                  <button
                    onClick={handleRunSync}
                    disabled={syncMutation.isPending || lockStatus?.locked}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all bg-[#05C3D4] hover:bg-[#04a9b8] text-black shadow-[0_0_20px_rgba(5,195,212,0.3)] disabled:opacity-50"
                  >
                    {syncMutation.isPending ? (
                      <RefreshCw className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    {syncMutation.isPending
                      ? "Синхронизация..."
                      : lockStatus?.locked
                        ? "Синхронизация уже запущена"
                      : "Запустить синхронизацию"}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 mt-6">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl"
              >
                Назад
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
          <div className="text-xs text-gray-500 font-bold">Webhook lag</div>
          <div className="text-2xl font-black text-[#15171A]">
            {syncOverview?.webhookLagMinutes ?? 0}м
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
          <div className="text-xs text-gray-500 font-bold">Failed</div>
          <div className="text-2xl font-black text-amber-600">
            {syncOverview?.failedCount ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
          <div className="text-xs text-gray-500 font-bold">Dead</div>
          <div className="text-2xl font-black text-red-600">
            {syncOverview?.deadCount ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
          <div className="text-xs text-gray-500 font-bold">Full sync OK</div>
          <div className="text-xs font-bold text-[#15171A] mt-1">
            {syncOverview?.lastFullSuccess
              ? new Date(syncOverview.lastFullSuccess).toLocaleString("ru-RU")
              : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
          <div className="text-xs text-gray-500 font-bold">Reconcile OK</div>
          <div className="text-xs font-bold text-[#15171A] mt-1">
            {syncOverview?.lastReconcileSuccess
              ? new Date(syncOverview.lastReconcileSuccess).toLocaleString("ru-RU")
              : "—"}
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-red-100">
        <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
          <Trash2 size={20} />
          Опасная зона
        </h3>
        <div className="bg-red-50 border border-red-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h4 className="font-bold text-red-900">Полная очистка каталога</h4>
            <p className="text-sm text-red-700 mt-1">
              Это действие удалит все товары, категории, отзывы и остатки из базы данных. Отменить это действие невозможно.
            </p>
          </div>
          <button 
            onClick={() => {
              if (window.confirm("Вы уверены, что хотите ПОЛНОСТЬЮ очистить каталог? Все товары и категории будут удалены.")) {
                wipeCatalogMutation.mutate();
              }
            }}
            disabled={wipeCatalogMutation.isPending}
            className="whitespace-nowrap px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {wipeCatalogMutation.isPending ? "Удаление..." : "Удалить всё и очистить базу"}
          </button>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-[#15171A] flex items-center gap-2">
            <Clock3 size={20} />
            Очередь вебхуков МойСклад
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:border-gray-300 disabled:opacity-50"
            >
              {reconcileMutation.isPending ? "Reconcile..." : "Reconcile остатков"}
            </button>
            <button
              onClick={() => processWebhookQueueMutation.mutate({ limit: 100 })}
              disabled={processWebhookQueueMutation.isPending}
              className="px-4 py-2 rounded-xl bg-[#15171A] text-white text-sm font-bold disabled:opacity-50"
            >
              {processWebhookQueueMutation.isPending ? "Обработка..." : "Обработать очередь"}
            </button>
            <button
              onClick={() => refetchWebhookQueue()}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:border-gray-300"
            >
              Обновить
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 mb-4">
          <div className="text-xs font-bold text-gray-500 mb-3">Чек-лист webhook</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {webhookSetup?.hasSecret ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-600" />
                )}
                <span>Секрет webhook задан</span>
              </div>
              <span className={webhookSetup?.hasSecret ? "text-green-700 font-bold" : "text-amber-700 font-bold"}>
                {webhookSetup?.hasSecret ? "OK" : "Нет"}
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
              <span className={(webhookSetup?.events24h ?? 0) > 0 ? "text-green-700 font-bold" : "text-amber-700 font-bold"}>
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
                <span>Lag в норме (до 10 минут)</span>
              </div>
              <span
                className={(syncOverview?.webhookLagMinutes ?? 0) <= 10 ? "text-green-700 font-bold" : "text-amber-700 font-bold"}
              >
                {syncOverview?.webhookLagMinutes ?? 0}м
              </span>
            </div>
            <div className="text-xs text-gray-500 pt-1">
              Последнее событие:{" "}
              {webhookSetup?.lastEventAt
                ? new Date(webhookSetup.lastEventAt).toLocaleString("ru-RU")
                : "не было"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 mb-4">
          <div className="text-xs font-bold text-gray-500 mb-2">Последние reconcile-запуски</div>
          <div className="space-y-2">
            {reconcileRuns.length === 0 ? (
              <div className="text-sm text-gray-500">Пока запусков нет</div>
            ) : (
              reconcileRuns.slice(0, 5).map(run => (
                <div key={run.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm border-b border-gray-50 pb-2">
                  <div className="font-medium">{run.status}</div>
                  <div className="text-gray-500">
                    {new Date(run.startedAt).toLocaleString("ru-RU")}
                  </div>
                  <div className="text-gray-600">
                    строк: {getRunStats(run.statsJson).rowsProcessed}
                  </div>
                  <div className="text-gray-600">
                    фильтр складов: {getRunStats(run.statsJson).storesFiltered}
                  </div>
                  <div className="text-gray-500">
                    длительность: {getDurationLabel(run.startedAt, run.finishedAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          {[
            { key: "new", label: "Новые" },
            { key: "processing", label: "В обработке" },
            { key: "done", label: "Готово" },
            { key: "failed", label: "Failed" },
            { key: "dead", label: "Dead" },
          ].map(item => (
            <div key={item.key} className="rounded-xl border border-gray-100 bg-white px-4 py-3">
              <div className="text-xs text-gray-500 font-bold">{item.label}</div>
              <div className="text-2xl font-black text-[#15171A]">
                {queueByStatus[item.key] ?? 0}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-500 mb-4">
          Эти счетчики заполняются только если в МойСклад настроен webhook на
          <span className="font-mono"> /api/webhooks/moysklad</span>. Нули — это нормально, если webhook еще не подключен или не было событий.
        </div>

        {failedOrDeadRows.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <AlertTriangle size={18} />
                Ошибочные события: {failedOrDeadRows.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (allFailedOrDeadSelected) {
                      setSelectedWebhookIds(prev =>
                        prev.filter(id => !failedOrDeadRows.some(row => row.id === id))
                      );
                    } else {
                      setSelectedWebhookIds(
                        Array.from(new Set([...selectedWebhookIds, ...failedOrDeadRows.map(row => row.id)]))
                      );
                    }
                  }}
                  className="px-3 py-2 text-xs rounded-lg border border-amber-300 text-amber-800 font-bold"
                >
                  {allFailedOrDeadSelected ? "Снять выделение" : "Выделить все"}
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
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  <RotateCcw size={14} />
                  {retryWebhookEventsMutation.isPending ? "Retry..." : "Retry selected"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 w-10">#</th>
                  <th className="text-left px-3 py-2">Тип</th>
                  <th className="text-left px-3 py-2">Статус</th>
                  <th className="text-left px-3 py-2">Попытки</th>
                  <th className="text-left px-3 py-2">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {webhookRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      Событий пока нет. Проверьте webhook в МойСклад и секрет в настройках.
                    </td>
                  </tr>
                ) : (
                  webhookRows.map(row => (
                    <tr key={row.id} className="border-b border-gray-50">
                      <td className="px-3 py-2">
                        {(row.status === "failed" || row.status === "dead") && (
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
                            className="w-4 h-4 accent-[#05C3D4]"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.eventType}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">{row.attempts}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 max-w-[320px] truncate">
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
  );
}
