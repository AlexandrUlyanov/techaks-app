import { useRef } from "react";
import { Link } from "react-router";
import { ArrowRight, Smartphone, Watch, Headphones } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function Hero() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

    // Entrance Animation
    tl.from(".hero-label", { y: 20, opacity: 0, duration: 0.8, delay: 0.2 })
      .from(".hero-title-line", { 
        y: 100, 
        opacity: 0, 
        duration: 1.2, 
        stagger: 0.15, 
        rotationX: -20, 
        transformOrigin: "0% 50% -50" 
      }, "-=0.6")
      .from(".hero-sub", { y: 30, opacity: 0, duration: 0.8 }, "-=0.8")
      .from(".hero-ctas", { y: 20, opacity: 0, duration: 0.8 }, "-=0.6")
      .from(".hero-badges .badge-item", { y: 20, opacity: 0, duration: 0.6, stagger: 0.1 }, "-=0.6")
      .from(".hero-visual .floating-card", { y: 50, opacity: 0, duration: 1.2, stagger: 0.15 }, "-=1.0")
      .from(".scroll-hint", { opacity: 0, duration: 1 }, "-=0.2");

    // Magnetic Button Effect
    const magneticBtn = document.querySelector('.magnetic');
    if (magneticBtn) {
      magneticBtn.addEventListener('mousemove', (e: any) => {
        const r = magneticBtn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.35;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        gsap.to(magneticBtn, { x, y, duration: 0.4, ease: 'power2.out' });
      });
      magneticBtn.addEventListener('mouseleave', () => {
        gsap.to(magneticBtn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      });
    }
  }, { scope: container });

  return (
    <section ref={container} className="relative min-h-[100vh] flex items-center overflow-hidden bg-[#15171A]">
      {/* Background Layer: CSS Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[70%] rounded-full bg-[#05C3D4] opacity-20 mix-blend-screen blur-[120px] animate-blob" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-[#464A50] opacity-40 mix-blend-screen blur-[100px] animate-blob animation-delay-2000" />
      </div>

      {/* Atmospheric FX: Grain Overlay */}
      <div 
        className="absolute inset-0 z-[1] pointer-events-none opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}
      />

      <div className="container-main relative z-10 w-full pt-32 pb-24 grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
        
        {/* Content Layer: Left Aligned */}
        <div className="flex flex-col items-start perspective-[1000px]">
          <div className="hero-label inline-block text-[#05C3D4] text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] mb-6 px-3 py-1.5 border border-[#05C3D4]/20 rounded-full bg-[#05C3D4]/5 backdrop-blur-md">
            Технологичный Retail • Пенза
          </div>
          
          <h1 className="text-[clamp(3.5rem,8vw,6.5rem)] font-black leading-[0.92] tracking-[-0.04em] uppercase text-white font-heading m-0 flex flex-col">
            <span className="overflow-hidden pb-2"><span className="hero-title-line block">Техника</span></span>
            <span className="overflow-hidden pb-2"><span className="hero-title-line block">и Аксесс<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#05C3D4] to-[#27E6F2]">уары</span></span></span>
          </h1>
          
          <p className="hero-sub mt-8 text-[clamp(1rem,2vw,1.25rem)] text-white/60 max-w-[500px] leading-relaxed font-medium">
            Помогаем быстро подобрать нужную технику без лишней сложности. Чистая визуальная система, два современных магазина.
          </p>
          
          <div className="hero-ctas mt-12 flex flex-wrap gap-5 items-center">
            <Link
              to="/catalog"
              className="magnetic inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#05C3D4] text-black rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-colors relative overflow-hidden group shadow-[0_0_40px_rgba(5,195,212,0.3)]"
            >
              Смотреть каталог
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              to="/stores"
              className="px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors border border-white/10 backdrop-blur-sm"
            >
              Наши магазины
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="hero-badges mt-20 flex flex-wrap gap-x-12 gap-y-6">
            {[
              { label: "Официально", value: "Партнёры брендов" },
              { label: "В наличии", value: "Более 5000 товаров" },
              { label: "Рейтинг", value: "4.9 Яндекс Карты" },
            ].map((item, i) => (
              <div key={i} className="badge-item flex flex-col gap-1.5 relative pl-4 border-l border-white/10">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{item.label}</span>
                <span className="text-[13px] font-bold text-white tracking-tight">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Foreground Detail: Visual Side */}
        <div className="hero-visual hidden lg:block relative h-[600px] w-full perspective-[1000px]">
          {/* Main Card */}
          <div className="floating-card absolute top-[20%] right-[10%] w-[280px] h-[360px] bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl flex flex-col justify-between transform rotate-y-[-10deg] rotate-x-[5deg] z-20" style={{ transformStyle: 'preserve-3d' }}>
            <div className="flex justify-between items-start translate-z-12">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#05C3D4] to-blue-500 flex items-center justify-center text-white shadow-lg">
                <Smartphone size={24} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-white/10 rounded-full text-white">Top</span>
            </div>
            <div className="translate-z-8">
              <div className="h-2 w-1/3 bg-white/20 rounded-full mb-3" />
              <div className="h-4 w-3/4 bg-white/40 rounded-full" />
            </div>
          </div>
          
          {/* Secondary Card 1 */}
          <div className="floating-card absolute top-[45%] right-[40%] w-[200px] h-[220px] bg-black/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col justify-between transform rotate-y-[15deg] rotate-x-[-10deg] z-30" style={{ animationDelay: '0.2s', transformStyle: 'preserve-3d' }}>
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-[#05C3D4] translate-z-12">
              <Watch size={20} />
            </div>
            <div className="translate-z-8">
              <div className="h-1.5 w-1/2 bg-white/10 rounded-full mb-2" />
              <div className="h-3 w-full bg-white/20 rounded-full" />
            </div>
          </div>

          {/* Secondary Card 2 */}
          <div className="floating-card absolute top-[10%] right-[45%] w-[160px] h-[160px] bg-gradient-to-br from-[#05C3D4]/20 to-transparent backdrop-blur-md border border-[#05C3D4]/30 rounded-full p-4 shadow-xl flex items-center justify-center transform rotate-y-[-20deg] z-10" style={{ animationDelay: '0.4s', transformStyle: 'preserve-3d' }}>
            <Headphones size={48} className="text-[#05C3D4] opacity-50 translate-z-12" />
          </div>
        </div>

      </div>

      {/* Interaction Layer: Scroll Hint */}
      <div className="scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-20 pointer-events-none">
        <div className="w-[1px] h-[50px] bg-gradient-to-b from-transparent via-white/50 to-transparent animate-scroll-pulse" />
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">Scroll</span>
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
