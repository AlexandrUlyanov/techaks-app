import { AlertTriangle, CheckCircle2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function AdminNormalizeSpecs() {
  const preview = trpc.normalize.previewDescriptions.useQuery(
    { limit: 500, examplesLimit: 20 },
    { enabled: false }
  );

  const data = preview.data;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black font-heading tracking-tight text-[#15171A] uppercase">
            Нормализация характеристик
          </h1>
          <p className="text-gray-500 mt-2 max-w-3xl">
            Preview переносит строки вида "Ключ: значение" из описания товара в
            структурированные характеристики. Данные в базе не изменяются.
          </p>
        </div>
        <button
          onClick={() => preview.refetch()}
          disabled={preview.isFetching}
          className="flex items-center gap-2 px-6 py-3 bg-[#05C3D4] hover:bg-[#04a9b8] text-black rounded-xl font-bold transition-all disabled:opacity-50"
        >
          {preview.isFetching ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <SlidersHorizontal size={18} />
          )}
          Проверить
        </button>
      </div>

      {preview.error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">
          {preview.error.message}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              ["Проверено", data.scannedProducts],
              ["Будет изменено", data.changedProducts],
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
                    {product.conflicts.length > 0 ? (
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
    </div>
  );
}
