import {
  Check,
  CircleAlert,
  CloudDownload,
  KeyRound,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { AppRouter } from "../../../api/router";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/providers/trpc";

type TargetType = "product" | "listing";
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
  const [targetType, setTargetType] = useState<TargetType>("product");
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
  const setDecision = trpc.wordstat.setQueryDecision.useMutation({
    onSuccess: async () => utils.wordstat.getCluster.invalidate(),
    onError: error => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="SEO и рост"
        title="Wordstat и кластеры спроса"
        description="Собирайте отдельный кластер запросов для каждой страницы товара и каждого опубликованного листинга. Частотность загружается только из админки и не замедляет витрину."
        actions={
          <Button
            type="button"
            onClick={() => syncBatch.mutate({ targetType })}
            disabled={syncBatch.isPending || !settingsQuery.data?.enabled}
            className="gap-2"
          >
            {syncBatch.isPending ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />}
            Обновить очередь
          </Button>
        }
      />

      <WordstatSettings />

      <div className="grid gap-6 xl:grid-cols-[minmax(330px,0.38fr)_minmax(0,0.62fr)]">
        <AdminSection
          title="Страницы для сбора"
          description="Сначала показываются страницы без кластера и с самой старой датой обновления."
          contentClassName="p-4"
          actions={
            <div className="flex rounded-xl bg-muted p-1">
              {(["product", "listing"] as const).map(type => (
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
                  {type === "product" ? "Товары" : "Списки товаров"}
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
              placeholder={targetType === "product" ? "Название или slug товара" : "H1 или URL листинга"}
              className={`${fieldClass} pl-10`}
            />
          </label>

          <div className="max-h-[650px] space-y-1 overflow-y-auto pr-1">
            {targetsQuery.isLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" /> Загружаю страницы...
              </div>
            ) : targetsQuery.data?.length ? (
              targetsQuery.data.map(target => (
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
                  <span className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="truncate">{target.primaryQuery || "Кластер не создан"}</span>
                    <span className="shrink-0">{formatDate(target.lastSyncedAt)}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Подходящих страниц не найдено.</p>
            )}
          </div>
        </AdminSection>

        <AdminSection
          title={clusterQuery.data?.target?.label || "Кластер страницы"}
          description={
            selectedId
              ? "Проверяйте реальные запросы и отмечайте те, которые подходят странице."
              : "Выберите товар или листинг слева."
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
              <p className="max-w-md text-sm">Для каждого товара и списка товаров хранится собственный независимый кластер.</p>
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
      description="Ключ хранится зашифрованно. Для Wordstat нужны права search-api.webSearch.user и yc.search-api.execute."
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
        <div className="text-xs text-muted-foreground">
          {data.lastCheck
            ? `Последняя проверка: ${String(data.lastCheck.message || "без сообщения")}`
            : "Подключение ещё не проверялось"}
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
    };
  }, [data.queries]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-px bg-border/60">
        {[
          ["Всего запросов", stats.all],
          ["Принято", stats.accepted],
          ["На проверке", stats.review],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-card px-5 py-4">
            <div className="text-2xl font-black text-foreground">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
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
            {data.queries.map(query => (
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
