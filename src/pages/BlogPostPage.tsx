import { useMemo } from "react";
import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  Loader2,
  ArrowLeft,
  Calendar,
  User,
  AlertCircle,
  Clock3,
  ArrowRight,
} from "lucide-react";
import LeadForm from "@/components/LeadForm";
import { useSeo } from "@/lib/seo";
import {
  buildBreadcrumbStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  getPublicSchemaAddress,
} from "@/lib/seo-structured";
import {
  getKnowledgeCenterPlanForPost,
  getKnowledgeFaqForPost,
} from "@contracts/blog-knowledge-center";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = trpc.blog.getBySlug.useQuery({
    slug: slug || "",
  });
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: relatedPosts = [] } = trpc.blog.getRelated.useQuery(
    {
      id: post?.id ?? 0,
      category: post?.category ?? "",
      limit: 3,
    },
    {
      enabled: Boolean(post?.id && post?.category),
    }
  );
  const knowledgePlan = useMemo(
    () =>
      getKnowledgeCenterPlanForPost({
        slug: post?.slug,
        title: post?.title,
        category: post?.category,
      }),
    [post?.category, post?.slug, post?.title]
  );
  const knowledgeFaq = useMemo(
    () =>
      getKnowledgeFaqForPost({
        slug: post?.slug,
        title: post?.title,
        category: post?.category,
        excerpt: post?.excerpt,
      }),
    [post?.category, post?.excerpt, post?.slug, post?.title]
  );

  const structuredData = useMemo(() => {
    if (!post) return null;

    const faqStructuredData = buildFaqStructuredData(knowledgeFaq);

    return [
      buildBreadcrumbStructuredData([
        { name: "Главная", path: "/" },
        { name: "Блог", path: "/blog" },
        { name: post.title, path: `/blog/${post.slug}` },
      ]),
      buildOrganizationStructuredData({
        name: "ТЕХАКС",
        url: "https://techaks.ru",
        logo: "https://techaks.ru/images/logo-light.svg",
        email: siteProfile?.contacts.email || "tech.aks@yandex.ru",
        phone: siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88",
        address: getPublicSchemaAddress({
          shortAddress: siteProfile?.contacts.shortAddress,
          fullAddress: siteProfile?.contacts.fullAddress,
          legalAddress: siteProfile?.seller.legalAddress,
        }),
      }),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.metaTitle || post.title,
        description: post.metaDescription || post.excerpt,
        image: [post.ogImage || post.image],
        datePublished: new Date(post.publishedAt || post.createdAt).toISOString(),
        dateModified: new Date(post.updatedAt || post.createdAt).toISOString(),
        author: {
          "@type": "Person",
          name: post.authorName || "Редакция ТЕХАКС",
        },
        publisher: {
          "@type": "Organization",
          name: "ТЕХАКС",
          logo: {
            "@type": "ImageObject",
            url: "https://techaks.ru/images/logo-light.svg",
          },
        },
        mainEntityOfPage: `https://techaks.ru/blog/${post.slug}`,
      },
      ...(faqStructuredData ? [faqStructuredData] : []),
    ];
  }, [
    knowledgeFaq,
    post,
    siteProfile?.contacts.email,
    siteProfile?.contacts.fullAddress,
    siteProfile?.contacts.primaryPhoneDisplay,
    siteProfile?.contacts.shortAddress,
    siteProfile?.seller.legalAddress,
  ]);

  useSeo({
    title: post ? `${post.metaTitle || post.title} — Блог ТЕХАКС` : "Блог ТЕХАКС",
    description:
      post?.metaDescription || post?.excerpt || "Полезные статьи и обзоры от ТЕХАКС.",
    canonicalPath: post ? `/blog/${post.slug}` : "/blog",
    image: post?.ogImage || post?.image,
    type: "article",
    structuredData,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <AlertCircle size={64} className="mx-auto text-gray-300" />
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Статья не найдена</h1>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 font-semibold text-[#05C3D4] hover:underline"
          >
            <ArrowLeft size={18} /> Вернуться в блог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <div className="border-b border-border bg-card/70 py-4">
        <div className="container-main flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <Link to="/blog" className="transition-colors hover:text-[#05C3D4]">
            Блог
          </Link>
          <span className="text-foreground/10">/</span>
          <span className="max-w-[220px] truncate text-foreground/70">{post.title}</span>
        </div>
      </div>

      <article className="py-16 md:py-24">
        <div className="container-main max-w-6xl">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <header className="mb-12">
                <span className="mb-6 inline-block rounded-md bg-[#05C3D4]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#05C3D4]">
                  {post.category}
                </span>
                <h1 className="text-4xl font-black uppercase leading-tight tracking-tighter text-foreground md:text-6xl">
                  {post.title}
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
                  {post.excerpt}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-[#05C3D4]" />
                    {new Date(post.publishedAt || post.createdAt).toLocaleDateString(
                      "ru-RU"
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-[#05C3D4]" />
                    {post.authorName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 size={16} className="text-[#05C3D4]" />
                    {post.readingTimeMinutes} мин чтения
                  </div>
                </div>
              </header>

              <div className="group relative mb-14 aspect-[21/9] overflow-hidden rounded-[2.5rem] border border-border shadow-2xl">
                <img
                  src={post.image}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#15171A] to-transparent opacity-30" />
              </div>

              <div className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-a:text-[#05C3D4] prose-img:rounded-[2rem]">
                <div dangerouslySetInnerHTML={{ __html: post.content }} />
              </div>

              <section className="mt-16 rounded-[2.5rem] border border-border bg-card p-8 md:p-10">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
                      Короткий ответ
                    </div>
                    <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">
                      Что важно по этой теме
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                      {knowledgePlan?.shortAnswer || post.excerpt}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] bg-background/80 px-5 py-4 text-sm text-muted-foreground">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#05C3D4]">
                      Материал
                    </div>
                    <div className="mt-2 font-semibold text-foreground">
                      {knowledgePlan?.intent || post.category}
                    </div>
                  </div>
                </div>

                {(knowledgePlan?.categoryLinks?.length || knowledgePlan?.brandLinks?.length) ? (
                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {knowledgePlan?.categoryLinks?.length ? (
                      <div className="rounded-[1.5rem] border border-border bg-background/70 p-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#05C3D4]">
                          Категории по теме
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {knowledgePlan.categoryLinks.map(link => (
                            <Link
                              key={link.href}
                              to={link.href}
                              className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:border-[#05C3D4]/40 hover:text-[#05C3D4]"
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {knowledgePlan?.brandLinks?.length ? (
                      <div className="rounded-[1.5rem] border border-border bg-background/70 p-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#05C3D4]">
                          Бренды и подборки
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {knowledgePlan.brandLinks.map(link => (
                            <Link
                              key={link.href}
                              to={link.href}
                              className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:border-[#05C3D4]/40 hover:text-[#05C3D4]"
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {knowledgeFaq.length > 0 ? (
                <section className="mt-16 rounded-[2.5rem] border border-border bg-card p-8 md:p-10">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
                    FAQ
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">
                    Частые вопросы по теме
                  </h2>
                  <div className="mt-8 space-y-4">
                    {knowledgeFaq.map(item => (
                      <div
                        key={item.question}
                        className="rounded-[1.5rem] border border-border bg-background/70 p-5"
                      >
                        <h3 className="text-base font-black leading-snug text-foreground">
                          {item.question}
                        </h3>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="relative mt-24 overflow-hidden rounded-[2.5rem] border border-border bg-card p-10 md:p-16">
                <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#05C3D4]/5 blur-[100px]" />
                <div className="relative z-10 flex flex-col gap-12 md:flex-row md:items-center">
                  <div className="flex-1">
                    <h2 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">
                      Нужна помощь с выбором?
                    </h2>
                    <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                      Если после статьи остались вопросы по аксессуарам, совместимости
                      или выбору модели — оставьте заявку, и мы подскажем спокойно и
                      по делу.
                    </p>
                  </div>
                  <div className="w-full md:w-[380px]">
                    <LeadForm
                      dark
                      title="ПЕРЕЗВОНИТЕ МНЕ"
                      subtitle="Консультация специалиста ТЕХАКС"
                      buttonText="Оставить заявку"
                      metadata={{ fromPost: post.title, fromPostCategory: post.category }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-border bg-card p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                  О статье
                </div>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div>
                    <div className="font-black uppercase tracking-widest text-foreground">
                      Рубрика
                    </div>
                    <div className="mt-1">{post.category}</div>
                  </div>
                  <div>
                    <div className="font-black uppercase tracking-widest text-foreground">
                      Обновлено
                    </div>
                    <div className="mt-1">
                      {new Date(post.updatedAt || post.createdAt).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                  <div>
                    <div className="font-black uppercase tracking-widest text-foreground">
                      Время чтения
                    </div>
                    <div className="mt-1">{post.readingTimeMinutes} минут</div>
                  </div>
                </div>
              </div>

              {relatedPosts.length > 0 ? (
                <div className="rounded-[2rem] border border-border bg-card p-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                    Читать дальше
                  </div>
                  <div className="mt-5 space-y-5">
                    {relatedPosts.map(item => (
                      <Link
                        key={item.id}
                        to={`/blog/${item.slug}`}
                        className="group block rounded-2xl border border-border p-4 transition-all hover:border-[#05C3D4]/30 hover:bg-background"
                      >
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4]">
                          {item.category}
                        </div>
                        <div className="mt-2 text-sm font-black uppercase leading-snug text-foreground transition-colors group-hover:text-[#05C3D4]">
                          {item.title}
                        </div>
                        <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Читать
                          <ArrowRight size={12} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <Link
                to="/blog"
                className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-[#05C3D4]"
              >
                <ArrowLeft size={16} /> Вернуться в блог
              </Link>
            </aside>
          </div>
        </div>
      </article>
    </div>
  );
}
