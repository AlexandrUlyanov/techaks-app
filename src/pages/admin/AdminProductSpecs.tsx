import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import ProductSpecStandardizationPanel from "@/components/admin/ProductSpecStandardizationPanel";
import { trpc } from "@/providers/trpc";

type StatusFilter = "all" | "visible" | "hidden" | "filterable";
type BulkAction = "hide" | "exclude_from_filters" | "delete";

export default function AdminProductSpecs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryIdFromQuery = Number(searchParams.get("categoryId") ?? 0) || null;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const { data: categories = [] } = trpc.product.getCategories.useQuery({
    includeInactive: true,
  });
  const { data: overview = [], isLoading, refetch } =
    trpc.product.getSpecStandardizationOverview.useQuery();

  const bulkManage = trpc.product.bulkManageSpecOverview.useMutation({
    onSuccess: result => {
      refetch();
      setSelectedIds({});
      const actionLabel =
        result.action === "hide"
          ? "скрыто"
          : result.action === "exclude_from_filters"
            ? "убрано из фильтров"
            : "удалено";
      alert(
        `Готово: ${actionLabel}. Свойств: ${result.affectedRules}, товаров: ${result.affectedProducts}, значений: ${result.affectedValues}.`
      );
    },
  });

  const filteredOverview = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("ru");
    return overview
      .filter(item => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          item.categoryName.toLocaleLowerCase("ru").includes(normalizedSearch) ||
          item.categorySlug.toLocaleLowerCase("ru").includes(normalizedSearch) ||
          item.sourceKey.toLocaleLowerCase("ru").includes(normalizedSearch) ||
          item.targetKey.toLocaleLowerCase("ru").includes(normalizedSearch);

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "visible" && item.isVisible) ||
          (statusFilter === "hidden" && !item.isVisible) ||
          (statusFilter === "filterable" && item.isFilterable);

        return matchesSearch && matchesStatus;
      })
      .sort(
        (a, b) =>
          b.productCount - a.productCount ||
          a.categoryName.localeCompare(b.categoryName, "ru", {
            sensitivity: "base",
          }) ||
          a.sourceKey.localeCompare(b.sourceKey, "ru", { sensitivity: "base" })
      );
  }, [overview, searchTerm, statusFilter]);

  const makeRowId = (item: (typeof overview)[number]) =>
    `${item.categoryId}:${item.sourceNormalizedKey}`;

  const selectedRows = useMemo(
    () => filteredOverview.filter(item => selectedIds[makeRowId(item)]),
    [filteredOverview, selectedIds]
  );

  const allVisibleSelected =
    filteredOverview.length > 0 &&
    filteredOverview.every(item => selectedIds[makeRowId(item)]);

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  const runBulkAction = (action: BulkAction) => {
    if (selectedRows.length === 0) return;
    bulkManage.mutate({
      action,
      items: selectedRows.map(item => ({
        categoryId: item.categoryId,
        sourceKey: item.sourceKey,
        sourceNormalizedKey: item.sourceNormalizedKey,
      })),
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Каталог"
        title="Все характеристики"
        description="Единый реестр свойств по всему сайту. Можно сразу отметить нужные строки и массово скрыть их, убрать из фильтров или удалить из товаров."
      />

      <AdminSection
        title="Единый реестр свойств"
        description="Здесь показываются все свойства сразу, без разбиения по карточкам категорий. Категория остается отдельной колонкой, чтобы было понятно, откуда именно пришло свойство."
      >
        <div className="mb-4 space-y-4 rounded-3xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-xl">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Найти свойство или категорию"
                className="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-[#15171A] outline-none transition-colors focus:border-[#05C3D4]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "Все" },
                { value: "visible", label: "Только видимые" },
                { value: "hidden", label: "Только скрытые" },
                { value: "filterable", label: "Только в фильтрах" },
              ].map(option => {
                const isActive = statusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value as StatusFilter)}
                    className={`inline-flex h-11 items-center rounded-2xl px-4 text-sm font-bold transition-colors ${
                      isActive
                        ? "bg-[#05C3D4] text-white"
                        : "border border-gray-200 bg-white text-gray-600 hover:border-[#05C3D4] hover:text-[#05C3D4]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-dashed border-gray-200 bg-[#f8fbfc] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                Массовые действия
              </div>
              <div className="mt-2 text-sm font-semibold text-[#15171A]">
                Выбрано свойств: {selectedCount}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runBulkAction("hide")}
                disabled={selectedRows.length === 0 || bulkManage.isPending}
                className="inline-flex h-11 items-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Скрыть на сайте
              </button>
              <button
                type="button"
                onClick={() => runBulkAction("exclude_from_filters")}
                disabled={selectedRows.length === 0 || bulkManage.isPending}
                className="inline-flex h-11 items-center rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm font-bold text-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Убрать из фильтров
              </button>
              <button
                type="button"
                onClick={() => runBulkAction("delete")}
                disabled={selectedRows.length === 0 || bulkManage.isPending}
                className="inline-flex h-11 items-center rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Удалить из товаров
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds({})}
                disabled={selectedCount === 0}
                className="inline-flex h-11 items-center rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Снять выделение
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-sm text-gray-500">Собираю свойства...</div>
        ) : filteredOverview.length === 0 ? (
          <div className="py-10 text-sm text-gray-500">
            Под текущие условия свойства не найдены.
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#fbfcfd] text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={event => {
                          const next: Record<string, boolean> = { ...selectedIds };
                          if (event.target.checked) {
                            for (const item of filteredOverview) {
                              next[makeRowId(item)] = true;
                            }
                          } else {
                            for (const item of filteredOverview) {
                              delete next[makeRowId(item)];
                            }
                          }
                          setSelectedIds(next);
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3">Категория</th>
                    <th className="px-4 py-3">Исходный ключ</th>
                    <th className="px-4 py-3">Стандарт</th>
                    <th className="px-4 py-3">Товаров</th>
                    <th className="px-4 py-3">Значений</th>
                    <th className="px-4 py-3">Показ</th>
                    <th className="px-4 py-3">Фильтр</th>
                    <th className="px-4 py-3">Тонкая настройка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOverview.map(item => {
                    const rowId = makeRowId(item);
                    const checked = Boolean(selectedIds[rowId]);
                    return (
                      <tr key={rowId} className="align-top">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event =>
                              setSelectedIds(prev => ({
                                ...prev,
                                [rowId]: event.target.checked,
                              }))
                            }
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#15171A]">
                          <div>{item.categoryName}</div>
                          <div className="mt-1 text-xs font-medium text-gray-400">
                            {item.categorySlug || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#15171A]">
                          {item.sourceKey}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.targetKey}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.productCount}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.valueCount}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              item.isVisible
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.isVisible ? "Показывать" : "Скрыто"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              item.isFilterable
                                ? "bg-sky-50 text-sky-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.isFilterable ? "В фильтрах" : "Скрыт"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchParams(prev => {
                                const next = new URLSearchParams(prev);
                                next.set("categoryId", String(item.categoryId));
                                return next;
                              });
                            }}
                            className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 transition-colors hover:border-[#05C3D4] hover:text-[#05C3D4]"
                          >
                            Открыть ветку
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AdminSection>

      <ProductSpecStandardizationPanel
        categories={categories as Array<{ id: number; name: string; parentId: number | null }>}
        initialCategoryId={categoryIdFromQuery}
      />
    </div>
  );
}
