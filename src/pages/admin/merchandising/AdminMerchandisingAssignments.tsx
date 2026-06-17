import { useState } from "react";
import { CheckCheck, Sparkles } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";

export default function AdminMerchandisingAssignments() {
  const utils = trpc.useUtils();
  const [categoryId, setCategoryId] = useState("");

  const categoriesQuery = trpc.product.getCategories.useQuery({ includeInactive: true });
  const previewQuery = trpc.merchandising.assignmentPreview.useQuery(
    { categoryId: categoryId ? Number(categoryId) : 0 },
    { enabled: Boolean(categoryId), refetchOnWindowFocus: false }
  );
  const applyAssignments = trpc.merchandising.applyAssignments.useMutation({
    onSuccess: data => {
      toast.success(`Применено назначений: ${data.applied}`);
      utils.merchandising.assignmentPreview.invalidate();
      utils.merchandising.catalog.invalidate();
      utils.merchandising.qualityDashboard.invalidate();
      utils.product.invalidate();
    },
  });

  const categories = categoriesQuery.data ?? [];
  const selectedCategoryName =
    categories.find(category => category.id === Number(categoryId))?.name ?? "категории";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="AI Merchandising"
        title="Назначения бейджей"
        description="Этот экран нужен для последнего sanity check перед массовым применением. Мы видим кандидатов, уверенность и уже существующие назначения."
        actions={
          <button
            type="button"
            disabled={applyAssignments.isPending || !categoryId}
            onClick={() => applyAssignments.mutate({ categoryId: Number(categoryId) })}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#15171A] px-4 text-sm font-black text-white transition hover:bg-black disabled:opacity-50"
          >
            <CheckCheck size={16} />
            Применить назначения
          </button>
        }
      />

      <AdminSection
        title="Выбор категории для preview"
        description="Сначала выбираем категорию, потом проверяем, насколько правила действительно попадают в нужные товары."
      >
        <select
          value={categoryId}
          onChange={event => setCategoryId(event.target.value)}
          className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] lg:max-w-md"
        >
          <option value="">Выбери категорию</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </AdminSection>

      <AdminSection
        title="Превью по бейджам"
        description="Если совпадений мало или объяснение выглядит странно, лучше вернуться на этап AI/review и поправить формулировки или правила."
        tone="subtle"
      >
        <div className="space-y-3">
          {(previewQuery.data ?? []).map(item => (
            <div key={item.badgeId} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-[#15171A]">{item.badgeLabel}</span>
                <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black uppercase text-gray-500">
                  {item.badgeCode}
                </span>
                <span className="rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700">
                  {selectedCategoryName}
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
                      className="flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
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

          {!categoryId && (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
              Выбери категорию, чтобы построить preview назначений
            </div>
          )}
        </div>
      </AdminSection>

      <AdminSection
        title="Что считать нормой"
        description="Полезно держать это рядом, чтобы менеджер не действовал вслепую."
        tone="accent"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Хороший знак", "Есть новые назначения и объяснение совпадает с ожиданием по категории."],
            ["Тревожный знак", "Много товаров с низкой уверенностью или смысл бейджа слишком общий."],
            ["Следующий шаг", "Если preview выглядит хорошо — применяем. Если нет, возвращаемся в AI-генерацию."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl border border-[#05C3D4]/10 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#15171A]">
                <Sparkles size={16} className="text-[#05C3D4]" />
                {title}
              </div>
              <div className="mt-2 text-sm leading-6 text-gray-500">{text}</div>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
