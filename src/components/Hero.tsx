import { Link } from "react-router";
import { ArrowRight, MapPin } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#05C3D4]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#464A50]/20 blur-[100px] rounded-full" />
      </div>

      <div className="container-main relative z-10 py-24 md:py-32">
        <div className="max-w-[800px]">
          <span className="inline-block text-[#05C3D4] text-xs md:text-sm font-black uppercase tracking-[0.3em] mb-6">
            Технологичный Retail • Пенза
          </span>
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black leading-[0.9] tracking-tighter uppercase font-heading text-foreground">
            ТЕХНИКА <br /> И АКСЕСС<span className="text-[#05C3D4]">УАРЫ</span>
          </h1>
          <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-[580px] leading-relaxed font-medium">
            Помогаем быстро подобрать нужную технику и аксессуары без лишней сложности. Чистая визуальная система, два современных магазина.
          </p>
          
          <div className="mt-12 flex flex-wrap gap-5">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-3 px-10 py-5 bg-[#05C3D4] text-white dark:text-black rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all glow-cyan hover:-translate-y-1 active:scale-95"
            >
              Смотреть каталог
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="mt-16 flex flex-wrap gap-x-10 gap-y-6 border-t border-border pt-10">
            {[
              { label: "Официально", value: "Партнёры брендов" },
              { label: "В наличии", value: "Более 5000 товаров" },
              { label: "Рейтинг", value: "4.9 Яндекс Карты" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</span>
                <span className="text-sm font-bold text-foreground/90">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
