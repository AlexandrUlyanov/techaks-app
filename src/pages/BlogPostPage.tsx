import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Loader2, ArrowLeft, Calendar, User, AlertCircle } from "lucide-react";
import LeadForm from "@/components/LeadForm";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = trpc.blog.getBySlug.useQuery({ slug: slug || "" });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#00bcd4]" size={48} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertCircle size={64} className="mx-auto text-gray-300" />
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Статья не найдена</h1>
          <Link to="/blog" className="inline-flex items-center gap-2 text-[#00bcd4] font-semibold hover:underline">
            <ArrowLeft size={18} /> Вернуться в блог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Breadcrumbs */}
      <div className="bg-gray-50 border-b border-gray-200 py-4">
        <div className="container-main flex items-center gap-2 text-sm text-gray-400">
          <Link to="/blog" className="hover:text-[#00bcd4] transition-colors">Блог</Link>
          <span>/</span>
          <span className="text-[#0a0a0a] truncate">{post.title}</span>
        </div>
      </div>

      <article className="py-12">
        <div className="container-main max-w-4xl">
          <header className="mb-10 text-center">
            <span className="inline-block px-3 py-1 bg-blue-50 text-[#007c91] text-xs font-bold rounded-lg uppercase tracking-widest mb-4">
              {post.category}
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#0a0a0a] leading-tight mb-6">
              {post.title}
            </h1>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar size={18} />
                {new Date(post.createdAt).toLocaleDateString("ru-RU")}
              </div>
              <div className="flex items-center gap-2">
                <User size={18} />
                Редакция ТЕХАКС
              </div>
            </div>
          </header>

          <div className="rounded-3xl overflow-hidden mb-12 aspect-[21/9]">
            <img 
              src={post.image} 
              alt={post.title} 
              className="w-full h-full object-cover"
            />
          </div>

          <div className="prose prose-lg max-w-none prose-headings:text-[#0a0a0a] prose-p:text-gray-600 prose-img:rounded-2xl">
            <div dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br/>') }} />
          </div>

          {/* Form Section */}
          <div className="mt-20 p-10 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-[#0a0a0a] mb-4">Появились вопросы?</h2>
              <p className="text-gray-500">
                Если у вас возникли вопросы по теме статьи или вам нужна помощь в выборе аксессуара — оставьте заявку, и мы свяжемся с вами в течение 15 минут.
              </p>
            </div>
            <div className="w-full md:w-[320px]">
              <LeadForm 
                title="Перезвоните мне"
                subtitle="Консультация специалиста"
                buttonText="Оставить заявку"
                metadata={{ fromPost: post.title }}
              />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
