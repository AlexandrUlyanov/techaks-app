import { useState } from "react";
import { Layers3, Plus } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";

export default function AdminMerchandisingBadges() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [form, setForm] = useState({
    label: "",
    code: "",
    description: "",
    scopeCategoryId: "",
  });

  const categoriesQuery = trpc.product.getCategories.useQuery({ includeInactive: true });
  const catalogQuery = trpc.merchandising.catalog.useQuery(
    {
      search: search.trim() || undefined,
      status: status || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
    },
    { refetchOnWindowFocus: false }
  );
  const reviewSuggestion = trpc.merchandising.reviewSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Статус бейджа обновлен");
      utils.merchandising.catalog.invalidate();
      utils.merchandising.qualityDashboard.invalidate();
      utils.product.invalidate();
    },
  });
  const upsertCatalogBadge = trpc.merchandising.upsertCatalogBadge.useMutation({
    onSuccess: () => {
      toast.success("Новый бейдж добавлен в каталог");
      setForm({ label: "", code: "", description: "", scopeCategoryId: "" });
      utils.merchandising.catalog.invalidate();
      utils.merchandising.qualityDashboard.invalidate();
    },
  });

  const categories = categoriesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="AI Merchandising"
        title="Каталог бейджей"
        description="Здесь живёт управляемый словарь полезных бейджей. Это главная точка контроля формулировок, статусов и области применения по категориям."
        actions={
          <div className="inline-flex items-center gap-2 rounded-full border border-[#05C3D4]/20 bg-[#F7FEFF] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#0099A8]">
            <Layers3 size={14} />
            {(catalogQuery.data ?? []).length} в текущем фильтре
          </div>
        }
      />

      <AdminSection
        title="Добавить новый бейдж"
        description="Ручной бейдж сразу становится частью каталога и может быть назначен категории или оставлен глобальным."
      >
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1.2fr_220px_auto]">
          <input
            value={form.label}
            onChange={event => setForm(prev => ({ ...prev, label: event.target.value }))}
            placeholder="Название бейджа"
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          />
          <input
            value={form.code}
            onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
            placeholder="code (необязательно)"
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          />
          <input
            value={form.description}
            onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            placeholder="Короткое описание"
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          />
          <select
            value={form.scopeCategoryId}
            onChange={event => setForm(prev => ({ ...prev, scopeCategoryId: event.target.value }))}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            <option value="">Глобальный бейдж</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={upsertCatalogBadge.isPending || !form.label.trim()}
            onClick={() =>
              upsertCatalogBadge.mutate({
                label: form.label,
                code: form.code || undefined,
                description: form.description || undefined,
                badgeType: "manual",
                audience: "customer",
                status: "active",
                source: "manual",
                isVisibleOnSite: true,
                scopeType: form.scopeCategoryId ? "category" : "global",
                scopeId: form.scopeCategoryId ? Number(form.scopeCategoryId) : null,
              })
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15171A] px-4 text-sm font-black text-white transition hover:bg-black disabled:opacity-50"
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>
      </AdminSection>

      <AdminSection
        title="Список бейджей"
        description="Фильтруй, архивируй и активируй формулировки. Так каталог остаётся чистым и управляемым."
      >
        <div className="grid gap-3 lg:grid-cols-[1.2fr_220px_220px]">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Поиск по названию или code"
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          />
          <select
            value={status}
            onChange={event => setStatus(event.target.value)}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            <option value="">Любой статус</option>
            <option value="draft">Черновик</option>
            <option value="active">Активен</option>
            <option value="disabled">Отключен</option>
            <option value="archived">Архив</option>
          </select>
          <select
            value={categoryId}
            onChange={event => setCategoryId(event.target.value)}
            className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
          >
            <option value="">Все категории</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-3">
          {(catalogQuery.data ?? []).map(item => (
            <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-[#15171A]">{item.label}</span>
                    <span className="rounded-md bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase text-gray-500">
                      {item.code}
                    </span>
                    <span className="rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">
                      {item.status}
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase text-gray-500">
                      {item.source}
                    </span>
                  </div>
                  <div className="text-sm leading-6 text-gray-500">
                    {item.description || "Без описания"}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-400">
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
                    className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-[#15171A] transition hover:border-[#05C3D4] disabled:opacity-50"
                  >
                    {item.status === "active" ? "В архив" : "Активировать"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {catalogQuery.data?.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
              Под выбранный фильтр пока ничего не найдено
            </div>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
