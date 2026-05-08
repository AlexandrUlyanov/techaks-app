import { Link } from "react-router";
import { Phone, Mail, MapPin, Send } from "lucide-react";

const catalogLinks = [
  { label: "Смартфоны", href: "/catalog?cat=smartfony" },
  { label: "Наушники", href: "/catalog?cat=naushniki" },
  { label: "Зарядка и кабели", href: "/catalog?cat=zaryadka" },
  { label: "Чехлы и защита", href: "/catalog?cat=chehly" },
  { label: "Смарт-часы", href: "/catalog?cat=smart-chasy" },
  { label: "Для дома", href: "/catalog?cat=dom" },
  { label: "ПК и гейминг", href: "/catalog?cat=pc-gaming" },
];

const infoLinks = [
  { label: "О компании", href: "/#" },
  { label: "Магазины", href: "/stores" },
  { label: "Акции", href: "/promotions" },
  { label: "Блог", href: "/blog" },
  { label: "Контакты", href: "/contacts" },
];

export default function Footer() {
  return (
    <footer className="bg-[#15171A] text-white border-t border-white/5">
      <div className="container-main py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center group">
              <img
                src="/images/logo-white.svg"
                alt="ТЕХАКС"
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-sm text-white/50 leading-relaxed font-medium">
              ТЕХАКС — техника и аксессуары в понятном, современном и надежном
              формате. Два магазина в Пензе, помощь с подбором и гарантией.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://t.me/tech_aks"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-[#05C3D4] hover:bg-white/10 transition-all"
              >
                <Send size={20} />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-[#05C3D4] hover:bg-white/10 transition-all"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Catalog */}
          <div>
            <h4 className="text-[13px] font-black uppercase tracking-widest text-white/40 mb-8">
              Каталог
            </h4>
            <ul className="space-y-4">
              {catalogLinks.map(link => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm font-bold text-white/60 hover:text-[#05C3D4] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-[13px] font-black uppercase tracking-widest text-white/40 mb-8">
              Информация
            </h4>
            <ul className="space-y-4">
              {infoLinks.map(link => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm font-bold text-white/60 hover:text-[#05C3D4] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h4 className="text-[13px] font-black uppercase tracking-widest text-white/40 mb-8">
              Контакты
            </h4>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Phone size={14} className="text-[#05C3D4]" />
                </div>
                <div>
                  <a
                    href="tel:+79273750555"
                    className="text-sm font-bold text-white/80 hover:text-[#05C3D4] transition-colors"
                  >
                    +7 (927) 375-05-55
                  </a>
                  <p className="text-[10px] font-bold text-white/40 uppercase mt-1 tracking-wider">
                    Ежедневно 9:00–21:00
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-[#05C3D4]" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-white/80">
                    пр. Строителей, 50А
                  </p>
                  <p className="text-sm font-bold text-white/80">
                    ул. Генерала Глазунова, 1
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-[#05C3D4]" />
                </div>
                <span className="text-sm font-bold text-white/80">
                  info@techaks.ru
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-white/5">
        <div className="container-main py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="text-[11px] font-bold text-white/20 uppercase tracking-[0.2em]">
            © 2026 ТЕХАКС — ТЕХНИКА И АКСЕССУАРЫ
          </span>
          <div className="flex items-center gap-8">
            <span className="text-[10px] font-bold text-white/20 hover:text-white/40 uppercase tracking-wider cursor-pointer transition-colors">
              Политика
            </span>
            <span className="text-[10px] font-bold text-white/20 hover:text-white/40 uppercase tracking-wider cursor-pointer transition-colors">
              Оферта
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
