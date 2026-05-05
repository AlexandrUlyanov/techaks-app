import { useState, useEffect } from "react";
import { Link } from "react-router";
import { 
  Sun, Moon, ShoppingBag, User, Search
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import AuthModal from "./AuthModal";
import { CatalogTrigger } from "./Catalog/CatalogMenu";

export default function Header() {
  const [authOpen, setAuthOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { getItemCount } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "shadow-2xl" : ""}`}>
        {/* Main Bar: Logo, Search, Actions */}
        <div className="bg-background/95 backdrop-blur-xl border-b border-border py-4">
          <div className="container-main flex items-center gap-4 md:gap-8">
            {/* Logo */}
            <Link to="/" className="flex items-center group active:scale-95 transition-transform shrink-0">
              <img 
                src={mounted && theme === "dark" ? "/images/logo-color.svg" : "/images/logo-light.svg"} 
                alt="ТЕХАКС" 
                className="h-7 md:h-10 w-auto"
              />
            </Link>

            {/* Desktop Catalog & Nav */}
            <div className="hidden xl:flex items-center gap-6">
              <CatalogTrigger />
              
              <nav className="flex items-center gap-6">
                <Link to="/promotions" className="relative group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-foreground/60 group-hover:text-[#05C3D4] transition-colors">Акции</span>
                  <span className="absolute -top-3 -right-3 px-1.5 py-0.5 bg-[#05C3D4] text-white dark:text-black text-[7px] font-black rounded uppercase animate-pulse">Hot</span>
                </Link>
                <Link to="/stores" className="text-[11px] font-black uppercase tracking-widest text-foreground/60 hover:text-[#05C3D4] transition-colors">Магазины</Link>
              </nav>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center flex-1 max-w-xl h-11 bg-muted/50 border border-border rounded-xl px-4 text-muted-foreground hover:border-[#05C3D4]/50 transition-all cursor-text group">
              <Search size={18} className="mr-3 group-hover:text-[#05C3D4] transition-colors" />
              <input 
                type="text" 
                placeholder="Найти аксессуар или гаджет..." 
                className="bg-transparent border-none outline-none text-sm font-medium w-full placeholder:text-muted-foreground"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-4 ml-auto shrink-0 h-11">
              <a href="tel:+79273750555" className="hidden lg:flex flex-col items-end mr-2 justify-center">
                <span className="text-xs font-black text-foreground">+7 (927) 375-05-55</span>
                <span className="text-[9px] font-bold text-[#05C3D4] uppercase tracking-wider">Ежедневно 9-21</span>
              </a>

              <div className="flex items-center gap-1 md:gap-2 h-full">
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

                <Link to="/checkout" className="p-2.5 text-foreground/40 hover:text-[#05C3D4] transition-colors rounded-xl hover:bg-muted relative" aria-label="Корзина">
                  <ShoppingBag size={22} />
                  {mounted && getItemCount() > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#05C3D4] text-white dark:text-black text-[8px] font-black flex items-center justify-center rounded-full border border-background">
                      {getItemCount()}
                    </span>
                  )}
                </Link>

                {/* Mobile Catalog Trigger */}
                <div className="xl:hidden">
                  <CatalogTrigger />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-[76px] md:h-[86px]" />

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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </>
  );
}
