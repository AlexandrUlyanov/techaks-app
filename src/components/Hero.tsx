import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-background">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Blobs with CSS animation */}
        <div className="hero-blob blob-1" />
        <div className="hero-blob blob-2" />
        <div className="hero-blob blob-3" />
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

      <style>{`
        .hero-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          z-index: -1;
          opacity: 0.35;
          mix-blend-mode: soft-light;
          pointer-events: none;
        }

        .blob-1 {
          top: -10%;
          right: -5%;
          width: 60%;
          height: 60%;
          background: #05C3D4;
          animation: float-1 20s infinite alternate ease-in-out;
        }

        .blob-2 {
          bottom: -15%;
          left: -5%;
          width: 50%;
          height: 50%;
          background: #464A50;
          animation: float-2 25s infinite alternate ease-in-out;
        }

        .blob-3 {
          top: 20%;
          left: 10%;
          width: 30%;
          height: 30%;
          background: #05C3D4;
          opacity: 0.15;
          animation: float-3 18s infinite alternate ease-in-out;
        }

        @keyframes float-1 {
          0% { transform: translate(0, 0) scale(1); background: #05C3D4; }
          50% { transform: translate(50px, -40px) scale(1.1); background: #27E6F2; }
          100% { transform: translate(-20px, 20px) scale(0.9); background: #0099A8; }
        }

        @keyframes float-2 {
          0% { transform: translate(0, 0) scale(1); background: #464A50; }
          50% { transform: translate(-60px, 50px) scale(1.15); background: #15171A; }
          100% { transform: translate(30px, -20px) scale(0.95); background: #24272B; }
        }

        @keyframes float-3 {
          0% { transform: translate(0, 0); opacity: 0.15; }
          100% { transform: translate(40px, 60px); opacity: 0.25; }
        }
      `}</style>
    </section>
  );
}
