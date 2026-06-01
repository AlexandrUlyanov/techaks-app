import {
  CheckCircle2,
  Clipboard,
  CreditCard,
  Loader2,
  Save,
  ShieldCheck,
  TestTube2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/providers/trpc";
import { useAbility } from "@/providers/AbilityProvider";

type ConfirmationType = "embedded" | "redirect";

const DEFAULT_RETURN_URL = "https://techaks.ru/payment/result";
const DEFAULT_WEBHOOK_URL = "https://techaks.ru/api/yookassa/webhook";

export default function AdminYooKassaSettings() {
  const ability = useAbility();
  const utils = trpc.useUtils();
  const canManage = ability.can("manage_payment_settings", "Settings");
  const { data, isLoading } = trpc.settings.getYooKassaSettings.useQuery(
    undefined,
    { enabled: canManage }
  );

  const [enabled, setEnabled] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [shopId, setShopId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [returnUrl, setReturnUrl] = useState(DEFAULT_RETURN_URL);
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL);
  const [confirmationType, setConfirmationType] =
    useState<ConfirmationType>("redirect");
  const [capture, setCapture] = useState(true);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setTestMode(data.testMode);
    setShopId(data.shopId || "");
    setSecretKey("");
    setReturnUrl(data.returnUrl || DEFAULT_RETURN_URL);
    setWebhookUrl(data.webhookUrl || DEFAULT_WEBHOOK_URL);
    setConfirmationType(data.confirmationType);
    setCapture(data.capture);
  }, [data]);

  const saveMutation = trpc.settings.saveYooKassaSettings.useMutation({
    onSuccess: () => {
      utils.settings.getYooKassaSettings.invalidate();
      setSecretKey("");
      alert("Настройки YooKassa сохранены.");
    },
  });

  const testMutation = trpc.settings.testYooKassaConnection.useMutation({
    onSuccess: result => {
      alert(result.message);
    },
  });

  if (!canManage) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Оплата"
          title="YooKassa"
          description="У вас нет доступа к настройкам платежных систем."
        />
        <Link
          to="/admin/settings"
          className="inline-flex h-11 items-center rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black"
        >
          Вернуться в настройки
        </Link>
      </div>
    );
  }

  const save = () => {
    saveMutation.mutate({
      enabled,
      testMode,
      shopId,
      secretKey,
      returnUrl,
      webhookUrl,
      confirmationType,
      capture,
    });
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    alert("Webhook URL скопирован.");
  };

  const secretStatus = data?.secretKeyConfigured
    ? `Ключ задан${data.secretKeyLast4 ? `, последние 4: ${data.secretKeyLast4}` : ""}`
    : "Ключ не задан";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Настройки / Оплата"
        title="YooKassa"
        description="Управление платежным провайдером. Secret Key хранится только в зашифрованном виде и никогда не отдается на frontend."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/settings"
          className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-bold text-[#464A50] ring-1 ring-black/5 transition hover:text-[#05C3D4]"
        >
          Настройки
        </Link>
        <span className="text-sm text-gray-400">/</span>
        <span className="inline-flex h-10 items-center rounded-xl bg-[#E8FAFC] px-4 text-sm font-black text-[#047987]">
          Оплата / YooKassa
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          Загружаю настройки оплаты...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <AdminSection
              title="Основные настройки"
              description="Включение провайдера, режим работы и параметры создания платежа."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <ToggleRow
                  title="YooKassa включена"
                  description="Если выключено, сайт не должен создавать платежи через YooKassa."
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
                <ToggleRow
                  title="Тестовый режим"
                  description="Пометка для тестовой конфигурации магазина YooKassa."
                  checked={testMode}
                  onCheckedChange={setTestMode}
                />
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    YooKassa Shop ID
                  </label>
                  <input
                    value={shopId}
                    onChange={event => setShopId(event.target.value)}
                    placeholder="Например, 123456"
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Confirmation type
                  </label>
                  <select
                    value={confirmationType}
                    onChange={event =>
                      setConfirmationType(event.target.value as ConfirmationType)
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#05C3D4]"
                  >
                    <option value="redirect">redirect</option>
                    <option value="embedded">embedded</option>
                  </select>
                </div>
                <ToggleRow
                  title="Capture"
                  description="По умолчанию деньги списываются сразу после успешной оплаты."
                  checked={capture}
                  onCheckedChange={setCapture}
                />
              </div>
            </AdminSection>

            <AdminSection
              title="Secret Key"
              description="Введите ключ только при замене. Старый ключ сохранится, если поле оставить пустым."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Текущий статус ключа
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-600">
                    {secretStatus}
                  </div>
                  {data?.secretKeySetAt ? (
                    <p className="text-xs text-gray-500">
                      Последняя замена: {new Date(data.secretKeySetAt).toLocaleString("ru-RU")}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Новый Secret Key
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={event => setSecretKey(event.target.value)}
                    placeholder={
                      data?.secretKeyConfigured
                        ? "Оставьте пустым, чтобы не менять"
                        : "Введите Secret Key"
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                  {!data?.encryptionConfigured ? (
                    <p className="text-xs font-semibold text-red-600">
                      APP_ENCRYPTION_KEY не задан. Новый Secret Key сохранить нельзя.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Ключ будет сохранен как secret_key_encrypted.
                    </p>
                  )}
                </div>
              </div>
            </AdminSection>

            <AdminSection
              title="Return URL"
              description="Адрес, куда YooKassa вернет покупателя после оплаты."
            >
              <input
                value={returnUrl}
                onChange={event => setReturnUrl(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              />
            </AdminSection>

            <AdminSection
              title="Webhook URL"
              description="Укажите этот адрес в личном кабинете YooKassa. Значение показывается в админке, но не содержит секретов."
              actions={
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#E8FAFC] px-4 text-sm font-black text-[#047987]"
                >
                  <Clipboard size={16} />
                  Скопировать
                </button>
              }
            >
              <input
                readOnly
                value={webhookUrl}
                onChange={event => setWebhookUrl(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 font-mono text-sm text-gray-700 outline-none"
              />
            </AdminSection>
          </div>

          <div className="space-y-6">
            <AdminSection
              title="Проверка подключения"
              description="Проверяет Shop ID и Secret Key запросом к YooKassa. Значение ключа в лог не пишется."
            >
              <div className="space-y-4">
                <div className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                  Источник настроек:{" "}
                  <span className="font-black text-[#15171A]">
                    {data?.source === "database"
                      ? "База данных"
                      : data?.source === "env"
                        ? ".env"
                        : "Не настроено"}
                  </span>
                </div>
                {saveMutation.error || testMutation.error ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {saveMutation.error?.message || testMutation.error?.message}
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
              title="Webhook события"
              description="В личном кабинете YooKassa включите эти события для магазина."
            >
              <div className="space-y-3">
                {["payment.succeeded", "payment.canceled", "refund.succeeded"].map(
                  event => (
                    <div
                      key={event}
                      className="flex items-center gap-3 rounded-2xl bg-[#F6F7F8] px-4 py-3 text-sm font-bold text-[#15171A]"
                    >
                      <CheckCircle2 size={17} className="text-[#05C3D4]" />
                      <span className="font-mono">{event}</span>
                    </div>
                  )
                )}
              </div>
            </AdminSection>

            <div className="rounded-[var(--tech-radius-card)] bg-[#E8FAFC] p-5 text-sm leading-6 text-[#047987]">
              <div className="mb-2 flex items-center gap-2 font-black text-[#15171A]">
                <ShieldCheck size={18} />
                Безопасность
              </div>
              Secret Key не возвращается в GET-ответах и не попадает в audit log.
              В админке видны только факт настройки, последние 4 символа и дата замены.
            </div>
          </div>
        </div>
      )}
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
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-gray-50 p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-[#15171A]">
          <CreditCard size={16} className="text-[#05C3D4]" />
          {title}
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
