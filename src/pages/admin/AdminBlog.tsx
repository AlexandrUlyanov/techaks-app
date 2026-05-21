import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Bot,
  Calendar,
  Check,
  Eye,
  EyeOff,
  FilePenLine,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { slugifyBlogTitle } from "@/lib/blog-formatters";

type BlogStatus = "draft" | "scheduled" | "published" | "archived";
type AiMode =
  | "title"
  | "excerpt"
  | "outline"
  | "seo"
  | "rewrite"
  | "ideas"
  | "internal_links";

type PostRecord = {
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  contentFormat: string;
  category: string;
  image: string;
  ogImage?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  authorName?: string | null;
  status: string;
  featured: boolean;
  readingTimeMinutes: number;
  published: boolean;
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date;
};

type BlogDraft = {
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  ogImage: string;
  metaTitle: string;
  metaDescription: string;
  authorName: string;
  status: BlogStatus;
  featured: boolean;
  publishedAt: string;
};

type AiSuggestionItem = {
  suggestionType: string;
  content: string;
  metadataJson?: Record<string, unknown> | null;
};

const DEFAULT_DRAFT: BlogDraft = {
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  category: "Советы",
  image: "",
  ogImage: "",
  metaTitle: "",
  metaDescription: "",
  authorName: "Редакция ТЕХАКС",
  status: "draft",
  featured: false,
  publishedAt: "",
};

const CATEGORY_OPTIONS = ["Новости", "Обзоры", "Советы", "Подборки", "Гайды"];

function formatStatus(status: BlogStatus) {
  switch (status) {
    case "published":
      return "Опубликовано";
    case "scheduled":
      return "Запланировано";
    case "archived":
      return "Архив";
    default:
      return "Черновик";
  }
}

function statusTone(status: BlogStatus) {
  switch (status) {
    case "published":
      return "text-green-600 bg-green-50";
    case "scheduled":
      return "text-amber-700 bg-amber-50";
    case "archived":
      return "text-slate-600 bg-slate-100";
    default:
      return "text-gray-500 bg-gray-100";
  }
}

function normalizeDraftFromPost(post?: Partial<PostRecord> | null): BlogDraft {
  if (!post) return { ...DEFAULT_DRAFT };
  const publishedAt =
    post.publishedAt instanceof Date
      ? post.publishedAt.toISOString().slice(0, 16)
      : typeof post.publishedAt === "string" && post.publishedAt
        ? new Date(post.publishedAt).toISOString().slice(0, 16)
        : "";

  return {
    id: post.id,
    slug: post.slug || "",
    title: post.title || "",
    excerpt: post.excerpt || "",
    content: post.content || "",
    category: post.category || "Советы",
    image: post.image || "",
    ogImage: post.ogImage || post.image || "",
    metaTitle: post.metaTitle || post.title || "",
    metaDescription: post.metaDescription || post.excerpt || "",
    authorName: post.authorName || "Редакция ТЕХАКС",
    status: normalizeStatus(post.status),
    featured: Boolean(post.featured),
    publishedAt,
  };
}

function normalizeStatus(status?: string | null): BlogStatus {
  if (status === "scheduled" || status === "published" || status === "archived") {
    return status;
  }

  return "draft";
}

function normalizeSuggestionItem(item: {
  suggestionType: string;
  content: string;
  metadataJson?: unknown;
}): AiSuggestionItem {
  return {
    suggestionType: item.suggestionType,
    content: item.content,
    metadataJson:
      item.metadataJson && typeof item.metadataJson === "object"
        ? (item.metadataJson as Record<string, unknown>)
        : null,
  };
}

export default function AdminBlog() {
  const [editingPost, setEditingPost] = useState<BlogDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlogStatus | "all">("all");
  const [previewMode, setPreviewMode] = useState<"editor" | "article" | "card">("editor");
  const [aiMode, setAiMode] = useState<AiMode>("title");
  const [localSuggestions, setLocalSuggestions] = useState<AiSuggestionItem[]>([]);

  const utils = trpc.useUtils();
  const { data: posts = [], isLoading } = trpc.blog.getAll.useQuery();
  const { data: aiSuggestions = [] } = trpc.blog.listAiSuggestions.useQuery(
    { postId: editingPost?.id },
    { enabled: Boolean(editingPost) }
  );

  const upsertMutation = trpc.blog.upsert.useMutation({
    onSuccess: () => {
      utils.blog.getAll.invalidate();
      utils.blog.getPublished.invalidate();
      utils.blog.getFeatured.invalidate();
      utils.blog.getCategories.invalidate();
      setEditingPost(null);
      setLocalSuggestions([]);
      toast.success("Статья сохранена");
    },
    onError: err => {
      toast.error("Ошибка сохранения: " + err.message);
    },
  });

  const deleteMutation = trpc.blog.delete.useMutation({
    onSuccess: () => {
      utils.blog.getAll.invalidate();
      utils.blog.getPublished.invalidate();
      utils.blog.getFeatured.invalidate();
      utils.blog.getCategories.invalidate();
      toast.success("Статья удалена");
    },
    onError: err => {
      toast.error("Ошибка удаления: " + err.message);
    },
  });

  const generateAiMutation = trpc.blog.generateAiSuggestions.useMutation({
    onSuccess: data => {
      setLocalSuggestions(data.suggestions);
      utils.blog.listAiSuggestions.invalidate();
      toast.success("AI-помощник подготовил предложения");
    },
    onError: err => {
      toast.error("AI не смог подготовить предложения: " + err.message);
    },
  });

  const markAppliedMutation = trpc.blog.markAiSuggestionsApplied.useMutation({
    onSuccess: () => utils.blog.listAiSuggestions.invalidate(),
  });

  useEffect(() => {
    if (!editingPost) {
      setLocalSuggestions([]);
      setPreviewMode("editor");
      setAiMode("title");
    }
  }, [editingPost]);

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const matchesSearch =
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : post.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [posts, searchQuery, statusFilter]);

  const previewTitle = editingPost?.metaTitle?.trim() || editingPost?.title || "Заголовок статьи";
  const previewDescription =
    editingPost?.metaDescription?.trim() ||
    editingPost?.excerpt ||
    "Краткое описание статьи для превью.";

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
        setEditingPost(prev =>
          prev
            ? {
                ...prev,
                image: data.url,
                ogImage: prev.ogImage || data.url,
              }
            : null
        );
        toast.success("Изображение загружено");
      } else {
        throw new Error(data.error || "Ошибка загрузки");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPost) return;

    upsertMutation.mutate({
      id: editingPost.id,
      data: {
        slug: editingPost.slug,
        title: editingPost.title,
        excerpt: editingPost.excerpt,
        content: editingPost.content,
        category: editingPost.category,
        image: editingPost.image,
        ogImage: editingPost.ogImage,
        metaTitle: editingPost.metaTitle,
        metaDescription: editingPost.metaDescription,
        authorName: editingPost.authorName,
        status: editingPost.status,
        featured: editingPost.featured,
        publishedAt: editingPost.publishedAt
          ? new Date(editingPost.publishedAt).toISOString()
          : null,
      },
    });
  };

  const runAi = () => {
    if (!editingPost) return;
    if (!editingPost.title.trim()) {
      toast.error("Сначала нужен хотя бы рабочий заголовок статьи.");
      return;
    }

    generateAiMutation.mutate({
      postId: editingPost.id,
      mode: aiMode,
      title: editingPost.title,
      excerpt: editingPost.excerpt,
      content: editingPost.content,
      category: editingPost.category,
      metaTitle: editingPost.metaTitle,
      metaDescription: editingPost.metaDescription,
      slug: editingPost.slug,
      featured: editingPost.featured,
      status: editingPost.status,
    });
  };

  const combinedSuggestions: AiSuggestionItem[] =
    localSuggestions.length > 0
      ? localSuggestions
      : aiSuggestions.map(normalizeSuggestionItem);

  const applySuggestion = (item: AiSuggestionItem) => {
    if (!editingPost) return;

    const next = { ...editingPost };
    if (item.suggestionType === "title" || item.suggestionType === "idea_title") {
      next.title = item.content;
      if (!next.slug || next.slug === slugifyBlogTitle(editingPost.title)) {
        next.slug = slugifyBlogTitle(item.content);
      }
      if (!next.metaTitle) next.metaTitle = item.content;
    } else if (item.suggestionType === "slug") {
      next.slug = slugifyBlogTitle(item.content);
    } else if (item.suggestionType === "excerpt") {
      next.excerpt = item.content;
      if (!next.metaDescription) next.metaDescription = item.content;
    } else if (item.suggestionType === "rewrite") {
      next.content = item.content;
    } else if (item.suggestionType === "outline") {
      const block = item.content
        .split("\n")
        .filter(Boolean)
        .map(line => `<h2>${line.replace(/^[•\-0-9.\s]+/, "").trim()}</h2>\n<p></p>`)
        .join("\n\n");
      next.content = next.content ? `${next.content}\n\n${block}` : block;
    } else if (item.suggestionType === "seo_title") {
      next.metaTitle = item.content;
    } else if (item.suggestionType === "seo_description") {
      next.metaDescription = item.content;
    } else if (item.suggestionType === "cta") {
      next.content = `${next.content}\n\n<p><strong>${item.content}</strong></p>`;
    } else if (item.suggestionType === "internal_link") {
      const url =
        item.metadataJson && typeof item.metadataJson.url === "string"
          ? item.metadataJson.url
          : "";
      next.content = url
        ? `${next.content}\n\n<p><strong>Сюда можно добавить внутреннюю ссылку:</strong> <a href="${url}">${item.content}</a></p>`
        : `${next.content}\n\n<p><strong>Сюда можно добавить внутреннюю ссылку:</strong> ${item.content}</p>`;
    } else if (item.suggestionType === "idea") {
      next.title = item.content;
      next.slug = slugifyBlogTitle(item.content);
    }

    setEditingPost(next);

    const matchedIds = aiSuggestions
      .filter(suggestion => suggestion.suggestionType === item.suggestionType && suggestion.content === item.content)
      .map(suggestion => suggestion.id);
    if (matchedIds.length > 0) {
      markAppliedMutation.mutate({ ids: matchedIds });
    }

    toast.success("Предложение применено к черновику");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0a0a0a]">Управление блогом</h2>
          <p className="mt-1 text-sm text-gray-500">
            Здесь мы ведём редакционный контур блога: статьи, SEO и AI-помощник.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Поиск статей..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-64 rounded-lg border border-gray-200 py-2 pl-10 pr-4 outline-none focus:border-[#05C3D4]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as BlogStatus | "all")}
            className="rounded-lg border border-gray-200 px-4 py-2 outline-none focus:border-[#05C3D4]"
          >
            <option value="all">Все статусы</option>
            <option value="draft">Черновики</option>
            <option value="scheduled">Запланировано</option>
            <option value="published">Опубликовано</option>
            <option value="archived">Архив</option>
          </select>

          <button
            onClick={() => setEditingPost({ ...DEFAULT_DRAFT })}
            className="flex items-center gap-2 rounded-lg bg-[#05C3D4] px-4 py-2 font-medium text-white transition-colors hover:bg-[#0097a7]"
          >
            <Plus size={18} />
            Написать статью
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
              <th className="px-6 py-4">Статья</th>
              <th className="px-6 py-4">Категория</th>
              <th className="px-6 py-4">Дата</th>
              <th className="px-6 py-4">Статус</th>
              <th className="px-6 py-4">AI/SEO</th>
              <th className="px-6 py-4 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Статей не найдено
                </td>
              </tr>
            ) : (
              filteredPosts.map(post => (
                <tr key={post.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <img src={post.image} className="h-full w-full object-cover" alt="" />
                      </div>
                      <div>
                        <div className="line-clamp-1 font-bold text-[#0a0a0a]">{post.title}</div>
                        <div className="text-xs font-mono text-gray-400">{post.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase text-[#0099A8]">
                      {post.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(post.publishedAt || post.createdAt || new Date()).toLocaleDateString(
                      "ru-RU"
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase ${statusTone(
                        normalizeStatus(post.status)
                      )}`}
                    >
                      {post.status === "published" ? <Eye size={14} /> : <EyeOff size={14} />}
                      {formatStatus(normalizeStatus(post.status))}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {post.featured ? (
                        <span className="rounded-full bg-[#05C3D4]/10 px-2 py-1 font-bold text-[#0099A8]">
                          Featured
                        </span>
                      ) : null}
                      <span className="rounded-full bg-gray-100 px-2 py-1">
                        SEO {post.metaTitle ? "готово" : "черновик"}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1">
                        {post.readingTimeMinutes} мин
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingPost(normalizeDraftFromPost(post))}
                        className="rounded-lg border border-transparent p-2 text-gray-400 transition-all hover:border-gray-200 hover:bg-white hover:text-[#05C3D4] hover:shadow-sm"
                      >
                        <PencilLine size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Удалить эту статью?")) {
                            deleteMutation.mutate({ id: post.id! });
                          }
                        }}
                        className="rounded-lg border border-transparent p-2 text-gray-400 transition-all hover:border-gray-200 hover:bg-white hover:text-red-500 hover:shadow-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingPost(null)} />
          <div className="relative max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#0a0a0a]">
                  {editingPost.id ? "Редактировать статью" : "Новая статья"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Пишем материал, настраиваем SEO и можем звать AI-помощника на
                  конкретные куски работы.
                </p>
              </div>
              <button
                onClick={() => setEditingPost(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-6 border-r border-gray-200 p-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <Field label="Заголовок">
                      <div className="flex gap-2">
                        <input
                          value={editingPost.title}
                          onChange={e =>
                            setEditingPost(prev => (prev ? { ...prev, title: e.target.value } : prev))
                          }
                          required
                          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditingPost(prev =>
                              prev
                                ? {
                                    ...prev,
                                    slug: slugifyBlogTitle(prev.title),
                                    metaTitle: prev.metaTitle || prev.title,
                                  }
                                : prev
                            )
                          }
                          className="rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-500 hover:border-[#05C3D4] hover:text-[#05C3D4]"
                        >
                          slug
                        </button>
                      </div>
                    </Field>

                    <Field label="Slug (URL)">
                      <input
                        value={editingPost.slug}
                        onChange={e =>
                          setEditingPost(prev => (prev ? { ...prev, slug: e.target.value } : prev))
                        }
                        required
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                      />
                    </Field>

                    <Field label="Категория">
                      <select
                        value={editingPost.category}
                        onChange={e =>
                          setEditingPost(prev =>
                            prev ? { ...prev, category: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                      >
                        {CATEGORY_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Автор">
                      <input
                        value={editingPost.authorName}
                        onChange={e =>
                          setEditingPost(prev =>
                            prev ? { ...prev, authorName: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                      />
                    </Field>
                  </div>

                  <div className="space-y-4">
                    <Field label="Обложка">
                      <div className="flex flex-col gap-3">
                        {editingPost.image ? (
                          <div className="relative h-40 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                            <img
                              src={editingPost.image}
                              className="h-full w-full object-cover"
                              alt="Preview"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingPost(prev => (prev ? { ...prev, image: "" } : prev))}
                              className="absolute right-2 top-2 rounded-full bg-white/80 p-1 text-red-500 shadow-sm hover:bg-white"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          <input
                            value={editingPost.image}
                            onChange={e =>
                              setEditingPost(prev =>
                                prev ? { ...prev, image: e.target.value } : prev
                              )
                            }
                            placeholder="URL изображения..."
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                            required
                          />
                          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 transition-colors hover:bg-gray-200">
                            {uploading ? (
                              <Loader2 size={18} className="animate-spin text-gray-500" />
                            ) : (
                              <Plus size={18} className="text-gray-500" />
                            )}
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleFileUpload}
                              disabled={uploading}
                            />
                          </label>
                        </div>
                      </div>
                    </Field>

                    <Field label="OG image">
                      <input
                        value={editingPost.ogImage}
                        onChange={e =>
                          setEditingPost(prev =>
                            prev ? { ...prev, ogImage: e.target.value } : prev
                          )
                        }
                        placeholder="Если пусто, возьмём обложку статьи"
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                      />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field label="Статус">
                        <select
                          value={editingPost.status}
                          onChange={e =>
                            setEditingPost(prev =>
                              prev
                                ? { ...prev, status: e.target.value as BlogStatus }
                                : prev
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                        >
                          <option value="draft">Черновик</option>
                          <option value="scheduled">Запланировано</option>
                          <option value="published">Опубликовано</option>
                          <option value="archived">Архив</option>
                        </select>
                      </Field>
                      <Field label="Публикация">
                        <input
                          type="datetime-local"
                          value={editingPost.publishedAt}
                          onChange={e =>
                            setEditingPost(prev =>
                              prev ? { ...prev, publishedAt: e.target.value } : prev
                            )
                          }
                          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                        />
                      </Field>
                    </div>

                    <label className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                      <input
                        type="checkbox"
                        checked={editingPost.featured}
                        onChange={e =>
                          setEditingPost(prev =>
                            prev ? { ...prev, featured: e.target.checked } : prev
                          )
                        }
                        className="h-5 w-5 rounded border-gray-300 text-[#05C3D4] focus:ring-[#05C3D4]"
                      />
                      <span className="text-sm font-bold text-[#0a0a0a]">
                        Показывать как featured / выбор редакции
                      </span>
                    </label>
                  </div>
                </div>

                <Field label="Краткое описание">
                  <textarea
                    value={editingPost.excerpt}
                    onChange={e =>
                      setEditingPost(prev =>
                        prev ? { ...prev, excerpt: e.target.value } : prev
                      )
                    }
                    rows={4}
                    required
                    className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Field label={`Meta title (${editingPost.metaTitle.length}/255)`}>
                    <input
                      value={editingPost.metaTitle}
                      onChange={e =>
                        setEditingPost(prev =>
                          prev ? { ...prev, metaTitle: e.target.value } : prev
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                    />
                  </Field>
                  <Field label={`Meta description (${editingPost.metaDescription.length}/320)`}>
                    <textarea
                      value={editingPost.metaDescription}
                      onChange={e =>
                        setEditingPost(prev =>
                          prev ? { ...prev, metaDescription: e.target.value } : prev
                        )
                      }
                      rows={3}
                      className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-[#05C3D4]"
                    />
                  </Field>
                </div>

                <Field label="Контент статьи (HTML или аккуратный текст с абзацами)">
                  <textarea
                    value={editingPost.content}
                    onChange={e =>
                      setEditingPost(prev =>
                        prev ? { ...prev, content: e.target.value } : prev
                      )
                    }
                    rows={18}
                    required
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm outline-none focus:border-[#05C3D4]"
                  />
                </Field>

                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-500">
                    Preview SEO: <span className="font-semibold">{previewTitle}</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingPost(null)}
                      className="rounded-xl px-6 py-2.5 font-bold text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={upsertMutation.isPending}
                      className="flex items-center gap-2 rounded-xl bg-[#05C3D4] px-8 py-2.5 font-bold text-white transition-colors hover:bg-[#0097a7] disabled:opacity-50"
                    >
                      {upsertMutation.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      {editingPost.id ? "Сохранить статью" : "Создать статью"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6 bg-[#fafafa] p-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-[#0a0a0a]">Preview</div>
                      <div className="text-xs text-gray-500">
                        Смотрим, как статья читается до публикации.
                      </div>
                    </div>
                    <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                      {[
                        ["editor", "SEO"],
                        ["article", "Статья"],
                        ["card", "Карточка"],
                      ].map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPreviewMode(mode as typeof previewMode)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                            previewMode === mode
                              ? "bg-[#05C3D4] text-white"
                              : "text-gray-500 hover:text-[#05C3D4]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {previewMode === "editor" ? (
                    <div className="space-y-3">
                      <div className="text-sm text-[#1a0dab]">{previewTitle}</div>
                      <div className="text-xs text-[#006621]">
                        https://techaks.ru/blog/{editingPost.slug || "slug-stati"}
                      </div>
                      <div className="text-sm text-gray-600">{previewDescription}</div>
                    </div>
                  ) : previewMode === "card" ? (
                    <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm">
                      {editingPost.image ? (
                        <img
                          src={editingPost.image}
                          alt=""
                          className="h-44 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-44 items-center justify-center bg-gray-100 text-sm text-gray-400">
                          Обложка статьи
                        </div>
                      )}
                      <div className="p-5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4]">
                          {editingPost.category}
                        </div>
                        <div className="mt-3 text-lg font-black uppercase leading-snug text-[#0a0a0a]">
                          {editingPost.title || "Заголовок статьи"}
                        </div>
                        <div className="mt-3 text-sm leading-relaxed text-gray-500">
                          {editingPost.excerpt || "Краткое описание статьи"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4]">
                        {editingPost.category}
                      </div>
                      <div className="text-2xl font-black uppercase leading-tight text-[#0a0a0a]">
                        {editingPost.title || "Заголовок статьи"}
                      </div>
                      <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={14} />
                          {editingPost.publishedAt
                            ? new Date(editingPost.publishedAt).toLocaleDateString("ru-RU")
                            : "дата публикации"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FilePenLine size={14} />
                          {editingPost.authorName}
                        </span>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-600">
                        {editingPost.content ? (
                          <div dangerouslySetInnerHTML={{ __html: editingPost.content }} />
                        ) : (
                          <span>Черновик статьи появится здесь.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Bot size={18} className="text-[#05C3D4]" />
                    <div>
                      <div className="text-sm font-bold text-[#0a0a0a]">AI-помощник</div>
                      <div className="text-xs text-gray-500">
                        Помогает с заголовком, структурой, SEO и идеями, но ничего не публикует сам.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["title", "Заголовки"],
                      ["excerpt", "Excerpt"],
                      ["outline", "Структура"],
                      ["seo", "SEO"],
                      ["rewrite", "Переписать"],
                      ["ideas", "Идеи"],
                      ["internal_links", "Связки"],
                    ].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAiMode(mode as AiMode)}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                          aiMode === mode
                            ? "border-[#05C3D4] bg-[#05C3D4]/10 text-[#0099A8]"
                            : "border-gray-200 text-gray-500 hover:border-[#05C3D4]/30 hover:text-[#05C3D4]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={runAi}
                    disabled={generateAiMutation.isPending}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F131A] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1a2029] disabled:opacity-60"
                  >
                    {generateAiMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Wand2 size={16} />
                    )}
                    Запустить AI-проход
                  </button>

                  <div className="mt-5 space-y-3">
                    {combinedSuggestions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                        Здесь появятся предложения AI по текущему черновику.
                      </div>
                    ) : (
                      combinedSuggestions.map((item, index) => (
                        <div
                          key={`${item.suggestionType}-${item.content}-${index}`}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                        >
                          {(() => {
                            const reason =
                              item.metadataJson && typeof item.metadataJson.reason === "string"
                                ? item.metadataJson.reason
                                : "";
                            const url =
                              item.metadataJson && typeof item.metadataJson.url === "string"
                                ? item.metadataJson.url
                                : "";
                            const entityType =
                              item.metadataJson && typeof item.metadataJson.entityType === "string"
                                ? item.metadataJson.entityType
                                : "";

                            return (
                              <>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4]">
                              {item.suggestionType}
                            </div>
                            <button
                              type="button"
                              onClick={() => applySuggestion(item)}
                              className="text-xs font-bold text-[#0099A8] hover:underline"
                            >
                              Применить
                            </button>
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                            {item.content}
                          </div>
                          {reason ? (
                            <div className="mt-3 text-xs text-gray-500">Причина: {reason}</div>
                          ) : null}
                          {url ? (
                            <div className="mt-2 text-xs text-gray-500">
                              URL:{" "}
                              <span className="font-mono text-[#0099A8]">
                                {url}
                              </span>
                              {entityType ? ` (${entityType})` : ""}
                            </div>
                          ) : null}
                              </>
                            );
                          })()}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
