import { useMemo, useState } from "react";
import {
  EyeOff,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

type EditState = {
  manualPriority: number;
  badges: string[];
  isFeatured: boolean;
  isHiddenFromPromo: boolean;
  comment: string;
};

const BADGE_LABELS: Record<string, string> = {
  top_category: "Топ категории",
  excellent_price: "Отличная цена",
  store_choice: "Выбор магазина",
  new: "Новинка",
  recommend: "Рекомендуем",
  profitable: "Выгодно",
  in_stock: "В наличии",
  low_stock: "Осталось мало",
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

function normalizeBadges(badges: unknown): string[] {
  return Array.isArray(badges) ? badges.map(String) : [];
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

  const categoriesQuery = trpc.product.getCategories.useQuery();
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
      stockStatus: stockStatus as "in_stock" | "out_of_stock" | undefined,
      scoreMin: scoreMin ? Number(scoreMin) : undefined,
      search: search.trim() || undefined,
    }
  );

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
      badges: normalizeBadges(item.badges),
      isFeatured: Boolean(item.isFeatured),
      isHiddenFromPromo: Boolean(item.isHiddenFromPromo),
      comment: item.comment ?? "",
    };
    return { ...fallback, ...(edits[item.id] ?? {}) };
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
            {Object.entries(BADGE_LABELS).map(([value, label]) => (
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
                const hasStoreChoice = edit.badges.includes("store_choice");

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
                        {normalizeBadges(item.badges).map(itemBadge => (
                          <span key={itemBadge} className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600">
                            {BADGE_LABELS[itemBadge] ?? itemBadge}
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
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const nextBadges = hasStoreChoice
                                ? edit.badges.filter(itemBadge => itemBadge !== "store_choice")
                                : [...edit.badges, "store_choice"];
                              patchEdit(item.id, { badges: nextBadges }, fallback);
                            }}
                            className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[10px] font-black uppercase ${
                              hasStoreChoice ? "bg-[#05C3D4] text-black" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            <Sparkles size={13} />
                            Выбор
                          </button>
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
    </div>
  );
}
