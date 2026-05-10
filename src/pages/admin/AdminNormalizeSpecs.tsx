import { AlertTriangle, CheckCircle2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function AdminNormalizeSpecs() {
  const utils = trpc.useUtils();
  const preview = trpc.normalize.previewDescriptions.useQuery(
    { limit: 50000, examplesLimit: 20 },
    { enabled: false }
  );
  const logs = trpc.normalize.getLogs.useQuery();
  const apply = trpc.normalize.applyDescriptions.useMutation({
    onSuccess: data => {
      preview.refetch();
      logs.refetch();
      utils.product.getSpecFilters.invalidate();
      alert(`Готово: применено ${data.appliedProducts}, пропущено ${data.skippedProducts}, перенесено характеристик ${data.movedSpecs}.`);
    },
  });
  const rebuildIndex = trpc.normalize.rebuildSpecIndex.useMutation({
    onSuccess: data => {
      utils.product.getSpecFilters.invalidate();
      alert(`Индекс собран: товаров ${data.indexedProducts}, значений ${data.indexedValues}.`);
    },
  });

  const data = preview.data;
  const isBusy = preview.isFetching || apply.isPending || rebuildIndex.isPending;

  const handleApply = () => {
    if (!data?.changedProducts) return;
    const confirmed = window.confirm(
      `Перенести характеристики у ${data.changedProducts} товаров? Товары с конфликтами будут пропущены.`
    );
    if (confirmed) {
      apply.mutate({ limit: 50000, examplesLimit: 20, skipConflicts: true, rebuildIndex: true });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black font-heading tracking-tight text-[#15171A] uppercase">
            Нормализация характеристик
          </h1>
          <p className="text-gray-500 mt-2 max-w-3xl">
            Preview показывает строки вида "Ключ: значение" из описания товара.
            Применение переносит их в характеристики, пишет аудит и обновляет индекс фильтров.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={() => preview.refetch()}
            disabled={isBusy}
            className="flex items-center gap-2 px-5 py-3 bg-[#05C3D4] hover:bg-[#04a9b8] text-black rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {preview.isFetching ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <SlidersHorizontal size={18} />
            )}
            Проверить
          </button>
          <button
            onClick={handleApply}
            disabled={isBusy || !data?.changedProducts}
            className="flex items-center gap-2 px-5 py-3 bg-[#15171A] hover:bg-black text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {apply.isPending ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            Применить
          </button>
          <button
            onClick={() => rebuildIndex.mutate({ limit: 10000 })}
            disabled={isBusy}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 hover:border-gray-300 text-[#15171A] rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {rebuildIndex.isPending ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Индекс
          </button>
        </div>
      </div>

      {(preview.error || apply.error || rebuildIndex.error) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">
          {preview.error?.message || apply.error?.message || rebuildIndex.error?.message}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              ["Проверено", data.scannedProducts],
              ["Будет изменено", data.changedProducts],
              ["Применено", data.appliedProducts],
              ["Найдено характеристик", data.movedSpecs],
              ["Конфликты", data.conflictCount],
            ].map(([label, value]) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {label}
                </div>
                <div className="text-3xl font-black text-[#15171A] mt-2">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 h-fit">
              <h2 className="text-sm font-black uppercase tracking-widest mb-5">
                Частые ключи
              </h2>
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {data.topKeys.map(item => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2"
                  >
                    <span className="text-xs font-bold text-gray-700">
                      {item.key}
                    </span>
                    <span className="text-xs font-black text-[#05C3D4]">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest">
                Примеры изменений
              </h2>
              {data.examples.map(product => (
                <div
                  key={product.id}
                  className="bg-white rounded-3xl border border-gray-100 p-6 space-y-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-black text-[#15171A]">
                        {product.name}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-1">
                        #{product.id} / {product.slug}
                      </div>
                    </div>
                    {product.applied ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-50 text-green-600 text-[10px] font-black uppercase">
                        <CheckCircle2 size={12} /> Применено
                      </span>
                    ) : product.conflicts.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-50 text-orange-600 text-[10px] font-black uppercase">
                        <AlertTriangle size={12} /> Конфликт
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-50 text-green-600 text-[10px] font-black uppercase">
                        <CheckCircle2 size={12} /> Готово
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                        Было в описании
                      </div>
                      <pre className="whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-xs text-gray-700">
                        {product.oldDescription}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                        Новое описание
                      </div>
                      <pre className="whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 text-xs text-gray-700 min-h-[72px]">
                        {product.newDescription || "Описание очистится"}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                      Найденные характеристики
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(product.parsedSpecs).map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-lg bg-[#05C3D4]/10 px-3 py-1.5 text-xs font-bold text-[#047987]"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 p-6">
        <h2 className="text-sm font-black uppercase tracking-widest mb-5">
          Последние запуски
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="py-3 pr-4">Дата</th>
                <th className="py-3 pr-4">Товар</th>
                <th className="py-3 pr-4">Источник</th>
                <th className="py-3 pr-4">Статус</th>
                <th className="py-3 pr-4">Перенесено</th>
                <th className="py-3 pr-4">Конфликты</th>
              </tr>
            </thead>
            <tbody>
              {(logs.data ?? []).map(log => (
                <tr key={log.id} className="border-t border-gray-100">
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(log.createdAt).toLocaleString("ru-RU")}
                  </td>
                  <td className="py-3 pr-4 font-bold text-[#15171A]">
                    {log.productName}
                  </td>
                  <td className="py-3 pr-4 text-gray-500">{log.source}</td>
                  <td className="py-3 pr-4 font-bold">{log.status}</td>
                  <td className="py-3 pr-4">{log.movedSpecCount}</td>
                  <td className="py-3 pr-4">{log.conflictCount}</td>
                </tr>
              ))}
              {logs.data?.length === 0 && (
                <tr>
                  <td className="py-6 text-gray-400" colSpan={6}>
                    Запусков пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
