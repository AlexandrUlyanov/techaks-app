import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Wand2,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

type Category = {
  id: number;
  name: string;
  parentId: number | null;
};

type KeyRuleEdit = {
  targetKey: string;
  isVisible: boolean;
  isFilterable: boolean;
  sortOrder: number;
  reason?: string;
};

type ValueRuleEdit = {
  targetValue: string;
  sortOrder: number;
};

type SectionKey = "keys" | "values";

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
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    keys: true,
    values: false,
  });
  const [keyEdits, setKeyEdits] = useState<Record<string, KeyRuleEdit>>({});
  const [valueEdits, setValueEdits] = useState<Record<string, ValueRuleEdit>>({});
  const [selectedValueKey, setSelectedValueKey] = useState<string>("");
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

  const rows = standardization.data ?? [];

  useEffect(() => {
    if (!rows.length) {
      setSelectedValueKey("");
      return;
    }

    if (!selectedValueKey || !rows.some(row => row.sourceNormalizedKey === selectedValueKey)) {
      setSelectedValueKey(rows[0].sourceNormalizedKey);
    }
  }, [rows, selectedValueKey]);

  const valueStandardization = trpc.product.getSpecValueStandardization.useQuery(
    {
      categoryId: categoryId ?? 0,
      sourceNormalizedKey: selectedValueKey,
    },
    {
      enabled: Boolean(categoryId && selectedValueKey),
    }
  );

  const valueRows = valueStandardization.data ?? [];

  const saveRule = trpc.product.upsertSpecRule.useMutation({
    onSuccess: () => {
      standardization.refetch();
      utils.product.getSpecFilters.invalidate();
    },
  });
  const saveBulkRules = trpc.product.upsertSpecRulesBulk.useMutation({
    onSuccess: data => {
      standardization.refetch();
      utils.product.getSpecFilters.invalidate();
      alert(`Сохранено правил характеристик: ${data.saved}.`);
    },
  });
  const suggestWithAi = trpc.product.suggestSpecRulesWithAi.useMutation({
    onSuccess: suggestions => {
      const nextEdits: Record<string, KeyRuleEdit> = {};
      for (const suggestion of suggestions) {
        nextEdits[suggestion.sourceNormalizedKey] = {
          targetKey: suggestion.targetKey,
          isVisible: suggestion.isVisible,
          isFilterable: suggestion.isFilterable,
          sortOrder: suggestion.sortOrder,
          reason: suggestion.reason,
        };
      }
      setKeyEdits(nextEdits);
    },
  });
  const applyRules = trpc.product.applySpecStandardization.useMutation({
    onSuccess: data => {
      standardization.refetch();
      valueStandardization.refetch();
      utils.product.getSpecFilters.invalidate();
      alert(
        `Готово: применено ${data.appliedProducts}, пропущено ${data.skippedProducts}, конфликтов ${data.conflictCount}.`
      );
    },
  });

  const saveValueRule = trpc.product.upsertSpecValueRule.useMutation({
    onSuccess: () => {
      valueStandardization.refetch();
      utils.product.getSpecFilters.invalidate();
    },
  });
  const saveBulkValueRules = trpc.product.upsertSpecValueRulesBulk.useMutation({
    onSuccess: data => {
      valueStandardization.refetch();
      utils.product.getSpecFilters.invalidate();
      alert(`Сохранено правил значений: ${data.saved}.`);
    },
  });
  const applyValueRules = trpc.product.applySpecValueStandardization.useMutation({
    onSuccess: data => {
      standardization.refetch();
      valueStandardization.refetch();
      utils.product.getSpecFilters.invalidate();
      alert(
        `Значения применены: ${data.appliedProducts} товаров обновлено, ${data.changedProducts} изменений найдено.`
      );
    },
  });

  const getKeyEdit = (row: (typeof rows)[number]) =>
    keyEdits[row.sourceNormalizedKey] ?? {
      targetKey: row.targetKey,
      isVisible: row.isVisible,
      isFilterable: row.isFilterable,
      sortOrder: row.sortOrder,
      reason: "",
    };

  const patchKeyEdit = (
    row: (typeof rows)[number],
    patch: Partial<KeyRuleEdit>
  ) => {
    setKeyEdits(prev => ({
      ...prev,
      [row.sourceNormalizedKey]: {
        ...getKeyEdit(row),
        ...patch,
      },
    }));
  };

  const getValueEdit = (row: (typeof valueRows)[number]) =>
    valueEdits[row.sourceNormalizedValue] ?? {
      targetValue: row.targetValue,
      sortOrder: row.sortOrder,
    };

  const patchValueEdit = (
    row: (typeof valueRows)[number],
    patch: Partial<ValueRuleEdit>
  ) => {
    setValueEdits(prev => ({
      ...prev,
      [row.sourceNormalizedValue]: {
        ...getValueEdit(row),
        ...patch,
      },
    }));
  };

  const topRows = rows.slice(0, 40);
  const topValueRows = valueRows.slice(0, 60);
  const selectedKeyRow =
    rows.find(row => row.sourceNormalizedKey === selectedValueKey) ?? null;

  const toggleSection = (section: SectionKey) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const keyErrors =
    standardization.error ||
    saveRule.error ||
    saveBulkRules.error ||
    suggestWithAi.error ||
    applyRules.error;
  const valueErrors =
    valueStandardization.error ||
    saveValueRule.error ||
    saveBulkValueRules.error ||
    applyValueRules.error;

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-[#0a0a0a]">
            Стандартизация характеристик и значений
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Здесь приводим к стандарту и названия свойств, и их значения внутри
            категории. Разделы свернуты в аккордеоны, чтобы не мешать обычной
            работе с товарами.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryId ?? ""}
            onChange={event => {
              setCategoryId(Number(event.target.value));
              setKeyEdits({});
              setValueEdits({});
            }}
            className="h-11 min-w-[260px] rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            {rootCategories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              standardization.refetch();
              valueStandardization.refetch();
            }}
            disabled={
              standardization.isFetching ||
              valueStandardization.isFetching ||
              !categoryId
            }
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-bold text-[#0a0a0a] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                standardization.isFetching || valueStandardization.isFetching
                  ? "animate-spin"
                  : ""
              }
            />
            Обновить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <StatCard label="Ключей найдено" value={rows.length} />
        <StatCard
          label="Ключей с правилами"
          value={rows.filter(row => row.hasRule).length}
        />
        <StatCard
          label="Значений найдено"
          value={valueRows.length}
        />
        <StatCard
          label="Значений с правилами"
          value={valueRows.filter(row => row.hasRule).length}
        />
        <StatCard
          label="Ключ для значений"
          value={selectedKeyRow?.sourceKey || "—"}
          compact
        />
      </div>

      <AccordionSection
        title="Стандартизация характеристик"
        description="Переименовываем ключи, управляем видимостью и участием в фильтрах."
        open={openSections.keys}
        onToggle={() => toggleSection("keys")}
        actions={
          <>
            <button
              onClick={() => {
                if (!categoryId) return;
                suggestWithAi.mutate({ categoryId, limit: 80 });
              }}
              disabled={suggestWithAi.isPending || !categoryId}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-4 text-xs font-bold text-[#0a0a0a] disabled:opacity-50"
            >
              <Bot
                size={14}
                className={suggestWithAi.isPending ? "animate-pulse" : ""}
              />
              Предложить ИИ
            </button>
            <button
              onClick={() => {
                if (!categoryId) return;
                const rules = Object.entries(keyEdits)
                  .map(([sourceNormalizedKey, edit]) => {
                    const row = rows.find(
                      item => item.sourceNormalizedKey === sourceNormalizedKey
                    );
                    return row
                      ? {
                          sourceKey: row.sourceKey,
                          sourceNormalizedKey,
                          targetKey: edit.targetKey,
                          isVisible: edit.isVisible,
                          isFilterable: edit.isFilterable,
                          sortOrder: edit.sortOrder,
                        }
                      : null;
                  })
                  .filter(Boolean) as Array<{
                  sourceKey: string;
                  sourceNormalizedKey: string;
                  targetKey: string;
                  isVisible: boolean;
                  isFilterable: boolean;
                  sortOrder: number;
                }>;

                if (rules.length === 0) return;
                saveBulkRules.mutate({ categoryId, rules });
              }}
              disabled={
                saveBulkRules.isPending ||
                !categoryId ||
                Object.keys(keyEdits).length === 0
              }
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#05C3D4] px-4 text-xs font-black text-black disabled:opacity-50"
            >
              <Save size={14} />
              Сохранить все
            </button>
            <button
              onClick={() => {
                if (!categoryId) return;
                applyRules.mutate({ categoryId, limit: 10000 });
              }}
              disabled={applyRules.isPending || !categoryId}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#15171A] px-4 text-xs font-black text-white disabled:opacity-50"
            >
              <Wand2 size={14} />
              Применить
            </button>
          </>
        }
      >
        {keyErrors && (
          <ErrorBox message={keyErrors.message} />
        )}

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
                  <th className="px-4 py-3">Значения</th>
                  <th className="px-4 py-3">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {topRows.map(row => {
                  const edit = getKeyEdit(row);
                  const isSelected = row.sourceNormalizedKey === selectedValueKey;

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
                            patchKeyEdit(row, { targetKey: event.target.value })
                          }
                          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        />
                        {edit.reason && (
                          <div className="mt-1 text-[11px] leading-4 text-gray-400">
                            ИИ: {edit.reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#15171A]">
                        {row.productCount}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.valueCount}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            patchKeyEdit(row, { isVisible: !edit.isVisible })
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
                            patchKeyEdit(row, { isFilterable: !edit.isFilterable })
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
                            patchKeyEdit(row, {
                              sortOrder: Number(event.target.value || 0),
                            })
                          }
                          className="h-10 w-20 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setSelectedValueKey(row.sourceNormalizedKey);
                            setOpenSections(prev => ({ ...prev, values: true }));
                          }}
                          className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-black uppercase ${
                            isSelected
                              ? "bg-[#15171A] text-white"
                              : "border border-gray-200 text-[#15171A]"
                          }`}
                        >
                          Значения
                        </button>
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
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                      Для категории пока нет проиндексированных характеристик
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        title="Стандартизация значений свойств"
        description="Приводим к единому виду значения внутри выбранной характеристики."
        open={openSections.values}
        onToggle={() => toggleSection("values")}
        actions={
          <>
            <select
              value={selectedValueKey}
              onChange={event => {
                setSelectedValueKey(event.target.value);
                setValueEdits({});
              }}
              className="h-10 min-w-[240px] rounded-lg border border-gray-200 px-3 text-xs font-bold outline-none focus:border-[#05C3D4]"
            >
              {rows.map(row => (
                <option key={row.sourceNormalizedKey} value={row.sourceNormalizedKey}>
                  {row.sourceKey}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!categoryId || !selectedValueKey) return;
                const rules = Object.entries(valueEdits)
                  .map(([sourceNormalizedValue, edit]) => {
                    const row = valueRows.find(
                      item => item.sourceNormalizedValue === sourceNormalizedValue
                    );
                    return row
                      ? {
                          sourceValue: row.sourceValue,
                          sourceNormalizedValue,
                          targetValue: edit.targetValue,
                          sortOrder: edit.sortOrder,
                        }
                      : null;
                  })
                  .filter(Boolean) as Array<{
                  sourceValue: string;
                  sourceNormalizedValue: string;
                  targetValue: string;
                  sortOrder: number;
                }>;

                if (rules.length === 0) return;
                saveBulkValueRules.mutate({
                  categoryId,
                  specNormalizedKey: selectedValueKey,
                  rules,
                });
              }}
              disabled={
                saveBulkValueRules.isPending ||
                !categoryId ||
                !selectedValueKey ||
                Object.keys(valueEdits).length === 0
              }
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#05C3D4] px-4 text-xs font-black text-black disabled:opacity-50"
            >
              <Save size={14} />
              Сохранить все
            </button>
            <button
              onClick={() => {
                if (!categoryId || !selectedValueKey) return;
                applyValueRules.mutate({
                  categoryId,
                  sourceNormalizedKey: selectedValueKey,
                  limit: 10000,
                });
              }}
              disabled={applyValueRules.isPending || !categoryId || !selectedValueKey}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#15171A] px-4 text-xs font-black text-white disabled:opacity-50"
            >
              <Wand2 size={14} />
              Применить
            </button>
          </>
        }
      >
        {valueErrors && <ErrorBox message={valueErrors.message} />}

        <div className="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Активная характеристика:{" "}
          <span className="font-black text-[#15171A]">
            {selectedKeyRow?.sourceKey || "Не выбрана"}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-3">Исходное значение</th>
                  <th className="px-4 py-3">Стандарт</th>
                  <th className="px-4 py-3">Товаров</th>
                  <th className="px-4 py-3">Порядок</th>
                  <th className="px-4 py-3">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {topValueRows.map(row => {
                  const edit = getValueEdit(row);
                  return (
                    <tr key={row.sourceNormalizedValue}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#15171A]">{row.sourceValue}</div>
                        <div className="mt-1 text-xs text-gray-400">
                          {row.sourceNormalizedValue}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={edit.targetValue}
                          onChange={event =>
                            patchValueEdit(row, {
                              targetValue: event.target.value,
                            })
                          }
                          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-[#15171A]">
                        {row.productCount}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={edit.sortOrder}
                          onChange={event =>
                            patchValueEdit(row, {
                              sortOrder: Number(event.target.value || 0),
                            })
                          }
                          className="h-10 w-20 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            if (!categoryId || !selectedValueKey) return;
                            saveValueRule.mutate({
                              categoryId,
                              specNormalizedKey: selectedValueKey,
                              sourceValue: row.sourceValue,
                              sourceNormalizedValue: row.sourceNormalizedValue,
                              targetValue: edit.targetValue,
                              sortOrder: edit.sortOrder,
                            });
                          }}
                          disabled={saveValueRule.isPending}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#05C3D4] px-4 text-xs font-black uppercase text-black disabled:opacity-50"
                        >
                          <Save size={14} />
                          Сохранить
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {topValueRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                      Для выбранной характеристики пока нет значений
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AccordionSection>
    </section>
  );
}

function AccordionSection({
  title,
  description,
  open,
  onToggle,
  actions,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 bg-white px-5 py-4 text-left"
      >
        <div>
          <div className="text-sm font-black text-[#15171A]">{title}</div>
          <div className="mt-1 text-sm text-gray-500">{description}</div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-[#fcfcfc] p-5">
          {actions && (
            <div className="mb-4 flex flex-wrap items-center gap-3">{actions}</div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | number;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
        {label}
      </div>
      <div
        className={`mt-2 font-black text-[#15171A] ${
          compact ? "text-base" : "text-2xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
      {message}
    </div>
  );
}
