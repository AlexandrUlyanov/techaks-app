import { Link } from "react-router";
import { Phone, Mail, MapPin } from "lucide-react";
import { trpc } from "@/providers/trpc";

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
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();

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
                    href={`tel:${(siteProfile?.contacts.primaryPhone || "").replace(/\s+/g, "")}`}
                    className="text-sm font-bold text-white/80 hover:text-[#05C3D4] transition-colors"
                  >
                    {siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88"}
                  </a>
                  <p className="text-[10px] font-bold text-white/40 uppercase mt-1 tracking-wider">
                    {siteProfile?.contacts.workingHours || "Ежедневно 9:00–21:00"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-[#05C3D4]" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-white/80">
                    {siteProfile?.contacts.shortAddress || "Пенза"}
                  </p>
                  <p className="text-sm font-bold text-white/80">
                    {siteProfile?.contacts.fullAddress ||
                      "442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-[#05C3D4]" />
                </div>
                <span className="text-sm font-bold text-white/80">
                  {siteProfile?.contacts.email || "tech.aks@yandex.ru"}
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
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
            <Link
              to="/privacy-policy"
              className="text-[10px] font-bold text-white/30 hover:text-white/55 uppercase tracking-wider transition-colors"
            >
              Политика обработки персональных данных
            </Link>
            <span className="text-white/15">·</span>
            <Link
              to="/offer"
              className="text-[10px] font-bold text-white/30 hover:text-white/55 uppercase tracking-wider transition-colors"
            >
              Оферта
            </Link>
            <span className="text-white/15">·</span>
            <Link
              to="/returns"
              className="text-[10px] font-bold text-white/30 hover:text-white/55 uppercase tracking-wider transition-colors"
            >
              Возврат
            </Link>
            <span className="text-white/15">·</span>
            <Link
              to="/payment-delivery"
              className="text-[10px] font-bold text-white/30 hover:text-white/55 uppercase tracking-wider transition-colors"
            >
              Оплата
            </Link>
            <span className="text-white/15">·</span>
            <Link
              to="/payment-delivery"
              className="text-[10px] font-bold text-white/30 hover:text-white/55 uppercase tracking-wider transition-colors"
            >
              Доставка
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
