import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileCode2,
  Loader2,
  RefreshCw,
  Rss,
  Save,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/providers/trpc";

export default function AdminFeeds() {
  const utils = trpc.useUtils();
  const catalogQuery = trpc.settings.getFeedCatalog.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const settingsQuery = trpc.settings.getYandexYmlFeedSettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const previewQuery = trpc.settings.previewYandexYmlFeed.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [enabled, setEnabled] = useState(false);
  const [feedName, setFeedName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [shopUrl, setShopUrl] = useState("https://techaks.ru");
  const [currencyId, setCurrencyId] = useState<"RUR" | "RUB">("RUR");
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false);
  const [pickup, setPickup] = useState(true);
  const [delivery, setDelivery] = useState(true);
  const [salesNotes, setSalesNotes] = useState("");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(settingsQuery.data.enabled);
    setFeedName(settingsQuery.data.feedName);
    setCompanyName(settingsQuery.data.companyName);
    setShopUrl(settingsQuery.data.shopUrl);
    setCurrencyId(settingsQuery.data.currencyId);
    setIncludeOutOfStock(settingsQuery.data.includeOutOfStock);
    setPickup(settingsQuery.data.pickup);
    setDelivery(settingsQuery.data.delivery);
    setSalesNotes(settingsQuery.data.salesNotes || "");
  }, [settingsQuery.data]);

  const saveMutation = trpc.settings.saveYandexYmlFeedSettings.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.settings.getFeedCatalog.invalidate(),
        utils.settings.getYandexYmlFeedSettings.invalidate(),
        utils.settings.previewYandexYmlFeed.invalidate(),
      ]);
      alert("Настройки Yandex YML сохранены.");
    },
  });

  const isLoading =
    catalogQuery.isLoading || settingsQuery.isLoading || previewQuery.isLoading;
  const overview = useMemo(
    () => catalogQuery.data?.find(item => item.key === "yandex_yml") ?? null,
    [catalogQuery.data]
  );
  const preview = previewQuery.data;

  const copyPublicUrl = async () => {
    const value =
      settingsQuery.data?.publicUrl || "https://techaks.ru/feeds/yandex-business.yml";
    await navigator.clipboard.writeText(value);
    alert("Ссылка на фид скопирована.");
  };

  const handleSave = () => {
    saveMutation.mutate({
      enabled,
      feedName,
      companyName,
      shopUrl,
      currencyId,
      includeOutOfStock,
      pickup,
      delivery,
      salesNotes,
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Контент и система"
        title="Фиды"
        description="Здесь мы собираем публичные товарные фиды для внешних площадок. Первый контур — Yandex YML для Яндекс Бизнес / приоритетного размещения."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void Promise.all([
                  catalogQuery.refetch(),
                  settingsQuery.refetch(),
                  previewQuery.refetch(),
                ]);
              }}
              disabled={catalogQuery.isFetching || settingsQuery.isFetching || previewQuery.isFetching}
            >
              <RefreshCw
                size={16}
                className={
                  catalogQuery.isFetching || settingsQuery.isFetching || previewQuery.isFetching
                    ? "animate-spin"
                    : ""
                }
              />
              Обновить
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || isLoading}>
              {saveMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Сохранить
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Фидов подключено"
          value={catalogQuery.data?.length ?? 0}
          hint="Пока один боевой формат"
          icon={Rss}
          tone="accent"
        />
        <AdminStatCard
          label="Офферов в YML"
          value={preview?.stats.totalOffers ?? 0}
          hint="Уйдут в актуальный XML"
          icon={FileCode2}
        />
        <AdminStatCard
          label="Предупреждений"
          value={preview?.stats.warnings.length ?? 0}
          hint="Проверки качества фида"
          icon={TriangleAlert}
          tone={(preview?.stats.warnings.length ?? 0) > 0 ? "warning" : "success"}
        />
        <AdminStatCard
          label="Публичный доступ"
          value={enabled ? "Включён" : "Выключен"}
          hint={enabled ? "Фид доступен по ссылке" : "Маршрут отдаёт 404"}
          icon={ShieldCheck}
          tone={enabled ? "success" : "default"}
        />
      </div>

      {isLoading ? (
        <AdminSection
          title="Загрузка"
          description="Собираю текущие настройки и статистику фида."
        >
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-5 text-sm text-[var(--tech-color-text-muted)]">
            <Loader2 size={18} className="animate-spin" />
            Загружаю фид и предпросмотр...
          </div>
        </AdminSection>
      ) : null}

      {!isLoading && overview ? (
        <>
          <AdminSection
            title="Yandex YML"
            description="Этот фид подходит для загрузки каталога в Яндекс. В него попадают только публично видимые товары и модификации с корректной ценой."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={copyPublicUrl}>
                  <Clipboard size={16} />
                  Скопировать ссылку
                </Button>
                <a
                  href={settingsQuery.data?.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-[var(--tech-radius-button)] border border-border bg-background px-5 text-[11px] font-black uppercase tracking-widest text-foreground transition hover:bg-muted"
                >
                  <ExternalLink size={16} />
                  Открыть XML
                </a>
              </div>
            }
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <ToggleRow
                    title="Включить YML-фид"
                    description="Публичный URL будет отдавать XML только если этот переключатель включён."
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                  <ToggleRow
                    title="Экспортировать товары без наличия"
                    description="Если выключено, в XML попадут только офферы с доступным остатком."
                    checked={includeOutOfStock}
                    onCheckedChange={setIncludeOutOfStock}
                  />
                  <ToggleRow
                    title="Самовывоз в фиде"
                    description="Добавляет в оффер тег pickup."
                    checked={pickup}
                    onCheckedChange={setPickup}
                  />
                  <ToggleRow
                    title="Доставка в фиде"
                    description="Добавляет в оффер тег delivery."
                    checked={delivery}
                    onCheckedChange={setDelivery}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Название магазина в YML"
                    value={feedName}
                    onChange={setFeedName}
                    placeholder="ТЕХАКС"
                  />
                  <Field
                    label="Company"
                    value={companyName}
                    onChange={setCompanyName}
                    placeholder="ТЕХАКС"
                  />
                  <Field
                    label="Базовый URL магазина"
                    value={shopUrl}
                    onChange={setShopUrl}
                    placeholder="https://techaks.ru"
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[var(--tech-color-text-main)]">
                      Валюта
                    </label>
                    <select
                      value={currencyId}
                      onChange={event => setCurrencyId(event.target.value as "RUR" | "RUB")}
                      className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-[#05C3D4]"
                    >
                      <option value="RUR">RUR</option>
                      <option value="RUB">RUB</option>
                    </select>
                    <p className="text-xs text-[var(--tech-color-text-muted)]">
                      Для Яндекс YML безопаснее оставлять RUR, если нет отдельного требования.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--tech-color-text-main)]">
                    sales_notes
                  </label>
                  <textarea
                    value={salesNotes}
                    onChange={event => setSalesNotes(event.target.value)}
                    rows={3}
                    placeholder="Например: Уточняйте наличие и условия выдачи у менеджера."
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#05C3D4]"
                  />
                  <p className="text-xs text-[var(--tech-color-text-muted)]">
                    Необязательно. Если нужно, это значение попадёт в каждый оффер.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-border bg-[var(--tech-color-surface-muted)] px-5 py-5">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
                    Публичный URL
                  </div>
                  <div className="mt-3 rounded-2xl bg-white px-4 py-4 font-mono text-xs leading-6 text-[var(--tech-color-text-main)] ring-1 ring-black/5">
                    {settingsQuery.data?.publicUrl}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--tech-color-text-muted)] ring-1 ring-black/5">
                    <CheckCircle2 size={14} className="text-[#05C3D4]" />
                    {enabled
                      ? "Маршрут включён и доступен для Яндекса"
                      : "Маршрут сейчас выключен и отдаёт 404"}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-white px-5 py-5">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
                    Что попадёт в фид
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--tech-color-text-main)]">
                    <li>• только товары, которые видны на витрине</li>
                    <li>• если у товара есть модификации — экспортируются варианты</li>
                    <li>• у оффера будет цена, бренд, категория, ссылка, картинки и описание</li>
                    <li>• артикул берём из variant.article / product.article / externalCode</li>
                  </ul>
                </div>
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Проверка и предпросмотр"
            description="Смотрим, сколько офферов уйдёт в XML, и быстро ловим проблемы до загрузки в Яндекс."
            actions={
              <Button
                variant="outline"
                onClick={() => void previewQuery.refetch()}
                disabled={previewQuery.isFetching}
              >
                <RefreshCw
                  size={16}
                  className={previewQuery.isFetching ? "animate-spin" : ""}
                />
                Пересобрать предпросмотр
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatCard
                label="Исходных товаров"
                value={preview?.stats.productsSource ?? 0}
                hint="Публичные карточки, доступные для выгрузки"
                icon={Rss}
              />
              <AdminStatCard
                label="Офферов по товарам"
                value={preview?.stats.productOffers ?? 0}
                hint="Базовые товарные офферы"
                icon={CheckCircle2}
                tone="success"
              />
              <AdminStatCard
                label="Офферов по вариантам"
                value={preview?.stats.variantOffers ?? 0}
                hint="Модификации, выгруженные как отдельные позиции"
                icon={FileCode2}
                tone="accent"
              />
              <AdminStatCard
                label="Категорий в XML"
                value={preview?.stats.categoriesIncluded ?? 0}
                hint="Попадут только реально используемые разделы"
                icon={Rss}
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-3">
                <div className="text-sm font-black text-[var(--tech-color-text-main)]">
                  Предпросмотр XML
                </div>
                <textarea
                  readOnly
                  value={preview?.preview ?? ""}
                  rows={24}
                  className="w-full rounded-3xl border border-border bg-[#0B1120] px-4 py-4 font-mono text-xs leading-6 text-cyan-50 outline-none"
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-border bg-[var(--tech-color-surface-muted)] px-5 py-5">
                  <div className="text-sm font-black text-[var(--tech-color-text-main)]">
                    Предупреждения
                  </div>
                  {(preview?.stats.warnings ?? []).length === 0 ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 size={16} />
                      Явных проблем не найдено
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {(preview?.stats.warnings ?? []).map((warning, index) => (
                        <div
                          key={`${warning}-${index}`}
                          className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-[var(--tech-color-text-main)] ring-1 ring-black/5"
                        >
                          <div className="flex items-start gap-3">
                            <TriangleAlert size={16} className="mt-1 shrink-0 text-amber-500" />
                            <span>{warning}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-border bg-white px-5 py-5">
                  <div className="text-sm font-black text-[var(--tech-color-text-main)]">
                    Что нужно указать в Яндексе
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--tech-color-text-main)]">
                    <li>• вставить именно публичную ссылку на XML</li>
                    <li>• после смены режима или настроек лучше пересобрать фид</li>
                    <li>• если Яндекс ругается на картинки или vendor, сначала проверь карточки товаров</li>
                  </ul>
                </div>
              </div>
            </div>
          </AdminSection>
        </>
      ) : null}
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
    <div className="rounded-2xl border border-border bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-black text-[var(--tech-color-text-main)]">
            {title}
          </div>
          <div className="text-sm leading-6 text-[var(--tech-color-text-muted)]">
            {description}
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-[var(--tech-color-text-main)]">
        {label}
      </label>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-[#05C3D4]"
      />
    </div>
  );
}
