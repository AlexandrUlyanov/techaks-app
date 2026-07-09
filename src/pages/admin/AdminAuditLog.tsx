import { useMemo, useState } from "react";
import { History, RefreshCw, Search, Settings2, ShieldCheck, UserCircle2 } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function formatActionLabel(action: string) {
  const map: Record<string, string> = {
    "category.create": "Создание категории",
    "category.update": "Изменение категории",
    "category.delete": "Удаление категории",
    "category.reorder": "Изменение порядка категорий",
    "store.create": "Создание магазина",
    "store.update": "Изменение магазина",
    "store.delete": "Удаление магазина",
    "banner.create": "Создание акции",
    "banner.update": "Изменение акции",
    "banner.delete": "Удаление акции",
    "settings.site_profile.update": "Изменение профиля сайта",
    "settings.maintenance.update": "Изменение режима техобслуживания",
    "settings.reservations.update": "Изменение настроек резервов",
    "settings.ai.update": "Изменение AI-настроек",
    "settings.ai.clear_api_key": "Очистка Gemini API key",
    "settings.ai.clear_proxy_token": "Очистка AI proxy token",
    "settings.logo_provider.update": "Изменение провайдера логотипов",
    "settings.logo_provider.clear_token": "Очистка токена логотипов",
    "settings.moysklad.update": "Изменение настроек МойСклад",
    "settings.moysklad.clear_token": "Очистка токена МойСклад",
    "settings.moysklad.clear_webhook_secret": "Очистка секрета вебхука МойСклад",
    "settings.yookassa.update": "Изменение настроек YooKassa",
    "settings.yookassa.test_connection": "Проверка подключения YooKassa",
    "settings.yandex_delivery.update":
      "Изменение настроек Яндекс Доставки",
    "settings.yandex_delivery.test_connection":
      "Проверка подключения Яндекс Доставки",
    "settings.yandex_geosuggest.test_connection":
      "Проверка подключения GeoSuggest",
    "settings.feed.yandex_yml.update": "Изменение настроек Yandex YML",
    "settings.feed.vk.update": "Изменение настроек VK-фида",
    "settings.homepage_hero.update": "Изменение hero главной страницы",
    "settings.homepage_hero_content.update":
      "Изменение контента hero главной страницы",
    "settings.auth.update": "Изменение настроек авторизации и почты",
  };

  return map[action] ?? action;
}

function formatEntityLabel(entityType: string) {
  const map: Record<string, string> = {
    category: "Категория",
    store: "Магазин",
    banner: "Акция",
    settings: "Настройки",
  };
  return map[entityType] ?? entityType;
}

function renderJson(value: unknown) {
  if (!value) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminAuditLog() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  const auditQuery = trpc.settings.getAdminAuditLogs.useQuery(
    {
      search: search.trim() || undefined,
      entityType: entityType || undefined,
      action: action || undefined,
      limit: 120,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const items = auditQuery.data?.items ?? [];
  const summary = auditQuery.data?.summary;
  const facets = auditQuery.data?.facets;

  const settingsEntries = useMemo(
    () => items.filter(item => item.entityType === "settings").length,
    [items]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Система"
        title="Журнал изменений"
        description="Здесь мы видим, кто и когда менял категории, магазины, акции и чувствительные настройки. Секреты и ключи в журнал не попадают."
        actions={
          <Button
            variant="outline"
            onClick={() => utils.settings.getAdminAuditLogs.invalidate()}
            disabled={auditQuery.isFetching}
          >
            <RefreshCw size={16} className={`mr-2 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Всего записей"
          value={summary?.total ?? 0}
          hint="Общий объём журнала"
          icon={History}
        />
        <AdminStatCard
          label="За 24 часа"
          value={summary?.last24h ?? 0}
          hint="Свежие административные действия"
          icon={RefreshCw}
          tone={(summary?.last24h ?? 0) > 0 ? "accent" : "default"}
        />
        <AdminStatCard
          label="Изменения настроек"
          value={summary?.settingsChanges ?? 0}
          hint="Отдельно по чувствительным настройкам"
          icon={Settings2}
          tone={(summary?.settingsChanges ?? 0) > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Уникальных админов"
          value={summary?.uniqueActors ?? 0}
          hint="Кто вносил изменения"
          icon={UserCircle2}
          tone="success"
        />
      </div>

      <AdminSection
        title="Фильтры и обзор"
        description="Быстрый поиск по сущности, действию и ответственному сотруднику."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Поиск: email, действие, сущность"
                className="h-10 min-w-[280px] rounded-xl border border-border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#05C3D4]"
              />
            </div>
            <select
              value={entityType}
              onChange={event => setEntityType(event.target.value)}
              className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-[#05C3D4]"
            >
              <option value="">Все сущности</option>
              {(facets?.entityTypes ?? []).map(value => (
                <option key={value} value={value}>
                  {formatEntityLabel(value)}
                </option>
              ))}
            </select>
            <select
              value={action}
              onChange={event => setAction(event.target.value)}
              className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-[#05C3D4]"
            >
              <option value="">Все действия</option>
              {(facets?.actions ?? []).map(value => (
                <option key={value} value={value}>
                  {formatActionLabel(value)}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
              Текущая выборка
            </div>
            <div className="mt-2 text-2xl font-black text-[var(--tech-color-text-main)]">
              {items.length}
            </div>
            <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">
              Строк загружено в таблицу
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
              Из них настройки
            </div>
            <div className="mt-2 text-2xl font-black text-[var(--tech-color-text-main)]">
              {settingsEntries}
            </div>
            <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">
              Чувствительные административные изменения
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
              Защита секрета
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-700">
              <ShieldCheck size={16} />
              Секреты маскируются
            </div>
            <div className="mt-2 text-sm text-[var(--tech-color-text-muted)]">
              API keys, токены и пароли в журнале редактируются автоматически.
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Последние изменения"
        description="Свежие действия в административном контуре. Раскрой запись, чтобы посмотреть до/после и служебный контекст."
        contentClassName="px-0 py-0"
      >
        {auditQuery.isLoading ? (
          <div className="px-6 py-10 text-sm text-gray-500">Загружаем журнал изменений...</div>
        ) : auditQuery.error ? (
          <div className="px-6 py-10 text-sm text-rose-600">
            Не удалось загрузить журнал: {auditQuery.error.message}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-sm text-gray-500">
            Журнал пока пуст. Как только в админке будут изменения, записи появятся здесь.
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {items.map(item => (
              <details key={item.id} className="group bg-white px-6 py-5 transition open:bg-[#F7FEFF]">
                <summary className="flex cursor-pointer list-none flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--tech-color-surface-muted)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
                        {formatEntityLabel(item.entityType)}
                      </span>
                      <span className="rounded-full bg-[#EAFBFD] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#0099A8]">
                        {formatActionLabel(item.action)}
                      </span>
                      {item.entityLabel ? (
                        <span className="text-sm font-semibold text-[var(--tech-color-text-main)]">
                          {item.entityLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--tech-color-text-muted)]">
                      <span>{item.actorEmail || "Системное действие"}</span>
                      <span>•</span>
                      <span>{item.actorRole || "system"}</span>
                      <span>•</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-[var(--tech-color-text-muted)]">
                    ID записи #{item.id}
                  </div>
                </summary>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <div className="space-y-2 rounded-2xl bg-[var(--tech-color-surface-muted)] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
                      До
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-[var(--tech-color-text-main)]">
                      {renderJson(item.beforeJson)}
                    </pre>
                  </div>
                  <div className="space-y-2 rounded-2xl bg-[var(--tech-color-surface-muted)] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
                      После
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-[var(--tech-color-text-main)]">
                      {renderJson(item.afterJson)}
                    </pre>
                  </div>
                  <div className="space-y-2 rounded-2xl bg-[var(--tech-color-surface-muted)] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
                      Контекст
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-[var(--tech-color-text-main)]">
                      {renderJson({
                        meta: item.metaJson,
                        ip: item.ip,
                        userAgent: item.userAgent,
                        entityId: item.entityId,
                      })}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </AdminSection>
    </div>
  );
}
