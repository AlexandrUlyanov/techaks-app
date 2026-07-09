import {
  Clipboard,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  TestTube2,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { Switch } from "@/components/ui/switch";
import { useAbility } from "@/providers/AbilityProvider";
import { trpc } from "@/providers/trpc";

const DEFAULT_API_BASE_URL = "https://b2b.taxi.yandex.net";

type SettingsPayload = {
  enabled: boolean;
  selectedCorpClientId: string;
  useSelectedCorpClientId: boolean;
  apiBaseUrl: string;
  accessTokenConfigured: boolean;
  accessTokenLast4: string;
  accessTokenSetAt: string | null;
  source: "database" | "env" | "none";
  lastCheck: {
    ok: boolean | null;
    status: string | null;
    at: string | null;
    message: string | null;
  };
  geosuggest: {
    enabled: boolean;
    apiKeyConfigured: boolean;
    apiKeyLast4: string;
    apiKeySetAt: string | null;
    source: "database" | "env" | "none";
    lastCheck: {
      ok: boolean | null;
      status: string | null;
      at: string | null;
      message: string | null;
    };
  };
  encryptionConfigured: boolean;
};

export default function AdminYandexDeliverySettings() {
  const ability = useAbility();
  const canManage = ability.can("configure", "Settings");
  const { data, isLoading } = trpc.settings.getYandexDeliverySettings.useQuery(
    undefined,
    { enabled: canManage }
  );

  if (!canManage) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Интеграции"
          title="Яндекс Доставка"
          description="У вас нет доступа к настройкам доставки."
        />
        <Link
          to="/admin/settings/integrations"
          className="inline-flex h-11 items-center rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black"
        >
          Вернуться в настройки
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Настройки / Интеграции"
        title="Яндекс Доставка"
        description="Храним OAuth-токен в зашифрованном виде, отдельно настраиваем Corp Client ID и проверяем реальное подключение к API 2.0 Яндекс Доставки."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/settings/integrations"
          className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-bold text-[#464A50] ring-1 ring-black/5 transition hover:text-[#05C3D4]"
        >
          Настройки
        </Link>
        <span className="text-sm text-gray-400">/</span>
        <span className="inline-flex h-10 items-center rounded-xl bg-[#E8FAFC] px-4 text-sm font-black text-[#047987]">
          Интеграции / Яндекс Доставка
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          Загружаю настройки доставки...
        </div>
      ) : data ? (
        <AdminYandexDeliverySettingsForm
          key={[
            data.enabled ? "1" : "0",
            data.selectedCorpClientId || "",
            data.apiBaseUrl || "",
            data.accessTokenLast4 || "",
            data.accessTokenSetAt || "",
            data.source || "",
            data.lastCheck?.status || "",
            data.lastCheck?.at || "",
            data.geosuggest?.enabled ? "1" : "0",
            data.geosuggest?.apiKeyLast4 || "",
            data.geosuggest?.lastCheck?.status || "",
            data.geosuggest?.lastCheck?.at || "",
          ].join(":")}
          data={data}
        />
      ) : null}
    </div>
  );
}

function AdminYandexDeliverySettingsForm({ data }: { data: SettingsPayload }) {
  const utils = trpc.useUtils();
  const [enabled, setEnabled] = useState(data.enabled);
  const [accessToken, setAccessToken] = useState("");
  const [selectedCorpClientId, setSelectedCorpClientId] = useState(
    data.selectedCorpClientId || ""
  );
  const [useSelectedCorpClientId, setUseSelectedCorpClientId] = useState(
    data.useSelectedCorpClientId
  );
  const [apiBaseUrl, setApiBaseUrl] = useState(
    data.apiBaseUrl || DEFAULT_API_BASE_URL
  );
  const [geosuggestEnabled, setGeosuggestEnabled] = useState(
    data.geosuggest?.enabled ?? false
  );
  const [geosuggestApiKey, setGeosuggestApiKey] = useState("");

  const saveMutation = trpc.settings.saveYandexDeliverySettings.useMutation({
    onSuccess: async () => {
      await utils.settings.getYandexDeliverySettings.invalidate();
      alert("Настройки Яндекс Доставки сохранены.");
    },
  });

  const testMutation = trpc.settings.testYandexDeliveryConnection.useMutation({
    onSuccess: result => {
      alert(result.message);
      void utils.settings.getYandexDeliverySettings.invalidate();
    },
  });
  const testGeoSuggestMutation =
    trpc.settings.testYandexGeoSuggestConnection.useMutation({
      onSuccess: result => {
        alert(result.message);
        void utils.settings.getYandexDeliverySettings.invalidate();
      },
    });

  const copyBaseUrl = async () => {
    await navigator.clipboard.writeText(apiBaseUrl);
    alert("Базовый URL скопирован.");
  };

  const save = () => {
    saveMutation.mutate({
      enabled,
      accessToken,
      selectedCorpClientId,
      useSelectedCorpClientId,
      apiBaseUrl,
      geosuggestEnabled,
      geosuggestApiKey,
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <AdminSection
          title="Основные настройки"
          description="Включение провайдера доставки и параметры подключения к кабинету Яндекс Go для бизнеса."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <ToggleRow
              title="Интеграция включена"
              description="Если выключено, checkout не должен использовать Яндекс Доставку для расчета или заказа курьера."
              checked={enabled}
              onCheckedChange={setEnabled}
            />

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#15171A]">
                Corp Client ID
              </label>
              <input
                value={selectedCorpClientId}
                onChange={event => setSelectedCorpClientId(event.target.value)}
                placeholder="Если у аккаунта несколько кабинетов"
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
              <p className="text-xs leading-5 text-gray-500">
                Значение для заголовка{" "}
                <span className="font-mono">X-YaTaxi-Selected-Corp-Client-Id</span>,
                если один Яндекс ID привязан к нескольким кабинетам.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <ToggleRow
              title="Отправлять Corp Client ID в заголовке"
              description="Если выключено, заголовок X-YaTaxi-Selected-Corp-Client-Id не уходит в API Яндекс Доставки, даже если значение сохранено."
              checked={useSelectedCorpClientId}
              onCheckedChange={setUseSelectedCorpClientId}
            />
          </div>
        </AdminSection>

        <AdminSection
          title="OAuth-токен"
          description="Токен никогда не уходит на frontend. При пустом поле текущий токен сохраняется без изменений."
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
              Статус токена:{" "}
              <span className="font-black text-[#15171A]">
                {data.accessTokenConfigured
                  ? `задан${data.accessTokenLast4 ? `, последние 4: ${data.accessTokenLast4}` : ""}`
                  : "не задан"}
              </span>
              {data.accessTokenSetAt ? (
                <div className="mt-2 text-xs">
                  Последняя замена:{" "}
                  {new Date(data.accessTokenSetAt).toLocaleString("ru-RU")}
                </div>
              ) : null}
              {!data.encryptionConfigured ? (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  APP_ENCRYPTION_KEY не задан. Пока этот ключ не настроен, новый
                  токен сохранить нельзя.
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#15171A]">
                Новый OAuth-токен
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={event => setAccessToken(event.target.value)}
                placeholder={
                  data.accessTokenConfigured
                    ? "Оставьте пустым, чтобы сохранить текущий токен"
                    : "Вставьте OAuth-токен Яндекс Доставки"
                }
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="GeoSuggest для адресов"
          description="Автоподсказки улиц и домов в checkout. Ключ хранится отдельно от OAuth-токена доставки и не отдаётся на frontend."
        >
          <div className="space-y-5">
            <ToggleRow
              title="Использовать GeoSuggest в оформлении заказа"
              description="Если включено и ключ задан, поле адреса будет сначала получать подсказки из Яндекс GeoSuggest, а затем fallback-иться на старые источники."
              checked={geosuggestEnabled}
              onCheckedChange={setGeosuggestEnabled}
            />

            <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
              Статус ключа:{" "}
              <span className="font-black text-[#15171A]">
                {data.geosuggest?.apiKeyConfigured
                  ? `задан${data.geosuggest.apiKeyLast4 ? `, последние 4: ${data.geosuggest.apiKeyLast4}` : ""}`
                  : "не задан"}
              </span>
              <div className="mt-2 text-xs">
                Источник:{" "}
                <span className="font-black text-[#15171A]">
                  {data.geosuggest?.source === "database"
                    ? "База данных"
                    : data.geosuggest?.source === "env"
                      ? ".env"
                      : "Не настроено"}
                </span>
              </div>
              {data.geosuggest?.apiKeySetAt ? (
                <div className="mt-1 text-xs">
                  Последняя замена:{" "}
                  {new Date(data.geosuggest.apiKeySetAt).toLocaleString("ru-RU")}
                </div>
              ) : null}
              {data.geosuggest?.lastCheck?.at ? (
                <div className="mt-2 text-xs">
                  Последняя проверка GeoSuggest:{" "}
                  <span
                    className={
                      data.geosuggest.lastCheck.ok
                        ? "text-emerald-700"
                        : "text-red-700"
                    }
                  >
                    {data.geosuggest.lastCheck.ok ? "успешно" : "ошибка"}
                  </span>{" "}
                  (HTTP {data.geosuggest.lastCheck.status}) —{" "}
                  {new Date(data.geosuggest.lastCheck.at).toLocaleString("ru-RU")}
                </div>
              ) : null}
              {data.geosuggest?.lastCheck?.message ? (
                <div className="mt-2 text-xs text-gray-500">
                  {data.geosuggest.lastCheck.message}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#15171A]">
                Новый API-ключ GeoSuggest
              </label>
              <input
                type="password"
                value={geosuggestApiKey}
                onChange={event => {
                  setGeosuggestApiKey(event.target.value);
                  if (event.target.value.trim()) {
                    setGeosuggestEnabled(true);
                  }
                }}
                placeholder={
                  data.geosuggest?.apiKeyConfigured
                    ? "Оставьте пустым, чтобы сохранить текущий ключ"
                    : "Вставьте API-ключ Яндекс GeoSuggest"
                }
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
              <p className="text-xs leading-5 text-gray-500">
                Для продакшена лучше хранить ключ здесь или в{" "}
                <span className="font-mono">YANDEX_GEOSUGGEST_API_KEY</span>.
                Старые ключи геокодера остаются fallback-источником.
              </p>
            </div>

            <button
              type="button"
              onClick={() => testGeoSuggestMutation.mutate()}
              disabled={testGeoSuggestMutation.isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-[#15171A] ring-1 ring-gray-200 disabled:opacity-50"
            >
              {testGeoSuggestMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <MapPin size={16} />
              )}
              Проверить GeoSuggest
            </button>
          </div>
        </AdminSection>

        <AdminSection
          title="Базовый URL API"
          description="По умолчанию используется b2b.taxi.yandex.net. Менять нужно только если Яндекс официально переведет интеграцию на другой base URL."
          actions={
            <button
              type="button"
              onClick={copyBaseUrl}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#E8FAFC] px-4 text-sm font-black text-[#047987]"
            >
              <Clipboard size={16} />
              Скопировать
            </button>
          }
        >
          <input
            value={apiBaseUrl}
            onChange={event => setApiBaseUrl(event.target.value)}
            className="h-11 w-full rounded-xl border border-gray-200 px-3 font-mono text-sm outline-none focus:border-[#05C3D4]"
          />
        </AdminSection>
      </div>

      <div className="space-y-6">
        <AdminSection
          title="Проверка подключения"
          description="Тестовый запрос идет в API Яндекс Доставки. Значение токена в ответ, логи и аудит не попадает."
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
              Источник настроек:{" "}
              <span className="font-black text-[#15171A]">
                {data.source === "database"
                  ? "База данных"
                  : data.source === "env"
                    ? ".env"
                    : "Не настроено"}
              </span>
              <div className="mt-3 text-xs">
                Corp Client ID:{" "}
                <span className="font-black text-[#15171A]">
                  {data.selectedCorpClientId || "не задан"}
                </span>
              </div>
              <div className="mt-1 text-xs">
                Отправка заголовка:{" "}
                <span className="font-black text-[#15171A]">
                  {data.useSelectedCorpClientId ? "включена" : "выключена"}
                </span>
              </div>
              <div className="mt-1 text-xs">
                Базовый URL:{" "}
                <span className="font-black text-[#15171A]">
                  {data.apiBaseUrl || DEFAULT_API_BASE_URL}
                </span>
              </div>
              {data.lastCheck?.at ? (
                <div className="mt-2 text-xs">
                  Последняя проверка:{" "}
                  <span
                    className={
                      data.lastCheck.ok ? "text-emerald-700" : "text-red-700"
                    }
                  >
                    {data.lastCheck.ok ? "успешно" : "ошибка"}
                  </span>{" "}
                  (HTTP {data.lastCheck.status}) —{" "}
                  {new Date(data.lastCheck.at).toLocaleString("ru-RU")}
                </div>
              ) : null}
              {data.lastCheck?.message ? (
                <div className="mt-2 text-xs text-gray-500">
                  {data.lastCheck.message}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-[#F8FBFD] p-4 text-sm leading-6 text-gray-600">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 text-[#05C3D4]" />
                <div>
                  <div className="font-black text-[#15171A]">Что дальше</div>
                  <div className="mt-1 text-sm">
                    После успешной проверки мы сможем перейти к расчету тарифов,
                    созданию delivery-заказов и синхронизации статусов курьера.
                  </div>
                </div>
              </div>
            </div>

            {saveMutation.error || testMutation.error || testGeoSuggestMutation.error ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {saveMutation.error?.message ||
                  testMutation.error?.message ||
                  testGeoSuggestMutation.error?.message}
              </div>
            ) : null}

            <button
              type="button"
              onClick={save}
              disabled={saveMutation.isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Сохранить настройки
            </button>
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-[#15171A] ring-1 ring-gray-200 disabled:opacity-50"
            >
              {testMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <TestTube2 size={16} />
              )}
              Проверить подключение
            </button>
          </div>
        </AdminSection>

        <AdminSection
          title="Памятка по API"
          description="Собрал рядом ключевые вещи, чтобы не лазить по документации при каждом включении интеграции."
        >
          <div className="space-y-3 text-sm leading-6 text-gray-600">
            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <Truck size={18} className="mt-0.5 text-[#05C3D4]" />
                <div>
                  Для подключения нужен OAuth-токен из кабинета Яндекс Go для
                  бизнеса.
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              Если у одного аккаунта несколько кабинетов, сохраните{" "}
              <span className="font-mono">Corp Client ID</span> и отдельно
              включите его отправку.
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              На следующем этапе интеграции мы используем это подключение для:
              расчета стоимости, ETA, создания курьерского заказа и отслеживания
              статусов.
            </div>
          </div>
        </AdminSection>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-[#FAFBFC] p-4">
      <div className="space-y-1">
        <div className="text-sm font-black text-[#15171A]">{title}</div>
        <div className="text-sm leading-6 text-gray-500">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
