import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowRight, Gift, Percent, Zap, Loader2 } from "lucide-react";

export default function PromotionsPage() {
  const { data: banners = [], isLoading } = trpc.banner.getActive.useQuery();

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <section className="bg-[#003238] py-16 text-center">
        <div className="container-main">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white">
            Акции и спецпредложения
          </h1>
          <p className="mt-4 text-white/70 max-w-2xl mx-auto">
            Следите за нашими новостями, чтобы не пропустить лучшие цены на любимую технику и аксессуары
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
          ) : banners.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <Gift size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">На данный момент активных акций нет</p>
              <Link to="/catalog" className="mt-6 inline-flex text-[#00bcd4] hover:underline font-semibold">
                Перейти к покупкам
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {banners.map((promo) => (
                <div 
                  key={promo.id} 
                  className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full"
                >
                  <div className="h-64 overflow-hidden bg-gray-100">
                    <img 
                      src={promo.image} 
                      alt={promo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-8 flex flex-col flex-1">
                    <div className="flex items-center gap-2 text-[#00bcd4] mb-3">
                      <Zap size={16} className="fill-current" />
                      <span className="text-xs font-bold uppercase tracking-widest">Акция</span>
                    </div>
                    <h3 className="text-2xl font-bold text-[#0a0a0a] mb-3">
                      {promo.title}
                    </h3>
                    <p className="text-gray-600 mb-8 flex-1">
                      {promo.subtitle}
                    </p>
                    <Link 
                      to={`/promotions/${promo.slug}`}
                      className="inline-flex items-center gap-2 text-[#00bcd4] font-bold hover:gap-3 transition-all"
                    >
                      Узнать подробнее
                      <ArrowRight size={20} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bonus Section */}
      <section className="container-main">
        <div className="bg-gradient-to-br from-[#00bcd4] to-[#00838f] rounded-3xl p-10 md:p-16 text-white overflow-hidden relative">
          <div className="relative z-10 max-w-xl">
            <Percent size={64} className="text-white/20 absolute -top-8 -left-8 -rotate-12" />
            <h2 className="text-3xl md:text-4xl font-extrabold mb-6 leading-tight">
              Дарим скидку 5% за отзыв!
            </h2>
            <p className="text-lg text-white/80 mb-8 leading-relaxed">
              Оставьте отзыв о нашем магазине на Яндекс Картах или 2ГИС, покажите его продавцу и получите скидку на любую покупку аксессуаров.
            </p>
            <div className="flex flex-wrap gap-4">
              <a 
                href="https://yandex.ru/maps/org/techaks/" 
                target="_blank"
                className="px-6 py-3 bg-white text-[#007c91] rounded-xl font-bold hover:bg-gray-100 transition-colors"
              >
                Яндекс Карты
              </a>
              <a 
                href="https://2gis.ru/penza/search/techaks" 
                target="_blank"
                className="px-6 py-3 border border-white/30 text-white rounded-xl font-bold hover:bg-white/10 transition-colors"
              >
                2ГИС
              </a>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-1/3 h-full hidden lg:block opacity-20 translate-x-1/4 translate-y-1/4">
            <Gift size={300} />
          </div>
        </div>
      </section>
    </div>
  );
}
