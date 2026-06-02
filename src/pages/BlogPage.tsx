import { useMemo, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Loader2, Calendar, ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { buildBreadcrumbStructuredData } from "@/lib/seo-structured";

export default function BlogPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const { data: categories = [] } = trpc.blog.getCategories.useQuery();
  const { data: featuredPost } = trpc.blog.getFeatured.useQuery();
  const { data: posts = [], isLoading } = trpc.blog.getPublished.useQuery({
    category: categoryFilter || undefined,
  });

  const regularPosts = useMemo(
    () => posts.filter(post => post.id !== featuredPost?.id),
    [featuredPost?.id, posts]
  );

  useSeo({
    title: "Блог ТЕХАКС — обзоры, советы и подборки аксессуаров",
    description:
      "Полезные статьи ТЕХАКС: как выбрать аксессуары, чем отличаются модели, что подойдёт для смартфона, авто и дома.",
    canonicalPath: "/blog",
    type: "website",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", url: "https://techaks.ru/" },
        { name: "Блог", url: "https://techaks.ru/blog" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Блог ТЕХАКС",
        description:
          "Полезные статьи ТЕХАКС: как выбрать аксессуары, чем отличаются модели, что подойдёт для смартфона, авто и дома.",
        url: "https://techaks.ru/blog",
        mainEntity: posts.slice(0, 12).map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `https://techaks.ru/blog/${post.slug}`,
          name: post.title,
        })),
      },
    ],
  });

  return (
    <div className="min-h-screen pb-20 bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border py-20 md:py-28">
        <div className="absolute inset-0 bg-[#15171A]" />
        <div className="absolute right-0 top-0 h-full w-[45%] rounded-full bg-[#05C3D4]/5 blur-[120px]" />
        <div className="container-main relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="mb-4 block text-[10px] font-black uppercase tracking-[0.3em] text-[#05C3D4]">
              Блог ТЕХАКС
            </span>
            <h1 className="text-4xl font-black uppercase leading-none tracking-tighter text-white md:text-6xl lg:text-7xl">
              ПОЛЕЗНЫЕ <span className="text-white/20">МАТЕРИАЛЫ</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg font-medium text-white/50">
              Обзоры, практические советы, подборки и объяснения без воды —
              чтобы покупателю было легче выбрать технику и аксессуары.
            </p>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="container-main">
          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => setCategoryFilter("")}
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                categoryFilter
                  ? "bg-background text-muted-foreground hover:text-[#05C3D4]"
                  : "bg-[#05C3D4] text-black"
              }`}
            >
              Все статьи
            </button>
            {categories.map(item => (
              <button
                key={item.category}
                type="button"
                onClick={() => setCategoryFilter(item.category)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                  categoryFilter === item.category
                    ? "bg-[#05C3D4] text-black"
                    : "bg-background text-muted-foreground hover:text-[#05C3D4]"
                }`}
              >
                {item.category}
                <span className="ml-2 text-[10px] opacity-70">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {featuredPost && !categoryFilter ? (
        <section className="pb-10">
          <div className="container-main">
            <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm lg:grid-cols-[1.15fr_0.85fr]">
              <div className="relative min-h-[320px] overflow-hidden">
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-[#0F131A] via-[#0F131A]/20 to-transparent" />
              </div>
              <div className="flex flex-col justify-between p-8 md:p-10">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#05C3D4]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#05C3D4]">
                    <Sparkles size={12} />
                    Выбор редакции
                  </div>
                  <div className="mb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {featuredPost.category}
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">
                    {featuredPost.title}
                  </h2>
                  <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                    {featuredPost.excerpt}
                  </p>
                </div>
                <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <Calendar size={14} className="text-[#05C3D4]" />
                    {new Date(
                      featuredPost.publishedAt || featuredPost.createdAt
                    ).toLocaleDateString("ru-RU")}
                  </div>
                  <Link
                    to={`/blog/${featuredPost.slug}`}
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#05C3D4] transition-colors hover:text-foreground"
                  >
                    Читать статью
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-12">
        <div className="container-main">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
            </div>
          ) : regularPosts.length === 0 ? (
            <div className="rounded-[2rem] border border-border bg-card py-24 text-center">
              <BookOpen size={64} className="mx-auto mb-6 text-foreground/10" />
              <p className="text-xl font-black uppercase tracking-widest text-foreground/30">
                Статей пока нет
              </p>
              <Link
                to="/catalog"
                className="mt-8 inline-flex items-center gap-3 rounded-xl bg-[#05C3D4] px-8 py-4 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-[#27E6F2]"
              >
                В каталог
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {regularPosts.map(post => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-border bg-card transition-all duration-300 hover:border-[#05C3D4]/30 hover:shadow-xl"
                >
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#15171A]/70 to-transparent opacity-80" />
                    <span className="absolute bottom-6 left-6 rounded-md bg-[#05C3D4] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
                      {post.category}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-8">
                    <h3 className="line-clamp-2 text-xl font-black uppercase leading-tight tracking-tight text-foreground transition-colors group-hover:text-[#05C3D4] md:text-2xl">
                      {post.title}
                    </h3>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-4">
                      {post.excerpt}
                    </p>
                    <div className="mt-8 flex items-center justify-between border-t border-border pt-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-[#05C3D4]" />
                        {new Date(post.publishedAt || post.createdAt).toLocaleDateString(
                          "ru-RU"
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[#05C3D4] transition-all group-hover:gap-4">
                        Читать
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
