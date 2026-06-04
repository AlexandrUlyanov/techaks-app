import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Phone, Mail, MapPin } from "lucide-react";
import { useTheme } from "next-themes";
import { trpc } from "@/providers/trpc";

const catalogLinks = [
  { label: "Смартфоны и гаджеты", href: "/catalog?cat=smartfony-i-gadzhety" },
  { label: "Аксессуары для гаджетов", href: "/catalog?cat=aksessuary-dlya-gadzhetov" },
  { label: "Компьютеры и ноутбуки", href: "/catalog?cat=kompyutery-i-noutbuki" },
  { label: "Телевизоры и аудио", href: "/catalog?cat=televizory-i-audio" },
  { label: "Автомобильные аксессуары", href: "/catalog?cat=avtomobilnye-aksessuary" },
  { label: "Для дома", href: "/catalog?cat=dlya-doma" },
  { label: "Инструменты и аксессуары", href: "/catalog?cat=instrumenty-i-aksessuary" },
  { label: "Красота и здоровье", href: "/catalog?cat=krasota-i-zdorove" },
];

const infoLinks = [
  { label: "О компании", href: "/" },
  { label: "Магазины", href: "/stores" },
  { label: "Акции", href: "/promotions" },
  { label: "Блог", href: "/blog" },
  { label: "Контакты", href: "/contacts" },
  { label: "Возврат", href: "/returns" },
  { label: "Оплата", href: "/payment-delivery" },
  { label: "Доставка", href: "/payment-delivery" },
  { label: "Вакансии", href: "https://penza.hh.ru/employer/12280898?tab=VACANCIES", external: true },
];

const socialLinks = [
  { label: "VK", href: "https://vk.com/tech_aks" },
  { label: "Telegram", href: "https://t.me/tech_aks" },
  { label: "TikTok", href: "https://www.tiktok.com/@tech_aks" },
  { label: "VK Видео", href: "https://vkvideo.ru/@tech_aks" },
];

export default function Footer() {
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const yandexBadgeSrc =
    mounted && resolvedTheme === "dark"
      ? "https://yandex.ru/sprav/widget/rating-badge/81538152780?type=rating&theme=dark"
      : "https://yandex.ru/sprav/widget/rating-badge/81538152780?type=rating";

  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-[#15171A] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-[-5rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.14)_0%,rgba(5,195,212,0.05)_38%,transparent_72%)] opacity-70" />
        <div className="absolute bottom-[-7rem] right-[-4rem] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.12)_0%,rgba(5,195,212,0.03)_42%,transparent_76%)] opacity-60" />
        <div className="absolute right-[8%] top-10 h-28 w-40 opacity-[0.08] [background-image:radial-gradient(circle,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:14px_14px]" />
      </div>

      <div className="container-main relative py-20">
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
            <div className="space-y-3">
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">
                Мы в соцсетях
              </span>
              <div className="flex flex-wrap gap-2">
                {socialLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/70 transition-colors hover:border-[#05C3D4]/45 hover:text-[#7DE7F0]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
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
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-bold text-white/60 hover:text-[#05C3D4] transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-sm font-bold text-white/60 hover:text-[#05C3D4] transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
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
          <div className="flex flex-col items-center gap-4 md:items-end">
            <iframe
              src={yandexBadgeSrc}
              width="150"
              height="50"
              frameBorder="0"
              loading="lazy"
              title="Рейтинг ТЕХАКС в Яндекс Картах"
              className="overflow-hidden rounded-xl"
            />
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
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
