import { useRef } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Smartphone,
  Watch,
  Headphones,
  Sparkles,
  Tag,
  Shield,
  Box,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const shortcuts = [
  {
    label: "Все новинки",
    icon: Sparkles,
    href: "/catalog?sort=new",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    label: "Акции %",
    icon: Tag,
    href: "/promotions",
    color: "text-[#05C3D4]",
    bg: "bg-[#05C3D4]/10",
  },
  {
    label: "Чехлы iPhone",
    icon: Shield,
    href: "/catalog?cat=cases",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    label: "Наушники",
    icon: Headphones,
    href: "/catalog?cat=audio",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    label: "Защита",
    icon: Smartphone,
    href: "/catalog?cat=glass",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    label: "Уценка",
    icon: Box,
    href: "/catalog?cat=outlet",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
];

export default function Hero() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      // Entrance Animation
      tl.from(".hero-label", { y: 20, opacity: 0, duration: 0.8, delay: 0.2 })
        .from(
          ".hero-title-line",
          {
            y: 100,
            opacity: 0,
            duration: 1.2,
            stagger: 0.15,
            rotationX: -20,
            transformOrigin: "0% 50% -50",
          },
          "-=0.6"
        )
        .from(".hero-sub", { y: 30, opacity: 0, duration: 0.8 }, "-=0.8")
        .from(".hero-ctas", { y: 20, opacity: 0, duration: 0.8 }, "-=0.6")
        .from(
          ".hero-badges .badge-item",
          { y: 20, opacity: 0, duration: 0.6, stagger: 0.1 },
          "-=0.6"
        )
        .from(
          ".hero-visual .floating-card",
          { y: 50, opacity: 0, duration: 1.2, stagger: 0.15 },
          "-=1.0"
        )
        .from(".scroll-hint", { opacity: 0, duration: 1 }, "-=0.2");

      // Magnetic Button Effect
      const magneticBtn = document.querySelector(".magnetic");
      if (magneticBtn) {
        magneticBtn.addEventListener("mousemove", (e: any) => {
          const r = magneticBtn.getBoundingClientRect();
          const x = (e.clientX - r.left - r.width / 2) * 0.35;
          const y = (e.clientY - r.top - r.height / 2) * 0.35;
          gsap.to(magneticBtn, { x, y, duration: 0.4, ease: "power2.out" });
        });
        magneticBtn.addEventListener("mouseleave", () => {
          gsap.to(magneticBtn, {
            x: 0,
            y: 0,
            duration: 0.7,
            ease: "elastic.out(1, 0.4)",
          });
        });
      }
    },
    { scope: container }
  );

  return (
    <section
      ref={container}
      className="relative min-h-[100vh] flex items-center overflow-hidden bg-slate-50 dark:bg-[#15171A] transition-colors duration-500"
    >
      {/* Background Layer: CSS Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[70%] rounded-full bg-[#05C3D4] opacity-20 mix-blend-multiply dark:mix-blend-screen blur-[120px] animate-blob" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-blue-200 dark:bg-[#464A50] opacity-40 mix-blend-multiply dark:mix-blend-screen blur-[100px] animate-blob animation-delay-2000" />
      </div>

      {/* Atmospheric FX: Grain Overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-[0.04] mix-blend-multiply dark:mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="container-main relative z-10 w-full pt-32 pb-24 grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
        {/* Content Layer: Left Aligned */}
        <div className="flex flex-col items-start perspective-[1000px]">
          <div className="hero-label inline-block text-[#05C3D4] text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] mb-6 px-3 py-1.5 border border-[#05C3D4]/20 rounded-full bg-[#05C3D4]/5 backdrop-blur-md">
            Технологичный Retail • Пенза
          </div>

          <h1 className="text-[clamp(3.5rem,8vw,6.5rem)] font-black leading-[0.92] tracking-[-0.04em] uppercase text-slate-900 dark:text-white font-heading m-0 flex flex-col">
            <span className="overflow-hidden pb-2">
              <span className="hero-title-line block">Техника и</span>
            </span>
            <span className="overflow-hidden pb-2">
              <span className="hero-title-line block">
                <span className="text-[#05C3D4]">Аксессуары</span>
              </span>
            </span>
          </h1>

          <p className="hero-sub mt-8 text-[clamp(1rem,2vw,1.25rem)] text-slate-600 dark:text-white/60 max-w-[500px] leading-relaxed font-medium">
            Помогаем быстро подобрать нужную технику без лишней сложности.
            Чистая визуальная система, два современных магазина.
          </p>

          <div className="hero-ctas mt-12 flex flex-wrap gap-5 items-center">
            <Link
              to="/catalog"
              className="magnetic inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#05C3D4] text-white dark:text-black rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-colors relative overflow-hidden group shadow-[0_4px_20px_rgba(5,195,212,0.3)] dark:shadow-[0_0_40px_rgba(5,195,212,0.3)]"
            >
              Смотреть каталог
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </Link>
            <Link
              to="/stores"
              className="px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors border border-black/10 dark:border-white/10 backdrop-blur-sm"
            >
              Наши магазины
            </Link>
          </div>

          {/* Quick Shortcuts */}
          <div className="hero-badges mt-16 flex flex-wrap gap-3 max-w-[550px]">
            {shortcuts.map((item, i) => {
              const Icon = item.icon;
              return (
                <Link
                  key={i}
                  to={item.href}
                  className="badge-item group flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-black/5 dark:border-white/10 hover:border-[#05C3D4]/40 hover:bg-white/80 dark:hover:bg-white/10 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <div
                    className={`w-8 h-8 rounded-xl ${item.bg} ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform`}
                  >
                    <Icon size={16} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/80 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Foreground Detail: Visual Side */}
        <div className="hero-visual hidden lg:block relative h-[600px] w-full perspective-[1000px]">
          {/* Main Card */}
          <div
            className="floating-card absolute top-[20%] right-[10%] w-[280px] h-[360px] bg-white/60 dark:bg-white/5 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-[2rem] p-6 shadow-2xl flex flex-col justify-between transform rotate-y-[-10deg] rotate-x-[5deg] z-20"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="flex justify-between items-start translate-z-12">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#05C3D4] to-blue-500 flex items-center justify-center text-white shadow-lg">
                <Smartphone size={24} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-[#05C3D4]/10 text-[#05C3D4] rounded-full border border-[#05C3D4]/20">
                Хит продаж
              </span>
            </div>

            <div className="translate-z-8 flex flex-col gap-3 mt-auto">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 dark:text-white/50 font-semibold">
                  Смартфоны
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  HONOR X8b 8GB/128GB
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <span className="text-yellow-500 text-sm">★</span> 4.8{" "}
                <span className="text-slate-400 font-normal">(12 отзывов)</span>
              </div>
              <div className="flex items-end justify-between mt-2 pt-4 border-t border-black/5 dark:border-white/10">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-400 line-through decoration-slate-400/50">
                    22 990 ₽
                  </span>
                  <span className="text-2xl font-black text-[#05C3D4]">
                    19 990 ₽
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center hover:scale-110 hover:bg-[#05C3D4] dark:hover:bg-[#05C3D4] hover:text-white transition-all shadow-md cursor-pointer">
                  <ArrowRight size={18} />
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Card 1 */}
          <div
            className="floating-card absolute top-[45%] right-[40%] w-[220px] h-[240px] bg-white/40 dark:bg-[#15171A]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col justify-between transform rotate-y-[15deg] rotate-x-[-10deg] z-30"
            style={{ animationDelay: "0.2s", transformStyle: "preserve-3d" }}
          >
            <div className="flex justify-between items-start translate-z-12">
              <div className="w-10 h-10 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#05C3D4]">
                <Watch size={20} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full border border-red-500/20">
                -15%
              </span>
            </div>

            <div className="translate-z-8 flex flex-col gap-2 mt-auto">
              <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Смарт-часы ISA SW-1
              </span>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-900 dark:text-white">
                <span className="text-yellow-500">★</span> 4.5{" "}
                <span className="text-slate-400 font-normal">в наличии</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-3 border-t border-black/5 dark:border-white/10">
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  4 990 ₽
                </span>
                <div className="px-3 py-1.5 rounded-lg bg-[#05C3D4] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#27E6F2] transition-colors cursor-pointer shadow-sm">
                  В корзину
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Card 2 */}
          <div
            className="floating-card absolute top-[10%] right-[45%] w-[180px] h-[180px] bg-gradient-to-br from-[#05C3D4]/10 dark:from-[#05C3D4]/20 to-transparent backdrop-blur-xl border border-[#05C3D4]/30 rounded-3xl p-4 shadow-xl flex flex-col items-center justify-center gap-3 transform rotate-y-[-20deg] z-10"
            style={{ animationDelay: "0.4s", transformStyle: "preserve-3d" }}
          >
            <div className="w-12 h-12 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center translate-z-12 shadow-inner">
              <Headphones size={24} className="text-[#05C3D4] opacity-90" />
            </div>
            <div className="translate-z-8 text-center flex flex-col items-center gap-1 mt-1">
              <span className="text-[10px] font-bold text-slate-700 dark:text-white/80 uppercase tracking-wider">
                HOCO EW81
              </span>
              <span className="text-xs font-black text-[#05C3D4]">2 490 ₽</span>
              <div className="mt-1 flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#05C3D4]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-200"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interaction Layer: Scroll Hint */}
      <div className="scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-20 pointer-events-none">
        <div className="w-[1px] h-[50px] bg-gradient-to-b from-transparent via-black/30 dark:via-white/50 to-transparent animate-scroll-pulse" />
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/40">
          Scroll
        </span>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 20s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        @keyframes scrollPulse {
          0%, 100% { transform: scaleY(0.1) translateY(-50%); opacity: 0; }
          50% { transform: scaleY(1) translateY(0); opacity: 1; }
        }
        .animate-scroll-pulse {
          animation: scrollPulse 2.2s ease-in-out infinite;
          transform-origin: top;
        }
        .floating-card {
          animation: float 6s ease-in-out infinite alternate;
        }
        @keyframes float {
          0% { transform: translateY(0) rotateY(var(--tw-rotate-y, 0deg)) rotateX(var(--tw-rotate-x, 0deg)); }
          100% { transform: translateY(-15px) rotateY(calc(var(--tw-rotate-y, 0deg) + 2deg)) rotateX(calc(var(--tw-rotate-x, 0deg) - 2deg)); }
        }
        .perspective-\\[1000px\\] {
          perspective: 1000px;
        }
        .translate-z-12 {
          transform: translateZ(3rem);
        }
        .translate-z-8 {
          transform: translateZ(2rem);
        }
      `}</style>
    </section>
  );
}
