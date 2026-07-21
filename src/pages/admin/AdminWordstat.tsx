import {
  Check,
  CircleAlert,
  CircleCheckBig,
  CloudDownload,
  KeyRound,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { AppRouter } from "../../../api/router";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/providers/trpc";

type TargetType = "category" | "product" | "listing";
type Decision = "suggested" | "accepted" | "rejected" | "needs_review";
type WordstatClusterData = inferRouterOutputs<AppRouter>["wordstat"]["getCluster"];

const decisionLabels: Record<Decision, string> = {
  suggested: "Предложен",
  accepted: "Принят",
  rejected: "Отклонён",
  needs_review: "На проверке",
};

const fieldClass =
  "h-11 border-border bg-background text-foreground placeholder:text-muted-foreground";

function isTargetStale(lastSyncedAt: string | Date | null | undefined, refreshDays: number) {
  if (!lastSyncedAt) return true;
  return new Date(lastSyncedAt).getTime() < Date.now() - refreshDays * 24 * 60 * 60 * 1000;
}

function getTargetState(target: { primaryQuery: string | null; lastSyncedAt: string | Date | null }, refreshDays: number) {
  if (!target.primaryQuery || !target.lastSyncedAt) {
    return { label: "Нет кластера", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  }
  if (isTargetStale(target.lastSyncedAt, refreshDays)) {
    return { label: "Нужно обновить", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" };
  }
  return { label: "Актуально", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Ещё не собирался";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminWordstat() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.wordstat.getSettings.useQuery();
  const coverageQuery = trpc.wordstat.getCoverageSummary.useQuery();
  const [targetType, setTargetType] = useState<TargetType>("category");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const targetsQuery = trpc.wordstat.listTargets.useQuery({
    targetType,
    search: deferredSearch || undefined,
    limit: 50,
  });
  const clusterQuery = trpc.wordstat.getCluster.useQuery(
    { targetType, targetId: selectedId ?? 0 },
    { enabled: selectedId !== null }
  );

  useEffect(() => {
    setSelectedId(null);
  }, [targetType]);

  const syncTarget = trpc.wordstat.syncTarget.useMutation({
    onSuccess: async result => {
      toast.success(`Кластер обновлён: ${result.resultCount + result.associationCount} запросов`);
      await Promise.all([
        utils.wordstat.listTargets.invalidate(),
        utils.wordstat.getCluster.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const syncBatch = trpc.wordstat.syncBatch.useMutation({
    onSuccess: async result => {
      toast.success(
        `Обработано ${result.processed}: успешно ${result.succeeded}, ошибок ${result.failed}`
      );
      await utils.wordstat.listTargets.invalidate();
      if (selectedId) await utils.wordstat.getCluster.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const syncPriorityBatch = trpc.wordstat.syncPriorityBatch.useMutation({
    onSuccess: async result => {
      if (!result.targetType) {
        toast.info("Все очереди сейчас пусты");
      } else {
        toast.success(`Собрана очередь: ${result.processed} объектов, ошибок ${result.failed}`);
      }
      await Promise.all([
        utils.wordstat.listTargets.invalidate(),
        utils.wordstat.getCoverageSummary.invalidate(),
        utils.wordstat.getCluster.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const setDecision = trpc.wordstat.setQueryDecision.useMutation({
    onSuccess: async () => utils.wordstat.getCluster.invalidate(),
    onError: error => toast.error(error.message),
  });

  const targetSummary = useMemo(() => {
    const targets = targetsQuery.data || [];
    const refreshDays = settingsQuery.data?.refreshDays ?? 30;
    return {
      total: targets.length,
      missing: targets.filter(target => !target.primaryQuery || !target.lastSyncedAt).length,
      stale: targets.filter(target => target.lastSyncedAt && isTargetStale(target.lastSyncedAt, refreshDays)).length,
    };
  }, [settingsQuery.data?.refreshDays, targetsQuery.data]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="SEO и рост"
        title="Спрос и запросы"
        description="Управляйте реальными поисковыми запросами для товаров и товарных листингов. Сбор работает в фоне и не влияет на скорость витрины."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => syncPriorityBatch.mutate()}
              disabled={syncPriorityBatch.isPending || !settingsQuery.data?.enabled}
              className="gap-2"
            >
              {syncPriorityBatch.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Собрать следующий приоритет
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => syncBatch.mutate({ targetType })}
              disabled={syncBatch.isPending || !settingsQuery.data?.enabled}
              className="gap-2"
            >
              {syncBatch.isPending ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
              Обновить очередь
            </Button>
          </div>
        }
      />

      <DemandNavigation />

      <WordstatSettings />

      {coverageQuery.data ? (
        <section className="grid gap-3 md:grid-cols-3" aria-label="Покрытие кластеризацией">
          {coverageQuery.data.phases.map(phase => (
            <div key={phase.targetType} className="rounded-2xl bg-muted/40 p-4">
              <div className="text-sm font-black text-foreground">{phase.label}</div>
              <div className="mt-2 text-2xl font-black text-foreground">
                {phase.clustered} <span className="text-base font-bold text-muted-foreground">/ {phase.total}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Без кластера: {phase.missing} · Спрос: {phase.demand.toLocaleString("ru-RU")}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка по спросу">
        <SummaryCard label="В очереди" value={targetSummary.total} hint={targetType === "category" ? "категорий в выборке" : targetType === "product" ? "товаров в выборке" : "листингов в выборке"} icon={<PackageSearch size={18} />} />
        <SummaryCard label="Без кластера" value={targetSummary.missing} hint="нужен первый сбор" tone="warning" icon={<Sparkles size={18} />} />
        <SummaryCard label="Нужно обновить" value={targetSummary.stale} hint={`старше ${settingsQuery.data?.refreshDays ?? 30} дней`} tone="info" icon={<RefreshCw size={18} />} />
        <SummaryCard
          label="Подключение"
          value={settingsQuery.data?.enabled ? "Включено" : "Выключено"}
          hint={settingsQuery.data?.apiKeyConfigured ? "ключ настроен" : "нужен API-ключ"}
          tone={settingsQuery.data?.enabled && settingsQuery.data?.apiKeyConfigured ? "success" : "neutral"}
          icon={<CircleCheckBig size={18} />}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(330px,0.38fr)_minmax(0,0.62fr)]">
        <AdminSection
          title="Страницы для сбора"
          description="Сначала показываются страницы без кластера и с самой старой датой обновления. Выберите страницу, чтобы проверить её запросы."
          contentClassName="p-4"
          actions={
            <div className="flex rounded-xl bg-muted p-1">
              {(["category", "product", "listing"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTargetType(type)}
                  className={`h-9 rounded-lg px-3 text-xs font-black transition-colors ${
                    targetType === type
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type === "category" ? "Категории" : type === "product" ? "Товары" : "Списки товаров"}
                </button>
              ))}
            </div>
          }
        >
          <label className="relative mb-4 block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={targetType === "category" ? "Название или slug категории" : targetType === "product" ? "Название или slug товара" : "H1 или URL листинга"}
              className={`${fieldClass} pl-10`}
            />
          </label>

          <div className="max-h-[650px] space-y-1 overflow-y-auto pr-1">
            {targetsQuery.isLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" /> Загружаю страницы...
              </div>
            ) : targetsQuery.data?.length ? (
              targetsQuery.data.map(target => {
                const state = getTargetState(target, settingsQuery.data?.refreshDays ?? 30);
                return (
                  <button
                  key={target.id}
                  type="button"
                  onClick={() => setSelectedId(target.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                    selectedId === target.id
                      ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,transparent)]"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="block truncate text-sm font-bold text-foreground">
                    {target.name || target.slug || `Страница #${target.id}`}
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="truncate">{target.primaryQuery || "Кластер не создан"}</span>
                    <span className="shrink-0">{target.lastSyncedAt ? formatDate(target.lastSyncedAt) : "Не собирался"}</span>
                  </span>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${state.className}`}>
                    {state.label}
                  </span>
                  </button>
                );
              })
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Подходящих страниц не найдено.</p>
            )}
          </div>
        </AdminSection>

        <AdminSection
          title={clusterQuery.data?.target?.label || "Кластер страницы"}
          description={
            selectedId
              ? "Оставляйте только коммерчески релевантные запросы: их можно использовать при подготовке контента и посадочных страниц."
              : "Выберите категорию, товар или листинг слева."
          }
          contentClassName="p-0"
          actions={
            selectedId ? (
              <Button
                variant="outline"
                onClick={() => syncTarget.mutate({ targetType, targetId: selectedId })}
                disabled={syncTarget.isPending || !settingsQuery.data?.enabled}
                className="gap-2"
              >
                {syncTarget.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Собрать заново
              </Button>
            ) : null
          }
        >
          {!selectedId ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <PackageSearch size={34} />
              <p className="max-w-md text-sm">Для каждой категории, товара и посадочной страницы хранится отдельный независимый кластер. Ничего не публикуется автоматически.</p>
            </div>
          ) : clusterQuery.isLoading ? (
            <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin" /> Загружаю кластер...
            </div>
          ) : !clusterQuery.data?.cluster ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center">
              <CircleAlert size={34} className="text-muted-foreground" />
              <div>
                <p className="font-bold text-foreground">Для страницы ещё нет данных</p>
                <p className="mt-1 text-sm text-muted-foreground">Запустите сбор, Wordstat вернёт основные и связанные запросы.</p>
              </div>
            </div>
          ) : (
            <ClusterDetails
              data={clusterQuery.data}
              onDecision={(queryId, decision) => setDecision.mutate({ queryId, decision })}
              pendingDecisionId={setDecision.variables?.queryId}
            />
          )}
        </AdminSection>
      </div>
    </div>
  );
}

function DemandNavigation() {
  const steps = [
    {
      href: "/admin/listings",
      label: "Посадочные страницы",
      description: "Что опубликовано и что требует подготовки",
    },
    {
      href: "/admin/seo/wordstat",
      label: "Спрос и кластеры",
      description: "Какие запросы важны для каждой страницы",
      current: true,
    },
    {
      href: "/admin/listings#listing-quality",
      label: "Качество листингов",
      description: "Дубли, пустые страницы и слабые места",
    },
  ];

  return (
    <nav
      aria-label="Рабочий контур SEO и роста"
      className="grid gap-2 rounded-2xl bg-muted/35 p-2 md:grid-cols-3"
    >
      {steps.map(step => (
        <Link
          key={step.href}
          to={step.href}
          aria-current={step.current ? "page" : undefined}
          className={`group rounded-xl px-4 py-3 transition-colors ${
            step.current
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
          }`}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-sm font-black">{step.label}</span>
            <span className="text-[var(--tech-color-primary)] opacity-0 transition-opacity group-hover:opacity-100">
              →
            </span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {step.description}
          </span>
        </Link>
      ))}
    </nav>
  );
}

function WordstatSettings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.wordstat.getSettings.useQuery();
  const [enabled, setEnabled] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [regionIds, setRegionIds] = useState("");
  const [numPhrases, setNumPhrases] = useState("50");
  const [refreshDays, setRefreshDays] = useState("30");
  const [maxTargets, setMaxTargets] = useState("20");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setFolderId(data.folderId);
    setRegionIds(data.regionIds.join(", "));
    setNumPhrases(String(data.numPhrases));
    setRefreshDays(String(data.refreshDays));
    setMaxTargets(String(data.maxTargetsPerRun));
  }, [data]);

  const save = trpc.wordstat.saveSettings.useMutation({
    onSuccess: async () => {
      setApiKey("");
      toast.success("Настройки Wordstat сохранены");
      await utils.wordstat.getSettings.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const test = trpc.wordstat.testConnection.useMutation({
    onSuccess: async result => {
      toast.success(result.message);
      await utils.wordstat.getSettings.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (isLoading || !data) return null;
  return (
    <AdminSection
      title="Подключение к Yandex Search API"
      description="Ключ хранится зашифрованно. Для сбора Wordstat нужны права search-api.webSearch.user и yc.search-api.execute."
      tone="subtle"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground">Интеграция</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Folder ID">
          <Input value={folderId} onChange={e => setFolderId(e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Новый API-ключ" hint={data.apiKeyConfigured ? `Сохранён ключ ••••${data.apiKeyLast4}` : "Ключ не настроен"}>
          <div className="relative">
            <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Оставьте пустым, чтобы не менять" className={`${fieldClass} pl-10`} />
          </div>
        </Field>
        <Field label="Регионы Wordstat" hint="ID через запятую; пусто — вся Россия">
          <Input value={regionIds} onChange={e => setRegionIds(e.target.value)} placeholder="Например: 49" className={fieldClass} />
        </Field>
        <Field label="Запросов на страницу">
          <Input type="number" min={1} max={2000} value={numPhrases} onChange={e => setNumPhrases(e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Обновлять каждые, дней">
          <Input type="number" min={1} max={365} value={refreshDays} onChange={e => setRefreshDays(e.target.value)} className={fieldClass} />
        </Field>
        <Field label="Страниц за один пакет">
          <Input type="number" min={1} max={100} value={maxTargets} onChange={e => setMaxTargets(e.target.value)} className={fieldClass} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{enabled ? "Сбор включён" : "Сбор выключен"}</span>
          {" · "}
          {data.lastCheck
            ? `Последняя проверка: ${String(data.lastCheck.message || "без сообщения")}`
            : "подключение ещё не проверялось"}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => test.mutate({ seedQuery: "техника" })} disabled={test.isPending} className="gap-2">
            {test.isPending ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />}
            Проверить
          </Button>
          <Button
            onClick={() =>
              save.mutate({
                enabled,
                folderId,
                regionIds: regionIds.split(",").map(item => item.trim()).filter(Boolean),
                numPhrases: Number(numPhrases),
                refreshDays: Number(refreshDays),
                maxTargetsPerRun: Number(maxTargets),
                apiKey: apiKey || undefined,
              })
            }
            disabled={save.isPending}
          >
            {save.isPending ? "Сохраняю..." : "Сохранить настройки"}
          </Button>
        </div>
      </div>
    </AdminSection>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-bold text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  tone?: "neutral" | "warning" | "info" | "success";
}) {
  const toneClass = {
    neutral: "bg-muted text-muted-foreground",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  }[tone];
  return (
    <div className="flex min-h-28 items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
      <div>
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>{icon}</span>
    </div>
  );
}

function ClusterDetails({
  data,
  onDecision,
  pendingDecisionId,
}: {
  data: WordstatClusterData;
  onDecision: (queryId: number, decision: Decision) => void;
  pendingDecisionId?: number;
}) {
  const stats = useMemo(() => {
    const queries = data.queries || [];
    return {
      all: queries.length,
      accepted: queries.filter(item => item.decision === "accepted").length,
      review: queries.filter(item => item.decision === "needs_review").length,
      suggested: queries.filter(item => item.decision === "suggested").length,
      totalDemand: queries.reduce((sum, item) => sum + Number(item.count30d || 0), 0),
    };
  }, [data.queries]);
  const [scope, setScope] = useState<"all" | "suggested" | "needs_review" | "accepted">("all");
  const visibleQueries = useMemo(
    () => data.queries.filter(query => scope === "all" || query.decision === scope),
    [data.queries, scope]
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-px bg-border/60 md:grid-cols-4">
        {[
          ["Всего запросов", stats.all],
          ["Принято", stats.accepted],
          ["На проверке", stats.review],
          ["Суммарный спрос", stats.totalDemand.toLocaleString("ru-RU")],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-card px-5 py-4">
            <div className="text-2xl font-black text-foreground">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
        <p className="text-xs text-muted-foreground">Решение по запросу не меняет SEO автоматически: оно формирует рабочую очередь для контента.</p>
        <div className="flex rounded-xl bg-muted p-1">
          {[
            ["all", `Все ${stats.all}`],
            ["suggested", `Новые ${stats.suggested}`],
            ["needs_review", `Проверить ${stats.review}`],
            ["accepted", `Принято ${stats.accepted}`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value as typeof scope)}
              className={`h-8 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                scope === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Запрос</th>
              <th className="px-4 py-3">Частота за 30 дней</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Решение</th>
              <th className="px-5 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {visibleQueries.map(query => (
              <tr key={query.id} className="border-t border-border/60">
                <td className="max-w-sm px-5 py-3 font-semibold text-foreground">{query.query}</td>
                <td className="px-4 py-3 font-black text-foreground">{Number(query.count30d).toLocaleString("ru-RU")}</td>
                <td className="px-4 py-3 text-muted-foreground">{query.kind === "association" ? "Связанный" : "Основной"}</td>
                <td className="px-4 py-3 text-muted-foreground">{decisionLabels[query.decision as Decision] || query.decision}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <DecisionButton label="Принять" icon={<Check size={15} />} active={query.decision === "accepted"} pending={pendingDecisionId === query.id} onClick={() => onDecision(query.id, "accepted")} />
                    <DecisionButton label="Проверить" icon={<CircleAlert size={15} />} active={query.decision === "needs_review"} pending={pendingDecisionId === query.id} onClick={() => onDecision(query.id, "needs_review")} />
                    <DecisionButton label="Отклонить" icon={<X size={15} />} active={query.decision === "rejected"} pending={pendingDecisionId === query.id} onClick={() => onDecision(query.id, "rejected")} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visibleQueries.length ? (
        <p className="border-t border-border/60 px-5 py-7 text-center text-sm text-muted-foreground">В этой группе запросов пока нет.</p>
      ) : null}
      {data.runs?.length ? (
        <div className="border-t border-border/70 px-5 py-4 text-xs text-muted-foreground">
          Последний запуск: {formatDate(data.runs[0].startedAt)} · {data.runs[0].status === "completed" ? "успешно" : data.runs[0].status}
          {data.runs[0].errorMessage ? ` · ${data.runs[0].errorMessage}` : ""}
        </div>
      ) : null}
    </div>
  );
}

function DecisionButton({ label, icon, active, pending, onClick }: { label: string; icon: ReactNode; active: boolean; pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={pending}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
        active ? "bg-[var(--tech-color-primary)] text-black" : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : icon}
    </button>
  );
}
