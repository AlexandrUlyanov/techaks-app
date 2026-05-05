import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Loader2, Calendar, ArrowRight, BookOpen } from "lucide-react";

export default function BlogPage() {
  const { data: posts = [], isLoading } = trpc.blog.getPublished.useQuery();

  return (
    <div className="min-h-screen pb-20 bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[#15171A] z-0" />
        <div className="absolute top-0 right-0 w-[50%] h-full bg-[#05C3D4]/5 blur-[120px] rounded-full" />
        <div className="container-main relative z-10 text-center">
          <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-4 block">Блог ТЕХАКС</span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase font-heading leading-none tracking-tighter text-white">
            СОВЕТЫ <span className="text-white/20">И ОБЗОРЫ</span>
          </h1>
          <p className="mt-8 text-lg text-white/40 max-w-2xl mx-auto font-medium">
            Обзоры новинок, советы по выбору аксессуаров и последние новости магазинов ТЕХАКС.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="py-24">
        <div className="container-main">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-24 bg-[#24272B] rounded-[2rem] border border-white/5">
              <BookOpen size={64} className="mx-auto text-white/10 mb-6" />
              <p className="text-xl font-black uppercase font-heading text-white/20 tracking-widest">Статей пока нет</p>
              <Link to="/catalog" className="mt-8 inline-flex items-center gap-3 px-8 py-4 bg-[#05C3D4] text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all glow-cyan">
                В каталог
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link 
                  key={post.id} 
                  to={`/blog/${post.slug}`}
                  className="group bg-[#24272B] border border-white/5 rounded-[2rem] overflow-hidden hover:border-[#05C3D4]/20 transition-all duration-300 flex flex-col h-full"
                >
                  <div className="h-64 overflow-hidden relative">
                    <img 
                      src={post.image} 
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#24272B] to-transparent opacity-60" />
                    <span className="absolute bottom-6 left-6 px-3 py-1 bg-[#05C3D4] text-black text-[10px] font-black uppercase tracking-widest rounded-md">
                      {post.category}
                    </span>
                  </div>
                  <div className="p-8 flex flex-col flex-1">
                    <h3 className="text-xl md:text-2xl font-black uppercase font-heading tracking-tight leading-tight text-white mb-4 group-hover:text-[#05C3D4] transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-white/40 font-medium text-sm mb-8 flex-1 line-clamp-3 leading-relaxed">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-6 border-t border-white/5 text-[10px] font-black uppercase tracking-widest text-white/20">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-[#05C3D4]" />
                        {new Date(post.createdAt).toLocaleDateString("ru-RU")}
                      </div>
                      <div className="flex items-center gap-2 text-[#05C3D4] group-hover:gap-4 transition-all">
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
