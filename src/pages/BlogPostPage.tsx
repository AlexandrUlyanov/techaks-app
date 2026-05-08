import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Loader2, ArrowLeft, Calendar, User, AlertCircle } from "lucide-react";
import LeadForm from "@/components/LeadForm";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = trpc.blog.getBySlug.useQuery({
    slug: slug || "",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertCircle size={64} className="mx-auto text-gray-300" />
          <h1 className="text-2xl font-bold text-[#0a0a0a]">
            Статья не найдена
          </h1>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-[#05C3D4] font-semibold hover:underline"
          >
            <ArrowLeft size={18} /> Вернуться в блог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-background text-foreground">
      {/* Breadcrumbs */}
      <div className="bg-white/5 border-b border-white/5 py-4">
        <div className="container-main flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30">
          <Link to="/blog" className="hover:text-[#05C3D4] transition-colors">
            Блог
          </Link>
          <span className="text-white/10">/</span>
          <span className="text-white/60 truncate max-w-[200px]">
            {post.title}
          </span>
        </div>
      </div>

      <article className="py-16 md:py-24">
        <div className="container-main max-w-4xl">
          <header className="mb-16 text-center">
            <span className="inline-block px-3 py-1 bg-[#05C3D4]/10 text-[#05C3D4] text-[10px] font-black uppercase tracking-widest rounded-md mb-6">
              {post.category}
            </span>
            <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-tight tracking-tighter text-white mb-8">
              {post.title}
            </h1>
            <div className="flex items-center justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-white/20">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#05C3D4]" />
                {new Date(post.createdAt).toLocaleDateString("ru-RU")}
              </div>
              <div className="flex items-center gap-2">
                <User size={16} className="text-[#05C3D4]" />
                Редакция ТЕХАКС
              </div>
            </div>
          </header>

          <div className="rounded-[2.5rem] overflow-hidden mb-16 border border-white/5 aspect-[21/9] shadow-2xl relative group">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#15171A] to-transparent opacity-40" />
          </div>

          <div className="prose prose-invert prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:font-heading prose-headings:tracking-tighter prose-p:text-white/50 prose-p:leading-relaxed prose-strong:text-white prose-img:rounded-[2rem] prose-a:text-[#05C3D4]">
            <div
              dangerouslySetInnerHTML={{
                __html: post.content.replace(/\n/g, "<br/>"),
              }}
            />
          </div>

          {/* Form Section */}
          <div className="mt-32 p-10 md:p-16 bg-[#24272B] rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#05C3D4]/5 blur-[100px] rounded-full" />
            <div className="flex-1 relative z-10">
              <h2 className="text-3xl md:text-4xl font-black uppercase font-heading tracking-tight text-white mb-6">
                Остались вопросы?
              </h2>
              <p className="text-white/40 font-medium leading-relaxed text-lg">
                Если вам нужна помощь в выборе аксессуара или консультация по
                теме статьи — оставьте заявку, и мы свяжемся с вами за 5 минут.
              </p>
            </div>
            <div className="w-full md:w-[380px] relative z-10">
              <LeadForm
                dark
                title="ПЕРЕЗВОНИТЕ МНЕ"
                subtitle="Консультация специалиста ТЕХАКС"
                buttonText="Оставить заявку"
                metadata={{ fromPost: post.title }}
              />
            </div>
          </div>

          <div className="mt-16 text-center">
            <Link
              to="/blog"
              className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-[#05C3D4] transition-colors"
            >
              <ArrowLeft size={16} /> Вернуться в блог
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
