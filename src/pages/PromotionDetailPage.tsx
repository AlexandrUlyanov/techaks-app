import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, Calendar, Share2, Loader2, AlertCircle } from "lucide-react";
import LeadForm from "@/components/LeadForm";

export default function PromotionDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: promo, isLoading } = trpc.banner.getBySlug.useQuery({ slug: slug || "" });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertCircle size={64} className="mx-auto text-gray-300" />
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Акция не найдена</h1>
          <Link to="/promotions" className="inline-flex items-center gap-2 text-[#05C3D4] font-semibold hover:underline">
            <ArrowLeft size={18} /> Вернуться к списку
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
          <Link to="/promotions" className="hover:text-[#05C3D4] transition-colors">Акции</Link>
          <span className="text-white/10">/</span>
          <span className="text-white/60 truncate max-w-[200px]">{promo.title}</span>
        </div>
      </div>

      {/* Content */}
      <section className="py-16 md:py-24">
        <div className="container-main">
          <div className="max-w-4xl mx-auto">
            <span className="inline-block px-3 py-1 bg-[#05C3D4]/10 text-[#05C3D4] text-[10px] font-black uppercase tracking-widest rounded-md mb-6">
              Спецпредложение
            </span>
            <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-white">
              {promo.title}
            </h1>
            <p className="mt-8 text-xl text-white/40 leading-relaxed font-medium">
              {promo.subtitle}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-8 text-[10px] font-black uppercase tracking-widest text-white/20">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[#05C3D4]" />
                Опубликовано {new Date(promo.createdAt).toLocaleDateString("ru-RU")}
              </div>
              <button className="flex items-center gap-2 hover:text-white transition-colors group">
                <Share2 size={16} className="group-hover:text-[#05C3D4]" />
                Поделиться
              </button>
            </div>

            <div className="mt-12 rounded-[2.5rem] overflow-hidden border border-white/5 bg-[#24272B] aspect-video relative group">
              <img 
                src={promo.image} 
                alt={promo.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#15171A] to-transparent opacity-40" />
            </div>

            {/* Long Content */}
            <div className="mt-16 prose prose-invert prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:font-heading prose-headings:tracking-tighter prose-p:text-white/50 prose-p:leading-relaxed prose-strong:text-white prose-img:rounded-3xl">
              {promo.content ? (
                <div dangerouslySetInnerHTML={{ __html: promo.content.replace(/\n/g, '<br/>') }} />
              ) : (
                <p>Подробности акции уточняйте у менеджеров в наших магазинах или по телефону.</p>
              )}
            </div>

            {/* Action Card */}
            <div className="mt-24 grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
              <div className="lg:col-span-2 space-y-10">
                <div className="p-10 bg-[#24272B] rounded-[2rem] border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#05C3D4]/5 blur-3xl rounded-full" />
                  <h3 className="text-xl font-black uppercase font-heading text-white mb-6 tracking-tight">Условия акции</h3>
                  <ul className="space-y-4">
                    {[
                      "Предложение действует во всех магазинах ТЕХАКС",
                      "Скидки не суммируются с другими акциями",
                      "Количество товаров ограничено",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-4 text-white/40 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#05C3D4] mt-2 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {promo.link && (
                  <Link 
                    to={promo.link}
                    className="inline-flex items-center gap-4 px-10 py-5 bg-[#05C3D4] text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all glow-cyan active:scale-95"
                  >
                    Перейти к покупкам
                    <ArrowLeft className="rotate-180" size={18} />
                  </Link>
                )}
              </div>

              <div className="sticky top-28">
                <LeadForm 
                  dark
                  title="ЕСТЬ ВОПРОСЫ?"
                  subtitle="Оставьте заявку и мы проконсультируем вас по этой акции за 5 минут."
                  metadata={{ promotionTitle: promo.title, promotionId: promo.id }}
                  buttonText="Задать вопрос"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
