import { Link } from "react-router";
import {
  ArrowRight,
  BadgeCheck,
  Cable,
  Headphones,
  House,
  MessageCircleMore,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useSeo } from "@/lib/seo";
import {
  buildBreadcrumbStructuredData,
  buildOrganizationStructuredData,
  buildStoreStructuredData,
} from "@/lib/seo-structured";

const heroHighlights = [
  "Официальные партнёры брендов",
  "Товары без лишних наценок",
  "Гарантия и поддержка",
  "Консультация перед покупкой",
];

const brandCards = [
  {
    title: "HOCO",
    description:
      "Аксессуары, зарядные устройства, кабели, наушники и гаджеты для повседневного использования.",
  },
  {
    title: "Remax",
    description:
      "Современные аксессуары, аудиотехника, зарядные устройства и полезные устройства для дома и работы.",
  },
  {
    title: "ISA",
    description:
      "Практичная электроника и техника, которую мы отбираем по качеству, надежности и востребованности у покупателей.",
  },
  {
    title: "Другие бренды",
    description:
      "Мы расширяем ассортимент за счёт производителей, которые проходят отбор по качеству, сервису и спросу у клиентов.",
  },
];

const categoryCards = [
  {
    title: "Умная электроника",
    description:
      "Яндекс Станции, умные часы, беспроводные наушники и другие устройства для современного образа жизни.",
    icon: Smartphone,
  },
  {
    title: "Аудиотехника",
    description:
      "Портативные колонки, гарнитуры, наушники и аксессуары для музыки, общения и работы.",
    icon: Headphones,
  },
  {
    title: "Аксессуары для гаджетов",
    description:
      "Кабели, зарядные устройства, пауэрбанки, держатели, переходники, чехлы и другие полезные товары.",
    icon: Cable,
  },
  {
    title: "Техника для дома",
    description:
      "Мелкая бытовая техника: тостеры, блендеры и другие устройства, которые помогают в быту каждый день.",
    icon: House,
  },
];

const advantages = [
  {
    title: "Цены от производителей",
    description:
      "Благодаря прямым контрактам с брендами мы предлагаем товары без лишних наценок.",
    icon: Wallet,
  },
  {
    title: "Широкий ассортимент",
    description:
      "У нас можно подобрать решение для разных задач: от простого кабеля до умной электроники и техники для дома.",
    icon: Sparkles,
  },
  {
    title: "Гарантия качества",
    description:
      "Вся продукция сертифицирована и поддерживается официальными сервисными центрами.",
    icon: ShieldCheck,
  },
  {
    title: "Клиентский сервис",
    description:
      "Наши консультанты помогут разобраться в характеристиках, сравнить товары и выбрать подходящий вариант.",
    icon: MessageCircleMore,
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-3xl">
      <span className="block text-[11px] font-black uppercase tracking-[0.32em] text-[#05C3D4] sm:text-xs">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-black leading-[0.96] tracking-[-0.05em] text-foreground sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground sm:text-[17px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function AboutPage() {
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: stores = [] } = trpc.store.getAll.useQuery();

  useSeo({
    title: "О компании ТЕХАКС — техника и аксессуары в Пензе",
    description:
      "ТЕХАКС — розничная сеть магазинов техники и аксессуаров в Пензе. Официальный партнёр брендов HOCO, Remax, ISA и других производителей. Умная электроника, аудиотехника, аксессуары и техника для дома.",
    canonicalPath: "/about",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", path: "/" },
        { name: "О компании", path: "/about" },
      ]),
      buildOrganizationStructuredData({
        name: "ТЕХАКС",
        url: "https://techaks.ru",
        logo: "/images/logo-light.svg",
        email: siteProfile?.contacts.email || "tech.aks@yandex.ru",
        phone: siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88",
        address: siteProfile?.contacts.fullAddress || siteProfile?.seller.legalAddress,
      }),
      ...stores.map(store => buildStoreStructuredData(store)),
    ],
  });

  return (
    <div className="bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="absolute inset-0">
          <div className="absolute left-[-10rem] top-[-8rem] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.14)_0%,rgba(5,195,212,0.03)_48%,transparent_74%)]" />
          <div className="absolute right-[-8rem] top-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.1)_0%,rgba(5,195,212,0.02)_50%,transparent_76%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--tech-color-primary)_4%,transparent)_100%)]" />
        </div>

        <div className="container-main relative py-20 sm:py-24 lg:py-32">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-end">
            <div className="max-w-4xl">
              <span className="inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--tech-color-primary)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
                О компании
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[0.92] tracking-[-0.06em] text-foreground sm:text-5xl lg:text-[4.4rem]">
                ТЕХАКС — техника и аксессуары в Пензе
              </h1>
              <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-foreground/85 sm:text-xl">
                Современные гаджеты, полезная электроника и аксессуары для
                повседневной жизни — по честным ценам и с гарантией качества.
              </p>
              <p className="mt-5 max-w-3xl text-[15px] leading-8 text-muted-foreground sm:text-[17px]">
                ТЕХАКС — розничная сеть магазинов техники и аксессуаров в Пензе.
                Мы помогаем клиентам выбирать удобные, надежные и современные
                решения для дома, работы, учебы, автомобиля и отдыха.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/catalog">
                    Перейти в каталог
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/contacts">Связаться с нами</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tech-color-surface)_84%,transparent)_0%,color-mix(in_srgb,var(--tech-color-surface-muted)_92%,transparent)_100%)] p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,transparent)] text-[#05C3D4]">
                  <BadgeCheck size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                    Партнёрский контур
                  </p>
                  <p className="mt-1 text-xl font-black tracking-tight text-foreground">
                    Надёжный выбор без лишнего шума
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {["HOCO", "Remax", "ISA"].map(brand => (
                  <div
                    key={brand}
                    className="rounded-2xl bg-background/80 px-4 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-foreground"
                  >
                    {brand}
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                {[
                  "Подбор техники под конкретную задачу",
                  "Ассортимент для дома, работы и дороги",
                  "Официальные поставки и гарантийная поддержка",
                ].map(item => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-background/60 px-4 py-3"
                  >
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#05C3D4]" />
                    <span className="text-sm font-medium leading-6 text-foreground/80">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {heroHighlights.map(item => (
              <div
                key={item}
                className="rounded-[1.4rem] border border-border/60 bg-card/70 px-4 py-4 text-sm font-bold text-foreground/80 backdrop-blur-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-main grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
          <div>
            <SectionHeading eyebrow="Кто мы" title="Кто мы" />
            <div className="mt-8 space-y-5 text-[15px] leading-8 text-muted-foreground sm:text-[17px]">
              <p>
                ТЕХАКС — это магазин для тех, кто хочет покупать технику
                спокойно, понятно и без переплат.
              </p>
              <p>
                Мы являемся официальным партнёром ведущих брендов, среди которых
                HOCO, Remax, ISA и другие производители современной электроники и
                аксессуаров. Благодаря прямому сотрудничеству с поставщиками мы
                формируем ассортимент качественных товаров без лишних посредников
                и необоснованных наценок.
              </p>
              <p>
                Наша задача — не просто продать товар, а помочь клиенту выбрать
                именно то, что действительно подходит под его задачи, бюджет и
                образ жизни.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tech-color-surface)_92%,transparent)_0%,color-mix(in_srgb,var(--tech-color-primary)_6%,var(--tech-color-surface))_100%)] p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Официальные партнёры",
                  text: "Работаем с брендами напрямую и следим за качеством ассортимента.",
                },
                {
                  title: "Без лишних наценок",
                  text: "Формируем предложение так, чтобы техника оставалась доступной и честной по цене.",
                },
                {
                  title: "Консультация перед покупкой",
                  text: "Помогаем сравнить модели и выбрать практичное решение.",
                },
                {
                  title: "После покупки тоже рядом",
                  text: "Подскажем по гарантии, выдаче, заказу и получению товара.",
                },
              ].map(item => (
                <div
                  key={item.title}
                  className="rounded-[1.6rem] bg-background/80 px-5 py-5"
                >
                  <p className="text-base font-black tracking-tight text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-main">
          <SectionHeading
            eyebrow="Бренды"
            title="Работаем с проверенными брендами"
            description="Мы выбираем производителей, которые хорошо зарекомендовали себя на рынке аксессуаров, гаджетов и электроники."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {brandCards.map(card => (
              <article
                key={card.title}
                className="rounded-[1.8rem] bg-[var(--tech-color-surface-muted)] px-6 py-6"
              >
                <div className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,transparent)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.26em] text-[#05C3D4]">
                  {card.title}
                </div>
                <p className="mt-5 text-sm leading-7 text-muted-foreground">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-main">
          <SectionHeading
            eyebrow="Ассортимент"
            title="Что вы найдёте в ТЕХАКС"
            description="В наших магазинах собраны товары, которые делают жизнь удобнее, проще и технологичнее."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categoryCards.map(card => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="rounded-[1.8rem] border border-border/70 bg-card/80 px-6 py-6"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] text-[#05C3D4]">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-5 text-xl font-black tracking-tight text-foreground">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {card.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-main">
          <SectionHeading eyebrow="Преимущества" title="Почему выбирают ТЕХАКС" />

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {advantages.map(item => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-[1.8rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tech-color-surface)_88%,transparent)_0%,color-mix(in_srgb,var(--tech-color-primary)_5%,var(--tech-color-surface))_100%)] px-6 py-6"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 text-[#05C3D4]">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-5 text-xl font-black tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-24 pt-8 sm:pb-28">
        <div className="container-main">
          <div className="relative overflow-hidden rounded-[2.2rem] border border-border/70 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--tech-color-primary)_12%,var(--tech-color-surface))_0%,var(--tech-color-surface)_54%,color-mix(in_srgb,var(--tech-color-primary)_8%,var(--tech-color-surface-muted))_100%)] px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
            <div className="absolute right-[-4rem] top-[-4rem] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.18)_0%,rgba(5,195,212,0.03)_55%,transparent_78%)]" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-3xl">
                <span className="block text-[11px] font-black uppercase tracking-[0.32em] text-[#05C3D4]">
                  Финальный акцент
                </span>
                <h2 className="mt-4 text-3xl font-black leading-[0.96] tracking-[-0.05em] text-foreground sm:text-4xl lg:text-5xl">
                  Нужна техника или аксессуары?
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-muted-foreground sm:text-[17px]">
                  Загляните в каталог ТЕХАКС — мы собрали товары, которые
                  пригодятся каждый день: дома, в дороге, на работе и в учебе.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button asChild size="lg">
                  <Link to="/catalog">Смотреть каталог</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/contacts">Задать вопрос</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
