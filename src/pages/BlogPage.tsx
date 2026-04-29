import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Loader2, Calendar, User, ArrowRight, BookOpen } from "lucide-react";

export default function BlogPage() {
  const { data: posts = [], isLoading } = trpc.blog.getPublished.useQuery();

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <section className="bg-[#003238] py-16 text-center">
        <div className="container-main">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white">
            Блог и новости
          </h1>
          <p className="mt-4 text-white/70 max-w-2xl mx-auto">
            Обзоры новинок, советы по выбору аксессуаров и последние новости магазинов ТЕХАКС
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="py-16">
        <div className="container-main">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#00bcd4]" size={48} />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Статей пока нет, но мы скоро что-нибудь напишем!</p>
              <Link to="/catalog" className="mt-6 inline-flex text-[#00bcd4] hover:underline font-semibold">
                В каталог товаров
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link 
                  key={post.id} 
                  to={`/blog/${post.slug}`}
                  className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full"
                >
                  <div className="h-56 overflow-hidden bg-gray-100">
                    <img 
                      src={post.image} 
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-[#007c91] mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest">{post.category}</span>
                    </div>
                    <h3 className="text-xl font-bold text-[#0a0a0a] mb-3 group-hover:text-[#00bcd4] transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-500 text-sm mb-6 flex-1 line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-400 font-medium">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(post.createdAt).toLocaleDateString("ru-RU")}
                      </div>
                      <div className="flex items-center gap-1 text-[#00bcd4]">
                        Читать полностью
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
