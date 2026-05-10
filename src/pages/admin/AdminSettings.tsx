import { KeyRound, Loader2, PlugZap, Route, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.settings.getGemini.useQuery();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [proxyBaseUrl, setProxyBaseUrl] = useState("");
  const [proxyToken, setProxyToken] = useState("");

  useEffect(() => {
    if (!data) return;
    setApiKey("");
    setModel(data.model || "gemini-2.5-flash");
    setProxyBaseUrl(data.proxyBaseUrl || "");
    setProxyToken("");
  }, [data]);

  const saveMutation = trpc.settings.saveGemini.useMutation({
    onSuccess: () => {
      utils.settings.getGemini.invalidate();
      alert("Настройки Gemini сохранены.");
      setApiKey("");
      setProxyToken("");
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#15171A] p-8 text-white">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <PlugZap size={20} className="text-[#05C3D4]" />
            </div>
            <div>
              <h1 className="text-3xl font-black">Настройки интеграций ИИ</h1>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Здесь можно подключить Gemini для автоматической стандартизации
                характеристик. Ключ сохраняется в базе и используется в админке
                без ручной правки файлов на сервере.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/40">
              Статус
            </div>
            <div className="mt-2 text-lg font-black">
              {data?.isConfigured ? "Подключено" : "Не подключено"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-black text-[#15171A]">
              Gemini API
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Ключ нужен для предложений ИИ в стандартизации характеристик по
              категориям.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 px-6 py-10 text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              Загружаю настройки...
            </div>
          ) : (
            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Модель
                  </label>
                  <input
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="gemini-2.5-flash"
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Сохраненный ключ
                  </label>
                  <div className="flex h-11 items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-500">
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
                      className="h-11 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#05C3D4]"
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
                      className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
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
                    className="h-11 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#05C3D4]"
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
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
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
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-bold text-[#15171A] disabled:opacity-50"
                >
                  {testMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  Проверить подключение
                </button>

                <button
                  onClick={() => {
                    if (!confirm("Удалить сохраненный API-ключ Gemini?")) return;
                    clearMutation.mutate();
                  }}
                  disabled={clearMutation.isPending || data?.source === "env"}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-600 disabled:opacity-50"
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
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-600 disabled:opacity-50"
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
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
              Источник
            </div>
            <div className="mt-2 text-base font-black text-[#15171A]">
              {data?.proxyBaseUrl
                ? `Через AI Router (${data?.proxySource === "database" ? "База данных" : ".env"})`
                : data?.source === "database"
                  ? "Прямой доступ из базы данных"
                  : ".env fallback"}
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Если указан `AI Proxy URL`, запросы к Gemini идут через Cloud Run
              роутер. Если нет, система ходит напрямую по ключу Gemini.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
              Где используется
            </div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>Стандартизация характеристик по категории</li>
              <li>Подсказки для фильтров и видимости свойств</li>
              <li>Единые названия характеристик в каталоге</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
