import { useMemo, useState } from "react";
import {
  Bot,
  CheckCheck,
  EyeOff,
  Layers3,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Warehouse,
  XCircle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import {
  AUTO_MERCH_BADGE_OPTIONS,
  getMerchandisingBadgeLabel,
  getMerchandisingBadgeStyle,
  MANUAL_MERCH_BADGE_OPTIONS,
  MERCH_BADGE_LABELS,
  normalizeMerchandisingBadges,
} from "@/lib/merchandising-badges";
import { toast } from "sonner";
import AdminMerchandisingNav from "@/pages/admin/merchandising/AdminMerchandisingNav";

type EditState = {
  manualPriority: number;
  badges: string[];
  isFeatured: boolean;
  isHiddenFromPromo: boolean;
  comment: string;
};

const STATUS_LABELS: Record<string, string> = {
  ready_for_promo: "Готов к промо",
  needs_content: "Нужен контент",
  needs_price_review: "Проверить цену",
  low_margin: "Низкая маржа",
  out_of_stock: "Нет остатка",
  manual_review: "Ручная проверка",
  excluded_from_promo: "Исключен",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
}

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (score >= 55) return "bg-cyan-50 text-cyan-700 border-cyan-100";
  if (score >= 35) return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-rose-50 text-rose-700 border-rose-100";
}

export default function AdminMerchandising() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [badge, setBadge] = useState("");
  const [status, setStatus] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [edits, setEdits] = useState<Record<number, EditState>>({});
  const [bulkBadge, setBulkBadge] = useState<string>("store_choice");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("");
  const [catalogCategoryId, setCatalogCategoryId] = useState("");
  const [aiCategoryId, setAiCategoryId] = useState("");
  const [assignmentCategoryId, setAssignmentCategoryId] = useState("");
  const [suggestionEdits, setSuggestionEdits] = useState<
    Record<number, { label: string; description: string; notes: string }>
  >({});
  const [newBadge, setNewBadge] = useState({
    label: "",
    code: "",
    description: "",
    scopeCategoryId: "",
  });

  const categoriesQuery = trpc.product.getCategories.useQuery();
  const badgeSettings = trpc.merchandising.badgeSettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const dashboard = trpc.merchandising.dashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const products = trpc.merchandising.products.useQuery(
    {
      page,
      limit: 40,
      categoryId: categoryId ? Number(categoryId) : undefined,
      badge: badge || undefined,
      status: status || undefined,
      stockStatus: stockStatus
        ? (stockStatus as "in_stock" | "out_of_stock")
        : undefined,
      scoreMin: scoreMin ? Number(scoreMin) : undefined,
      search: search.trim() || undefined,
    }
  );
  const catalogQuery = trpc.merchandising.catalog.useQuery(
    {
      search: catalogSearch.trim() || undefined,
      status: catalogStatus || undefined,
      categoryId: catalogCategoryId ? Number(catalogCategoryId) : undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );
  const suggestionsQuery = trpc.merchandising.categorySuggestions.useQuery(
    { categoryId: aiCategoryId ? Number(aiCategoryId) : 0 },
    {
      enabled: Boolean(aiCategoryId),
      refetchOnWindowFocus: false,
    }
  );
  const assignmentPreviewQuery = trpc.merchandising.assignmentPreview.useQuery(
    { categoryId: assignmentCategoryId ? Number(assignmentCategoryId) : 0 },
    {
      enabled: Boolean(assignmentCategoryId),
      refetchOnWindowFocus: false,
    }
  );
  const qualityQuery = trpc.merchandising.qualityDashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const recalculate = trpc.merchandising.recalculate.useMutation({
    onSuccess: () => {
      utils.merchandising.dashboard.invalidate();
      utils.merchandising.products.invalidate();
    },
  });

  const updateProduct = trpc.merchandising.updateProduct.useMutation({
    onSuccess: () => {
      utils.merchandising.dashboard.invalidate();
      utils.merchandising.products.invalidate();
    },
  });
  const updateBadgeSettings = trpc.merchandising.updateBadgeSettings.useMutation({
    onSuccess: data => {
      toast.success("Глобальные настройки бейджей сохранены");
      utils.merchandising.badgeSettings.setData(undefined, {
        disabledBadges: data.disabledBadges,
      });
      utils.merchandising.dashboard.invalidate();
      utils.merchandising.products.invalidate();
      utils.product.invalidate();
    },
  });
  const bulkBadgeAction = trpc.merchandising.bulkBadgeAction.useMutation({
    onSuccess: data => {
      toast.success("Массовое действие выполнено");
      if ("disabledBadges" in data && data.disabledBadges) {
        utils.merchandising.badgeSettings.setData(undefined, {
          disabledBadges: data.disabledBadges,
        });
      }
      utils.merchandising.dashboard.invalidate();
      utils.merchandising.products.invalidate();
      utils.product.invalidate();
    },
  });
  const upsertCatalogBadge = trpc.merchandising.upsertCatalogBadge.useMutation({
    onSuccess: () => {
      toast.success("Бейдж сохранен в каталоге");
      setNewBadge({ label: "", code: "", description: "", scopeCategoryId: "" });
      utils.merchandising.catalog.invalidate();
      utils.merchandising.qualityDashboard.invalidate();
    },
  });
  const generateCategorySuggestions = trpc.merchandising.generateCategorySuggestions.useMutation({
    onSuccess: data => {
      toast.success(`AI подготовил ${data.total} предложений`);
      utils.merchandising.categorySuggestions.invalidate();
      utils.merchandising.catalog.invalidate();
      utils.merchandising.qualityDashboard.invalidate();
    },
  });
  const reviewSuggestion = trpc.merchandising.reviewSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Решение по предложению сохранено");
      utils.merchandising.categorySuggestions.invalidate();
      utils.merchandising.catalog.invalidate();
      utils.merchandising.assignmentPreview.invalidate();
      utils.merchandising.qualityDashboard.invalidate();
      utils.product.invalidate();
    },
  });
  const applyAssignments = trpc.merchandising.applyAssignments.useMutation({
    onSuccess: data => {
      toast.success(`Применено назначений: ${data.applied}`);
      utils.merchandising.assignmentPreview.invalidate();
      utils.merchandising.catalog.invalidate();
      utils.merchandising.qualityDashboard.invalidate();
      utils.product.invalidate();
    },
  });

  const summaryCards = useMemo(
    () => [
      ["Всего товаров", dashboard.data?.totalProducts ?? 0],
      ["В наличии", dashboard.data?.inStockProducts ?? 0],
      ["Готовы к промо", dashboard.data?.readyForPromo ?? 0],
      ["Высокий score", dashboard.data?.highScoreProducts ?? 0],
      ["Без фото", dashboard.data?.missingImages ?? 0],
      ["Без описания", dashboard.data?.missingDescriptions ?? 0],
      ["Низкая маржа", dashboard.data?.lowMarginProducts ?? 0],
      ["Без категории", dashboard.data?.missingCategoryProducts ?? 0],
    ],
    [dashboard.data]
  );

  const patchEdit = (productId: number, patch: Partial<EditState>, fallback: EditState) => {
    setEdits(prev => ({
      ...prev,
      [productId]: {
        ...fallback,
        ...(prev[productId] ?? {}),
        ...patch,
      },
    }));
  };

  const getEdit = (item: {
    id: number;
    badges: unknown;
    manualPriority: number | null;
    isFeatured: boolean | null;
    isHiddenFromPromo: boolean | null;
    comment: string | null;
  }): EditState => {
    const fallback = {
      manualPriority: item.manualPriority ?? 0,
      badges: normalizeMerchandisingBadges(item.badges),
      isFeatured: Boolean(item.isFeatured),
      isHiddenFromPromo: Boolean(item.isHiddenFromPromo),
      comment: item.comment ?? "",
    };
    return { ...fallback, ...(edits[item.id] ?? {}) };
  };

  const toggleBadge = (productId: number, badgeCode: string, edit: EditState, fallback: EditState) => {
    const nextBadges = edit.badges.includes(badgeCode)
      ? edit.badges.filter(itemBadge => itemBadge !== badgeCode)
      : [...edit.badges, badgeCode];
    patchEdit(productId, { badges: nextBadges }, fallback);
  };

  const disabledBadges = new Set(badgeSettings.data?.disabledBadges ?? dashboard.data?.disabledBadges ?? []);
  const categoryOptions = categoriesQuery.data ?? [];
  const currentFilters = {
    categoryId: categoryId ? Number(categoryId) : undefined,
    status: status || undefined,
    stockStatus: stockStatus ? (stockStatus as "in_stock" | "out_of_stock") : undefined,
    scoreMin: scoreMin ? Number(scoreMin) : undefined,
    search: search.trim() || undefined,
  };
  const selectedAiCategoryName =
    categoryOptions.find(category => category.id === Number(aiCategoryId))?.name ?? "категории";
  const selectedAssignmentCategoryName =
    categoryOptions.find(category => category.id === Number(assignmentCategoryId))?.name ?? "категории";

  const getSuggestionEdit = (item: {
    id: number;
    label: string;
    description?: string | null;
    notes?: string | null;
  }) => ({
    label: suggestionEdits[item.id]?.label ?? item.label,
    description: suggestionEdits[item.id]?.description ?? item.description ?? "",
    notes: suggestionEdits[item.id]?.notes ?? item.notes ?? "",
  });

  const patchSuggestionEdit = (
    badgeId: number,
    patch: Partial<{ label: string; description: string; notes: string }>,
    item: { label: string; description?: string | null; notes?: string | null }
  ) => {
    setSuggestionEdits(prev => ({
      ...prev,
      [badgeId]: {
        label: prev[badgeId]?.label ?? item.label,
        description: prev[badgeId]?.description ?? item.description ?? "",
        notes: prev[badgeId]?.notes ?? item.notes ?? "",
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight text-[#15171A]">
            Мерчендайзинг
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500">
            MVP-панель считает честный Merchandising Score без продажной статистики:
            цена, остатки, качество карточки, новизна и ручной приоритет. Маржа пока
            считается нейтрально, потому что в текущих товарах нет закупочной цены.
          </p>
        </div>
        <button
          onClick={() => recalculate.mutate({ scope: "all" })}
          disabled={recalculate.isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#05C3D4] px-5 text-sm font-black text-black transition hover:bg-[#04a9b8] disabled:opacity-50"
        >
          <RefreshCw size={17} className={recalculate.isPending ? "animate-spin" : ""} />
          Пересчитать все
        </button>
      </div>

      <AdminMerchandisingNav />

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          [
            "Каталог бейджей",
            "Отдельный экран со словарём формулировок, статусами и scope по категориям.",
            "/admin/merchandising/badges",
          ],
          [
            "AI-генерация",
            "Категорийный запуск агента, review предложений и утверждение смысла.",
            "/admin/merchandising/ai",
          ],
          [
            "Назначения",
            "Preview совпадений по товарам и controlled bulk apply после проверки.",
            "/admin/merchandising/assignments",
          ],
          [
            "Качество",
            "Покрытие категорий, recent runs и общая health-картина badge-системы.",
            "/admin/merchandising/quality",
          ],
        ].map(([title, text, href]) => (
          <a
            key={String(href)}
            href={String(href)}
            className="rounded-lg border border-gray-100 bg-white p-4 transition hover:border-[#05C3D4]/40 hover:shadow-sm"
          >
            <div className="text-sm font-black text-[#15171A]">{title}</div>
            <div className="mt-2 text-sm leading-6 text-gray-500">{text}</div>
          </a>
        ))}
      </div>

      {(dashboard.error || products.error) && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {dashboard.error?.message || products.error?.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-100 bg-white p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {label}
            </div>
            <div className="mt-2 text-2xl font-black text-[#15171A]">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#15171A]">
              Массовое управление бейджами
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Здесь можно массово добавлять или убирать ручные merchandising-бейджи по текущему фильтру, а также
              глобально скрывать конкретный бейдж на витрине. Глобальное скрытие безопаснее для авто-бейджей:
              даже если робот пересчитает их снова, на сайте они не появятся.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[220px_repeat(4,minmax(0,1fr))]">
            <select
              value={bulkBadge}
              onChange={event => setBulkBadge(event.target.value)}
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            >
              {Object.entries(MERCH_BADGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => bulkBadgeAction.mutate({ badge: bulkBadge, action: "add_filtered", ...currentFilters })}
              disabled={bulkBadgeAction.isPending}
              className="h-11 rounded-lg border border-gray-200 px-4 text-sm font-black text-[#15171A] transition hover:border-[#05C3D4] disabled:opacity-50"
            >
              Добавить по фильтру
            </button>
            <button
              type="button"
              onClick={() => bulkBadgeAction.mutate({ badge: bulkBadge, action: "remove_filtered", ...currentFilters })}
              disabled={bulkBadgeAction.isPending}
              className="h-11 rounded-lg border border-gray-200 px-4 text-sm font-black text-[#15171A] transition hover:border-rose-300 disabled:opacity-50"
            >
              Убрать по фильтру
            </button>
            <button
              type="button"
              onClick={() => bulkBadgeAction.mutate({ badge: bulkBadge, action: "remove_all" })}
              disabled={bulkBadgeAction.isPending}
              className="h-11 rounded-lg border border-rose-200 px-4 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              Убрать у всех товаров
            </button>
            <button
              type="button"
              onClick={() =>
                bulkBadgeAction.mutate({
                  badge: bulkBadge,
                  action: disabledBadges.has(bulkBadge) ? "enable_globally" : "disable_globally",
                })
              }
              disabled={bulkBadgeAction.isPending || updateBadgeSettings.isPending}
              className={`h-11 rounded-lg px-4 text-sm font-black transition disabled:opacity-50 ${
                disabledBadges.has(bulkBadge)
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              {disabledBadges.has(bulkBadge) ? "Вернуть на витрину" : "Скрыть на всём сайте"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.keys(MERCH_BADGE_LABELS).map(itemBadge => (
            <button
              key={itemBadge}
              type="button"
              onClick={() => {
                const next = new Set(disabledBadges);
                if (next.has(itemBadge)) next.delete(itemBadge);
                else next.add(itemBadge);
                updateBadgeSettings.mutate({ disabledBadges: Array.from(next) });
              }}
              disabled={updateBadgeSettings.isPending}
              className={`${disabledBadges.has(itemBadge) ? "bg-gray-200 text-gray-500 line-through" : getMerchandisingBadgeStyle(itemBadge)} rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition disabled:opacity-50`}
            >
              {getMerchandisingBadgeLabel(itemBadge)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_120px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={search}
              onChange={event => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Поиск по названию"
              className="h-11 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-[#05C3D4]"
            />
          </label>
          <select
            value={categoryId}
            onChange={event => {
              setPage(1);
              setCategoryId(event.target.value);
            }}
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            <option value="">Все категории</option>
            {(categoriesQuery.data ?? []).map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={badge}
            onChange={event => {
              setPage(1);
              setBadge(event.target.value);
            }}
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            <option value="">Любой бейдж</option>
            {Object.entries(MERCH_BADGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={event => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            <option value="">Любой статус</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={stockStatus}
            onChange={event => {
              setPage(1);
              setStockStatus(event.target.value);
            }}
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            <option value="">Любой остаток</option>
            <option value="in_stock">В наличии</option>
            <option value="out_of_stock">Нет остатка</option>
          </select>
          <input
            value={scoreMin}
            onChange={event => {
              setPage(1);
              setScoreMin(event.target.value);
            }}
            inputMode="numeric"
            placeholder="Score от"
            className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[#15171A]">
              Товары
            </h2>
            <div className="mt-1 text-xs text-gray-400">
              {products.data?.total ?? 0} товаров, страница {products.data?.page ?? page} из{" "}
              {products.data?.totalPages ?? 1}
            </div>
          </div>
          <TrendingUp className="text-[#05C3D4]" size={22} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="py-3 pl-4 pr-3">Товар</th>
                <th className="py-3 pr-3">Категория</th>
                <th className="py-3 pr-3">Цена</th>
                <th className="py-3 pr-3">Остаток</th>
                <th className="py-3 pr-3">Score</th>
                <th className="py-3 pr-3">Расшифровка</th>
                <th className="py-3 pr-3">Бейджи</th>
                <th className="py-3 pr-3">Ручное</th>
                <th className="py-3 pr-4">Действие</th>
              </tr>
            </thead>
            <tbody>
              {(products.data?.items ?? []).map(item => {
                const edit = getEdit(item);
                const fallback = getEdit({ ...item, ...edits[item.id] });
                const selectedBadges = new Set(edit.badges);

                return (
                  <tr key={item.id} className="border-t border-gray-100 align-top hover:bg-gray-50">
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex min-w-[340px] items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                          <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <div className="line-clamp-2 font-black text-[#15171A]">{item.name}</div>
                          <div className="mt-1 font-mono text-xs text-gray-400">{item.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-gray-600">{item.categoryName || "Без категории"}</td>
                    <td className="py-3 pr-3 font-black text-[#05C3D4]">{formatPrice(item.price)}</td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                        <Warehouse size={13} />
                        {Number(item.totalStock || 0)}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex min-w-14 justify-center rounded-md border px-2.5 py-1 text-xs font-black ${scoreColor(item.totalScore ?? 0)}`}>
                        {item.totalScore ?? 0}
                      </span>
                      <div className="mt-2 text-xs font-bold text-gray-500">
                        {STATUS_LABELS[item.status ?? "manual_review"] ?? item.status}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs text-gray-500">
                      <div>Цена: {item.priceScore ?? 0}</div>
                      <div>Остаток: {item.stockScore ?? 0}</div>
                      <div>Карточка: {item.contentScore ?? 0}</div>
                      <div>Новизна: {item.newnessScore ?? 0}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1.5">
                        {MANUAL_MERCH_BADGE_OPTIONS.map(itemBadge => {
                          const active = selectedBadges.has(itemBadge);
                          return (
                            <button
                              key={itemBadge}
                              type="button"
                              onClick={() => toggleBadge(item.id, itemBadge, edit, fallback)}
                              className={`${active ? getMerchandisingBadgeStyle(itemBadge) : "bg-gray-100 text-gray-500"} rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide transition hover:opacity-80`}
                            >
                              {getMerchandisingBadgeLabel(itemBadge)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex max-w-[220px] flex-wrap gap-1.5">
                        {AUTO_MERCH_BADGE_OPTIONS.map(itemBadge => (
                          <span
                            key={itemBadge}
                            className={`${selectedBadges.has(itemBadge) ? getMerchandisingBadgeStyle(itemBadge) : "bg-gray-100 text-gray-400"} rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide`}
                          >
                            {getMerchandisingBadgeLabel(itemBadge)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex w-[230px] flex-col gap-2">
                        <input
                          type="number"
                          min={-100}
                          max={100}
                          value={edit.manualPriority}
                          onChange={event => patchEdit(item.id, { manualPriority: Number(event.target.value) }, fallback)}
                          className="h-9 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-[#05C3D4]"
                        />
                        <input
                          value={edit.comment}
                          onChange={event => patchEdit(item.id, { comment: event.target.value }, fallback)}
                          placeholder="Комментарий"
                          className="h-9 rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-[#05C3D4]"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => patchEdit(item.id, { isHiddenFromPromo: !edit.isHiddenFromPromo }, fallback)}
                            className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[10px] font-black uppercase ${
                              edit.isHiddenFromPromo ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            <EyeOff size={13} />
                            Скрыть
                          </button>
                        </div>
                        <div className="text-[10px] font-bold text-gray-400">
                          Клик по ручным бейджам слева переключает их и они появятся на витрине после сохранения.
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => updateProduct.mutate({ productId: item.id, ...edit })}
                        disabled={updateProduct.isPending}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-[#15171A] px-3 text-xs font-black text-white transition hover:bg-black disabled:opacity-50"
                      >
                        <Save size={14} />
                        Сохранить
                      </button>
                      {edit.isFeatured && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">
                          <ShieldCheck size={12} />
                          Featured
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {products.data?.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Товары не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 p-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}
            className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-bold disabled:opacity-40"
          >
            Назад
          </button>
          <div className="text-xs font-bold text-gray-400">Страница {page}</div>
          <button
            disabled={page >= (products.data?.totalPages ?? 1)}
            onClick={() => setPage(value => value + 1)}
            className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-bold disabled:opacity-40"
          >
            Вперед
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-gray-100 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#15171A]">
                Каталог полезных бейджей
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                Здесь живёт управляемый словарь бейджей для категорий. ИИ может предлагать новые варианты, но
                именно этот каталог задаёт, какие формулировки считаются рабочими и видимыми на сайте.
              </p>
            </div>
            <Layers3 className="text-[#05C3D4]" size={22} />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_180px_180px]">
            <input
              value={catalogSearch}
              onChange={event => setCatalogSearch(event.target.value)}
              placeholder="Поиск по label / code"
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            />
            <select
              value={catalogStatus}
              onChange={event => setCatalogStatus(event.target.value)}
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            >
              <option value="">Любой статус</option>
              <option value="draft">Черновик</option>
              <option value="active">Активен</option>
              <option value="disabled">Отключен</option>
              <option value="archived">Архив</option>
            </select>
            <select
              value={catalogCategoryId}
              onChange={event => setCatalogCategoryId(event.target.value)}
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            >
              <option value="">Все категории</option>
              {categoryOptions.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 lg:grid-cols-[1.1fr_1fr_1fr_200px_auto]">
            <input
              value={newBadge.label}
              onChange={event => setNewBadge(prev => ({ ...prev, label: event.target.value }))}
              placeholder="Название бейджа"
              className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#05C3D4]"
            />
            <input
              value={newBadge.code}
              onChange={event => setNewBadge(prev => ({ ...prev, code: event.target.value }))}
              placeholder="code (необязательно)"
              className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#05C3D4]"
            />
            <input
              value={newBadge.description}
              onChange={event => setNewBadge(prev => ({ ...prev, description: event.target.value }))}
              placeholder="Короткое описание"
              className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#05C3D4]"
            />
            <select
              value={newBadge.scopeCategoryId}
              onChange={event => setNewBadge(prev => ({ ...prev, scopeCategoryId: event.target.value }))}
              className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#05C3D4]"
            >
              <option value="">Глобальный бейдж</option>
              {categoryOptions.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={upsertCatalogBadge.isPending || !newBadge.label.trim()}
              onClick={() =>
                upsertCatalogBadge.mutate({
                  label: newBadge.label,
                  code: newBadge.code || undefined,
                  description: newBadge.description || undefined,
                  badgeType: "manual",
                  audience: "customer",
                  status: "active",
                  source: "manual",
                  isVisibleOnSite: true,
                  scopeType: newBadge.scopeCategoryId ? "category" : "global",
                  scopeId: newBadge.scopeCategoryId ? Number(newBadge.scopeCategoryId) : null,
                })
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#15171A] px-4 text-sm font-black text-white transition hover:bg-black disabled:opacity-50"
            >
              <Plus size={16} />
              Добавить
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {(catalogQuery.data ?? []).map(item => (
              <div key={item.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-[#15171A]">{item.label}</span>
                      <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-[10px] font-bold uppercase text-gray-500">
                        {item.code}
                      </span>
                      <span className="rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">
                        {item.status}
                      </span>
                      <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-500">
                        {item.source}
                      </span>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-gray-500">
                      {item.description || "Без описания"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-gray-400">
                      <span>Scope: {item.scopeCount}</span>
                      <span>Назначений: {item.assignmentCount}</span>
                      <span>На витрине: {item.isVisibleOnSite ? "да" : "нет"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        reviewSuggestion.mutate({
                          badgeId: item.id,
                          action: item.status === "active" ? "archive" : "approve",
                          label: item.label,
                          description: item.description ?? undefined,
                          notes: item.notes ?? undefined,
                        })
                      }
                      disabled={reviewSuggestion.isPending}
                      className="h-9 rounded-md border border-gray-200 px-3 text-xs font-black text-[#15171A] transition hover:border-[#05C3D4] disabled:opacity-50"
                    >
                      {item.status === "active" ? "В архив" : "Активировать"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {catalogQuery.data?.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
                В каталоге пока нет бейджей под текущий фильтр
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#15171A]">
                AI-предложения по категории
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Агент предлагает точные, полезные бейджи внутри категории. Здесь мы их просматриваем, правим и
                утверждаем перед массовым назначением на товары.
              </p>
            </div>
            <Bot className="text-[#05C3D4]" size={22} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={aiCategoryId}
              onChange={event => setAiCategoryId(event.target.value)}
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            >
              <option value="">Выбери категорию для AI-прохода</option>
              {categoryOptions.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={generateCategorySuggestions.isPending || !aiCategoryId}
              onClick={() => generateCategorySuggestions.mutate({ categoryId: Number(aiCategoryId) })}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#05C3D4] px-4 text-sm font-black text-black transition hover:bg-[#04a9b8] disabled:opacity-50"
            >
              <Sparkles size={16} />
              Сгенерировать AI-бейджи
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {(suggestionsQuery.data ?? []).map(item => {
              const edit = getSuggestionEdit(item);
              return (
                <div key={item.id} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-[#15171A]">{item.code}</span>
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-500">
                      {item.status}
                    </span>
                    <span className="rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">
                      {selectedAiCategoryName}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <input
                      value={edit.label}
                      onChange={event => patchSuggestionEdit(item.id, { label: event.target.value }, item)}
                      className="h-10 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                    <input
                      value={edit.description}
                      onChange={event => patchSuggestionEdit(item.id, { description: event.target.value }, item)}
                      placeholder="Описание бейджа"
                      className="h-10 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                    <textarea
                      value={edit.notes}
                      onChange={event => patchSuggestionEdit(item.id, { notes: event.target.value }, item)}
                      rows={3}
                      placeholder="Почему этот бейдж полезен для категории"
                      className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={reviewSuggestion.isPending}
                      onClick={() =>
                        reviewSuggestion.mutate({
                          badgeId: item.id,
                          action: "approve",
                          label: edit.label,
                          description: edit.description,
                          notes: edit.notes,
                        })
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCheck size={14} />
                      Утвердить
                    </button>
                    <button
                      type="button"
                      disabled={reviewSuggestion.isPending}
                      onClick={() =>
                        reviewSuggestion.mutate({
                          badgeId: item.id,
                          action: "reject",
                          label: edit.label,
                          description: edit.description,
                          notes: edit.notes,
                        })
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-rose-50 px-3 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Отклонить
                    </button>
                  </div>
                </div>
              );
            })}
            {!aiCategoryId && (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
                Выбери категорию, чтобы увидеть AI-предложения или сгенерировать новые.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-lg border border-gray-100 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#15171A]">
                Превью назначения по товарам
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Перед применением система показывает, какие товары получат бейдж, сколько из них уже размечено и
                где уверенность низкая. Это позволяет не стрелять вслепую по целой категории.
              </p>
            </div>
            <Sparkles className="text-[#05C3D4]" size={22} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={assignmentCategoryId}
              onChange={event => setAssignmentCategoryId(event.target.value)}
              className="h-11 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
            >
              <option value="">Выбери категорию для preview</option>
              {categoryOptions.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={applyAssignments.isPending || !assignmentCategoryId}
              onClick={() => applyAssignments.mutate({ categoryId: Number(assignmentCategoryId) })}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#15171A] px-4 text-sm font-black text-white transition hover:bg-black disabled:opacity-50"
            >
              <CheckCheck size={16} />
              Применить назначения
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {(assignmentPreviewQuery.data ?? []).map(item => (
              <div key={item.badgeId} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-[#15171A]">{item.badgeLabel}</span>
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-500">
                    {item.badgeCode}
                  </span>
                  <span className="rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">
                    {selectedAssignmentCategoryName}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-gray-500">
                  <span>Совпадений: {item.totalMatches}</span>
                  <span>Новых назначений: {item.newAssignments}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {item.sampleProducts.length === 0 ? (
                    <div className="text-sm text-gray-400">Подходящих товаров пока не найдено</div>
                  ) : (
                    item.sampleProducts.map(product => (
                      <div
                        key={`${item.badgeId}-${product.productId}`}
                        className="flex flex-col gap-2 rounded-md border border-gray-100 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="font-bold text-[#15171A]">{product.productName}</div>
                          <div className="text-xs text-gray-500">{product.explanation}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-500">
                            {product.confidence} / 100
                          </span>
                          {product.alreadyApplied && (
                            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                              Уже применен
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#15171A]">
                Контроль качества AI-бейджей
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Этот блок помогает быстро понять, не расползлась ли система: сколько активных бейджей реально
                живут на витрине, где покрытие слабое и как идут последние AI-прогоны.
              </p>
            </div>
            <Bot className="text-[#05C3D4]" size={22} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Всего бейджей", qualityQuery.data?.totalBadges ?? 0],
              ["Активных", qualityQuery.data?.activeBadges ?? 0],
              ["AI черновиков", qualityQuery.data?.aiDraftBadges ?? 0],
              ["Видимых на сайте", qualityQuery.data?.visibleBadges ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
                <div className="mt-2 text-2xl font-black text-[#15171A]">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-gray-100">
            <div className="border-b border-gray-100 px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">
              Категории с самым слабым покрытием
            </div>
            <div className="divide-y divide-gray-100">
              {(qualityQuery.data?.lowCoverageCategories ?? []).map(item => (
                <div key={item.categoryId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-bold text-[#15171A]">{item.categoryName}</div>
                    <div className="text-xs text-gray-500">
                      Товаров: {item.productCount}, размечено: {item.assignedProductCount}
                    </div>
                  </div>
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-700">
                    {item.coveragePercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-gray-100">
            <div className="border-b border-gray-100 px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400">
              Последние AI-прогоны
            </div>
            <div className="divide-y divide-gray-100">
              {(qualityQuery.data?.recentRuns ?? []).map(run => (
                <div key={run.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-bold text-[#15171A]">
                      {run.runType} / #{run.id}
                    </div>
                    <div className="text-xs text-gray-500">
                      {run.model} • {String(run.promptVersion || "v1")}
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${
                      run.status === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : run.status === "error"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-cyan-50 text-cyan-700"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
