import { useState } from "react";
import { trpc } from "@/providers/trpc";
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
} from "lucide-react";

export default function AdminProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [editingProduct, setEditingProduct] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: pagedData, isLoading } = trpc.product.getPaginated.useQuery({
    page,
    limit,
    search: searchTerm,
  });

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

  const handleDelete = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот товар?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      slug: formData.get("slug") as string,
      name: formData.get("name") as string,
      categoryId: parseInt(formData.get("categoryId") as string),
      price: parseInt(formData.get("price") as string),
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

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Поиск товаров..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
          />
        </div>
        <button
          onClick={() => setEditingProduct({})}
          className="flex items-center gap-2 px-4 py-2 bg-[#05C3D4] text-white rounded-lg hover:bg-[#0097a7] transition-colors font-medium"
        >
          <Plus size={18} />
          Добавить товар
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
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
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Загрузка...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Товары не найдены
                  </td>
                </tr>
              ) : (
                products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded p-1 flex items-center justify-center">
                          <img
                            src={p.image}
                            alt=""
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <div>
                          <div className="font-medium text-[#0a0a0a]">
                            {p.name}
                          </div>
                          <div className="text-xs text-gray-400">{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {p.categoryName || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-[#0a0a0a]">
                        {p.price} ₽
                      </div>
                      {p.oldPrice && (
                        <div className="text-xs text-gray-400 line-through">
                          {p.oldPrice} ₽
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {p.stocks && p.stocks.length > 0 ? (
                        <div className="space-y-1">
                          {p.stocks.map((s: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-xs flex items-center justify-between gap-2 bg-gray-50 px-2 py-1 rounded"
                            >
                              <span
                                className="text-gray-600 truncate max-w-[120px]"
                                title={s.storeName}
                              >
                                {s.storeName}
                              </span>
                              <span className="font-bold">{s.quantity} шт</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                          <X size={12} /> Нет в наличии
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingProduct(p)}
                          className="p-2 text-gray-400 hover:text-[#05C3D4] hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                        <a
                          href={`/product/${p.slug}`}
                          target="_blank"
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-500">
              Страница {page} из {totalPages} ({pagedData?.total} товаров)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-200 rounded-lg bg-white disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-gray-200 rounded-lg bg-white disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditingProduct(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#0a0a0a]">
                {editingProduct.id ? "Редактировать товар" : "Новый товар"}
              </h2>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Название
                  </label>
                  <input
                    name="name"
                    defaultValue={editingProduct.name}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Slug (ID в URL)
                  </label>
                  <input
                    name="slug"
                    defaultValue={editingProduct.slug}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
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
                    defaultValue={editingProduct.price}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Характеристики (JSON)
                </label>
                <textarea
                  name="specs"
                  defaultValue={JSON.stringify(
                    editingProduct.specs || {},
                    null,
                    2
                  )}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4] font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="inStock"
                  defaultChecked={editingProduct.inStock ?? true}
                  id="inStock"
                />
                <label
                  htmlFor="inStock"
                  className="text-sm font-medium text-gray-700"
                >
                  В наличии
                </label>
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2 bg-[#05C3D4] text-white font-medium rounded-lg hover:bg-[#0097a7] transition-colors disabled:opacity-50"
                >
                  {upsertMutation.isPending && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {editingProduct.id ? "Сохранить изменения" : "Создать товар"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
