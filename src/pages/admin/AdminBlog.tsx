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
  Search,
  FileText
} from "lucide-react";
import { toast } from "sonner";

interface Post {
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  published: boolean;
  createdAt?: string;
}

export default function AdminBlog() {
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const utils = trpc.useUtils();
  const { data: posts = [], isLoading } = trpc.blog.getAll.useQuery();
  
  const upsertMutation = trpc.blog.upsert.useMutation({
    onSuccess: () => {
      utils.blog.getAll.invalidate();
      utils.blog.getPublished.invalidate();
      setEditingPost(null);
      toast.success("Статья сохранена");
    },
    onError: (err) => {
      toast.error("Ошибка сохранения: " + err.message);
    }
  });

  const deleteMutation = trpc.blog.delete.useMutation({
    onSuccess: () => {
      utils.blog.getAll.invalidate();
      utils.blog.getPublished.invalidate();
      toast.success("Статья удалена");
    },
    onError: (err) => {
      toast.error("Ошибка удаления: " + err.message);
    }
  });

  // ... (handleFileUpload remains unchanged) ...

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPost) return;

    const formData = new FormData(e.currentTarget);
    const data: Post = {
      slug: formData.get("slug") as string,
      title: formData.get("title") as string,
      excerpt: formData.get("excerpt") as string,
      content: formData.get("content") as string,
      category: formData.get("category") as string,
      image: (formData.get("image") as string) || editingPost.image || "",
      published: formData.get("published") !== null,
    };

    upsertMutation.mutate({
      id: editingPost.id,
      data
    });
  };

  const filteredPosts = posts.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-[#00bcd4]" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-[#0a0a0a]">Управление блогом</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Поиск статей..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#00bcd4] w-64"
            />
          </div>
          <button 
            onClick={() => setEditingPost({})}
            className="flex items-center gap-2 px-4 py-2 bg-[#00bcd4] text-white rounded-lg hover:bg-[#0097a7] transition-colors font-medium"
          >
            <Plus size={18} />
            Написать статью
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-4">Статья</th>
              <th className="px-6 py-4">Категория</th>
              <th className="px-6 py-4">Дата</th>
              <th className="px-6 py-4">Статус</th>
              <th className="px-6 py-4 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPosts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Статей не найдено
                </td>
              </tr>
            ) : filteredPosts.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img src={post.image} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <div className="font-bold text-[#0a0a0a] line-clamp-1">{post.title}</div>
                      <div className="text-xs text-gray-400 font-mono">{post.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-50 text-[#007c91] text-[10px] font-bold uppercase rounded-md">
                    {post.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(post.createdAt).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-6 py-4">
                  {post.published ? (
                    <span className="flex items-center gap-1 text-green-600 text-xs font-bold uppercase">
                      <Eye size={14} /> Опубликовано
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400 text-xs font-bold uppercase">
                      <EyeOff size={14} /> Черновик
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => setEditingPost(post)}
                      className="p-2 text-gray-400 hover:text-[#00bcd4] hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-gray-200 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("Удалить эту статью?")) {
                          deleteMutation.mutate({ id: post.id! });
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-gray-200 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingPost(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#0a0a0a]">
                {editingPost.id ? "Редактировать статью" : "Новая статья"}
              </h2>
              <button onClick={() => setEditingPost(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Заголовок</label>
                    <input name="title" defaultValue={editingPost.title} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Slug (URL)</label>
                    <input name="slug" defaultValue={editingPost.slug} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Категория</label>
                    <select name="category" defaultValue={editingPost.category || "Новости"} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4] bg-white">
                      <option value="Новости">Новости</option>
                      <option value="Обзоры">Обзоры</option>
                      <option value="Советы">Советы</option>
                      <option value="Подборки">Подборки</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Краткое описание (для списка)</label>
                    <textarea name="excerpt" defaultValue={editingPost.excerpt} rows={3} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4] resize-none" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Обложка</label>
                    <div className="flex flex-col gap-3">
                      {editingPost.image && (
                        <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                          <img src={editingPost.image} className="w-full h-full object-cover" alt="Preview" />
                          <button 
                            type="button"
                            onClick={() => setEditingPost({ ...editingPost, image: "" })}
                            className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded-full text-red-500 shadow-sm"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input 
                          name="image" 
                          value={editingPost.image || ""} 
                          onChange={(e) => setEditingPost({ ...editingPost, image: e.target.value })}
                          placeholder="URL изображения..." 
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
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <input 
                      type="checkbox" 
                      name="published" 
                      id="published" 
                      defaultChecked={editingPost.published ?? true} 
                      className="w-5 h-5 text-[#00bcd4] border-gray-300 rounded focus:ring-[#00bcd4]"
                    />
                    <label htmlFor="published" className="text-sm font-bold text-[#0a0a0a] cursor-pointer flex items-center gap-2">
                      <Eye size={16} className="text-[#00bcd4]" /> Опубликовать статью
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Контент статьи (HTML)</label>
                <textarea name="content" defaultValue={editingPost.content} rows={12} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#00bcd4] font-mono text-sm" />
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingPost(null)}
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
                  {editingPost.id ? "Сохранить" : "Опубликовать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
