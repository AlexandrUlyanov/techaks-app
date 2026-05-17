import {
  KeyRound,
  Loader2,
  Route,
  Save,
  ShieldCheck,
  Trash2,
  Wrench,
  UserCog,
  Bot,
  Cable,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Can } from "@/providers/AbilityProvider";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";
import AdminProfilePanel from "@/components/admin/AdminProfilePanel";
import AdminAuthSettingsPanel from "@/components/admin/AdminAuthSettingsPanel";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";

type SettingsTab = "profile" | "access" | "ai" | "integrations" | "site";

const TABS: Array<{ key: SettingsTab; label: string; icon: typeof UserCog }> = [
  { key: "profile", label: "Профиль", icon: UserCog },
  { key: "access", label: "Доступ", icon: ShieldCheck },
  { key: "ai", label: "ИИ", icon: Bot },
  { key: "integrations", label: "Интеграции", icon: Cable },
  { key: "site", label: "Сайт", icon: Wrench },
];

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.settings.getGemini.useQuery();
  const { data: msData } = trpc.settings.getMoySklad.useQuery();
  const { data: maintenanceData } = trpc.settings.getMaintenanceStatus.useQuery();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [proxyBaseUrl, setProxyBaseUrl] = useState("");
  const [proxyToken, setProxyToken] = useState("");
  const [manufacturerLogoProvider, setManufacturerLogoProvider] =
    useState("logo_dev");
  const [manufacturerLogoToken, setManufacturerLogoToken] = useState("");
  const [msToken, setMsToken] = useState("");
  const [msWebhookSecret, setMsWebhookSecret] = useState("");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceReopenDate, setMaintenanceReopenDate] = useState("");

  useEffect(() => {
    if (maintenanceData) {
      setMaintenanceEnabled(maintenanceData.isEnabled);
      setMaintenanceReopenDate(maintenanceData.reopenDate || "");
    }
  }, [maintenanceData]);

  useEffect(() => {
    if (!data) return;
    setApiKey("");
    setModel(data.model || "gemini-2.5-flash");
    setProxyBaseUrl(data.proxyBaseUrl || "");
    setProxyToken("");
    setManufacturerLogoProvider(data.manufacturerLogoProvider || "logo_dev");
    setManufacturerLogoToken("");
  }, [data]);

  const saveMaintenanceMutation = trpc.settings.saveMaintenanceSettings.useMutation({
    onSuccess: () => {
      utils.settings.getMaintenanceStatus.invalidate();
      alert("Настройки техобслуживания сохранены.");
    },
  });

  const saveMutation = trpc.settings.saveGemini.useMutation({
    onSuccess: () => {
      utils.settings.getGemini.invalidate();
      alert("Настройки Gemini сохранены.");
      setApiKey("");
      setProxyToken("");
    },
  });

  const saveMsMutation = trpc.settings.saveMoySklad.useMutation({
    onSuccess: () => {
      utils.settings.getMoySklad.invalidate();
      alert("Настройки МойСклад сохранены.");
      setMsToken("");
      setMsWebhookSecret("");
    },
  });

  const clearMsMutation = trpc.settings.clearMoySkladToken.useMutation({
    onSuccess: () => {
      utils.settings.getMoySklad.invalidate();
      alert("Токен МойСклад удален.");
      setMsToken("");
    },
  });

  const clearMsWebhookSecretMutation =
    trpc.settings.clearMoySkladWebhookSecret.useMutation({
      onSuccess: () => {
        utils.settings.getMoySklad.invalidate();
        alert("Секрет вебхука МойСклад удален.");
        setMsWebhookSecret("");
      },
    });

  const testMutation = trpc.settings.testGemini.useMutation({
    onSuccess: () => {
      alert("Подключение к Gemini успешно проверено.");
    },
  });

  const clearMutation = trpc.settings.clearGeminiApiKey.useMutation({
    onSuccess: () => {
      utils.settings.getGemini.invalidate();
      alert("Сохраненный API-ключ удален.");
      setApiKey("");
    },
  });

  const clearProxyMutation = trpc.settings.clearAiProxyToken.useMutation({
    onSuccess: () => {
      utils.settings.getGemini.invalidate();
      alert("Сохраненный токен роутера удален.");
      setProxyToken("");
    },
  });

  const saveManufacturerLogosMutation =
    trpc.settings.saveManufacturerLogoSettings.useMutation({
      onSuccess: () => {
        utils.settings.getGemini.invalidate();
        alert("Настройки поиска логотипов сохранены.");
        setManufacturerLogoToken("");
      },
    });

  const clearManufacturerLogoTokenMutation =
    trpc.settings.clearManufacturerLogoToken.useMutation({
      onSuccess: () => {
        utils.settings.getGemini.invalidate();
        alert("Токен Logo.dev удален.");
        setManufacturerLogoToken("");
      },
    });

  const statusCards = useMemo(
    () => [
      {
        label: "Gemini",
        value: data?.isConfigured ? "Подключено" : "Не подключено",
        hint: data?.proxyBaseUrl ? "Через AI Router" : "Прямой или .env fallback",
        tone: data?.isConfigured ? "success" : "warning",
      },
      {
        label: "МойСклад",
        value: msData?.hasToken ? "Токен сохранён" : "Токен не задан",
        hint: msData?.hasWebhookSecret ? "Секрет вебхука задан" : "Без секрета вебхука",
        tone: msData?.hasToken ? "success" : "warning",
      },
      {
        label: "Сайт",
        value: maintenanceEnabled ? "Техобслуживание" : "Онлайн",
        hint: maintenanceEnabled
          ? maintenanceReopenDate || "Дата открытия не указана"
          : "Обычный режим",
        tone: maintenanceEnabled ? "warning" : "accent",
      },
    ] as const,
    [data?.isConfigured, data?.proxyBaseUrl, maintenanceEnabled, maintenanceReopenDate, msData]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Контур управления"
        title="Настройки и интеграции"
        description="Здесь собраны только рабочие настройки: доступ, внешние интеграции, режим сайта и сервисные параметры. Длинный экран разбит на смысловые зоны, чтобы нужный блок находился быстрее."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {statusCards.map(card => (
          <AdminStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            hint={card.hint}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[#05C3D4] text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-[#05C3D4]"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "profile" ? (
        <div className="space-y-6">
          <AdminSection
            title="Личный профиль"
            description="Рабочая информация текущего администратора. Здесь нет сервисных интеграций и вторичных параметров."
          >
            <AdminProfilePanel />
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "access" ? (
        <div className="space-y-6">
          <Can I="read" a="User">
            <AdminSection
              title="Пользователи и роли"
              description="Управление доступом сотрудников. Здесь собраны роли, статусы и административные действия по пользователям."
            >
              <AdminUsersPanel />
            </AdminSection>
          </Can>

          <Can I="configure" a="Settings">
            <AdminSection
              title="Авторизация и безопасность"
              description="Настройки входа, ключей и рабочих параметров авторизации."
            >
              <AdminAuthSettingsPanel />
            </AdminSection>
          </Can>
        </div>
      ) : null}

      {activeTab === "ai" ? (
        <div className="space-y-6">
          <AdminSection
            title="Gemini API"
            description="Ключ нужен для предложений ИИ в стандартизации характеристик по категориям. Основные статусы показаны компактно, а опасные действия вынесены отдельно."
          >
            {isLoading ? (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Loader2 size={18} className="animate-spin" />
                Загружаю настройки...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Модель</label>
                    <input
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      placeholder="gemini-2.5-flash"
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">
                      Сохраненный ключ
                    </label>
                    <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500">
                      {data?.apiKeyMasked || "Ключ пока не задан"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">
                      AI Proxy URL
                    </label>
                    <div className="relative">
                      <Route
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        value={proxyBaseUrl}
                        onChange={e => setProxyBaseUrl(e.target.value)}
                        placeholder="https://your-ai-router-xxxx.run.app"
                        className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">
                      Токен роутера
                    </label>
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={proxyToken}
                        onChange={e => setProxyToken(e.target.value)}
                        placeholder={
                          data?.proxyTokenMasked
                            ? "Оставьте пустым, чтобы сохранить текущий токен"
                            : "Bearer token для AI Router"
                        }
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                      <div className="text-xs text-gray-500">
                        {data?.proxyTokenMasked || "Токен роутера пока не задан"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Новый API-ключ
                  </label>
                  <div className="relative">
                    <KeyRound
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={
                        data?.hasApiKey
                          ? "Оставьте пустым, чтобы сохранить текущий ключ"
                          : "Вставьте Gemini API key"
                      }
                      className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                </div>

                {(saveMutation.error ||
                  testMutation.error ||
                  clearMutation.error ||
                  clearProxyMutation.error) && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {saveMutation.error?.message ||
                      testMutation.error?.message ||
                      clearMutation.error?.message ||
                      clearProxyMutation.error?.message}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      saveMutation.mutate({
                        apiKey,
                        model,
                        proxyBaseUrl,
                        proxyToken,
                      })
                    }
                    disabled={saveMutation.isPending || !model.trim()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Сохранить
                  </button>

                  <button
                    onClick={() =>
                      testMutation.mutate({
                        apiKey: apiKey.trim() || undefined,
                        model,
                        proxyBaseUrl: proxyBaseUrl.trim() || undefined,
                        proxyToken: proxyToken.trim() || undefined,
                      })
                    }
                    disabled={testMutation.isPending || !model.trim()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-[#15171A] disabled:opacity-50"
                  >
                    {testMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    Проверить подключение
                  </button>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="mb-3 text-sm font-bold text-red-800">
                    Опасные действия
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (!confirm("Удалить сохраненный API-ключ Gemini?")) return;
                        clearMutation.mutate();
                      }}
                      disabled={clearMutation.isPending || data?.source === "env"}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      {clearMutation.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      Удалить ключ
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm("Удалить сохраненный токен AI Router?")) return;
                        clearProxyMutation.mutate();
                      }}
                      disabled={
                        clearProxyMutation.isPending || data?.proxySource === "env"
                      }
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      {clearProxyMutation.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      Удалить токен роутера
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AdminSection>

          <AdminSection
            title="Поиск логотипов производителей"
            description="Для кнопки «Собрать логотипы» в товарах. Сначала ищем логотип по домену бренда, затем — по названию производителя."
          >
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">Провайдер</label>
                  <select
                    value={manufacturerLogoProvider}
                    onChange={e => setManufacturerLogoProvider(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  >
                    <option value="logo_dev">Logo.dev</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Сохраненный токен Logo.dev
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500">
                    {data?.manufacturerLogoLogoDevTokenMasked || "Токен пока не задан"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#15171A]">
                  Новый publishable token Logo.dev
                </label>
                <input
                  type="password"
                  value={manufacturerLogoToken}
                  onChange={e => setManufacturerLogoToken(e.target.value)}
                  placeholder={
                    data?.manufacturerLogoLogoDevTokenMasked
                      ? "Оставьте пустым, чтобы сохранить текущий токен"
                      : "Вставьте token для Logo.dev"
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                />
                <p className="text-xs leading-5 text-gray-500">
                  Если логотип не найден, система сохраняет аккуратную локальную
                  заглушку с инициалами бренда.
                </p>
              </div>

              {(saveManufacturerLogosMutation.error ||
                clearManufacturerLogoTokenMutation.error) && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveManufacturerLogosMutation.error?.message ||
                    clearManufacturerLogoTokenMutation.error?.message}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    saveManufacturerLogosMutation.mutate({
                      provider: manufacturerLogoProvider,
                      logoDevToken: manufacturerLogoToken,
                    })
                  }
                  disabled={saveManufacturerLogosMutation.isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
                >
                  {saveManufacturerLogosMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Сохранить настройки логотипов
                </button>

                <button
                  onClick={() => {
                    if (!confirm("Удалить сохраненный токен Logo.dev?")) return;
                    clearManufacturerLogoTokenMutation.mutate();
                  }}
                  disabled={clearManufacturerLogoTokenMutation.isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                >
                  {clearManufacturerLogoTokenMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Удалить токен
                </button>
              </div>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "integrations" ? (
        <div className="space-y-6">
          <AdminSection
            title="МойСклад"
            description="API-токен используется для синхронизации товаров, остатков и цен. Секрет вебхука нужен для безопасного приема событий от МойСклад."
          >
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Сохраненный токен
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500">
                    {msData?.tokenMasked || "Токен пока не задан"}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Новый API-токен
                  </label>
                  <input
                    type="password"
                    value={msToken}
                    onChange={e => setMsToken(e.target.value)}
                    placeholder={
                      msData?.hasToken
                        ? "Оставьте пустым, чтобы сохранить текущий токен"
                        : "Вставьте API-токен МойСклад"
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Сохраненный секрет вебхука
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500">
                    {msData?.webhookSecretMasked || "Секрет вебхука пока не задан"}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Новый секрет вебхука
                  </label>
                  <input
                    type="password"
                    value={msWebhookSecret}
                    onChange={e => setMsWebhookSecret(e.target.value)}
                    placeholder={
                      msData?.hasWebhookSecret
                        ? "Оставьте пустым, чтобы сохранить текущий секрет"
                        : "Вставьте секрет для /api/webhooks/moysklad"
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              {(saveMsMutation.error ||
                clearMsMutation.error ||
                clearMsWebhookSecretMutation.error) && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveMsMutation.error?.message ||
                    clearMsMutation.error?.message ||
                    clearMsWebhookSecretMutation.error?.message}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    saveMsMutation.mutate({
                      token: msToken,
                      webhookSecret: msWebhookSecret,
                    })
                  }
                  disabled={
                    saveMsMutation.isPending ||
                    (!msToken.trim() && !msWebhookSecret.trim())
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
                >
                  {saveMsMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Сохранить настройки МойСклад
                </button>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                URL для вебхука МойСклад:{" "}
                <span className="font-mono">
                  https://techaks.ru/api/webhooks/moysklad
                </span>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="mb-3 text-sm font-bold text-red-800">
                  Опасные действия
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      if (!confirm("Удалить сохраненный токен МойСклад?")) return;
                      clearMsMutation.mutate();
                    }}
                    disabled={clearMsMutation.isPending}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                  >
                    {clearMsMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Удалить токен
                  </button>

                  <button
                    onClick={() => {
                      if (!confirm("Удалить сохраненный секрет вебхука МойСклад?")) {
                        return;
                      }
                      clearMsWebhookSecretMutation.mutate();
                    }}
                    disabled={clearMsWebhookSecretMutation.isPending}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                  >
                    {clearMsWebhookSecretMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Удалить секрет вебхука
                  </button>
                </div>
              </div>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "site" ? (
        <div className="space-y-6">
          <AdminSection
            title="Техническое обслуживание"
            description="Временное отключение сайта для пользователей. В это время показывается страница-заглушка с обратным отсчетом."
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={maintenanceEnabled}
                    onChange={e => setMaintenanceEnabled(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#05C3D4] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#05C3D4]/20"></div>
                </label>
                <span className="text-sm font-bold text-[#15171A]">
                  {maintenanceEnabled ? "Сайт отключен" : "Сайт активен"}
                </span>
              </div>

              {maintenanceEnabled ? (
                <div className="max-w-md space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Дата и время открытия
                  </label>
                  <input
                    type="datetime-local"
                    value={maintenanceReopenDate}
                    onChange={e => setMaintenanceReopenDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                  <p className="text-xs text-gray-500">
                    Укажите время, когда сайт автоматически вернется в обычный режим.
                  </p>
                </div>
              ) : null}

              {saveMaintenanceMutation.error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveMaintenanceMutation.error.message}
                </div>
              ) : null}

              <button
                onClick={() =>
                  saveMaintenanceMutation.mutate({
                    isEnabled: maintenanceEnabled,
                    reopenDate: maintenanceReopenDate || null,
                  })
                }
                disabled={saveMaintenanceMutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {saveMaintenanceMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Сохранить режим обслуживания
              </button>
            </div>
          </AdminSection>
        </div>
      ) : null}
    </div>
  );
}
