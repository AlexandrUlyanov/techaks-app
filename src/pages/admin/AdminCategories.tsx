import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  EyeOff,
  FolderTree,
  Hash,
  Layers3,
  Loader2,
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { CategoryIcon } from "@/lib/category-icons";
import { slugify } from "@/lib/utils";
import { trpc } from "@/providers/trpc";
import { normalizeCategoryPreviewImages } from "@/contracts/category-preview-images";

type CategoryRecord = {
  id: number;
  parentId: number | null;
  msId?: string | null;
  slug: string;
  name: string;
  isActive: boolean;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  imageUrl: string | null;
  previewImages?: unknown;
  icon: string | null;
  sortOrder: number;
};

type CategoryDraft = {
  id?: number;
  parentId: number | null;
  slug: string;
  name: string;
  isActive: boolean;
  description: string;
  metaTitle: string;
  metaDescription: string;
  imageUrl: string;
  previewImages: string[];
  icon: string;
  sortOrder: number;
};

const EMPTY_DRAFT: CategoryDraft = {
  parentId: null,
  slug: "",
  name: "",
  isActive: true,
  description: "",
  metaTitle: "",
  metaDescription: "",
  imageUrl: "",
  previewImages: [],
  icon: "",
  sortOrder: 0,
};

function buildChildrenMap(categories: CategoryRecord[]) {
  const map = new Map<number | null, CategoryRecord[]>();
  for (const category of categories) {
    const bucket = map.get(category.parentId ?? null) ?? [];
    bucket.push(category);
    map.set(category.parentId ?? null, bucket);
  }

  for (const [key, bucket] of map.entries()) {
    map.set(
      key,
      [...bucket].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"))
    );
  }

  return map;
}

function collectDescendantIds(
  categoryId: number,
  byParent: Map<number | null, CategoryRecord[]>
) {
  const result: number[] = [];
  const stack = [categoryId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = byParent.get(current) ?? [];
    for (const child of children) {
      result.push(child.id);
      stack.push(child.id);
    }
  }

  return result;
}

function buildPathLabel(
  category: CategoryRecord,
  byId: Map<number, CategoryRecord>
) {
  const trail: string[] = [];
  let current: CategoryRecord | undefined = category;

  while (current) {
    trail.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return trail.join(" / ");
}

export default function AdminCategories() {
  const utils = trpc.useUtils();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCategory, setEditingCategory] = useState<CategoryDraft | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<CategoryRecord | null>(null);
  const [manualSlug, setManualSlug] = useState(false);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const { data: categories = [], isLoading } = trpc.product.getCategories.useQuery({
    includeInactive: true,
  });
  const categoryPreviewSuggestions = trpc.product.getCategoryPreviewImageSuggestions.useQuery(
    {
      categoryId: editingCategory?.id ?? 0,
    },
    {
      enabled: false,
      retry: false,
    }
  );
  const { data: previews = [] } = trpc.product.getCatalogCategoryPreviews.useQuery({
    includeInactive: true,
  });

  const upsertCategory = trpc.product.upsertCategory.useMutation({
    onSuccess: result => {
      toast.success(editingCategory?.id ? "Категория сохранена" : "Категория создана");
      setEditingCategory(null);
      setManualSlug(false);
      utils.product.getCategories.invalidate();
      utils.product.getCatalogCategoryPreviews.invalidate();
      setExpandedIds(prev => (prev.includes(result.id) ? prev : [...prev, result.id]));
    },
    onError: error => toast.error(error.message || "Не удалось сохранить категорию"),
  });

  const deleteCategory = trpc.product.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success("Категория удалена");
      setPendingDeleteCategory(null);
      utils.product.getCategories.invalidate();
      utils.product.getCatalogCategoryPreviews.invalidate();
    },
    onError: error => toast.error(error.message || "Не удалось удалить категорию"),
  });

  const reorderCategory = trpc.product.reorderCategory.useMutation({
    onSuccess: result => {
      if (result.changed) {
        toast.success("Порядок категории обновлён");
        utils.product.getCategories.invalidate();
        utils.product.getCatalogCategoryPreviews.invalidate();
      }
    },
    onError: error => toast.error(error.message || "Не удалось изменить порядок категории"),
  });

  const updateCategoryActivity = trpc.product.updateCategoryActivity.useMutation({
    onSuccess: (_, variables) => {
      toast.success(
        variables.isActive ? "Категория активирована" : "Категория скрыта с сайта"
      );
      utils.product.getCategories.invalidate();
      utils.product.getCatalogCategoryPreviews.invalidate();
    },
    onError: error => toast.error(error.message || "Не удалось изменить состояние категории"),
  });

  useEffect(() => {
    if (categories.length === 0) return;
    setExpandedIds(prev => {
      if (prev.length > 0) return prev;
      return categories.filter(category => category.parentId === null).map(category => category.id);
    });
  }, [categories]);

  const byId = useMemo(
    () => new Map(categories.map(category => [category.id, category] as const)),
    [categories]
  );
  const byParent = useMemo(() => buildChildrenMap(categories), [categories]);
  const previewByCategoryId = useMemo(
    () => new Map(previews.map(item => [item.categoryId, item] as const)),
    [previews]
  );
  const rootCategories = useMemo(
    () => byParent.get(null) ?? [],
    [byParent]
  );
  const nestedCategoriesCount = useMemo(
    () => categories.filter(category => category.parentId !== null).length,
    [categories]
  );
  const categoriesWithProducts = useMemo(
    () => previews.filter(item => item.productCount > 0).length,
    [previews]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleCategoryIds = useMemo(() => {
    if (!normalizedSearch) return new Set(categories.map(category => category.id));

    const matched = categories.filter(category =>
      [category.name, category.slug, category.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );

    const visible = new Set<number>();
    for (const category of matched) {
      visible.add(category.id);
      let currentParentId = category.parentId;
      while (currentParentId) {
        visible.add(currentParentId);
        currentParentId = byId.get(currentParentId)?.parentId ?? null;
      }
    }
    return visible;
  }, [byId, categories, normalizedSearch]);

  useEffect(() => {
    if (!normalizedSearch) return;
    setExpandedIds(prev => {
      const nextExpanded = new Set(prev);
      for (const categoryId of visibleCategoryIds) {
        nextExpanded.add(categoryId);
      }
      return Array.from(nextExpanded);
    });
  }, [normalizedSearch, visibleCategoryIds]);

  const availableParentOptions = useMemo(() => {
    if (!editingCategory?.id) {
      return categories;
    }

    const forbiddenIds = new Set([
      editingCategory.id,
      ...collectDescendantIds(editingCategory.id, byParent),
    ]);

    return categories.filter(category => !forbiddenIds.has(category.id));
  }, [byParent, categories, editingCategory?.id]);

  const selectedParentLabel = useMemo(() => {
    if (!editingCategory?.parentId) return "Корневая категория";
    return byId.get(editingCategory.parentId)?.name ?? "Корневая категория";
  }, [byId, editingCategory?.parentId]);

  const openCreateModal = (parentId: number | null = null) => {
    const siblingSortOrders = (byParent.get(parentId) ?? []).map(category => category.sortOrder);
    const nextSortOrder = siblingSortOrders.length > 0 ? Math.max(...siblingSortOrders) + 10 : 0;
    setEditingCategory({
      ...EMPTY_DRAFT,
      parentId,
      sortOrder: nextSortOrder,
    });
    setManualSlug(false);
  };

  const openEditModal = (category: CategoryRecord) => {
    setEditingCategory({
      id: category.id,
      parentId: category.parentId ?? null,
      slug: category.slug,
      name: category.name,
      isActive: category.isActive,
      description: category.description ?? "",
      metaTitle: category.metaTitle ?? "",
      metaDescription: category.metaDescription ?? "",
      imageUrl: category.imageUrl ?? "",
      previewImages: normalizeCategoryPreviewImages(category.previewImages),
      icon: category.icon ?? "",
      sortOrder: category.sortOrder,
    });
    setManualSlug(true);
  };

  const handleDelete = (category: CategoryRecord) => {
    setPendingDeleteCategory(category);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCategory) return;

    upsertCategory.mutate({
      id: editingCategory.id,
      data: {
        parentId: editingCategory.parentId,
        slug: editingCategory.slug.trim(),
        name: editingCategory.name.trim(),
        isActive: editingCategory.isActive,
        description: editingCategory.description.trim() || null,
        metaTitle: editingCategory.metaTitle.trim() || null,
        metaDescription: editingCategory.metaDescription.trim() || null,
        imageUrl: editingCategory.imageUrl.trim() || null,
        previewImages: editingCategory.previewImages,
        icon: editingCategory.icon.trim() || null,
        sortOrder: Number(editingCategory.sortOrder) || 0,
      },
    });
  };

  const handleApplyPreviewSuggestions = async () => {
    if (!editingCategory?.id) {
      toast.error("Сначала сохраните категорию, затем можно подтянуть миниатюры из товаров.");
      return;
    }

    const result = await categoryPreviewSuggestions.refetch();
    if (result.error) {
      toast.error(result.error.message || "Не удалось подобрать миниатюры.");
      return;
    }

    const suggestions = result.data ?? [];
    setEditingCategory(prev =>
      prev
        ? {
            ...prev,
            previewImages: suggestions,
          }
        : prev
    );

    if (suggestions.length === 0) {
      toast.message("Подходящих изображений в товарах этой категории пока не нашлось.");
      return;
    }

    toast.success(`Подобрали ${suggestions.length} миниатюр из товаров категории.`);
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const getSiblingMeta = (category: CategoryRecord) => {
    const siblings = (byParent.get(category.parentId ?? null) ?? []).filter(node =>
      visibleCategoryIds.has(node.id)
    );
    const index = siblings.findIndex(node => node.id === category.id);
    return {
      canMoveUp: index > 0,
      canMoveDown: index >= 0 && index < siblings.length - 1,
    };
  };

  const pendingDeleteMeta = useMemo(() => {
    if (!pendingDeleteCategory) return null;
    const preview = previewByCategoryId.get(pendingDeleteCategory.id);
    return {
      directChildrenCount: (byParent.get(pendingDeleteCategory.id) ?? []).length,
      directProductCount: preview?.productCount ?? 0,
    };
  }, [byParent, pendingDeleteCategory, previewByCategoryId]);

  const renderTree = (nodes: CategoryRecord[], depth = 0): React.ReactElement | null => {
    const visibleNodes = nodes.filter(node => visibleCategoryIds.has(node.id));
    if (visibleNodes.length === 0) return null;

    return (
      <div className={depth === 0 ? "space-y-3" : "space-y-2 pt-2"}>
        {visibleNodes.map(category => {
          const children = byParent.get(category.id) ?? [];
          const hasChildren = children.some(child => visibleCategoryIds.has(child.id));
          const isExpanded = expandedIds.includes(category.id);
          const preview = previewByCategoryId.get(category.id);
          const siblingMeta = getSiblingMeta(category);

          const previewImages = normalizeCategoryPreviewImages(category.previewImages);

          return (
            <div key={category.id} className="space-y-2">
              <div
                className={`group flex items-start justify-between gap-3 rounded-2xl border px-4 py-4 transition-colors hover:border-[#05C3D4]/30 hover:bg-[#F7FEFF] ${
                  category.isActive ? "border-gray-100 bg-white" : "border-amber-100 bg-amber-50/60"
                } ${
                  depth > 0 ? "ml-6" : ""
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => (hasChildren ? toggleExpanded(category.id) : undefined)}
                    className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors ${
                      hasChildren ? "hover:bg-gray-100 hover:text-[#05C3D4]" : "opacity-40"
                    }`}
                    aria-label={
                      hasChildren
                        ? isExpanded
                          ? `Свернуть ${category.name}`
                          : `Развернуть ${category.name}`
                        : `Категория ${category.name}`
                    }
                    disabled={!hasChildren}
                  >
                    {hasChildren ? (
                      isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </button>

                  <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-[#05C3D4]">
                    {previewImages[0] ? (
                      <img
                        src={previewImages[0]}
                        alt={category.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                      />
                    ) : category.imageUrl ? (
                      <img
                        src={category.imageUrl}
                        alt={category.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <CategoryIcon name={category.name} slug={category.slug} size={18} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-black text-[#15171A]">{category.name}</div>
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                        {category.slug}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          category.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {category.isActive ? "Активна" : "Скрыта"}
                      </span>
                      <span className="inline-flex rounded-full bg-[#F2FBFD] px-2.5 py-1 text-[11px] font-semibold text-[#047C89]">
                        {preview?.productCount ?? 0} тов.
                      </span>
                      {hasChildren ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                          {(byParent.get(category.id) ?? []).length} доч.
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">{buildPathLabel(category, byId)}</div>
                    {category.description ? (
                      <div className="line-clamp-2 text-sm leading-6 text-gray-600">
                        {category.description}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() =>
                      reorderCategory.mutate({
                        id: category.id,
                        direction: "up",
                      })
                    }
                    disabled={!siblingMeta.canMoveUp || reorderCategory.isPending}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#15171A] disabled:cursor-not-allowed disabled:opacity-30"
                    title="Поднять выше"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      reorderCategory.mutate({
                        id: category.id,
                        direction: "down",
                      })
                    }
                    disabled={!siblingMeta.canMoveDown || reorderCategory.isPending}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#15171A] disabled:cursor-not-allowed disabled:opacity-30"
                    title="Опустить ниже"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateCategoryActivity.mutate({
                        id: category.id,
                        isActive: !category.isActive,
                      })
                    }
                    disabled={updateCategoryActivity.isPending}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                      category.isActive
                        ? "text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                        : "text-amber-500 hover:bg-emerald-50 hover:text-emerald-600"
                    }`}
                    title={category.isActive ? "Скрыть категорию с сайта" : "Активировать категорию"}
                  >
                    {category.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateModal(category.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-[#F2FBFD] hover:text-[#05C3D4]"
                    title="Создать дочернюю категорию"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(category)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#15171A]"
                    title="Редактировать категорию"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(category)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Удалить категорию"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {hasChildren && isExpanded ? renderTree(children, depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-[var(--tech-radius-card)] border border-border bg-card" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        </div>
        <div className="h-96 animate-pulse rounded-[var(--tech-radius-card)] border border-border bg-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Каталог"
        title="Категории"
        description="Здесь мы управляем структурой каталога: создаём разделы, переносим их по дереву и держим slug под контролем. Удаление работает только для пустых категорий — без товаров и без дочерних разделов."
        actions={
          <button
            type="button"
            onClick={() => openCreateModal(null)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-bold text-white transition-colors hover:bg-[#0097a7]"
          >
            <Plus size={18} />
            Создать категорию
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatCard
          label="Всего категорий"
          value={categories.length}
          hint="Все разделы в дереве"
          icon={FolderTree}
          tone="accent"
        />
        <AdminStatCard
          label="Корневые разделы"
          value={rootCategories.length}
          hint="Верхний уровень каталога"
          icon={Layers3}
        />
        <AdminStatCard
          label="Категории с товарами"
          value={categoriesWithProducts}
          hint={`Вложенных категорий: ${nestedCategoriesCount}`}
          icon={Hash}
          tone={categoriesWithProducts > 0 ? "success" : "default"}
        />
      </div>

      <AdminSection
        title="Дерево категорий"
        description="Поиск помогает быстро найти раздел по названию, slug или описанию. Создание дочерних категорий можно запускать прямо из строки нужного узла."
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Найти категорию по названию, slug или описанию"
                className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-11 text-sm outline-none transition-colors focus:border-[#05C3D4]"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Очистить поиск"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="text-sm text-gray-500">
              Найдено разделов:{" "}
              <span className="font-bold text-[#15171A]">
                {Array.from(visibleCategoryIds).length}
              </span>
            </div>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <div className="text-lg font-bold text-[#15171A]">Категорий пока нет</div>
              <div className="mt-2 text-sm leading-6 text-gray-500">
                Можно создать первую категорию вручную или подтянуть структуру из синхронизации.
              </div>
              <button
                type="button"
                onClick={() => openCreateModal(null)}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-bold text-white transition-colors hover:bg-[#0097a7]"
              >
                <Plus size={18} />
                Создать первую категорию
              </button>
            </div>
          ) : Array.from(visibleCategoryIds).length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <div className="text-lg font-bold text-[#15171A]">Ничего не найдено</div>
              <div className="mt-2 text-sm leading-6 text-gray-500">
                Попробуй изменить запрос — сейчас он ищет по названию, slug и описанию категории.
              </div>
            </div>
          ) : (
            renderTree(rootCategories)
          )}
        </div>
      </AdminSection>

      {editingCategory ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setEditingCategory(null);
              setManualSlug(false);
            }}
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-6 py-5">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-[#15171A]">
                  {editingCategory.id ? "Редактировать категорию" : "Новая категория"}
                </h2>
                <p className="text-sm leading-6 text-gray-500">
                  Настраиваем имя, slug, положение в дереве и служебные поля раздела.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setManualSlug(false);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Закрыть форму"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                <div className="font-semibold text-[#15171A]">Позиция в дереве</div>
                <div className="mt-1">
                  Родительский раздел: <span className="font-medium text-[#15171A]">{selectedParentLabel}</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-gray-700">Название</span>
                  <input
                    value={editingCategory.name}
                    onChange={event =>
                      setEditingCategory(prev =>
                        prev
                          ? {
                              ...prev,
                              name: event.target.value,
                              slug: manualSlug ? prev.slug : slugify(event.target.value),
                            }
                          : prev
                      )
                    }
                    required
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-gray-700">Slug</span>
                  <input
                    value={editingCategory.slug}
                    onChange={event => {
                      setManualSlug(true);
                      setEditingCategory(prev =>
                        prev ? { ...prev, slug: slugify(event.target.value) } : prev
                      );
                    }}
                    required
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-gray-700">Родительская категория</span>
                  <select
                    value={editingCategory.parentId ?? ""}
                    onChange={event =>
                      setEditingCategory(prev =>
                        prev
                          ? {
                              ...prev,
                              parentId: event.target.value === "" ? null : Number(event.target.value),
                            }
                          : prev
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                  >
                    <option value="">Корневая категория</option>
                    {availableParentOptions.map(category => (
                      <option key={category.id} value={category.id}>
                        {buildPathLabel(category, byId)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-gray-700">Порядок</span>
                  <input
                    type="number"
                    value={editingCategory.sortOrder}
                    onChange={event =>
                      setEditingCategory(prev =>
                        prev
                          ? { ...prev, sortOrder: Number(event.target.value || 0) }
                          : prev
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={editingCategory.isActive}
                  onChange={event =>
                    setEditingCategory(prev =>
                      prev ? { ...prev, isActive: event.target.checked } : prev
                    )
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#05C3D4] focus:ring-[#05C3D4]"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-semibold text-[#15171A]">
                    Категория активна на сайте
                  </span>
                  <span className="block text-sm leading-6 text-gray-500">
                    Если выключить категорию, она исчезнет из публичного каталога и навигации, но останется доступной в админке.
                  </span>
                </span>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Описание</span>
                <textarea
                  value={editingCategory.description}
                  onChange={event =>
                    setEditingCategory(prev =>
                      prev ? { ...prev, description: event.target.value } : prev
                    )
                  }
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Фото категории</span>
                <input
                  value={editingCategory.imageUrl}
                  onChange={event =>
                    setEditingCategory(prev =>
                      prev ? { ...prev, imageUrl: event.target.value } : prev
                    )
                  }
                  placeholder="https://... или /uploads/categories/..."
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                />
              </label>

              <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-[#15171A]">
                      Миниатюры для карточки категории
                    </div>
                    <div className="text-sm leading-6 text-gray-500">
                      До 5 изображений. Именно они будут анимированно переключаться на карточках категории в каталоге.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyPreviewSuggestions}
                    disabled={!editingCategory.id || categoryPreviewSuggestions.isFetching}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-[#05C3D4]/20 bg-white px-4 text-sm font-semibold text-[#047C89] transition-colors hover:bg-[#F2FBFD] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {categoryPreviewSuggestions.isFetching ? (
                      <>
                        <Loader2 size={14} className="mr-2 animate-spin" />
                        Подбираю…
                      </>
                    ) : (
                      "Подобрать из товаров категории"
                    )}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {editingCategory.previewImages.map((imageUrl, index) => (
                    <div
                      key={`${imageUrl}-${index}`}
                      className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3"
                    >
                      <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-white">
                        <img
                          src={imageUrl}
                          alt={`Миниатюра ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <input
                        value={imageUrl}
                        onChange={event =>
                          setEditingCategory(prev =>
                            prev
                              ? {
                                  ...prev,
                                  previewImages: prev.previewImages.map((item, itemIndex) =>
                                    itemIndex === index ? event.target.value : item
                                  ),
                                }
                              : prev
                          )
                        }
                        placeholder="https://... или /uploads/..."
                        className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditingCategory(prev =>
                            prev
                              ? {
                                  ...prev,
                                  previewImages: prev.previewImages.filter((_, itemIndex) => itemIndex !== index),
                                }
                              : prev
                          )
                        }
                        className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        Удалить миниатюру
                      </button>
                    </div>
                  ))}

                  {editingCategory.previewImages.length < 5 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCategory(prev =>
                          prev
                            ? {
                                ...prev,
                                previewImages: [...prev.previewImages, ""],
                              }
                            : prev
                        )
                      }
                      className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white text-sm font-semibold text-gray-500 transition-colors hover:border-[#05C3D4]/30 hover:bg-[#F7FEFF] hover:text-[#047C89]"
                    >
                      <Plus size={18} />
                      Добавить миниатюру
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-gray-700">SEO title</span>
                  <input
                    value={editingCategory.metaTitle}
                    onChange={event =>
                      setEditingCategory(prev =>
                        prev ? { ...prev, metaTitle: event.target.value } : prev
                      )
                    }
                    placeholder="Если пусто, используем шаблон по категории"
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-gray-700">SEO description</span>
                  <textarea
                    value={editingCategory.metaDescription}
                    onChange={event =>
                      setEditingCategory(prev =>
                        prev ? { ...prev, metaDescription: event.target.value } : prev
                      )
                    }
                    rows={4}
                    placeholder="Если пусто, используем шаблон и описание категории"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                  />
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Код иконки (опционально)</span>
                <input
                  value={editingCategory.icon}
                  onChange={event =>
                    setEditingCategory(prev =>
                      prev ? { ...prev, icon: event.target.value } : prev
                    )
                  }
                  placeholder="Например: phone, beauty, laptop"
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none transition-colors focus:border-[#05C3D4]"
                />
              </label>

              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setManualSlug(false);
                  }}
                  className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={upsertCategory.isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-5 text-sm font-bold text-white transition-colors hover:bg-[#0097a7] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {upsertCategory.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  {editingCategory.id ? "Сохранить изменения" : "Создать категорию"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingDeleteCategory ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setPendingDeleteCategory(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white px-6 py-6 shadow-2xl">
            <div className="space-y-2">
              <div className="text-xl font-black text-[#15171A]">Удалить категорию?</div>
              <div className="text-sm leading-6 text-gray-600">
                Мы удалим только пустую категорию. Если внутри есть товары или дочерние разделы, сервер
                остановит операцию и вернёт понятную ошибку.
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-4 text-sm text-gray-600">
              <div className="font-semibold text-[#15171A]">{pendingDeleteCategory.name}</div>
              <div className="mt-1 text-xs text-gray-500">{buildPathLabel(pendingDeleteCategory, byId)}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-2">
                  Подкатегорий:{" "}
                  <span className="font-bold text-[#15171A]">
                    {pendingDeleteMeta?.directChildrenCount ?? 0}
                  </span>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  Товаров:{" "}
                  <span className="font-bold text-[#15171A]">
                    {pendingDeleteMeta?.directProductCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteCategory(null)}
                className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => deleteCategory.mutate({ id: pendingDeleteCategory.id })}
                disabled={deleteCategory.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteCategory.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Удалить категорию
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
