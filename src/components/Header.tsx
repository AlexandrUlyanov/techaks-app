import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X, Phone, ArrowRight, Sun, Moon, ShoppingBag } from "lucide-react";
import { useTheme } from "next-themes";
import { useCart } from "@/hooks/use-cart";
import CartDrawer from "./CartDrawer";

const categories = [
  { label: "Смартфоны", href: "/catalog?cat=smartfony" },
  { label: "Наушники", href: "/catalog?cat=naushniki" },
  { label: "Зарядка", href: "/catalog?cat=zaryadka" },
  { label: "Чехлы", href: "/catalog?cat=chehly" },
];

const navLinks = [
  { label: "Акции", href: "/promotions" },
  { label: "Магазины", href: "/stores" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { getItemCount } = useCart();
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

  const headerHeight = announcementVisible ? 116 : 80;

  return (
    <>
      {/* CRO: Announcement Bar for Urgency/Trust */}
      {announcementVisible && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center px-4 bg-[#05C3D4]"
          style={{ height: 36 }}
        >
          <span className="text-black text-[10px] md:text-xs font-black tracking-widest uppercase">
            ⚡️ Акция недели: -20% на все аксессуары HOCO до 30 апреля
          </span>
          <button
            onClick={() => setAnnouncementVisible(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header: Adaptable Theme */}
      <header
        className={`fixed left-0 right-0 z-50 transition-all duration-500 ${
          scrolled 
            ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-2xl" 
            : "bg-transparent border-b border-transparent"
        }`}
        style={{ top: announcementVisible ? 36 : 0 }}
      >
        <div className="container-main flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center group active:scale-95 transition-transform">
            <img 
              src={mounted && theme === "dark" ? "/images/logo-color.svg" : "/images/logo-light.svg"} 
              alt="ТЕХАКС" 
              className="h-7 md:h-9 w-auto"
            />
          </Link>

          {/* CRO: Direct Access to Categories in Main Menu (Reduced Friction) */}
          <nav className="hidden lg:flex items-center gap-8">
            <div className="h-6 w-px bg-foreground/10 mx-2" />
            {categories.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-[11px] font-black text-foreground/50 hover:text-[#05C3D4] dark:hover:text-[#05C3D4] uppercase tracking-widest transition-all hover:-translate-y-0.5"
              >
                {link.label}
              </Link>
            ))}
            <div className="h-6 w-px bg-foreground/10 mx-2" />
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-[11px] font-black text-foreground/40 hover:text-foreground uppercase tracking-widest transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions: High Contrast Call-to-Action */}
          <div className="hidden lg:flex items-center gap-8">
            {/* Theme Toggle: Slightly more visible in light mode for accessibility */}
            <button
              onClick={toggleTheme}
              className="p-2 text-foreground/40 hover:text-[#05C3D4] dark:text-foreground/20 dark:hover:text-[#05C3D4] transition-all duration-500 transform active:rotate-45 active:scale-90"
              aria-label="Toggle theme"
            >
              {mounted && theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Cart Button */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-foreground/40 hover:text-[#05C3D4] transition-colors"
              aria-label="Корзина"
            >
              <ShoppingBag size={20} />
              {mounted && getItemCount() > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#05C3D4] text-white dark:text-black text-[9px] font-black flex items-center justify-center rounded-full animate-in zoom-in">
                  {getItemCount()}
                </span>
              )}
            </button>

            <a
              href="tel:+79273750555"
              className="flex items-center gap-2 text-xs font-black text-foreground hover:text-[#05C3D4] transition-colors"
            >
              <Phone size={14} className="text-[#05C3D4]" />
              +7 (927) 375-05-55
            </a>
            <Link
              to="/catalog"
              className="flex items-center gap-3 px-8 py-3.5 bg-[#05C3D4] text-white dark:text-black text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-[#27E6F2] transition-all glow-cyan active:scale-95 shadow-lg shadow-[#05C3D4]/10"
            >
              Каталог
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Mobile Actions */}
          <div className="lg:hidden flex items-center gap-4">
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-foreground/40"
            >
              <ShoppingBag size={22} />
              {mounted && getItemCount() > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-[#05C3D4] text-white dark:text-black text-[8px] font-black flex items-center justify-center rounded-full">
                  {getItemCount()}
                </span>
              )}
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 text-foreground/40"
            >
              {mounted && theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="p-2 text-foreground"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={28} />
            </button>
          </div>
        </div>
      </header>

      {/* Spacer to prevent content jump */}
      <div style={{ height: headerHeight }} />

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />

      {/* Mobile Menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="fixed top-0 right-0 bottom-0 w-[300px] max-w-[85vw] bg-[#15171A] border-l border-white/5 z-[80] p-8 lg:hidden"
            style={{
              animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <button
              className="absolute top-6 right-6 p-2 text-white/60 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X size={28} />
            </button>
            
            <div className="mt-12">
              <Link to="/" className="flex flex-col leading-none" onClick={() => setMobileOpen(false)}>
                <span className="text-2xl font-black tracking-tighter uppercase font-heading text-white">
                  ТЕХ<span className="text-[#05C3D4]">АКС</span>
                </span>
              </Link>
            </div>

            <nav className="mt-12 flex flex-col gap-8">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Категории</span>
                <div className="grid grid-cols-1 gap-4">
                  {categories.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="text-xl font-black text-white hover:text-[#05C3D4] uppercase tracking-tight transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-8 border-t border-white/5">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Информация</span>
                <div className="grid grid-cols-1 gap-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="text-lg font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
            <div className="mt-12 pt-12 border-t border-white/10">
              <a
                href="tel:+79273750555"
                className="flex items-center gap-3 text-lg font-black text-white"
              >
                <Phone size={24} className="text-[#05C3D4]" />
                +7 (927) 375-05-55
              </a>
              <Link
                to="/catalog"
                onClick={() => setMobileOpen(false)}
                className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-[#05C3D4] text-black text-sm font-black uppercase tracking-widest rounded-xl hover:bg-[#27E6F2] transition-all"
              >
                Каталог
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
