import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { MapPin, Send, Instagram } from "lucide-react";

export default function HeroInteractive() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W: number, H: number;
    const isMob = () => window.innerWidth < 768;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      initParticles();
      initHexes();
    };

    let mx = window.innerWidth / 2,
      my = window.innerHeight / 2;

    let rx = mx,
      ry = my;

    const handleMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;

      if (cursorRef.current) {
        cursorRef.current.style.left = `${e.clientX}px`;
        cursorRef.current.style.top = `${e.clientY}px`;
      }

      // Parallax effect
      if (!isMob() && heroContentRef.current) {
        const x = (e.clientX / window.innerWidth - 0.5) * 8;
        const y = (e.clientY / window.innerHeight - 0.5) * 5;
        heroContentRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };

    const animateCursor = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      if (cursorRingRef.current) {
        cursorRingRef.current.style.left = `${rx}px`;
        cursorRingRef.current.style.top = `${ry}px`;
      }
      requestAnimationFrame(animateCursor);
    };

    requestAnimationFrame(animateCursor);

    const handleTouch = (e: TouchEvent) => {
      mx = e.touches[0].clientX;
      my = e.touches[0].clientY;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("touchstart", handleTouch, { passive: true });

    resize();

    // Particles
    let particles: any[] = [];
    const r = (a: number, b: number) => a + Math.random() * (b - a);

    const initParticles = () => {
      const n = isMob() ? 65 : 140;
      particles = [];
      for (let i = 0; i < n; i++) {
        const g = Math.random() < 0.25;
        particles.push({
          x: r(0, W),
          y: r(0, H),
          r: r(0.6, g ? 2.6 : 1.6),
          vx: r(-0.2, 0.2),
          vy: r(-0.5, -0.07),
          alpha: r(0.25, g ? 0.9 : 0.6),
          pulse: r(0, Math.PI * 2),
          gold: g,
        });
      }
    };

    // Hexagons
    let hexes: any[] = [];
    const initHexes = () => {
      const n = isMob() ? 5 : Math.floor(W / 140) + 4;
      hexes = [];
      for (let i = 0; i < n; i++)
        hexes.push({
          cx: r(0.05, 0.95),
          cy: r(0.05, 0.95),
          size: r(isMob() ? 18 : 28, isMob() ? 52 : 88),
          phase: r(0, Math.PI * 2),
          speed: r(0.0003, 0.0007),
          gold: Math.random() < 0.35,
          rot: r(0, Math.PI),
          rotV: r(-0.001, 0.001),
        });
    };

    const drawHex = (
      cx: number,
      cy: number,
      sz: number,
      a: number,
      col: string,
      rot: number
    ) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.6;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i;
        i === 0
          ? ctx.moveTo(sz * Math.cos(ang), sz * Math.sin(ang))
          : ctx.lineTo(sz * Math.cos(ang), sz * Math.sin(ang));
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    const CD = isMob() ? 70 : 100;
    let animationFrame: number;

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(
        W * 0.5,
        H * 0.45,
        0,
        W * 0.5,
        H * 0.45,
        W * 0.75
      );
      g.addColorStop(0, "rgba(21,43,96,0.55)");
      g.addColorStop(0.5, "rgba(15,30,66,0.3)");
      g.addColorStop(1, "rgba(11,22,48,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      hexes.forEach(h => {
        h.phase += h.speed * 60;
        h.rot += h.rotV;
        const x = (h.cx + Math.sin(h.phase) * 0.06) * W,
          y = (h.cy + Math.cos(h.phase * 0.65) * 0.05) * H;
        const a = (0.05 + 0.04 * Math.sin(h.phase)) * (h.gold ? 1.5 : 1);
        drawHex(x, y, h.size, a, h.gold ? "#F5A623" : "#1A3A80", h.rot);
        drawHex(
          x,
          y,
          h.size * 0.55,
          a * 0.5,
          h.gold ? "#F5A623" : "#1A3A80",
          h.rot + Math.PI / 6
        );
      });

      const sk = isMob() ? 2 : 1;
      for (let i = 0; i < particles.length; i += sk) {
        for (let j = i + 1; j < particles.length; j += sk) {
          const dx = particles[i].x - particles[j].x,
            dy = particles[i].y - particles[j].y,
            d = Math.sqrt(dx * dx + dy * dy);
          if (d < CD) {
            ctx.save();
            ctx.globalAlpha = (1 - d / CD) * 0.1;
            ctx.strokeStyle =
              Math.hypot(particles[i].x - mx, particles[i].y - my) < 120 &&
              Math.hypot(particles[j].x - mx, particles[j].y - my) < 120
                ? "#F5A623"
                : "#2A4A9A";
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      particles.forEach(p => {
        p.pulse += 0.025;
        const md = Math.hypot(p.x - mx, p.y - my),
          pull = md < 140 ? 1 - md / 140 : 0;
        p.x += p.vx + (mx - p.x) * pull * 0.0015;
        p.y += p.vy + (my - p.y) * pull * 0.0015;
        if (p.y < -5) {
          p.y = H + 5;
          p.x = r(0, W);
        }
        if (p.x < -5) p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
        ctx.save();
        ctx.globalAlpha = Math.min(
          p.alpha * (0.75 + 0.25 * Math.sin(p.pulse)) + pull * 0.35,
          1
        );
        if (p.gold) {
          ctx.shadowBlur = 10 + pull * 18;
          ctx.shadowColor = "#F5A623";
        }
        ctx.fillStyle = p.gold ? "#F5A623" : "#4A7ADA";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + pull * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      const orb = ctx.createRadialGradient(mx, my, 0, mx, my, 180);
      orb.addColorStop(0, "rgba(245,166,35,0.05)");
      orb.addColorStop(0.5, "rgba(245,166,35,0.02)");
      orb.addColorStop(1, "transparent");
      ctx.fillStyle = orb;
      ctx.fillRect(0, 0, W, H);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchstart", handleTouch);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <section className="relative min-h-screen bg-[#0B1630] overflow-hidden font-['Exo_2'] selection:bg-[#F5A623]/30 selection:text-white">
      {mounted && (
        <>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;700;900&family=Space+Mono:wght@400;700&display=swap');
            
            .hero-title-shimmer {
              background: linear-gradient(90deg, #F5A623 0%, #FFCA5E 30%, #FF6B35 50%, #FFCA5E 70%, #F5A623 100%);
              background-size: 300% auto;
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              animation: shimmer 4s linear infinite;
            }

            @keyframes shimmer {
              0% { background-position: 0% center; }
              100% { background-position: 300% center; }
            }

            .scan-line-anim {
              animation: scan 5s linear infinite;
            }

            @keyframes scan {
              0% { top: -2px; opacity: 0; }
              3% { opacity: 1; }
              97% { opacity: 0.7; }
              100% { top: 100vh; opacity: 0; }
            }

            @keyframes fadeUp {
              from { opacity: 0; transform: translateY(24px); }
              to { opacity: 1; transform: translateY(0); }
            }

            .animate-fade-up {
              opacity: 0;
              animation: fadeUp 0.7s ease forwards;
            }

            @media (hover: hover) and (pointer: fine) {
              .hero-interactive-cursor {
                display: block;
                position: fixed;
                z-index: 9999;
                width: 10px;
                height: 10px;
                background: #F5A623;
                border-radius: 50%;
                pointer-events: none;
                transform: translate(-50%, -50%);
                transition: width 0.15s, height 0.15s;
                mix-blend-mode: screen;
              }
              .hero-interactive-cursor-ring {
                display: block;
                position: fixed;
                z-index: 9998;
                width: 36px;
                height: 36px;
                border: 1.5px solid rgba(245, 166, 35, 0.5);
                border-radius: 50%;
                pointer-events: none;
                transform: translate(-50%, -50%);
                transition: width 0.2s, height 0.2s;
              }
            }
          `}</style>

          <div
            ref={cursorRef}
            className="hero-interactive-cursor hidden md:block"
          />
          <div
            ref={cursorRingRef}
            className="hero-interactive-cursor-ring hidden md:block"
          />

          <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0 pointer-events-none"
          />

          {/* Overlays */}
          <div
            className="absolute inset-0 z-1 pointer-events-none opacity-[0.03] bg-repeat"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "200px 200px",
            }}
          />
          <div className="absolute inset-0 z-2 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(11,22,48,0.88)_100%)]" />
          <div className="absolute left-0 w-full h-[1px] z-20 pointer-events-none bg-[linear-gradient(90deg,transparent_0%,rgba(245,166,35,0.55)_40%,rgba(255,107,53,0.9)_50%,rgba(245,166,35,0.55)_60%,transparent_100%)] scan-line-anim" />

          <div className="relative z-30 container-main min-h-screen flex flex-col items-center justify-center text-center px-4 md:px-8">
            <div
              ref={heroContentRef}
              className="transition-transform duration-200 ease-out flex flex-col items-center"
            >
              {/* Tagline */}
              <div className="flex items-center gap-3 md:gap-4 mb-6 animate-fade-up [animation-delay:0.6s]">
                <div className="w-6 md:w-9 h-[1px] bg-[#F5A623] opacity-50" />
                <span className="font-['Space_Mono'] text-[10px] md:text-[11px] font-medium tracking-[0.22em] text-[#F5A623] uppercase">
                  Два магазина в Пензе · 9:00–21:00
                </span>
                <div className="w-6 md:w-9 h-[1px] bg-[#F5A623] opacity-50" />
              </div>

              {/* Title */}
              <h1 className="text-[36px] sm:text-[48px] md:text-[72px] lg:text-[88px] font-black leading-[1.0] text-white uppercase mb-6 animate-fade-up [animation-delay:0.85s]">
                Техника и<br />
                <span className="hero-title-shimmer">аксессуары</span>
                <br />
                для жизни
              </h1>

              {/* Subtitle */}
              <p className="max-w-[500px] text-sm md:text-lg font-light leading-relaxed text-white/55 mb-8 animate-fade-up [animation-delay:1.1s]">
                Смартфоны, наушники, зарядки, гаджеты.
                <br />
                <strong className="text-white/90 font-semibold">
                  HOCO · Remax · ISA.
                </strong>{" "}
                Поклейка стёкол на месте.
              </p>

              {/* Badges */}
              <div className="flex flex-wrap justify-center gap-2 mb-10 animate-fade-up [animation-delay:1.25s]">
                {[
                  { label: "Рейтинг", value: "4.9 ★" },
                  { label: "Товаров", value: "500+" },
                  { label: "Цены", value: "от производителей" },
                ].map(badge => (
                  <div
                    key={badge.label}
                    className="px-3 py-1.5 border border-[#F5A623]/30 rounded-full bg-[#F5A623]/5 backdrop-blur-md text-[10px] font-semibold tracking-wider text-white/65 uppercase"
                  >
                    {badge.label}{" "}
                    <span className="text-[#F5A623]">{badge.value}</span>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap justify-center gap-4 w-full max-w-md animate-fade-up [animation-delay:1.45s]">
                <Link
                  to="/catalog"
                  className="flex-1 min-w-[160px] py-4 bg-[#F5A623] text-[#0B1630] rounded-full text-xs font-black uppercase tracking-widest transition-all hover:scale-105 hover:-translate-y-1 hover:shadow-[0_10px_34px_rgba(245,166,35,0.55)] active:scale-95 shadow-[0_6px_26px_rgba(245,166,35,0.4)]"
                >
                  Каталог
                </Link>
                <button className="flex-1 min-w-[160px] py-4 bg-white/5 border border-white/20 text-white rounded-full text-xs font-semibold uppercase tracking-widest backdrop-blur-md transition-all hover:border-[#F5A623] hover:bg-[#F5A623]/10 hover:-translate-y-1 active:scale-95">
                  Узнать наличие
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Strips (Stores/Social) */}
          <div className="hidden lg:flex flex-col gap-4 absolute bottom-24 right-10 z-30 animate-fade-up [animation-delay:1.9s]">
            <div className="bg-[#0B1630]/75 backdrop-blur-md border border-[#F5A623]/15 rounded-xl p-4 flex items-center gap-3 min-w-[260px] hover:border-[#F5A623]/40 hover:-translate-x-1 transition-all cursor-pointer">
              <div className="w-9 h-9 bg-[#F5A623]/10 border border-[#F5A623]/20 rounded-lg flex items-center justify-center">
                <MapPin size={16} className="text-[#F5A623]" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-black text-white uppercase tracking-wider mb-0.5">
                  Магазин №1
                </div>
                <div className="text-[11px] text-white/55">
                  пр. Строителей, 50А
                </div>
              </div>
            </div>
            <div className="bg-[#0B1630]/75 backdrop-blur-md border border-[#F5A623]/15 rounded-xl p-4 flex items-center gap-3 min-w-[260px] hover:border-[#F5A623]/40 hover:-translate-x-1 transition-all cursor-pointer">
              <div className="w-9 h-9 bg-[#F5A623]/10 border border-[#F5A623]/20 rounded-lg flex items-center justify-center">
                <MapPin size={16} className="text-[#F5A623]" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-black text-white uppercase tracking-wider mb-0.5">
                  Магазин №2
                </div>
                <div className="text-[11px] text-white/55">
                  ул. Ген. Глазунова, 1
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-col gap-3 absolute bottom-24 left-10 z-30 animate-fade-up [animation-delay:1.9s]">
            {[
              { icon: Send, label: "Telegram", color: "#27A7E5" },
              { icon: Instagram, label: "Instagram", color: "#E1306C" },
            ].map(social => (
              <a
                key={social.label}
                href="#"
                className="flex items-center gap-3 px-4 py-2 bg-[#0B1630]/65 backdrop-blur-md border border-white/10 rounded-full hover:border-[#F5A623] hover:translate-x-1 transition-all"
              >
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: social.color }}
                />
                <span className="text-[11px] font-bold text-white/55 uppercase tracking-widest">
                  {social.label}
                </span>
              </a>
            ))}
          </div>

          {/* Scroll Hint */}
          <div className="hidden md:flex flex-col items-center gap-3 absolute bottom-10 left-1/2 -translate-x-1/2 z-30 opacity-40 animate-fade-up [animation-delay:2.2s]">
            <span className="font-['Space_Mono'] text-[9px] tracking-[0.2em] text-white/55 uppercase">
              Прокрутите вниз
            </span>
            <div className="w-[22px] h-[36px] border border-white/20 rounded-xl flex justify-center p-1.5">
              <div className="w-[3px] h-[7px] bg-[#F5A623] rounded-full animate-bounce" />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
