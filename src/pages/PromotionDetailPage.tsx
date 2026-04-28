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
        <Loader2 className="animate-spin text-[#00bcd4]" size={48} />
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertCircle size={64} className="mx-auto text-gray-300" />
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Акция не найдена</h1>
          <Link to="/promotions" className="inline-flex items-center gap-2 text-[#00bcd4] font-semibold hover:underline">
            <ArrowLeft size={18} /> Вернуться к списку
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
          <Link to="/promotions" className="hover:text-[#00bcd4] transition-colors">Акции</Link>
          <span>/</span>
          <span className="text-[#0a0a0a] truncate">{promo.title}</span>
        </div>
      </div>

      {/* Hero Content */}
      <section className="py-12">
        <div className="container-main">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#0a0a0a] leading-tight">
              {promo.title}
            </h1>
            <p className="mt-4 text-xl text-gray-500 leading-relaxed">
              {promo.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar size={18} />
                Опубликовано {new Date(promo.createdAt).toLocaleDateString("ru-RU")}
              </div>
              <button className="flex items-center gap-2 hover:text-[#00bcd4] transition-colors">
                <Share2 size={18} />
                Поделиться
              </button>
            </div>

            <div className="mt-10 rounded-3xl overflow-hidden shadow-2xl bg-gray-100 aspect-video">
              <img 
                src={promo.image} 
                alt={promo.title} 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Long Content */}
            <div className="mt-12 prose prose-lg max-w-none prose-headings:text-[#0a0a0a] prose-p:text-gray-600 prose-strong:text-[#0a0a0a]">
              {promo.content ? (
                <div dangerouslySetInnerHTML={{ __html: promo.content.replace(/\n/g, '<br/>') }} />
              ) : (
                <p>Подробности акции уточняйте у менеджеров в наших магазинах или по телефону.</p>
              )}
            </div>

            {/* Action Card */}
            <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
              <div className="lg:col-span-2 space-y-8">
                <div className="p-8 bg-blue-50 rounded-2xl border border-blue-100">
                  <h3 className="text-xl font-bold text-[#0a0a0a] mb-4">Условия акции:</h3>
                  <ul className="space-y-3">
                    {[
                      "Предложение действует во всех магазинах ТЕХАКС",
                      "Скидки не суммируются с другими акциями",
                      "Количество товаров ограничено",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00bcd4] mt-2 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {promo.link && (
                  <Link 
                    to={promo.link}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-[#00bcd4] text-white rounded-2xl font-bold text-lg hover:bg-[#0097a7] transition-all shadow-lg hover:shadow-[#00bcd4]/30"
                  >
                    Перейти к покупкам
                    <ArrowLeft className="rotate-180" size={20} />
                  </Link>
                )}
              </div>

              <div className="sticky top-24">
                <LeadForm 
                  title="Есть вопросы?"
                  subtitle="Оставьте заявку и мы проконсультируем вас по этой акции"
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
