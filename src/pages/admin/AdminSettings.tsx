import {
  KeyRound,
  Loader2,
  RefreshCcw,
  Route,
  Save,
  ShieldCheck,
  Trash2,
  Wrench,
  UserCog,
  Bot,
  Cable,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Can } from "@/providers/AbilityProvider";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";
import AdminProfilePanel from "@/components/admin/AdminProfilePanel";
import AdminAuthSettingsPanel from "@/components/admin/AdminAuthSettingsPanel";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";

type SettingsTab = "profile" | "access" | "ai" | "integrations" | "payment" | "site";

const TABS: Array<{ key: SettingsTab; label: string; icon: typeof UserCog }> = [
  { key: "profile", label: "Профиль", icon: UserCog },
  { key: "access", label: "Доступ", icon: ShieldCheck },
  { key: "ai", label: "ИИ", icon: Bot },
  { key: "integrations", label: "Интеграции", icon: Cable },
  { key: "payment", label: "Оплата", icon: CreditCard },
  { key: "site", label: "Сайт", icon: Wrench },
];

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const { data, isLoading } = trpc.settings.getGemini.useQuery();
  const { data: msData } = trpc.settings.getMoySklad.useQuery();
  const { data: maintenanceData } = trpc.settings.getMaintenanceStatus.useQuery();
  const { data: reservationSettings } = trpc.settings.getReservationSettings.useQuery();
  const { data: siteProfileSettings } = trpc.settings.getSiteProfileSettings.useQuery();
  const { data: homepageHeroSettings } = trpc.settings.getHomepageHeroSettings.useQuery(
    undefined,
    { enabled: activeTab === "site" }
  );
  const { data: homepageSnapshotStatus } = trpc.home.getSnapshotStatus.useQuery(
    undefined,
    { enabled: activeTab === "site" }
  );

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
  const [reservationDurationMinutes, setReservationDurationMinutes] = useState(180);
  const [homepageHeroVariant, setHomepageHeroVariant] = useState<
    "classic" | "interactive"
  >("classic");
  const [siteProfileForm, setSiteProfileForm] = useState({
    contacts: {
      primaryPhone: "",
      primaryPhoneDisplay: "",
      secondaryPhone: "",
      email: "",
      workingHours: "",
      shortAddress: "",
      fullAddress: "",
    },
    seller: {
      legalForm: "ip" as "ip" | "ooo",
      fullName: "",
      shortName: "",
      signatoryName: "",
      signatoryLabel: "",
      signatoryBasis: "",
      legalAddress: "",
      actualAddress: "",
      inn: "",
      ogrnip: "",
      kpp: "",
      okpo: "",
      email: "",
      phone: "",
    },
    bank: {
      bankName: "",
      account: "",
      corrAccount: "",
      bik: "",
      inn: "",
      kpp: "",
    },
    legalTexts: {
      offerTitle: "",
      offerContent: "",
      privacyPolicyTitle: "",
      privacyPolicyContent: "",
      paymentDeliveryTitle: "",
      paymentDeliveryContent: "",
      returnsPolicyTitle: "",
      returnsPolicyContent: "",
    },
    documents: {
      signatureName: "",
      signatureLabel: "",
      requisitesFooter: "",
    },
  });

  useEffect(() => {
    if (maintenanceData) {
      setMaintenanceEnabled(maintenanceData.isEnabled);
      setMaintenanceReopenDate(maintenanceData.reopenDate || "");
    }
  }, [maintenanceData]);

  useEffect(() => {
    if (reservationSettings) {
      setReservationDurationMinutes(reservationSettings.durationMinutes);
    }
  }, [reservationSettings]);

  useEffect(() => {
    if (!data) return;
    setApiKey("");
    setModel(data.model || "gemini-2.5-flash");
    setProxyBaseUrl(data.proxyBaseUrl || "");
    setProxyToken("");
    setManufacturerLogoProvider(data.manufacturerLogoProvider || "logo_dev");
    setManufacturerLogoToken("");
  }, [data]);

  useEffect(() => {
    if (!siteProfileSettings) return;
    setSiteProfileForm(siteProfileSettings);
  }, [siteProfileSettings]);

  useEffect(() => {
    if (!homepageHeroSettings?.variant) return;
    setHomepageHeroVariant(homepageHeroSettings.variant);
  }, [homepageHeroSettings]);

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

  const saveReservationSettingsMutation =
    trpc.settings.saveReservationSettings.useMutation({
      onSuccess: () => {
        utils.settings.getReservationSettings.invalidate();
        alert("Настройки резерва сохранены.");
      },
    });
  const saveSiteProfileMutation =
    trpc.settings.saveSiteProfileSettings.useMutation({
      onSuccess: () => {
        utils.settings.getSiteProfileSettings.invalidate();
        utils.settings.getPublicSiteProfile.invalidate();
        utils.home.getSnapshotStatus.invalidate();
        alert("Профиль сайта и реквизиты сохранены.");
      },
    });
  const refreshHomepageSnapshotMutation = trpc.home.refreshSnapshot.useMutation({
    onSuccess: result => {
      utils.home.getPageData.invalidate();
      utils.home.getSnapshotStatus.invalidate();
      alert(
        `Главная пересобрана. Категорий: ${result.counts.categories}, товаров недели: ${result.counts.weekProducts}.`
      );
    },
  });
  const saveHomepageHeroMutation =
    trpc.settings.saveHomepageHeroSettings.useMutation({
      onSuccess: () => {
        utils.settings.getHomepageHeroSettings.invalidate();
        alert("Версия hero главной страницы сохранена.");
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

  const updateContactField = <
    K extends keyof typeof siteProfileForm.contacts,
  >(
    key: K,
    value: (typeof siteProfileForm.contacts)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      contacts: { ...prev.contacts, [key]: value },
    }));
  };

  const updateSellerField = <
    K extends keyof typeof siteProfileForm.seller,
  >(
    key: K,
    value: (typeof siteProfileForm.seller)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      seller: { ...prev.seller, [key]: value },
    }));
  };

  const updateBankField = <K extends keyof typeof siteProfileForm.bank>(
    key: K,
    value: (typeof siteProfileForm.bank)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      bank: { ...prev.bank, [key]: value },
    }));
  };

  const updateLegalField = <
    K extends keyof typeof siteProfileForm.legalTexts,
  >(
    key: K,
    value: (typeof siteProfileForm.legalTexts)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      legalTexts: { ...prev.legalTexts, [key]: value },
    }));
  };

  const updateDocumentField = <
    K extends keyof typeof siteProfileForm.documents,
  >(
    key: K,
    value: (typeof siteProfileForm.documents)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      documents: { ...prev.documents, [key]: value },
    }));
  };

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

      {activeTab === "payment" ? (
        <div className="space-y-6">
          <Can I="manage_payment_settings" a="Settings">
            <AdminSection
              title="Оплата"
              description="Платежные провайдеры и безопасные ключи. Доступ к этому разделу есть только у администраторов с правом управления платежными настройками."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Link
                  to="/admin/settings/payment/yookassa"
                  className="group rounded-2xl bg-[#F6F7F8] p-5 transition-colors hover:bg-[#E8FAFC]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-black text-[#15171A]">
                        <CreditCard size={18} className="text-[#05C3D4]" />
                        YooKassa
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        Shop ID, Secret Key, режим оплаты, return URL и webhook.
                      </p>
                    </div>
                    <ArrowRight
                      size={18}
                      className="text-[#05C3D4] transition-transform group-hover:translate-x-1"
                    />
                  </div>
                </Link>
              </div>
            </AdminSection>
          </Can>
        </div>
      ) : null}

      {activeTab === "site" ? (
        <div className="space-y-6">
          <AdminSection
            title="Hero главной страницы"
            description="Текущая версия первого экрана сохранена как безопасный базовый вариант. Здесь можно переключать hero и в любой момент возвращаться к тому виду, который сейчас используется на сайте."
            tone="accent"
            actions={
              <button
                onClick={() =>
                  saveHomepageHeroMutation.mutate({
                    variant: homepageHeroVariant,
                  })
                }
                disabled={
                  saveHomepageHeroMutation.isPending || !homepageHeroVariant
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {saveHomepageHeroMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Сохранить hero
              </button>
            }
          >
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                {(homepageHeroSettings?.options ?? []).map(option => {
                  const isActive = homepageHeroVariant === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setHomepageHeroVariant(option.value)}
                      className={`rounded-2xl border p-5 text-left transition ${
                        isActive
                          ? "border-[#05C3D4] bg-[#EAFBFD]"
                          : "border-gray-200 bg-white hover:border-[#05C3D4]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-black text-[#15171A]">
                            {option.label}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-gray-500">
                            {option.description}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            isActive
                              ? "bg-[#05C3D4] text-black"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {isActive ? "Активно" : "Доступно"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <span className="font-black text-[#15171A]">Сейчас на сайте:</span>{" "}
                {homepageHeroVariant === "interactive"
                  ? "интерактивный hero"
                  : "классический hero (текущая версия)"}.
                {homepageHeroSettings?.isDefault ? (
                  <span>
                    {" "}
                    Настройка ещё не менялась вручную, поэтому используется сохранённый
                    базовый вариант.
                  </span>
                ) : null}
              </div>

              {saveHomepageHeroMutation.error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveHomepageHeroMutation.error.message}
                </div>
              ) : null}
            </div>
          </AdminSection>

          <AdminSection
            title="Snapshot главной страницы"
            description="Главная теперь может отдаваться из заранее собранного JSON-снимка. Это ускоряет первый ответ, переживает рестарты и даёт понятный ручной контроль."
            tone="accent"
            actions={
              <button
                onClick={() => refreshHomepageSnapshotMutation.mutate()}
                disabled={refreshHomepageSnapshotMutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {refreshHomepageSnapshotMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCcw size={16} />
                )}
                Пересобрать главную
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Snapshot
                </div>
                <div className="mt-2 text-lg font-black text-[#15171A]">
                  {homepageSnapshotStatus?.hasSnapshot ? "Есть" : "Ещё не собран"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {homepageSnapshotStatus?.generatedAt
                    ? new Date(homepageSnapshotStatus.generatedAt).toLocaleString("ru-RU")
                    : "После первой сборки здесь появится время генерации"}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Состояние
                </div>
                <div className="mt-2 text-lg font-black text-[#15171A]">
                  {homepageSnapshotStatus?.refreshInProgress
                    ? "Пересобирается"
                    : homepageSnapshotStatus?.isStale
                      ? "Устарел"
                      : "Свежий"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  TTL: {homepageSnapshotStatus?.ttlMinutes ?? 5} минут
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Возраст
                </div>
                <div className="mt-2 text-lg font-black text-[#15171A]">
                  {homepageSnapshotStatus?.ageSeconds !== null &&
                  homepageSnapshotStatus?.ageSeconds !== undefined
                    ? `${Math.round(homepageSnapshotStatus.ageSeconds / 60)} мин`
                    : "—"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Пока snapshot свежий, главная не ждёт live-сборку
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Время сборки
                </div>
                <div className="mt-2 text-lg font-black text-[#15171A]">
                  {homepageSnapshotStatus?.buildMs !== null &&
                  homepageSnapshotStatus?.buildMs !== undefined
                    ? `${homepageSnapshotStatus.buildMs} мс`
                    : "—"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Версия: {homepageSnapshotStatus?.sourceVersion || "homepage_snapshot_v1"}
                </div>
              </div>
            </div>

            {homepageSnapshotStatus?.lastError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Последняя ошибка пересборки: {homepageSnapshotStatus.lastError}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Публичная главная читает заранее собранный snapshot из базы. Если снимок устарел, витрина всё равно отдаёт его сразу и тихо запускает обновление в фоне.
              </div>
            )}
          </AdminSection>

          <AdminSection
            title="Профиль сайта и продавца"
            description="Единый источник контактов, реквизитов и правовых текстов. Эти данные должны потом использоваться в Header, Footer, Контактах, checkout и документах без захардкоженных строк."
            tone="accent"
            actions={
              <button
                onClick={() => saveSiteProfileMutation.mutate(siteProfileForm)}
                disabled={saveSiteProfileMutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {saveSiteProfileMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Сохранить профиль сайта
              </button>
            }
          >
            <div className="space-y-8">
              <div className="grid gap-8 xl:grid-cols-2">
                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <h3 className="text-sm font-black text-[#15171A]">Публичные контакты</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Эти данные пойдут в Header, Footer, Контакты, mobile bar и trust-блоки сайта.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Телефон для ссылки</label>
                      <input
                        value={siteProfileForm.contacts.primaryPhone}
                        onChange={e => updateContactField("primaryPhone", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="+7 (927) 364-28-88"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Телефон для показа</label>
                      <input
                        value={siteProfileForm.contacts.primaryPhoneDisplay}
                        onChange={e =>
                          updateContactField("primaryPhoneDisplay", e.target.value)
                        }
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="+7 (927) 364-28-88"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Доп. телефон</label>
                      <input
                        value={siteProfileForm.contacts.secondaryPhone}
                        onChange={e => updateContactField("secondaryPhone", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="+7 (927) 364-28-88 (доб.3)"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Email</label>
                      <input
                        type="email"
                        value={siteProfileForm.contacts.email}
                        onChange={e => updateContactField("email", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="tech.aks@yandex.ru"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Часы работы</label>
                      <input
                        value={siteProfileForm.contacts.workingHours}
                        onChange={e => updateContactField("workingHours", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="Ежедневно 9:00–21:00"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Короткий адрес</label>
                      <input
                        value={siteProfileForm.contacts.shortAddress}
                        onChange={e => updateContactField("shortAddress", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="Пенза"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Полный адрес</label>
                      <textarea
                        value={siteProfileForm.contacts.fullAddress}
                        onChange={e => updateContactField("fullAddress", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="Полный почтовый адрес"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <h3 className="text-sm font-black text-[#15171A]">Профиль продавца</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Эти данные нужны для оферты, реквизитов сторон, checkout и будущих документов.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Форма</label>
                      <select
                        value={siteProfileForm.seller.legalForm}
                        onChange={e =>
                          updateSellerField("legalForm", e.target.value as "ip" | "ooo")
                        }
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      >
                        <option value="ip">ИП</option>
                        <option value="ooo">ООО</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Короткое имя</label>
                      <input
                        value={siteProfileForm.seller.shortName}
                        onChange={e => updateSellerField("shortName", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Полное наименование</label>
                    <input
                      value={siteProfileForm.seller.fullName}
                      onChange={e => updateSellerField("fullName", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Подписант</label>
                      <input
                        value={siteProfileForm.seller.signatoryName}
                        onChange={e => updateSellerField("signatoryName", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Подпись</label>
                      <input
                        value={siteProfileForm.seller.signatoryLabel}
                        onChange={e => updateSellerField("signatoryLabel", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Основание подписания</label>
                    <input
                      value={siteProfileForm.seller.signatoryBasis}
                      onChange={e => updateSellerField("signatoryBasis", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">ИНН</label>
                      <input
                        value={siteProfileForm.seller.inn}
                        onChange={e => updateSellerField("inn", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">
                        {siteProfileForm.seller.legalForm === "ip" ? "ОГРНИП" : "ОГРН"}
                      </label>
                      <input
                        value={siteProfileForm.seller.ogrnip}
                        onChange={e => updateSellerField("ogrnip", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">КПП</label>
                      <input
                        value={siteProfileForm.seller.kpp}
                        onChange={e => updateSellerField("kpp", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">ОКПО</label>
                      <input
                        value={siteProfileForm.seller.okpo}
                        onChange={e => updateSellerField("okpo", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Email продавца</label>
                      <input
                        type="email"
                        value={siteProfileForm.seller.email}
                        onChange={e => updateSellerField("email", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Телефон продавца</label>
                      <input
                        value={siteProfileForm.seller.phone}
                        onChange={e => updateSellerField("phone", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Юридический адрес</label>
                      <textarea
                        value={siteProfileForm.seller.legalAddress}
                        onChange={e => updateSellerField("legalAddress", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Фактический адрес</label>
                      <textarea
                        value={siteProfileForm.seller.actualAddress}
                        onChange={e => updateSellerField("actualAddress", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-8 xl:grid-cols-2">
                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <h3 className="text-sm font-black text-[#15171A]">Банк и реквизиты</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Используются в оферте, реквизитах сторон и будущих документных шаблонах.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Банк</label>
                    <input
                      value={siteProfileForm.bank.bankName}
                      onChange={e => updateBankField("bankName", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Р/с</label>
                      <input
                        value={siteProfileForm.bank.account}
                        onChange={e => updateBankField("account", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">К/с</label>
                      <input
                        value={siteProfileForm.bank.corrAccount}
                        onChange={e => updateBankField("corrAccount", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">БИК</label>
                      <input
                        value={siteProfileForm.bank.bik}
                        onChange={e => updateBankField("bik", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">ИНН банка</label>
                      <input
                        value={siteProfileForm.bank.inn}
                        onChange={e => updateBankField("inn", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">КПП банка</label>
                      <input
                        value={siteProfileForm.bank.kpp}
                        onChange={e => updateBankField("kpp", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <h3 className="text-sm font-black text-[#15171A]">Preview</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Быстрый контроль того, как выглядит профиль продавца и контактная карточка без переходов по сайту.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                      Контакты сайта
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-[#15171A]">
                      <div className="font-black">{siteProfileForm.contacts.primaryPhoneDisplay}</div>
                      <div>{siteProfileForm.contacts.email}</div>
                      <div className="text-gray-500">{siteProfileForm.contacts.workingHours}</div>
                      <div className="text-gray-500">{siteProfileForm.contacts.fullAddress}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                      Реквизиты сторон
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-[#15171A]">
                      <div className="font-black">{siteProfileForm.seller.fullName}</div>
                      <div>ИНН: {siteProfileForm.seller.inn}</div>
                      <div>
                        {siteProfileForm.seller.legalForm === "ip" ? "ОГРНИП" : "ОГРН"}:{" "}
                        {siteProfileForm.seller.ogrnip}
                      </div>
                      {siteProfileForm.seller.kpp ? <div>КПП: {siteProfileForm.seller.kpp}</div> : null}
                      {siteProfileForm.seller.okpo ? <div>ОКПО: {siteProfileForm.seller.okpo}</div> : null}
                      <div>{siteProfileForm.bank.bankName}</div>
                      <div>р/с: {siteProfileForm.bank.account}</div>
                      <div>к/с: {siteProfileForm.bank.corrAccount}</div>
                      <div>БИК: {siteProfileForm.bank.bik}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                      Подпись и footer
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-[#15171A]">
                      <div>{siteProfileForm.documents.signatureName}</div>
                      <div className="font-black">______________ {siteProfileForm.documents.signatureLabel}</div>
                      <div className="text-gray-500">{siteProfileForm.documents.requisitesFooter}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                <div>
                  <h3 className="text-sm font-black text-[#15171A]">Правовые тексты</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Эти тексты используются для оферты, политики обработки данных, оплаты/доставки и возврата. В этой фазе храним их как безопасный форматированный текст без произвольного HTML.
                  </p>
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Заголовок оферты</label>
                    <input
                      value={siteProfileForm.legalTexts.offerTitle}
                      onChange={e => updateLegalField("offerTitle", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Заголовок политики</label>
                    <input
                      value={siteProfileForm.legalTexts.privacyPolicyTitle}
                      onChange={e => updateLegalField("privacyPolicyTitle", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Оферта</label>
                    <textarea
                      value={siteProfileForm.legalTexts.offerContent}
                      onChange={e => updateLegalField("offerContent", e.target.value)}
                      rows={9}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Политика обработки данных</label>
                    <textarea
                      value={siteProfileForm.legalTexts.privacyPolicyContent}
                      onChange={e => updateLegalField("privacyPolicyContent", e.target.value)}
                      rows={9}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Заголовок оплаты и доставки</label>
                    <input
                      value={siteProfileForm.legalTexts.paymentDeliveryTitle}
                      onChange={e =>
                        updateLegalField("paymentDeliveryTitle", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Заголовок возврата</label>
                    <input
                      value={siteProfileForm.legalTexts.returnsPolicyTitle}
                      onChange={e =>
                        updateLegalField("returnsPolicyTitle", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Оплата и доставка</label>
                    <textarea
                      value={siteProfileForm.legalTexts.paymentDeliveryContent}
                      onChange={e =>
                        updateLegalField("paymentDeliveryContent", e.target.value)
                      }
                      rows={8}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Возврат и обмен</label>
                    <textarea
                      value={siteProfileForm.legalTexts.returnsPolicyContent}
                      onChange={e =>
                        updateLegalField("returnsPolicyContent", e.target.value)
                      }
                      rows={8}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Имя подписанта в документах</label>
                    <input
                      value={siteProfileForm.documents.signatureName}
                      onChange={e => updateDocumentField("signatureName", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Сокращённая подпись</label>
                    <input
                      value={siteProfileForm.documents.signatureLabel}
                      onChange={e => updateDocumentField("signatureLabel", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-[#15171A]">Footer реквизитов</label>
                    <textarea
                      value={siteProfileForm.documents.requisitesFooter}
                      onChange={e => updateDocumentField("requisitesFooter", e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                </div>

                {saveSiteProfileMutation.error ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {saveSiteProfileMutation.error.message}
                  </div>
                ) : null}
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Резерв товара"
            description="Срок действия резерва используется на карточке товара и в админке. После истечения срока резерв перестаёт уменьшать доступный остаток."
          >
            <div className="space-y-5">
              <div className="max-w-md space-y-2">
                <label className="text-sm font-bold text-[#15171A]">
                  Срок действия резерва (в минутах)
                </label>
                <input
                  type="number"
                  min={15}
                  max={10080}
                  value={reservationDurationMinutes}
                  onChange={e =>
                    setReservationDurationMinutes(Math.max(15, Number(e.target.value) || 180))
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                />
                <p className="text-xs text-gray-500">
                  По умолчанию резерв держится 180 минут. Истёкшие резервы больше не уменьшают доступный остаток.
                </p>
              </div>

              {saveReservationSettingsMutation.error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveReservationSettingsMutation.error.message}
                </div>
              ) : null}

              <button
                onClick={() =>
                  saveReservationSettingsMutation.mutate({
                    durationMinutes: reservationDurationMinutes,
                  })
                }
                disabled={saveReservationSettingsMutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {saveReservationSettingsMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Сохранить срок резерва
              </button>
            </div>
          </AdminSection>

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
