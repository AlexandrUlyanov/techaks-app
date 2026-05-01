import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowRight, Gift, Loader2, Star } from "lucide-react";

export default function PromotionsPage() {
  const { data: banners = [], isLoading } = trpc.banner.getActive.useQuery();

  return (
    <div className="min-h-screen pb-20 bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-background z-0" />
        <div className="absolute top-0 right-0 w-[50%] h-full bg-[#05C3D4]/5 blur-[120px] rounded-full" />
        <div className="container-main relative z-10 text-center">
          <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-4 block">Digital Витрина</span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
            АКЦИИ <span className="text-muted-foreground/30">И ВЫГОДА</span>
          </h1>
          <p className="mt-8 text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            Следите за нашими новостями, чтобы не пропустить лучшие цены на любимую технику и аксессуары.
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
          ) : banners.length === 0 ? (
            <div className="text-center py-24 bg-card rounded-[2rem] border border-border">
              <Gift size={64} className="mx-auto text-muted-foreground/20 mb-6" />
              <p className="text-xl font-black uppercase font-heading text-muted-foreground/40 tracking-widest">Активных акций сейчас нет</p>
              <Link to="/catalog" className="mt-8 inline-flex items-center gap-3 px-8 py-4 bg-[#05C3D4] text-white dark:text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all glow-cyan">
                В каталог
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {banners.map((promo) => (
                <Link 
                  key={promo.id} 
                  to={promo.slug ? `/promotions/${promo.slug}` : "#"}
                  className="group bg-card border border-border rounded-[2rem] overflow-hidden hover:border-[#05C3D4]/20 transition-all duration-300 flex flex-col h-full shadow-sm hover:shadow-xl"
                >
                  <div className="h-72 overflow-hidden bg-foreground/5 relative">
                    <img 
                      src={promo.image} 
                      alt={promo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
                    <span className="absolute bottom-6 left-6 px-3 py-1 bg-[#05C3D4] text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-md">
                      Акция
                    </span>
                  </div>
                  <div className="p-10 flex flex-col flex-1">
                    <h3 className="text-2xl md:text-3xl font-black uppercase font-heading tracking-tight leading-tight text-foreground mb-4 group-hover:text-[#05C3D4] transition-colors">
                      {promo.title}
                    </h3>
                    <p className="text-muted-foreground font-medium leading-relaxed mb-10 flex-1 line-clamp-3">
                      {promo.subtitle}
                    </p>
                    <div className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#05C3D4] group-hover:gap-5 transition-all">
                      Узнать подробнее
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bonus Section */}
      <section className="container-main mb-24">
        <div className="bg-[#05C3D4] rounded-[2.5rem] p-12 md:p-20 text-black overflow-hidden relative group">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-4xl md:text-6xl font-black uppercase font-heading leading-[0.9] tracking-tighter mb-8 text-black">
              ДАРИМ СКИДКУ 5% <br /> <span className="text-black/40">ЗА ВАШ ОТЗЫВ</span>
            </h2>
            <p className="text-lg md:text-xl text-black/70 mb-10 leading-relaxed font-bold">
              Оставьте отзыв на Яндекс Картах или 2ГИС, покажите его продавцу и получите скидку на любую покупку аксессуаров.
            </p>
            <div className="flex flex-wrap gap-4">
              <a 
                href="https://yandex.ru/maps/org/techaks/" 
                target="_blank"
                className="px-10 py-5 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black/90 transition-all active:scale-95"
              >
                Яндекс Карты
              </a>
              <a 
                href="https://2gis.ru/penza/search/techaks" 
                target="_blank"
                className="px-10 py-5 border border-black/10 bg-black/5 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black/10 transition-all active:scale-95"
              >
                2ГИС
              </a>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-1/2 h-full hidden lg:flex items-end justify-end p-12 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <Star size={400} className="fill-black" />
          </div>
        </div>
      </section>
    </div>
  );
}
