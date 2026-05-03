import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { 
  Menu, X, Phone, ArrowRight, Sun, Moon, ShoppingBag, User,
  Smartphone, Headphones, Watch, Shield, Home, Gamepad2, 
  Wrench, Car, Tv, Wind, Heart, Star, Sparkles, Box, Laptop,
  Lightbulb, Tag, Search
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import AuthModal from "./AuthModal";

const categories = [
  { label: "Аксессуары для дома", slug: "home-acc", icon: Home },
  { label: "Авто/Вело/Мототовары", slug: "auto-moto", icon: Car },
  { label: "Аксессуары для компьютеров/ноутбуков", slug: "pc-acc", icon: Laptop },
  { label: "Аксессуары для телевизоров", slug: "tv-acc", icon: Tv },
  { label: "Аксессуары для телефонов", slug: "phone-acc", icon: Smartphone },
  { label: "Аудиотехника", slug: "audio", icon: Headphones },
  { label: "Гаджеты", slug: "gadgets", icon: Watch },
  { label: "Защита устройств", slug: "protection", icon: Shield },
  { label: "Инструменты", slug: "tools", icon: Wrench },
  { label: "Климатическая техника", slug: "climate", icon: Wind },
  { label: "Красота и здоровье", slug: "beauty-health", icon: Heart },
  { label: "Отдых и развлечения", slug: "leisure", icon: Gamepad2 },
  { label: "Сопутствующий товар", slug: "related", icon: Sparkles },
  { label: "Техника", slug: "electronics", icon: Box },
  { label: "Умный дом", slug: "smart-home", icon: Lightbulb },
  { label: "Уцененный товар", slug: "outlet", icon: Tag },
  { label: "Фирменный мерч", slug: "merch", icon: Star },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { getItemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "shadow-2xl" : ""}`}>
        {/* Main Bar: Logo, Search, Actions */}
        <div className="bg-background/95 backdrop-blur-xl border-b border-border py-4">
          <div className="container-main flex items-center gap-8 md:gap-12">
            {/* Logo */}
            <Link to="/" className="flex items-center group active:scale-95 transition-transform shrink-0">
              <img 
                src={mounted && theme === "dark" ? "/images/logo-color.svg" : "/images/logo-light.svg"} 
                alt="ТЕХАКС" 
                className="h-7 md:h-10 w-auto"
              />
            </Link>

            {/* Main Navigation (Desktop) */}
            <nav className="hidden xl:flex items-center gap-8 shrink-0">
              <Link to="/promotions" className="text-[11px] font-black uppercase tracking-widest text-foreground/60 hover:text-[#05C3D4] transition-colors">Акции</Link>
              <Link to="/stores" className="text-[11px] font-black uppercase tracking-widest text-foreground/60 hover:text-[#05C3D4] transition-colors">Магазины</Link>
            </nav>

            {/* Search Placeholder */}
            <div className="hidden md:flex items-center flex-1 max-w-xl h-11 bg-muted/50 border border-border rounded-xl px-4 text-muted-foreground hover:border-[#05C3D4]/50 transition-all cursor-text group">
              <Search size={18} className="mr-3 group-hover:text-[#05C3D4] transition-colors" />
              <span className="text-sm font-medium">Найти аксессуар или гаджет...</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 md:gap-6 ml-auto shrink-0">
              <a href="tel:+79273750555" className="hidden lg:flex flex-col items-end">
                <span className="text-xs font-black text-foreground">+7 (927) 375-05-55</span>
                <span className="text-[9px] font-bold text-[#05C3D4] uppercase tracking-wider">Ежедневно 9-21</span>
              </a>

              <div className="h-8 w-px bg-border hidden lg:block" />

              <div className="flex items-center gap-2">
                <button onClick={toggleTheme} className="p-2.5 text-foreground/40 hover:text-foreground transition-colors rounded-xl hover:bg-muted" aria-label="Toggle theme">
                  {mounted && theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {isAuthenticated ? (
                  <Link to="/account" className="p-2.5 text-foreground/40 hover:text-foreground transition-colors rounded-xl hover:bg-muted" aria-label="Личный кабинет">
                    <User size={20} />
                  </Link>
                ) : (
                  <button onClick={() => setAuthOpen(true)} className="p-2.5 text-foreground/40 hover:text-foreground transition-colors rounded-xl hover:bg-muted" aria-label="Войти">
                    <User size={20} />
                  </button>
                )}

                <Link to="/checkout" className="flex items-center gap-3 px-4 h-11 bg-[#05C3D4] text-white dark:text-black rounded-xl hover:bg-[#27E6F2] transition-all group">
                  <div className="relative">
                    <ShoppingBag size={20} />
                    {mounted && getItemCount() > 0 && (
                      <span className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white text-black text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#05C3D4]">
                        {getItemCount()}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Корзина</span>
                </Link>
              </div>

              <button className="xl:hidden p-2 text-foreground" onClick={() => setMobileOpen(true)}>
                <Menu size={28} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Bar: Full Width Navigation */}
        <div className="bg-background border-b border-border overflow-hidden">
          <div className="container-main px-0 md:px-8">
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/catalog?cat=${cat.slug}`}
                  className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-foreground/50 hover:text-[#05C3D4] hover:bg-[#05C3D4]/5 transition-all group min-w-[110px] sm:min-w-[130px]"
                >
                  <cat.icon size={20} className="group-hover:scale-110 transition-transform shrink-0" />
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter text-center leading-tight">
                    {cat.label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-[136px] md:h-[156px]" />

      {/* Mobile Menu */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] lg:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-[300px] max-w-[85vw] bg-[#15171A] border-l border-white/5 z-[80] p-8 lg:hidden" style={{ animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <button className="absolute top-6 right-6 p-2 text-white/60 hover:text-white" onClick={() => setMobileOpen(false)}>
              <X size={28} />
            </button>
            <div className="mt-12">
              <Link to="/" className="flex flex-col leading-none" onClick={() => setMobileOpen(false)}>
                <span className="text-2xl font-black tracking-tighter uppercase font-heading text-white">ТЕХ<span className="text-[#05C3D4]">АКС</span></span>
              </Link>
            </div>
            <nav className="mt-12 flex flex-col gap-8">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Меню</span>
                <div className="grid grid-cols-1 gap-2">
                  <Link to="/promotions" className="text-lg font-bold text-white/40 hover:text-white" onClick={() => setMobileOpen(false)}>Акции</Link>
                  <Link to="/stores" className="text-lg font-bold text-white/40 hover:text-white" onClick={() => setMobileOpen(false)}>Магазины</Link>
                </div>
              </div>
              <div className="space-y-4 pt-8 border-t border-white/5">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Категории</span>
                <div className="grid grid-cols-1 gap-1">
                  {categories.map((link) => (
                    <Link key={link.slug} to={`/catalog?cat=${link.slug}`} className="flex items-center gap-3 py-3 px-4 bg-white/5 rounded-xl border border-white/5 text-white" onClick={() => setMobileOpen(false)}>
                      <link.icon size={18} className="text-[#05C3D4]" />
                      <span className="text-[10px] font-black uppercase leading-tight">{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        </>
      )}

      {/* Auth Modal Overlay */}
      {authOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAuthOpen(false)} />
          <div className="relative z-10 w-full max-w-sm">
            <button onClick={() => setAuthOpen(false)} className="absolute -top-12 right-0 text-white/40 hover:text-white flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-colors">Закрыть ✕</button>
            <AuthModal onSuccess={() => setAuthOpen(false)} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
