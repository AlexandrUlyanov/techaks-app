import React, { useState } from "react";
import { trpc } from "@/providers/trpc";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  X,
  Eye,
  EyeOff,
  GripVertical
} from "lucide-react";
import { toast } from "sonner";

interface Banner {
  id?: number;
  slug: string;
  title: string;
  subtitle: string | null;
  content: string | null;
  image: string;
  link: string | null;
  active: boolean;
  sortOrder: number;
  createdAt?: string;
}

export default function AdminBanners() {
  const [editingBanner, setEditingBanner] = useState<Partial<Banner> | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const utils = trpc.useUtils();
  const { data: banners = [], isLoading } = trpc.banner.getAll.useQuery();
  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: products = [] } = trpc.product.getAll.useQuery();
  
  const upsertMutation = trpc.banner.upsert.useMutation({
    onSuccess: () => {
      utils.banner.getAll.invalidate();
      utils.banner.getActive.invalidate();
      setEditingBanner(null);
      toast.success("Акция сохранена");
    }
  });

  const deleteMutation = trpc.banner.delete.useMutation({
    onSuccess: () => {
      utils.banner.getAll.invalidate();
      utils.banner.getActive.invalidate();
      toast.success("Акция удалена");
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setEditingBanner(prev => prev ? { ...prev, image: data.url } : { image: data.url });
        toast.success("Изображение загружено");
      } else {
        throw new Error(data.error || "Ошибка загрузки");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBanner) return;

    const formData = new FormData(e.currentTarget);
    const data: Banner = {
      slug: formData.get("slug") as string,
      title: formData.get("title") as string,
      subtitle: (formData.get("subtitle") as string) || null,
      content: (formData.get("content") as string) || null,
      image: (formData.get("image") as string) || editingBanner.image || "",
      link: (formData.get("link") as string) || null,
      active: formData.get("active") === "on",
      sortOrder: parseInt(formData.get("sortOrder") as string || "0"),
    };

    upsertMutation.mutate({
      id: editingBanner.id,
      data
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-[#00bcd4]" size={48} />
      </div>
    );
  }

  const linkOptions = [
    { label: "Без ссылки", value: "" },
    { label: "--- Категории ---", value: "", disabled: true },
    ...categories.map(c => ({ label: `Каталог: ${c.name}`, value: `/catalog?cat=${c.slug}` })),
    { label: "--- Товары ---", value: "", disabled: true },
    ...products.map(p => ({ label: `Товар: ${p.name}`, value: `/product/${p.slug}` })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#0a0a0a]">Управление акциями</h2>
        <button 
          onClick={() => setEditingBanner({})}
          className="flex items-center gap-2 px-4 py-2 bg-[#00bcd4] text-white rounded-lg hover:bg-[#0097a7] transition-colors font-medium"
        >
          <Plus size={18} />
          Добавить акцию
        </button>
      </div>

      {/* ... (rest of banner list) ... */}
        {banners.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
            Акций пока нет
          </div>
        ) : banners.map((banner) => (
          <div key={banner.id} className={`bg-white border rounded-2xl overflow-hidden flex flex-col md:flex-row ${!banner.active ? 'opacity-60 grayscale' : 'border-gray-200'}`}>
            <div className="md:w-72 h-48 md:h-auto bg-gray-100 flex-shrink-0">
              <img src={banner.image} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xl text-[#0a0a0a]">{banner.title}</h3>
                    {!banner.active && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase rounded">
                        <EyeOff size={10} /> Черновик
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-mono">#{banner.id}</span>
                </div>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{banner.subtitle}</p>
                {banner.link && (
                  <div className="text-xs text-[#00bcd4] font-medium truncate bg-blue-50 px-2 py-1 rounded inline-block">
                    Ссылка: {banner.link}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <GripVertical size={14} />
                    Порядок: {banner.sortOrder}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setEditingBanner(banner)}
                    className="p-2 text-gray-400 hover:text-[#00bcd4] hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm("Удалить эту акцию?")) {
                        deleteMutation.mutate({ id: banner.id });
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingBanner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingBanner(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#0a0a0a]">
                {editingBanner.id ? "Редактировать акцию" : "Новая акция"}
              </h2>
              <button onClick={() => setEditingBanner(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Заголовок</label>
                  <input name="title" defaultValue={editingBanner.title} placeholder="Например: Скидка 20% на все чехлы" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4]" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Slug (URL акции)</label>
                  <input name="slug" defaultValue={editingBanner.slug} placeholder="skidka-20-cases" required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4]" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Краткое описание (подзаголовок)</label>
                <textarea name="subtitle" defaultValue={editingBanner.subtitle} rows={2} placeholder="Краткое описание акции для списка..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4] resize-none" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Полный текст акции (HTML поддерживается)</label>
                <textarea name="content" defaultValue={editingBanner.content} rows={6} placeholder="Подробные условия, текст, списки..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4] font-mono text-sm" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Изображение</label>
                <div className="flex flex-col gap-3">
                  {editingBanner.image && (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                      <img src={editingBanner.image} className="w-full h-full object-contain" alt="Preview" />
                      <button 
                        type="button"
                        onClick={() => setEditingBanner({ ...editingBanner, image: "" })}
                        className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded-full text-red-500 shadow-sm"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input 
                      name="image" 
                      value={editingBanner.image || ""} 
                      onChange={(e) => setEditingBanner({ ...editingBanner, image: e.target.value })}
                      placeholder="URL изображения или загрузите файл" 
                      required 
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4]" 
                    />
                    <label className="flex items-center justify-center px-4 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors border border-gray-200">
                      {uploading ? <Loader2 size={18} className="animate-spin text-gray-500" /> : <Plus size={18} className="text-gray-500" />}
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Ссылка (из каталога)</label>
                  <select 
                    name="link" 
                    defaultValue={editingBanner.link || ""} 
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4] bg-white"
                  >
                    {linkOptions.map((opt, i) => (
                      <option key={i} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Порядок</label>
                  <input name="sortOrder" type="number" defaultValue={editingBanner.sortOrder || 0} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4]" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <input 
                  type="checkbox" 
                  name="active" 
                  id="active" 
                  defaultChecked={editingBanner.active ?? true} 
                  className="w-5 h-5 text-[#00bcd4] border-gray-300 rounded focus:ring-[#00bcd4]"
                />
                <label htmlFor="active" className="text-sm font-bold text-[#0a0a0a] cursor-pointer flex items-center gap-2">
                  <Eye size={16} className="text-[#00bcd4]" /> Акция активна и видна на сайте
                </label>
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingBanner(null)}
                  className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="flex items-center gap-2 px-8 py-2.5 bg-[#00bcd4] text-white font-bold rounded-xl hover:bg-[#0097a7] transition-colors disabled:opacity-50"
                >
                  {upsertMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  {editingBanner.id ? "Сохранить" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
