import { useState } from "react";
import { Bot, CheckCheck, Sparkles, XCircle } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import AdminMerchandisingNav from "./AdminMerchandisingNav";

export default function AdminMerchandisingAi() {
  const utils = trpc.useUtils();
  const [categoryId, setCategoryId] = useState("");
  const [edits, setEdits] = useState<Record<number, { label: string; description: string; notes: string }>>({});

  const categoriesQuery = trpc.product.getCategories.useQuery();
  const suggestionsQuery = trpc.merchandising.categorySuggestions.useQuery(
    { categoryId: categoryId ? Number(categoryId) : 0 },
    { enabled: Boolean(categoryId), refetchOnWindowFocus: false }
  );
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
      toast.success("Решение по AI-предложению сохранено");
      utils.merchandising.categorySuggestions.invalidate();
      utils.merchandising.catalog.invalidate();
      utils.merchandising.assignmentPreview.invalidate();
      utils.merchandising.qualityDashboard.invalidate();
      utils.product.invalidate();
    },
  });

  const categories = categoriesQuery.data ?? [];
  const selectedCategoryName =
    categories.find(category => category.id === Number(categoryId))?.name ?? "категории";

  const getEdit = (item: { id: number; label: string; description?: string | null; notes?: string | null }) => ({
    label: edits[item.id]?.label ?? item.label,
    description: edits[item.id]?.description ?? item.description ?? "",
    notes: edits[item.id]?.notes ?? item.notes ?? "",
  });

  const patchEdit = (
    badgeId: number,
    patch: Partial<{ label: string; description: string; notes: string }>,
    item: { label: string; description?: string | null; notes?: string | null }
  ) => {
    setEdits(prev => ({
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
      <AdminPageHeader
        eyebrow="AI Merchandising"
        title="AI-генерация бейджей"
        description="Здесь агент предлагает бейджи под конкретную категорию. Мы быстро проверяем смысл, корректируем формулировку и решаем, допускать ли их в каталог."
        actions={
          <div className="inline-flex items-center gap-2 rounded-full border border-[#05C3D4]/20 bg-[#F7FEFF] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#0099A8]">
            <Bot size={14} />
            Категорийный режим
          </div>
        }
      />

      <AdminMerchandisingNav />

      <AdminSection
        title="Запустить AI-проход"
        description="Выбери категорию, и агент соберёт полезные, consumer-facing бейджи на основе товаров, описаний, характеристик и частых use-case."
        actions={
          <button
            type="button"
            disabled={generateCategorySuggestions.isPending || !categoryId}
            onClick={() => generateCategorySuggestions.mutate({ categoryId: Number(categoryId) })}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black transition hover:bg-[#04a9b8] disabled:opacity-50"
          >
            <Sparkles size={16} />
            Сгенерировать
          </button>
        }
      >
        <select
          value={categoryId}
          onChange={event => setCategoryId(event.target.value)}
          className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] lg:max-w-md"
        >
          <option value="">Выбери категорию для AI-прохода</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </AdminSection>

      <AdminSection
        title="Предложения агента"
        description="Здесь мы держим человека в контуре: можно подправить label, описание и смысловую заметку перед утверждением."
        tone="subtle"
      >
        <div className="space-y-3">
          {(suggestionsQuery.data ?? []).map(item => {
            const edit = getEdit(item);
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-[#15171A]">{item.code}</span>
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-500">
                    {item.status}
                  </span>
                  <span className="rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">
                    {selectedCategoryName}
                  </span>
                </div>
                <div className="mt-3 grid gap-3">
                  <input
                    value={edit.label}
                    onChange={event => patchEdit(item.id, { label: event.target.value }, item)}
                    className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                  <input
                    value={edit.description}
                    onChange={event => patchEdit(item.id, { description: event.target.value }, item)}
                    placeholder="Описание бейджа"
                    className="h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                  <textarea
                    rows={3}
                    value={edit.notes}
                    onChange={event => patchEdit(item.id, { notes: event.target.value }, item)}
                    placeholder="Почему бейдж полезен для этой категории"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#05C3D4]"
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
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
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
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-50 px-4 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Отклонить
                  </button>
                </div>
              </div>
            );
          })}

          {!categoryId && (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
              Выбери категорию, чтобы запустить AI и увидеть предложения
            </div>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
