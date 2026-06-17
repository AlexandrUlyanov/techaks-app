import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { slugify } from "@/lib/utils";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Package,
  EyeOff,
  CircleDollarSign,
  Power,
} from "lucide-react";
import ProductSpecStandardizationPanel from "@/components/admin/ProductSpecStandardizationPanel";
import ManufacturerCatalogPanel from "@/components/admin/ManufacturerCatalogPanel";
import {
  AUTO_BLOCK_REASON_ZERO_PRICE,
  hasInvalidProductPrice,
} from "@contracts/product-visibility";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";

export default function AdminProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "site_active" | "manual_disabled" | "auto_blocked" | "zero_price"
  >("all");
  const [page, setPage] = useState(1);
  const [showCatalogUtilities, setShowCatalogUtilities] = useState(false);
  const limit = 20;

  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [slugValue, setSlugValue] = useState("");
  const [manualSlug, setManualSlug] = useState(false);
  const [draftPrice, setDraftPrice] = useState<string>("");
  const [draftIsActive, setDraftIsActive] = useState(true);

  useEffect(() => {
    if (editingProduct) {
      setSlugValue(editingProduct.slug || "");
      setManualSlug(!!editingProduct.slug);
      setDraftPrice(
        editingProduct.price === undefined || editingProduct.price === null
          ? ""
          : String(editingProduct.price)
      );
      setDraftIsActive(editingProduct.isActive ?? true);
    } else {
      setSlugValue("");
      setManualSlug(false);
      setDraftPrice("");
      setDraftIsActive(true);
    }
  }, [editingProduct]);

  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.product.getCategories.useQuery({ includeInactive: true });
  const { data: pagedData, isLoading } = trpc.product.getPaginated.useQuery({
    page,
    limit,
    search: searchTerm,
    visibility: visibilityFilter,
  });
  const { data: reservationSummary } = trpc.product.getReservationSummary.useQuery(
    { productId: editingProduct?.id ?? 0 },
    { enabled: Boolean(editingProduct?.id) }
  );
  const { data: productVariants = [] } = trpc.product.getAdminVariants.useQuery(
    { productId: editingProduct?.id ?? 0 },
    { enabled: Boolean(editingProduct?.id) }
  );

  const products = pagedData?.items || [];
  const totalPages = pagedData?.totalPages || 1;

  const upsertMutation = trpc.product.upsertProduct.useMutation({
    onSuccess: () => {
      utils.product.getPaginated.invalidate();
      setEditingProduct(null);
    },
  });

  const deleteMutation = trpc.product.deleteProduct.useMutation({
    onSuccess: () => {
      utils.product.getPaginated.invalidate();
    },
  });

  const updateActivityMutation = trpc.product.updateProductActivity.useMutation({
    onSuccess: () => {
      utils.product.getPaginated.invalidate();
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот товар?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      slug: formData.get("slug") as string,
      name: formData.get("name") as string,
      categoryId: parseInt(formData.get("categoryId") as string),
      price: parseInt(formData.get("price") as string),
      isActive: formData.get("isActive") === "on",
      oldPrice: formData.get("oldPrice")
        ? parseInt(formData.get("oldPrice") as string)
        : null,
      badge: (formData.get("badge") as string) || null,
      image: formData.get("image") as string,
      description: formData.get("description") as string,
      specs: JSON.parse((formData.get("specs") as string) || "{}"),
      inStock: formData.get("inStock") === "on",
      rating: formData.get("rating") as string,
      reviewCount: parseInt((formData.get("reviewCount") as string) || "0"),
    };

    upsertMutation.mutate({
      id: editingProduct?.id,
      data,
    });
  };

  const getPublicationStatus = (product: any) => {
    if (product.isActive === false) {
      return {
        label: "Отключен вручную",
        hint: "Администратор отключил отображение товара на сайте.",
        className: "bg-slate-100 text-slate-700",
      };
    }

    if (
      product.isAutoBlocked === true ||
      product.autoBlockReason === AUTO_BLOCK_REASON_ZERO_PRICE ||
      hasInvalidProductPrice(product.price)
    ) {
      return {
        label: "Не отображается: цена не указана или равна 0",
        hint:
          "После появления цены больше 0 товар появится на сайте только если ручная активность включена.",
        className: "bg-amber-100 text-amber-800",
      };
    }

    return {
      label: "Отображается на сайте",
      hint: "Товар доступен на витрине и может быть куплен.",
      className: "bg-emerald-100 text-emerald-700",
    };
  };

  const editingStatus = getPublicationStatus({
    ...(editingProduct ?? {}),
    price: draftPrice === "" ? null : Number(draftPrice),
    isActive: draftIsActive,
  });

  const visibleProducts = products.filter(product => {
    const status = getPublicationStatus(product);
    return status.label === "Отображается на сайте";
  }).length;
  const autoBlockedProducts = products.filter(product => {
    return (
      product.isAutoBlocked === true ||
      product.autoBlockReason === AUTO_BLOCK_REASON_ZERO_PRICE ||
      hasInvalidProductPrice(product.price)
    );
  }).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Каталог"
        title="Товары"
        description="Основной рабочий сценарий здесь — поиск, просмотр и редактирование карточек. Служебные инструменты каталогизации и стандартизации остаются доступны, но не мешают ежедневному CRUD."
        actions={
          <button
            onClick={() => setEditingProduct({})}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-bold text-white transition-colors hover:bg-[#0097a7]"
          >
            <Plus size={18} />
            Добавить товар
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatCard
          label="Текущая выборка"
          value={pagedData?.total ?? 0}
          hint={`Страница ${page} из ${totalPages}`}
          icon={Package}
          tone="accent"
        />
        <AdminStatCard
          label="Отображаются на сайте"
          value={visibleProducts}
          hint="В текущей таблице"
          icon={CircleDollarSign}
          tone="success"
        />
        <AdminStatCard
          label="Автоблокировка / нет цены"
          value={autoBlockedProducts}
          hint="Товар не виден на витрине"
          icon={EyeOff}
          tone={autoBlockedProducts > 0 ? "warning" : "default"}
        />
      </div>

      <AdminSection
        title="Список товаров"
        description="Сначала работаем со списком. Инструментальные панели каталогизации и стандартизации вынесены ниже как отдельная служебная зона."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid w-full gap-3 lg:grid-cols-[minmax(280px,1fr)_260px]">
              <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Поиск товаров..."
                value={searchTerm}
                onChange={handleSearch}
                className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-4 text-sm outline-none focus:border-[#05C3D4]"
              />
              </div>
              <select
                value={visibilityFilter}
                onChange={event => {
                  setVisibilityFilter(event.target.value as typeof visibilityFilter);
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
              >
                <option value="all">Все товары</option>
                <option value="site_active">Активные на сайте</option>
                <option value="manual_disabled">Отключённые вручную</option>
                <option value="auto_blocked">Автоматически заблокированные</option>
                <option value="zero_price">Без цены / цена 0</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowCatalogUtilities(prev => !prev)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:border-[#05C3D4] hover:text-[#05C3D4]"
            >
              <ChevronsUpDown size={16} />
              {showCatalogUtilities
                ? "Скрыть служебные панели"
                : "Показать служебные панели"}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                      Товар
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                      Категория
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                      Цена
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                      Статус на сайте
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                      Наличие
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Загрузка...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Товары не найдены
                      </td>
                    </tr>
                  ) : (
                    products.map(product => {
                      const status = getPublicationStatus(product);
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 p-1">
                                <img
                                  src={product.image}
                                  alt=""
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <div>
                                <div className="font-medium text-[#0a0a0a]">
                                  {product.name}
                                </div>
                                <div className="text-xs text-gray-400">{product.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600">
                              {product.categoryName || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-[#0a0a0a]">
                              {product.price} ₽
                            </div>
                            {product.oldPrice ? (
                              <div className="text-xs text-gray-400 line-through">
                                {product.oldPrice} ₽
                              </div>
                            ) : null}
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                              >
                                {status.label}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateActivityMutation.mutate({
                                    id: product.id,
                                    isActive: !(product.isActive ?? true),
                                  })
                                }
                                disabled={updateActivityMutation.isPending}
                                className="mt-1 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 transition hover:border-[#05C3D4] hover:text-[#05C3D4] disabled:opacity-50"
                                title={
                                  product.isActive === false
                                    ? "Включить ручную активность"
                                    : "Отключить вручную"
                                }
                              >
                                <Power size={12} />
                                {product.isActive === false
                                  ? "Включить"
                                  : "Отключить"}
                              </button>
                              <div className="max-w-[220px] text-xs leading-relaxed text-gray-500">
                                {status.hint}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {product.stocks && product.stocks.length > 0 ? (
                              <div className="space-y-1">
                                {product.stocks.map((stock: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1 text-xs"
                                  >
                                    <span
                                      className="max-w-[120px] truncate text-gray-600"
                                      title={stock.storeName}
                                    >
                                      {stock.storeName}
                                    </span>
                                    <span className="font-bold">{stock.quantity} шт</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                                <X size={12} /> Нет в наличии
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingProduct(product)}
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#05C3D4]"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 size={16} />
                              </button>
                              <a
                                href={`/product/${product.slug}`}
                                target="_blank"
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                              >
                                <ExternalLink size={16} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!isLoading && totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-500">
                  Страница {page} из {totalPages} ({pagedData?.total} товаров)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="rounded-xl border border-gray-200 bg-white p-2 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="rounded-xl border border-gray-200 bg-white p-2 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </AdminSection>

      {showCatalogUtilities ? (
        <div className="space-y-6">
          <AdminSection
            title="Служебные панели каталога"
            description="Эти инструменты нужны не в каждом ежедневном сценарии, поэтому они вынесены в отдельную рабочую зону и не давят на основной экран товаров."
            tone="subtle"
          >
            <div className="space-y-6">
              <ManufacturerCatalogPanel />
              <ProductSpecStandardizationPanel categories={categories as any} />
            </div>
          </AdminSection>
        </div>
      ) : null}

      {editingProduct ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditingProduct(null)}
          />
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-6">
              <div>
                <h2 className="text-xl font-bold text-[#0a0a0a]">
                  {editingProduct.id ? "Редактировать товар" : "Новый товар"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Основные поля редактируются здесь. Статус публикации на сайте
                  всегда показывается сразу, чтобы не потерять смысл изменений.
                </p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">
                  Статус товара на сайте
                </div>
                <div
                  className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${editingStatus.className}`}
                >
                  {editingStatus.label}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  {editingStatus.hint}
                </p>
              </div>

              {editingProduct.id && reservationSummary ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">
                    Остатки и резервы по магазинам
                  </div>
                  <div className="mt-3 space-y-3">
                    {reservationSummary.stores.length > 0 ? (
                      reservationSummary.stores.map((store: any) => (
                        <div
                          key={store.storeId}
                          className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
                        >
                          <div className="font-semibold text-[#15171A]">
                            {store.storeName}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {store.storeAddress}
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-xl bg-white px-3 py-2 text-sm">
                              Остаток МойСклад:{" "}
                              <span className="font-bold">{store.rawStockQty}</span>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 text-sm">
                              В резерве:{" "}
                              <span className="font-bold">{store.activeReservedQty}</span>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 text-sm">
                              Доступно:{" "}
                              <span className="font-bold">{store.availableQty}</span>
                            </div>
                          </div>
                          {store.hasConflict ? (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                              Активных резервов больше, чем внешнего остатка. Нужна ручная проверка.
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                        По этому товару пока нет остатков по магазинам.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {editingProduct.id ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">
                    Модификации товара
                  </div>
                  {productVariants.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      У товара пока нет синхронизированных модификаций.
                    </div>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-[0.16em] text-gray-400">
                          <tr>
                            <th className="px-3 py-2">Название</th>
                            <th className="px-3 py-2">Артикул</th>
                            <th className="px-3 py-2">Цена</th>
                            <th className="px-3 py-2">Остаток</th>
                            <th className="px-3 py-2">Активна</th>
                            <th className="px-3 py-2">ID МойСклад</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {productVariants.map((variant: any) => (
                            <tr key={variant.id}>
                              <td className="px-3 py-3 font-medium text-[#15171A]">
                                {variant.name}
                              </td>
                              <td className="px-3 py-3 text-gray-500">
                                {variant.article || "—"}
                              </td>
                              <td className="px-3 py-3 text-gray-500">
                                {new Intl.NumberFormat("ru-RU").format(Number(variant.price || 0))} ₽
                              </td>
                              <td className="px-3 py-3 text-gray-500">{variant.stock}</td>
                              <td className="px-3 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    variant.isActive
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {variant.isActive ? "Да" : "Нет"}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-gray-400">{variant.msId || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Название
                  </label>
                  <input
                    name="name"
                    defaultValue={editingProduct.name}
                    onChange={e => {
                      if (!manualSlug) {
                        setSlugValue(slugify(e.target.value));
                      }
                    }}
                    required
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Slug (ID в URL)
                  </label>
                  <input
                    name="slug"
                    value={slugValue}
                    onChange={e => {
                      setSlugValue(e.target.value);
                      setManualSlug(true);
                    }}
                    required
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Категория
                  </label>
                  <select
                    name="categoryId"
                    defaultValue={editingProduct.categoryId}
                    required
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                  >
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Бейдж (Акция, Хит...)
                  </label>
                  <input
                    name="badge"
                    defaultValue={editingProduct.badge}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Цена (₽)
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={draftPrice}
                    onChange={e => setDraftPrice(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Старая цена (₽)
                  </label>
                  <input
                    type="number"
                    name="oldPrice"
                    defaultValue={editingProduct.oldPrice}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Рейтинг
                  </label>
                  <input
                    name="rating"
                    defaultValue={editingProduct.rating || "5.0"}
                    required
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Ссылка на изображение
                </label>
                <input
                  name="image"
                  defaultValue={editingProduct.image}
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Описание
                </label>
                <textarea
                  name="description"
                  defaultValue={editingProduct.description}
                  required
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Характеристики (JSON)
                </label>
                <textarea
                  name="specs"
                  defaultValue={JSON.stringify(editingProduct.specs || {}, null, 2)}
                  rows={5}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={draftIsActive}
                  onChange={e => setDraftIsActive(e.target.checked)}
                  id="isActive"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Активен на сайте
                </label>
              </div>

              {hasInvalidProductPrice(draftPrice === "" ? null : Number(draftPrice)) ||
              editingStatus.label !== "Отображается на сайте" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Товар не появится на сайте, пока цена не станет больше 0 и
                  ручная активность не будет включена.
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="inStock"
                  defaultChecked={editingProduct.inStock ?? true}
                  id="inStock"
                />
                <label htmlFor="inStock" className="text-sm font-medium text-gray-700">
                  В наличии
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="rounded-xl px-4 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#05C3D4] px-6 py-2 font-medium text-white transition-colors hover:bg-[#0097a7] disabled:opacity-50"
                >
                  {upsertMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  {editingProduct.id ? "Сохранить изменения" : "Создать товар"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
