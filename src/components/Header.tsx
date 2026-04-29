import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X, Phone, ArrowRight } from "lucide-react";

const navLinks = [
  { label: "Каталог", href: "/catalog" },
  { label: "Акции", href: "/promotions" },
  { label: "Магазины", href: "/stores" },
  { label: "Отзывы", href: "/#reviews" },
  { label: "Блог", href: "/#blog" },
  { label: "Контакты", href: "/contacts" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const announcementHeight = announcementVisible ? 36 : 0;
  const headerTop = announcementVisible ? 36 : 0;

  return (
    <>
      {/* Announcement Bar */}
      {announcementVisible && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center px-4"
          style={{ height: 36, backgroundColor: "#00bcd4" }}
        >
          <span className="text-white text-xs font-medium tracking-wide">
            Акция недели — скидка 20% на power bank HOCO! Успейте до 30 апреля
          </span>
          <button
            onClick={() => setAnnouncementVisible(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <header
        className="fixed left-0 right-0 z-50 bg-white border-b border-gray-200 transition-shadow duration-200"
        style={{
          top: headerTop,
          boxShadow: scrolled ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
        }}
      >
        <div className="container-main flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="text-lg font-extrabold tracking-[0.08em] text-[#0a0a0a] uppercase">
            ТЕХАКС
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-gray-500 hover:text-[#0a0a0a] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="tel:+79273750555"
              className="flex items-center gap-2 text-sm font-semibold text-[#0a0a0a] hover:text-[#00bcd4] transition-colors"
            >
              <Phone size={16} />
              +7 (927) 375-05-55
            </a>
            <Link
              to="/catalog"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00bcd4] text-white text-sm font-semibold rounded-lg hover:bg-[#0097a7] transition-colors"
              style={{ boxShadow: "0 2px 8px rgba(0,188,212,0.35)" }}
            >
              Узнать наличие
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className="lg:hidden p-2"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Spacer */}
      <div style={{ height: 64 + announcementHeight }} />

      {/* Mobile Menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[70] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="fixed top-0 right-0 bottom-0 w-[300px] max-w-[85vw] bg-white z-[80] p-6 lg:hidden"
            style={{
              animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <button
              className="absolute top-4 right-4 p-2"
              onClick={() => setMobileOpen(false)}
            >
              <X size={24} />
            </button>
            <nav className="mt-12 flex flex-col gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-xl font-semibold text-[#0a0a0a]"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 pt-8 border-t border-gray-200">
              <a
                href="tel:+79273750555"
                className="flex items-center gap-2 text-lg font-semibold text-[#0a0a0a]"
              >
                <Phone size={20} />
                +7 (927) 375-05-55
              </a>
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
