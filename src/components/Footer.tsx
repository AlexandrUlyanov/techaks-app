import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Phone, Mail, MapPin } from "lucide-react";
import { useTheme } from "next-themes";
import { trpc } from "@/providers/trpc";

function VkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M4.76 7.88c.1-.38.43-.63.83-.63h2.18c.36 0 .67.24.78.58.51 1.58 1.24 3.02 2.2 4.29V8.08c0-.46.37-.83.83-.83h1.81c.46 0 .83.37.83.83v2.28c0 .17.2.25.32.13 1.02-1.01 1.85-2.18 2.5-3.5.14-.29.43-.47.75-.47h2.45c.62 0 1.02.66.72 1.2-.81 1.43-1.81 2.72-2.99 3.87-.14.14-.13.38.03.5 1.37 1.08 2.52 2.37 3.45 3.88.34.55-.06 1.25-.71 1.25h-2.73c-.27 0-.52-.13-.68-.35-.63-.87-1.4-1.66-2.3-2.36-.13-.1-.32-.01-.32.15v1.73c0 .46-.37.83-.83.83h-1.23c-4.43 0-7.77-3.02-9.79-8.85-.06-.18-.07-.37-.02-.55Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M20.67 4.33a1 1 0 0 0-1.05-.15L4.34 10.9a1 1 0 0 0 .1 1.87l4.2 1.38 1.38 4.2a1 1 0 0 0 1.78.2l8.98-13.1a1 1 0 0 0-.1-1.12ZM10.52 13.48l-.73 3.18-.92-2.79 7.94-6.26-6.29 5.87Z" />
    </svg>
  );
}

function TiktokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M14.1 3.25c.35 1.85 1.6 3.04 3.44 3.27v2.45a5.7 5.7 0 0 1-3.15-1v5.67c0 3.36-2.48 5.61-5.63 5.61A5.4 5.4 0 0 1 3.4 13.9c0-3.1 2.38-5.4 5.4-5.4.38 0 .72.04 1.07.12v2.5a3.05 3.05 0 0 0-.93-.14c-1.58 0-2.82 1.16-2.82 2.8 0 1.73 1.3 2.83 2.76 2.83 1.7 0 2.7-1.23 2.7-2.96V3.25h2.52Z" />
    </svg>
  );
}

function VkVideoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M5.75 5.5h8.48c2.3 0 4.17 1.87 4.17 4.17v4.66c0 2.3-1.87 4.17-4.17 4.17H5.75A4.25 4.25 0 0 1 1.5 14.25V9.75A4.25 4.25 0 0 1 5.75 5.5Zm4.1 3.52v6.02l4.97-3.01-4.97-3.03Z" />
    </svg>
  );
}

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
  { label: "О компании", href: "/about" },
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
  { label: "VK", href: "https://vk.com/tech_aks", icon: VkIcon },
  { label: "Telegram", href: "https://t.me/tech_aks", icon: TelegramIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@tech_aks", icon: TiktokIcon },
  { label: "VK Видео", href: "https://vkvideo.ru/@tech_aks", icon: VkVideoIcon },
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
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.15fr] lg:gap-10">
          {/* Brand */}
          <div className="space-y-6 lg:min-h-[22rem]">
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {socialLinks.map(({ href, icon: Icon, label }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-white/70 transition-colors hover:border-[#05C3D4]/45 hover:text-[#7DE7F0]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[#7DE7F0]">
                      <Icon />
                    </span>
                    <span>{label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Catalog */}
          <div className="lg:min-h-[22rem]">
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
          <div className="lg:min-h-[22rem]">
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
          <div className="lg:min-h-[22rem]">
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
              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                      Яндекс Карты
                    </p>
                    <p className="mt-1 text-sm font-bold text-white/70">
                      Рейтинг и отзывы покупателей
                    </p>
                  </div>
                </div>
                <iframe
                  src={yandexBadgeSrc}
                  width="150"
                  height="50"
                  frameBorder="0"
                  loading="lazy"
                  title="Рейтинг ТЕХАКС в Яндекс Картах"
                  className="overflow-hidden rounded-xl"
                />
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
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center md:justify-end">
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
    </footer>
  );
}
