import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, RefreshCw, Save, Wand2 } from "lucide-react";
import { trpc } from "@/providers/trpc";

type Category = {
  id: number;
  name: string;
  parentId: number | null;
};

type RuleEdit = {
  targetKey: string;
  isVisible: boolean;
  isFilterable: boolean;
  sortOrder: number;
};

export default function ProductSpecStandardizationPanel({
  categories,
}: {
  categories: Category[];
}) {
  const rootCategories = useMemo(
    () => categories.filter(category => !category.parentId),
    [categories]
  );
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<string, RuleEdit>>({});
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!categoryId && rootCategories.length > 0) {
      setCategoryId(rootCategories[0].id);
    }
  }, [categoryId, rootCategories]);

  const standardization = trpc.product.getSpecStandardization.useQuery(
    { categoryId: categoryId ?? 0 },
    { enabled: Boolean(categoryId) }
  );

  const saveRule = trpc.product.upsertSpecRule.useMutation({
    onSuccess: () => {
      standardization.refetch();
      utils.product.getSpecFilters.invalidate();
    },
  });

  const applyRules = trpc.product.applySpecStandardization.useMutation({
    onSuccess: data => {
      standardization.refetch();
      utils.product.getSpecFilters.invalidate();
      alert(
        `Готово: применено ${data.appliedProducts}, пропущено ${data.skippedProducts}, конфликтов ${data.conflictCount}.`
      );
    },
  });

  const rows = standardization.data ?? [];
  const getEdit = (row: (typeof rows)[number]) =>
    edits[row.sourceNormalizedKey] ?? {
      targetKey: row.targetKey,
      isVisible: row.isVisible,
      isFilterable: row.isFilterable,
      sortOrder: row.sortOrder,
    };

  const patchEdit = (
    row: (typeof rows)[number],
    patch: Partial<RuleEdit>
  ) => {
    setEdits(prev => ({
      ...prev,
      [row.sourceNormalizedKey]: {
        ...getEdit(row),
        ...patch,
      },
    }));
  };

  const topRows = rows.slice(0, 40);

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-[#0a0a0a]">
            Стандартизация характеристик
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Настраиваем стандартные названия характеристик по категории и
            решаем, что участвует в фильтрах. Применение аккуратно
            переименовывает ключи в товарах категории и пропускает конфликты.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryId ?? ""}
            onChange={event => setCategoryId(Number(event.target.value))}
            className="h-11 min-w-[260px] rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            {rootCategories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => standardization.refetch()}
            disabled={standardization.isFetching || !categoryId}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-bold text-[#0a0a0a] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={standardization.isFetching ? "animate-spin" : ""}
            />
            Обновить
          </button>
          <button
            onClick={() => {
              if (!categoryId) return;
              applyRules.mutate({ categoryId, limit: 10000 });
            }}
            disabled={applyRules.isPending || !categoryId}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#15171A] px-4 text-sm font-black text-white disabled:opacity-50"
          >
            <Wand2 size={16} />
            Применить
          </button>
        </div>
      </div>

      {(standardization.error || saveRule.error || applyRules.error) && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {standardization.error?.message ||
            saveRule.error?.message ||
            applyRules.error?.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Ключей найдено
          </div>
          <div className="mt-2 text-2xl font-black text-[#15171A]">
            {rows.length}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Со своими правилами
          </div>
          <div className="mt-2 text-2xl font-black text-[#15171A]">
            {rows.filter(row => row.hasRule).length}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            В фильтрах
          </div>
          <div className="mt-2 text-2xl font-black text-[#15171A]">
            {rows.filter(row => row.isFilterable).length}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Скрыты
          </div>
          <div className="mt-2 text-2xl font-black text-[#15171A]">
            {rows.filter(row => !row.isVisible).length}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3">Исходный ключ</th>
                <th className="px-4 py-3">Стандарт</th>
                <th className="px-4 py-3">Товаров</th>
                <th className="px-4 py-3">Значений</th>
                <th className="px-4 py-3">Показ</th>
                <th className="px-4 py-3">Фильтр</th>
                <th className="px-4 py-3">Порядок</th>
                <th className="px-4 py-3">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {topRows.map(row => {
                const edit = getEdit(row);
                return (
                  <tr key={row.sourceNormalizedKey}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#15171A]">{row.sourceKey}</div>
                      <div className="mt-1 text-xs text-gray-400">
                        {row.sampleValue || "Без примера"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={edit.targetKey}
                        onChange={event =>
                          patchEdit(row, { targetKey: event.target.value })
                        }
                        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </td>
                    <td className="px-4 py-3 font-bold text-[#15171A]">
                      {row.productCount}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.valueCount}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          patchEdit(row, { isVisible: !edit.isVisible })
                        }
                        className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black uppercase ${
                          edit.isVisible
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {edit.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                        {edit.isVisible ? "Показывать" : "Скрыто"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          patchEdit(row, { isFilterable: !edit.isFilterable })
                        }
                        className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black uppercase ${
                          edit.isFilterable
                            ? "bg-cyan-50 text-cyan-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <Check size={14} />
                        {edit.isFilterable ? "В фильтрах" : "Скрыт"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={edit.sortOrder}
                        onChange={event =>
                          patchEdit(row, {
                            sortOrder: Number(event.target.value || 0),
                          })
                        }
                        className="h-10 w-20 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          if (!categoryId) return;
                          saveRule.mutate({
                            categoryId,
                            sourceKey: row.sourceKey,
                            sourceNormalizedKey: row.sourceNormalizedKey,
                            targetKey: edit.targetKey,
                            isVisible: edit.isVisible,
                            isFilterable: edit.isFilterable,
                            sortOrder: edit.sortOrder,
                          });
                        }}
                        disabled={saveRule.isPending}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#05C3D4] px-4 text-xs font-black uppercase text-black disabled:opacity-50"
                      >
                        <Save size={14} />
                        Сохранить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {topRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Для категории пока нет проиндексированных характеристик
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
