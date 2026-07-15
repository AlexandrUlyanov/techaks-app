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
  const yandexSettingsQuery = trpc.settings.getYandexYmlFeedSettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const yandexPreviewQuery = trpc.settings.previewYandexYmlFeed.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const yandexValidationQuery = trpc.settings.validateYandexYmlFeed.useQuery(undefined, {
    enabled: false,
    refetchOnWindowFocus: false,
  });
  const vkSettingsQuery = trpc.settings.getVkFeedSettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const vkPreviewQuery = trpc.settings.previewVkFeed.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const vkValidationQuery = trpc.settings.validateVkFeed.useQuery(undefined, {
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const [yandexEnabled, setYandexEnabled] = useState(false);
  const [yandexFeedName, setYandexFeedName] = useState("");
  const [yandexCompanyName, setYandexCompanyName] = useState("");
  const [yandexShopUrl, setYandexShopUrl] = useState("https://techaks.ru");
  const [yandexCurrencyId, setYandexCurrencyId] = useState<"RUR" | "RUB">("RUR");
  const [yandexIncludeOutOfStock, setYandexIncludeOutOfStock] = useState(false);
  const [yandexPickup, setYandexPickup] = useState(true);
  const [yandexDelivery, setYandexDelivery] = useState(true);
  const [yandexSalesNotes, setYandexSalesNotes] = useState("");

  const [vkEnabled, setVkEnabled] = useState(false);
  const [vkFeedName, setVkFeedName] = useState("");
  const [vkCompanyName, setVkCompanyName] = useState("");
  const [vkShopUrl, setVkShopUrl] = useState("https://techaks.ru");
  const [vkUtmEnabled, setVkUtmEnabled] = useState(true);
  const [vkUtmSource, setVkUtmSource] = useState("vk");
  const [vkUtmMedium, setVkUtmMedium] = useState("cpc");
  const [vkUtmCampaign, setVkUtmCampaign] = useState("product_feed");
  const [vkOnlyInStock, setVkOnlyInStock] = useState(true);
  const [vkIncludeOutOfStockAsUnavailable, setVkIncludeOutOfStockAsUnavailable] =
    useState(false);
  const [vkMaxItems, setVkMaxItems] = useState("");

  useEffect(() => {
    if (!yandexSettingsQuery.data) return;
    setYandexEnabled(yandexSettingsQuery.data.enabled);
    setYandexFeedName(yandexSettingsQuery.data.feedName);
    setYandexCompanyName(yandexSettingsQuery.data.companyName);
    setYandexShopUrl(yandexSettingsQuery.data.shopUrl);
    setYandexCurrencyId(yandexSettingsQuery.data.currencyId);
    setYandexIncludeOutOfStock(yandexSettingsQuery.data.includeOutOfStock);
    setYandexPickup(yandexSettingsQuery.data.pickup);
    setYandexDelivery(yandexSettingsQuery.data.delivery);
    setYandexSalesNotes(yandexSettingsQuery.data.salesNotes || "");
  }, [yandexSettingsQuery.data]);

  useEffect(() => {
    if (!vkSettingsQuery.data) return;
    setVkEnabled(vkSettingsQuery.data.enabled);
    setVkFeedName(vkSettingsQuery.data.feedName);
    setVkCompanyName(vkSettingsQuery.data.companyName);
    setVkShopUrl(vkSettingsQuery.data.shopUrl);
    setVkUtmEnabled(vkSettingsQuery.data.utmEnabled);
    setVkUtmSource(vkSettingsQuery.data.utmSource);
    setVkUtmMedium(vkSettingsQuery.data.utmMedium);
    setVkUtmCampaign(vkSettingsQuery.data.utmCampaign);
    setVkOnlyInStock(vkSettingsQuery.data.onlyInStock);
    setVkIncludeOutOfStockAsUnavailable(
      vkSettingsQuery.data.includeOutOfStockAsUnavailable
    );
    setVkMaxItems(vkSettingsQuery.data.maxItems ? String(vkSettingsQuery.data.maxItems) : "");
  }, [vkSettingsQuery.data]);

  const refreshAll = async () => {
    await Promise.all([
      catalogQuery.refetch(),
      yandexSettingsQuery.refetch(),
      yandexPreviewQuery.refetch(),
      vkSettingsQuery.refetch(),
      vkPreviewQuery.refetch(),
    ]);
  };

  const invalidateAll = async () => {
    await Promise.all([
      utils.settings.getFeedCatalog.invalidate(),
      utils.settings.getYandexYmlFeedSettings.invalidate(),
      utils.settings.previewYandexYmlFeed.invalidate(),
      utils.settings.validateYandexYmlFeed.invalidate(),
      utils.settings.getVkFeedSettings.invalidate(),
      utils.settings.previewVkFeed.invalidate(),
      utils.settings.validateVkFeed.invalidate(),
    ]);
  };

  const saveYandexMutation = trpc.settings.saveYandexYmlFeedSettings.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      alert("Настройки Yandex YML сохранены.");
    },
  });

  const saveVkMutation = trpc.settings.saveVkFeedSettings.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      alert("Настройки VK-фида сохранены.");
    },
  });

  const isLoading =
    catalogQuery.isLoading ||
    yandexSettingsQuery.isLoading ||
    yandexPreviewQuery.isLoading ||
    vkSettingsQuery.isLoading ||
    vkPreviewQuery.isLoading;

  const overview = useMemo(() => {
    const items = catalogQuery.data ?? [];
    return {
      yandex: items.find(item => item.key === "yandex_yml") ?? null,
      vk: items.find(item => item.key === "vk_xml") ?? null,
    };
  }, [catalogQuery.data]);

  const yandexPreview = yandexPreviewQuery.data;
  const yandexValidation = yandexValidationQuery.data ?? null;
  const vkPreview = vkPreviewQuery.data;
  const vkValidation = vkValidationQuery.data ?? null;
  const vkDiagnostics = vkValidation ?? vkPreview ?? null;
  const yandexDiagnostics = yandexValidation ?? yandexPreview ?? null;

  const totals = useMemo(() => {
    const items = catalogQuery.data ?? [];
    return {
      enabledFeeds: items.filter(item => item.enabled).length,
      offers: items.reduce((sum, item) => sum + (item.offersCount ?? 0), 0),
      warnings: items.reduce((sum, item) => sum + (item.warningsCount ?? 0), 0),
    };
  }, [catalogQuery.data]);

  const copyPublicUrl = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    alert(`${label} скопирован.`);
  };

  const handleSaveYandex = () => {
    saveYandexMutation.mutate({
      enabled: yandexEnabled,
      feedName: yandexFeedName,
      companyName: yandexCompanyName,
      shopUrl: yandexShopUrl,
      currencyId: yandexCurrencyId,
      includeOutOfStock: yandexIncludeOutOfStock,
      pickup: yandexPickup,
      delivery: yandexDelivery,
      salesNotes: yandexSalesNotes,
    });
  };

  const handleSaveVk = () => {
    const normalizedMaxItems = vkMaxItems.trim();
    const parsedMaxItems = normalizedMaxItems
      ? Number.parseInt(normalizedMaxItems, 10)
      : null;

    if (parsedMaxItems !== null && (!Number.isFinite(parsedMaxItems) || parsedMaxItems < 1)) {
      alert("Максимум товаров должен быть целым числом больше нуля.");
      return;
    }

    saveVkMutation.mutate({
      enabled: vkEnabled,
      feedName: vkFeedName,
      companyName: vkCompanyName,
      shopUrl: vkShopUrl,
      utmEnabled: vkUtmEnabled,
      utmSource: vkUtmSource,
      utmMedium: vkUtmMedium,
      utmCampaign: vkUtmCampaign,
      onlyInStock: vkOnlyInStock,
      includeOutOfStockAsUnavailable: vkIncludeOutOfStockAsUnavailable,
      maxItems: parsedMaxItems,
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Контент и система"
        title="Фиды"
        description="Держим выгрузки как отдельные каналы: Яндекс живёт в своём YML, VK — в собственном XML-контуре со своими фильтрами, UTM и диагностикой."
        actions={
          <Button
            variant="outline"
            onClick={() => void refreshAll()}
            disabled={
              catalogQuery.isFetching ||
              yandexSettingsQuery.isFetching ||
              yandexPreviewQuery.isFetching ||
              yandexValidationQuery.isFetching ||
              vkSettingsQuery.isFetching ||
              vkPreviewQuery.isFetching ||
              vkValidationQuery.isFetching
            }
          >
            <RefreshCw
              size={16}
              className={
                catalogQuery.isFetching ||
                yandexSettingsQuery.isFetching ||
                yandexPreviewQuery.isFetching ||
                yandexValidationQuery.isFetching ||
                vkSettingsQuery.isFetching ||
                vkPreviewQuery.isFetching ||
                vkValidationQuery.isFetching
                  ? "animate-spin"
                  : ""
              }
            />
            Обновить
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Каналов выгрузки"
          value={catalogQuery.data?.length ?? 0}
          hint="Отдельные витрины под разные площадки"
          icon={Rss}
          tone="accent"
        />
        <AdminStatCard
          label="Активно сейчас"
          value={totals.enabledFeeds}
          hint="Сколько публичных XML уже открыто наружу"
          icon={ShieldCheck}
          tone={totals.enabledFeeds > 0 ? "success" : "default"}
        />
        <AdminStatCard
          label="Всего офферов"
          value={totals.offers}
          hint="Суммарный объём по всем каналам"
          icon={FileCode2}
        />
        <AdminStatCard
          label="Предупреждений"
          value={totals.warnings}
          hint="Качество выгрузок и проблемные места"
          icon={TriangleAlert}
          tone={totals.warnings > 0 ? "warning" : "success"}
        />
      </div>

      {isLoading ? (
        <AdminSection
          title="Загрузка"
          description="Собираю текущие настройки и статистику фидов."
        >
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-5 text-sm text-[var(--tech-color-text-muted)]">
            <Loader2 size={18} className="animate-spin" />
            Загружаю настройки каналов выгрузки...
          </div>
        </AdminSection>
      ) : null}

      {!isLoading ? (
        <>
          <AdminSection
            title="Yandex YML"
            description="Боевой YML для Яндекса. Его настройки живут отдельно и не должны мешать VK."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    void copyPublicUrl(
                      yandexSettingsQuery.data?.publicUrl ||
                        "https://techaks.ru/feeds/yandex-business.yml",
                      "Ссылка на Yandex YML"
                    )
                  }
                >
                  <Clipboard size={16} />
                  Скопировать ссылку
                </Button>
                <a
                  href={yandexSettingsQuery.data?.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-[var(--tech-radius-button)] border border-border bg-background px-5 text-[11px] font-black uppercase tracking-widest text-foreground transition hover:bg-muted"
                >
                  <ExternalLink size={16} />
                  Открыть XML
                </a>
                <Button
                  variant="outline"
                  onClick={() => void yandexValidationQuery.refetch()}
                  disabled={yandexValidationQuery.isFetching}
                >
                  <RefreshCw
                    size={16}
                    className={yandexValidationQuery.isFetching ? "animate-spin" : ""}
                  />
                  Проверить Yandex
                </Button>
                <Button
                  onClick={handleSaveYandex}
                  disabled={saveYandexMutation.isPending || yandexSettingsQuery.isLoading}
                >
                  {saveYandexMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Сохранить Yandex
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatCard
                label="Офферов"
                value={overview.yandex?.offersCount ?? yandexDiagnostics?.stats.totalOffers ?? 0}
                hint="Позиции, которые увидит Яндекс"
                icon={Rss}
              />
              <AdminStatCard
                label="Предупреждений"
                value={
                  overview.yandex?.warningsCount ?? yandexDiagnostics?.stats.warnings.length ?? 0
                }
                hint="Подсказки по качеству YML"
                icon={TriangleAlert}
                tone={(overview.yandex?.warningsCount ?? 0) > 0 ? "warning" : "success"}
              />
              <AdminStatCard
                label="Публичный статус"
                value={yandexEnabled ? "Включён" : "Выключен"}
                hint={
                  yandexEnabled ? "Маршрут доступен по ссылке" : "Публичный XML сейчас закрыт"
                }
                icon={ShieldCheck}
                tone={yandexEnabled ? "success" : "default"}
              />
              <AdminStatCard
                label="Режим"
                value="YML"
                hint="Специфичная структура под Яндекс"
                icon={FileCode2}
                tone="accent"
              />
              <AdminStatCard
                label="Картинки"
                value={
                  yandexValidation
                    ? `${yandexValidation.validation.pictureProbeChecked - yandexValidation.validation.pictureProbeFailed}/${yandexValidation.validation.pictureProbeChecked}`
                    : "—"
                }
                hint="Доступность проверенной выборки"
                icon={CheckCircle2}
                tone={
                  !yandexValidation
                    ? "default"
                    : yandexValidation.validation.pictureProbeFailed > 0
                      ? "warning"
                      : "success"
                }
              />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <ToggleRow
                    title="Включить YML-фид"
                    description="Публичный URL будет отдавать XML только если переключатель активен."
                    checked={yandexEnabled}
                    onCheckedChange={setYandexEnabled}
                  />
                  <ToggleRow
                    title="Экспортировать товары без наличия"
                    description="Если выключено, в XML попадут только офферы с доступным остатком."
                    checked={yandexIncludeOutOfStock}
                    onCheckedChange={setYandexIncludeOutOfStock}
                  />
                  <ToggleRow
                    title="Самовывоз в фиде"
                    description="Добавляет в оффер тег pickup."
                    checked={yandexPickup}
                    onCheckedChange={setYandexPickup}
                  />
                  <ToggleRow
                    title="Доставка в фиде"
                    description="Добавляет в оффер тег delivery."
                    checked={yandexDelivery}
                    onCheckedChange={setYandexDelivery}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Название магазина в YML"
                    value={yandexFeedName}
                    onChange={setYandexFeedName}
                    placeholder="ТЕХАКС"
                  />
                  <Field
                    label="Company"
                    value={yandexCompanyName}
                    onChange={setYandexCompanyName}
                    placeholder="ТЕХАКС"
                  />
                  <Field
                    label="Базовый URL магазина"
                    value={yandexShopUrl}
                    onChange={setYandexShopUrl}
                    placeholder="https://techaks.ru"
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[var(--tech-color-text-main)]">
                      Валюта
                    </label>
                    <select
                      value={yandexCurrencyId}
                      onChange={event =>
                        setYandexCurrencyId(event.target.value as "RUR" | "RUB")
                      }
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
                    value={yandexSalesNotes}
                    onChange={event => setYandexSalesNotes(event.target.value)}
                    rows={3}
                    placeholder="Например: Уточняйте наличие и условия выдачи у менеджера."
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <FeedUrlCard
                  title="Публичный URL"
                  url={yandexSettingsQuery.data?.publicUrl ?? "https://techaks.ru/feeds/yandex-business.yml"}
                  enabled={yandexEnabled}
                  enabledHint="Маршрут включён и доступен для Яндекса"
                  disabledHint="Маршрут сейчас выключен и отдаёт 404"
                />
                <InfoCard
                  title="Что попадает в Yandex"
                  items={[
                    "только товары, которые видны на витрине",
                    "если у товара есть модификации — экспортируются варианты",
                    "одна картинка на оффер, цена, бренд, категория, ссылка и описание",
                    "артикул берём из variant.article / product.article / externalCode",
                  ]}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <FeedPreview
                  title="Предпросмотр XML"
                  value={yandexPreview?.preview ?? ""}
                  isRefreshing={yandexPreviewQuery.isFetching}
                  onRefresh={() => void yandexPreviewQuery.refetch()}
                />
                <FeedWarningsPanel
                  title="Предупреждения Yandex"
                  warnings={yandexDiagnostics?.stats.warnings ?? []}
                  footerTitle="Чек-лист и последняя проверка"
                  footerItems={[
                    ...(yandexValidation?.validation.checklist ?? [
                      "Нажми «Проверить Yandex», чтобы собрать deep-диагностику по фиду",
                    ]),
                    `Публичный URL: ${yandexSettingsQuery.data?.publicUrl ?? "https://techaks.ru/feeds/yandex-business.yml"}`,
                    "В Яндекс загружаем именно этот URL, а после правок пересобираем фид заново",
                  ]}
                  extraWarnings={yandexValidation?.validation.brokenPictureSamples ?? []}
                  extraWarningsTitle="Подозрительные картинки из выборки"
                />
              </div>
          </AdminSection>

          <AdminSection
            title="VK XML"
            description="Отдельный канал выгрузки для VK. Здесь можно независимо крутить фильтры, доступность, лимит товаров и UTM, не ломая Яндекс."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    void copyPublicUrl(
                      vkSettingsQuery.data?.publicUrl || "https://techaks.ru/feeds/vk.xml",
                      "Ссылка на VK XML"
                    )
                  }
                >
                  <Clipboard size={16} />
                  Скопировать ссылку
                </Button>
                <a
                  href={vkSettingsQuery.data?.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-[var(--tech-radius-button)] border border-border bg-background px-5 text-[11px] font-black uppercase tracking-widest text-foreground transition hover:bg-muted"
                >
                  <ExternalLink size={16} />
                  Открыть XML
                </a>
                <Button
                  variant="outline"
                  onClick={() => void vkValidationQuery.refetch()}
                  disabled={vkValidationQuery.isFetching}
                >
                  <RefreshCw
                    size={16}
                    className={vkValidationQuery.isFetching ? "animate-spin" : ""}
                  />
                  Проверить фид
                </Button>
                <Button
                  onClick={handleSaveVk}
                  disabled={saveVkMutation.isPending || vkSettingsQuery.isLoading}
                >
                  {saveVkMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Сохранить VK
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatCard
                label="Офферов"
                value={overview.vk?.offersCount ?? vkDiagnostics?.stats.totalOffers ?? 0}
                hint="Позиции, которые увидит VK"
                icon={Rss}
              />
              <AdminStatCard
                label="Предупреждений"
                value={overview.vk?.warningsCount ?? vkDiagnostics?.stats.warnings.length ?? 0}
                hint="Диагностика качества VK XML"
                icon={TriangleAlert}
                tone={(overview.vk?.warningsCount ?? 0) > 0 ? "warning" : "success"}
              />
              <AdminStatCard
                label="Публичный статус"
                value={vkEnabled ? "Включён" : "Выключен"}
                hint={vkEnabled ? "Маршрут доступен по ссылке" : "Публичный XML сейчас закрыт"}
                icon={ShieldCheck}
                tone={vkEnabled ? "success" : "default"}
              />
              <AdminStatCard
                label="Режим"
                value={vkUtmEnabled ? "UTM on" : "UTM off"}
                hint="Отдельная маркировка ссылок под VK"
                icon={FileCode2}
                tone={vkUtmEnabled ? "accent" : "default"}
              />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <ToggleRow
                    title="Включить VK-фид"
                    description="Публичный маршрут /feeds/vk.xml заработает только в активном режиме."
                    checked={vkEnabled}
                    onCheckedChange={setVkEnabled}
                  />
                  <ToggleRow
                    title="Добавлять UTM-метки"
                    description="Нужен отдельный канал аналитики, чтобы трафик из VK можно было считать отдельно."
                    checked={vkUtmEnabled}
                    onCheckedChange={setVkUtmEnabled}
                  />
                  <ToggleRow
                    title="Только товары в наличии"
                    description="Если включено, в фид не попадут товары без остатка."
                    checked={vkOnlyInStock}
                    onCheckedChange={setVkOnlyInStock}
                  />
                  <ToggleRow
                    title="Выгружать товары без наличия как unavailable"
                    description="Работает только если не включён жёсткий фильтр по наличию."
                    checked={vkIncludeOutOfStockAsUnavailable}
                    onCheckedChange={setVkIncludeOutOfStockAsUnavailable}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Название фида"
                    value={vkFeedName}
                    onChange={setVkFeedName}
                    placeholder="ТЕХАКС"
                  />
                  <Field
                    label="Company"
                    value={vkCompanyName}
                    onChange={setVkCompanyName}
                    placeholder="ТЕХАКС"
                  />
                  <Field
                    label="Базовый URL магазина"
                    value={vkShopUrl}
                    onChange={setVkShopUrl}
                    placeholder="https://techaks.ru"
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[var(--tech-color-text-main)]">
                      Лимит офферов
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={vkMaxItems}
                      onChange={event => setVkMaxItems(event.target.value)}
                      placeholder="Пусто = без лимита"
                      className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-[#05C3D4]"
                    />
                    <p className="text-xs text-[var(--tech-color-text-muted)]">
                      Можно ограничить объём выгрузки отдельно для VK, не затрагивая Yandex.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <Field
                    label="utm_source"
                    value={vkUtmSource}
                    onChange={setVkUtmSource}
                    placeholder="vk"
                  />
                  <Field
                    label="utm_medium"
                    value={vkUtmMedium}
                    onChange={setVkUtmMedium}
                    placeholder="cpc"
                  />
                  <Field
                    label="utm_campaign"
                    value={vkUtmCampaign}
                    onChange={setVkUtmCampaign}
                    placeholder="product_feed"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <FeedUrlCard
                  title="Публичный URL"
                  url={vkSettingsQuery.data?.publicUrl ?? "https://techaks.ru/feeds/vk.xml"}
                  enabled={vkEnabled}
                  enabledHint="Маршрут включён и доступен для VK"
                  disabledHint="Маршрут сейчас выключен и отдаёт 404"
                />
                <InfoCard
                  title="Что попадает в VK"
                  items={[
                    "товары и варианты с отдельной логикой доступности",
                    "до 8 изображений на оффер",
                    "URL можно маркировать отдельными UTM",
                    "при желании можно ограничить каталог по количеству офферов",
                  ]}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <FeedPreview
                title="Предпросмотр VK XML"
                value={vkPreview?.preview ?? ""}
                isRefreshing={vkPreviewQuery.isFetching}
                onRefresh={() => void vkPreviewQuery.refetch()}
              />
              <FeedWarningsPanel
                title="Диагностика VK"
                warnings={vkDiagnostics?.stats.warnings ?? []}
                footerTitle="Результат последней проверки"
                footerItems={[
                  `Режим: ${vkEnabled ? "live/public" : "disabled"}`,
                  `shop_url: ${vkSettingsQuery.data?.shopUrl ?? "—"}`,
                  `secret-like fields: не используются, всё хранится в настройках открыто только для этого канала`,
                  vkValidation
                    ? `Проверка выполнена: ${new Date(vkValidation.generatedAt).toLocaleString("ru-RU")}`
                    : "Нажми «Проверить фид», чтобы увидеть свежую диагностику",
                ]}
              />
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

function FeedUrlCard({
  title,
  url,
  enabled,
  enabledHint,
  disabledHint,
}: {
  title: string;
  url: string;
  enabled: boolean;
  enabledHint: string;
  disabledHint: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-[var(--tech-color-surface-muted)] px-5 py-5">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
        {title}
      </div>
      <div className="mt-3 rounded-2xl bg-white px-4 py-4 font-mono text-xs leading-6 text-[var(--tech-color-text-main)] ring-1 ring-black/5">
        {url}
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--tech-color-text-muted)] ring-1 ring-black/5">
        <CheckCircle2 size={14} className="text-[#05C3D4]" />
        {enabled ? enabledHint : disabledHint}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-border bg-white px-5 py-5">
      <div className="text-sm font-black text-[var(--tech-color-text-main)]">{title}</div>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--tech-color-text-main)]">
        {items.map(item => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function FeedPreview({
  title,
  value,
  isRefreshing,
  onRefresh,
}: {
  title: string;
  value: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-black text-[var(--tech-color-text-main)]">{title}</div>
        <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          Пересобрать
        </Button>
      </div>
      <textarea
        readOnly
        value={value}
        rows={24}
        className="w-full rounded-3xl border border-border bg-[#0B1120] px-4 py-4 font-mono text-xs leading-6 text-cyan-50 outline-none"
      />
    </div>
  );
}

function FeedWarningsPanel({
  title,
  warnings,
  footerTitle,
  footerItems,
  extraWarningsTitle,
  extraWarnings,
}: {
  title: string;
  warnings: string[];
  footerTitle: string;
  footerItems: string[];
  extraWarningsTitle?: string;
  extraWarnings?: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-[var(--tech-color-surface-muted)] px-5 py-5">
        <div className="text-sm font-black text-[var(--tech-color-text-main)]">{title}</div>
        {warnings.length === 0 ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} />
            Явных проблем не найдено
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {warnings.map((warning, index) => (
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

      {extraWarnings && extraWarnings.length > 0 ? (
        <div className="rounded-3xl border border-border bg-white px-5 py-5">
          <div className="text-sm font-black text-[var(--tech-color-text-main)]">
            {extraWarningsTitle || "Дополнительная диагностика"}
          </div>
          <div className="mt-4 space-y-3">
            {extraWarnings.map(item => (
              <div
                key={item}
                className="rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--tech-color-text-main)]"
              >
                <div className="flex items-start gap-3">
                  <TriangleAlert size={16} className="mt-1 shrink-0 text-amber-500" />
                  <span className="break-all">{item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-border bg-white px-5 py-5">
        <div className="text-sm font-black text-[var(--tech-color-text-main)]">
          {footerTitle}
        </div>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--tech-color-text-main)]">
          {footerItems.map(item => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
