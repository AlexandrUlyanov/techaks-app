import { Link } from "react-router";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";

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
  { label: "Блог", href: "/#blog" },
  { label: "Контакты", href: "/contacts" },
];

export default function Footer() {
  return (
    <footer className="bg-[#00252b] text-white">
      <div className="container-main py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="text-lg font-extrabold tracking-[0.08em] uppercase">ТЕХАКС</div>
            <p className="mt-4 text-sm text-gray-400 leading-relaxed">
              Магазин техники и аксессуаров в Пензе. Два магазина, широкий ассортимент, низкие цены.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a href="https://t.me/tech_aks" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <Send size={18} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            </div>
          </div>

          {/* Catalog */}
          <div>
            <h4 className="text-base font-semibold mb-5">Каталог</h4>
            <ul className="space-y-3">
              {catalogLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-base font-semibold mb-5">Информация</h4>
            <ul className="space-y-3">
              {infoLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h4 className="text-base font-semibold mb-5">Контакты</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-[#00bcd4] mt-0.5 shrink-0" />
                <div>
                  <a href="tel:+79273750555" className="text-sm text-gray-400 hover:text-white transition-colors">+7 (927) 375-05-55</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={16} className="text-[#00bcd4] mt-0.5 shrink-0" />
                <span className="text-sm text-gray-400">info@techaks.ru</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-[#00bcd4] mt-0.5 shrink-0" />
                <span className="text-sm text-gray-400">пр. Строителей, 50А</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-[#00bcd4] mt-0.5 shrink-0" />
                <span className="text-sm text-gray-400">ул. Генерала Глазунова, 1</span>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-[#00bcd4] mt-0.5 shrink-0" />
                <span className="text-sm text-gray-400">Ежедневно 9:00–21:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-[#2a2a2a]">
        <div className="container-main py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs text-gray-500">© 2026 ТЕХАКС. Все права защищены.</span>
          <div className="flex items-center gap-6">
            <span className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer">Политика конфиденциальности</span>
            <span className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer">Оферта</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
