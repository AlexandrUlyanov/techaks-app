import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import ProductSpecStandardizationPanel from "@/components/admin/ProductSpecStandardizationPanel";
import { trpc } from "@/providers/trpc";

export default function AdminProductSpecs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryIdFromQuery = Number(searchParams.get("categoryId") ?? 0) || null;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "visible" | "hidden" | "filterable"
  >("all");
  const { data: categories = [] } = trpc.product.getCategories.useQuery({
    includeInactive: true,
  });
  const { data: overview = [], isLoading } =
    trpc.product.getSpecStandardizationOverview.useQuery();

  const groupedOverview = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("ru");
    const groups = new Map<
      number,
      {
        categoryId: number;
        categoryName: string;
        categorySlug: string;
        visibleCount: number;
        hiddenCount: number;
        filterableCount: number;
        items: typeof overview;
      }
    >();

    for (const item of overview) {
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

      if (!matchesSearch || !matchesStatus) {
        continue;
      }

      const current = groups.get(item.categoryId) ?? {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        categorySlug: item.categorySlug,
        visibleCount: 0,
        hiddenCount: 0,
        filterableCount: 0,
        items: [],
      };
      current.items.push(item);
      current.visibleCount += item.isVisible ? 1 : 0;
      current.hiddenCount += item.isVisible ? 0 : 1;
      current.filterableCount += item.isFilterable ? 1 : 0;
      groups.set(item.categoryId, current);
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName, "ru", { sensitivity: "base" })
    );
  }, [overview, searchTerm, statusFilter]);

  const quickJumpCategories = useMemo(
    () =>
      groupedOverview
        .slice()
        .sort((a, b) => b.items.length - a.items.length || b.visibleCount - a.visibleCount)
        .slice(0, 8),
    [groupedOverview]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Каталог"
        title="Все характеристики"
        description="Сверху — обзор того, какие характеристики вообще живут на сайте по категориям. Ниже — точечная настройка выбранной ветки каталога."
      />

      <AdminSection
        title="Обзор по категориям"
        description="Помогает быстро увидеть мусорные, внутренние и слишком технические характеристики, которые стоит скрыть с витрины."
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
                placeholder="Найти категорию или характеристику"
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
                    onClick={() =>
                      setStatusFilter(
                        option.value as "all" | "visible" | "hidden" | "filterable"
                      )
                    }
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

          {quickJumpCategories.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                Быстрый переход
              </div>
              <div className="flex flex-wrap gap-2">
                {quickJumpCategories.map(group => (
                  <button
                    key={group.categoryId}
                    type="button"
                    onClick={() => {
                      setSearchParams(prev => {
                        const next = new URLSearchParams(prev);
                        next.set("categoryId", String(group.categoryId));
                        return next;
                      });
                    }}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-[#f8fbfc] px-4 py-2 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4] hover:text-[#05C3D4]"
                  >
                    {group.categoryName}
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-500">
                      {group.items.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="py-10 text-sm text-gray-500">Собираю характеристики...</div>
        ) : groupedOverview.length === 0 ? (
          <div className="py-10 text-sm text-gray-500">
            Пока нет проиндексированных характеристик.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedOverview.map(group => (
              <div
                key={group.categoryId}
                className="rounded-3xl border border-gray-200 bg-white p-5"
              >
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-black text-[#15171A]">
                        {group.categoryName}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchParams(prev => {
                            const next = new URLSearchParams(prev);
                            next.set("categoryId", String(group.categoryId));
                            return next;
                          });
                        }}
                        className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 transition-colors hover:border-[#05C3D4] hover:text-[#05C3D4]"
                      >
                        Настроить ветку
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      slug: {group.categorySlug || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                      Видимых: {group.visibleCount}
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                      Скрытых: {group.hiddenCount}
                    </span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">
                      В фильтрах: {group.filterableCount}
                    </span>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[880px] text-left">
                    <thead>
                      <tr className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">
                        <th className="py-2 pr-4">Исходный ключ</th>
                        <th className="py-2 pr-4">Стандарт</th>
                        <th className="py-2 pr-4">Товаров</th>
                        <th className="py-2 pr-4">Значений</th>
                        <th className="py-2 pr-4">Показ</th>
                        <th className="py-2 pr-4">Фильтр</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.items
                        .slice()
                        .sort((a, b) => b.productCount - a.productCount || a.sourceKey.localeCompare(b.sourceKey, "ru"))
                        .map(item => (
                          <tr key={`${item.categoryId}-${item.sourceNormalizedKey}`}>
                            <td className="py-3 pr-4 text-sm font-semibold text-[#15171A]">
                              {item.sourceKey}
                            </td>
                            <td className="py-3 pr-4 text-sm text-gray-600">
                              {item.targetKey}
                            </td>
                            <td className="py-3 pr-4 text-sm text-gray-600">
                              {item.productCount}
                            </td>
                            <td className="py-3 pr-4 text-sm text-gray-600">
                              {item.valueCount}
                            </td>
                            <td className="py-3 pr-4">
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
                            <td className="py-3 pr-4">
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
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
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
