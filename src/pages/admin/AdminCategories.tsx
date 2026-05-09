import { Plus, Edit2, Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { CategoryIcon } from "@/lib/category-icons";

export default function AdminCategories() {
  const { data: categories = [], isLoading } =
    trpc.product.getCategories.useQuery();

  if (isLoading) {
    return (
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        <div className="h-64 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  const renderTree = (parentId: number | null = null, level: number = 0) => {
    const children = categories.filter(c => c.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div className={`space-y-2 ${level > 0 ? "mt-2" : ""}`}>
        {children.map(cat => (
          <div key={cat.id}>
            <div
              className={`flex items-center justify-between p-3 rounded-xl hover:bg-gray-100 transition-colors ${level === 0 ? "bg-gray-50" : "bg-transparent border-l-2 border-gray-100"}`}
              style={{ marginLeft: level > 0 ? `${level * 24}px` : "0px" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${level === 0 ? "bg-white text-[#05C3D4] shadow-sm" : "text-gray-400"}`}
                >
                  <CategoryIcon
                    name={cat.name}
                    slug={cat.slug}
                    size={level === 0 ? 18 : 16}
                  />
                </div>
                <div>
                  <div
                    className={`${level === 0 ? "font-bold text-[#0a0a0a]" : "font-medium text-gray-700"}`}
                  >
                    {cat.name}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                    Slug: {cat.slug}
                  </div>
                </div>
              </div>
              <div
                className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity"
                style={{ opacity: 1 /* visible for now */ }}
              >
                <button
                  className="p-1.5 text-gray-400 hover:text-black hover:bg-white rounded-md transition-colors"
                  title="Редактировать"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="p-1.5 text-red-400 hover:text-red-500 hover:bg-white rounded-md transition-colors"
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {renderTree(cat.id, level + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black font-heading tracking-tight text-[#15171A] uppercase">
          Категории
        </h1>
        <button className="flex items-center gap-2 bg-[#05C3D4] hover:bg-[#04a9b8] text-black px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(5,195,212,0.3)]">
          <Plus size={18} />
          Создать категорию
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="space-y-4">
            {categories.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                Категорий пока нет. Запустите синхронизацию или создайте их
                вручную.
              </div>
            ) : (
              renderTree(null, 0)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
