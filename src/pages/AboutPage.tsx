import { Link } from "react-router";
import {
  ArrowRight,
  BadgeCheck,
  Cable,
  CheckCircle2,
  Headphones,
  House,
  MessageCircleMore,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Wallet,
  Zap,
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
    tone: "from-[#05C3D4]/12 via-[#05C3D4]/4 to-transparent",
  },
  {
    title: "Remax",
    description:
      "Современные аксессуары, аудиотехника, зарядные устройства и полезные устройства для дома и работы.",
    tone: "from-emerald-400/12 via-emerald-400/4 to-transparent",
  },
  {
    title: "ISA",
    description:
      "Практичная электроника и техника, которую мы отбираем по качеству, надежности и востребованности у покупателей.",
    tone: "from-sky-400/12 via-sky-400/4 to-transparent",
  },
  {
    title: "Другие бренды",
    description:
      "Подключаем производителей, которые проходят проверку по качеству, сервису и реальной пользе для покупателя.",
    tone: "from-violet-400/12 via-violet-400/4 to-transparent",
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
      "От кабелей и зарядок до техники для дома и умной электроники — в одном понятном каталоге.",
    icon: Sparkles,
  },
  {
    title: "Гарантия качества",
    description:
      "Работаем с официальными поставками и поддерживаем гарантийные сценарии после покупки.",
    icon: ShieldCheck,
  },
  {
    title: "Клиентский сервис",
    description:
      "Помогаем сравнить модели, подобрать совместимые аксессуары и не переплатить за лишнее.",
    icon: MessageCircleMore,
  },
];

const trustSignals = [
  "Подбор под дом, работу, учебу и дорогу",
  "Понятная консультация без навязчивости",
  "Самовывоз и поддержка после покупки",
];

const workflowSteps = [
  {
    title: "Запрос",
    text: "Понимаем, для чего именно нужен товар: на каждый день, для машины, для учебы или дома.",
  },
  {
    title: "Подбор",
    text: "Показываем несколько понятных вариантов по бюджету, характеристикам и совместимости.",
  },
  {
    title: "Покупка без лишнего",
    text: "Помогаем выбрать ровно то, что нужно, без ненужных допродаж и запутанных сценариев.",
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

function VisualMetric({
  label,
  value,
  widthClass,
}: {
  label: string;
  value: string;
  widthClass: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[12px] font-bold text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground/80">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-foreground/5">
        <div
          className={`h-full rounded-full bg-[linear-gradient(90deg,#05C3D4_0%,rgba(5,195,212,0.32)_100%)] ${widthClass} transition-all duration-700 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-3`}
        />
      </div>
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
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0">
          <div className="absolute left-[-10rem] top-[-9rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.16)_0%,rgba(5,195,212,0.04)_48%,transparent_74%)]" />
          <div className="absolute right-[-8rem] top-8 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.12)_0%,rgba(5,195,212,0.02)_55%,transparent_76%)]" />
          <div className="absolute bottom-0 left-[10%] h-32 w-56 opacity-[0.08] [background-image:radial-gradient(circle,rgba(5,195,212,0.95)_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>

        <div className="container-main relative py-20 sm:py-24 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-center">
            <div className="max-w-4xl">
              <span className="inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--tech-color-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_9%,transparent)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2">
                О компании
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[0.92] tracking-[-0.06em] text-foreground sm:text-5xl lg:text-[4.35rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
                ТЕХАКС — техника и аксессуары в Пензе
              </h1>
              <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-foreground/85 sm:text-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
                Современные гаджеты, полезная электроника и аксессуары для
                повседневной жизни — по честным ценам и с гарантией качества.
              </p>
              <p className="mt-5 max-w-3xl text-[15px] leading-8 text-muted-foreground sm:text-[17px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
                ТЕХАКС — розничная сеть магазинов техники и аксессуаров в Пензе.
                Мы помогаем выбирать удобные и надежные решения для дома,
                работы, учебы, автомобиля и отдыха — без перегруза, лишних
                посредников и непонятных сценариев покупки.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-5 motion-safe:duration-700">
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

            <div className="relative">
              <div className="absolute inset-x-10 top-10 h-40 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.18)_0%,rgba(5,195,212,0.02)_60%,transparent_80%)] blur-2xl" />
              <div className="relative rounded-[2.25rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tech-color-surface)_90%,transparent)_0%,color-mix(in_srgb,var(--tech-color-primary)_5%,var(--tech-color-surface-muted))_100%)] p-6 sm:p-7 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-700">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="rounded-[1.8rem] bg-background/86 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,transparent)] text-[#05C3D4]">
                        <BadgeCheck size={22} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                          Как мы работаем
                        </p>
                        <p className="mt-1 text-xl font-black tracking-tight text-foreground">
                          Спокойный подбор без перегруза
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      <VisualMetric label="Под дом и повседневные задачи" value="Фокус" widthClass="w-[88%]" />
                      <VisualMetric label="Под работу и учебу" value="Подбор" widthClass="w-[72%]" />
                      <VisualMetric label="Под автомобиль и дорогу" value="Аксессуары" widthClass="w-[64%]" />
                    </div>
                  </div>

                  <div className="rounded-[1.8rem] bg-background/72 p-5">
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                          Основной контур
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {["HOCO", "Remax", "ISA"].map(brand => (
                            <span
                              key={brand}
                              className="rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_9%,transparent)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#05C3D4]"
                            >
                              {brand}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-6 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                          <Store size={15} className="text-[#05C3D4]" />
                          Самовывоз и магазин
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                          <Zap size={15} className="text-[#05C3D4]" />
                          Быстрые полезные товары
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {trustSignals.map((item, index) => (
                    <div
                      key={item}
                      className="rounded-[1.5rem] bg-background/70 px-4 py-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3"
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] text-[#05C3D4]">
                          <CheckCircle2 size={14} />
                        </span>
                        <span className="text-sm font-semibold leading-6 text-foreground/80">
                          {item}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {heroHighlights.map((item, index) => (
              <div
                key={item}
                className="rounded-[1.4rem] bg-card/68 px-4 py-4 text-sm font-bold text-foreground/80 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
                style={{ animationDelay: `${120 + index * 80}ms` }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-main grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Кто мы"
              title="Магазин, в котором технику выбирают спокойно"
              description="Мы строим ассортимент и консультацию вокруг реальных сценариев покупки, а не вокруг сложных витрин и навязчивых допродаж."
            />
            <div className="mt-8 space-y-5 text-[15px] leading-8 text-muted-foreground sm:text-[17px]">
              <p>
                ТЕХАКС — это магазин для тех, кто хочет покупать технику
                понятно, без переплат и с ощущением, что ему действительно
                помогают разобраться.
              </p>
              <p>
                Мы работаем с официальными поставками и сотрудничаем с брендами
                HOCO, Remax, ISA и другими производителями современной
                электроники и аксессуаров. Благодаря прямому взаимодействию с
                поставщиками мы удерживаем ассортимент практичным, а цены —
                честными.
              </p>
              <p>
                Наша задача — помочь подобрать решение под конкретную задачу:
                дома, в дороге, в автомобиле, на работе или в учебе. Поэтому
                для нас важны не только характеристики, но и то, насколько товар
                действительно будет полезен в жизни.
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.2rem] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--tech-color-primary)_9%,transparent)_0%,color-mix(in_srgb,var(--tech-color-surface)_90%,transparent)_52%,color-mix(in_srgb,var(--tech-color-primary)_5%,var(--tech-color-surface-muted))_100%)] p-6 sm:p-8">
            <div className="absolute right-[-3rem] top-[-3rem] h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.16)_0%,rgba(5,195,212,0.02)_62%,transparent_80%)]" />
            <div className="relative">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#05C3D4]">
                Как выглядит наш подход
              </p>
              <div className="mt-6 space-y-4">
                {workflowSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className="group rounded-[1.6rem] bg-background/76 px-5 py-5 transition-colors duration-200 hover:bg-background/88 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-3"
                    style={{ animationDelay: `${index * 110}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] text-sm font-black text-[#05C3D4]">
                        0{index + 1}
                      </div>
                      <div>
                        <p className="text-lg font-black tracking-tight text-foreground">
                          {step.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {step.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
            {brandCards.map((card, index) => (
              <article
                key={card.title}
                className="group relative overflow-hidden rounded-[1.9rem] bg-[var(--tech-color-surface-muted)] px-6 py-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className={`absolute inset-0 bg-[linear-gradient(180deg,var(--tw-gradient-stops))] ${card.tone} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                <div className="relative">
                  <div className="inline-flex rounded-full bg-background/75 px-4 py-2 text-[11px] font-black uppercase tracking-[0.26em] text-[#05C3D4]">
                    {card.title}
                  </div>
                  <p className="mt-5 text-sm leading-7 text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container-main">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-end">
            <SectionHeading
              eyebrow="Ассортимент"
              title="Что вы найдёте в ТЕХАКС"
              description="В наших магазинах собраны товары, которые делают жизнь удобнее, проще и технологичнее."
            />

            <div className="rounded-[2rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tech-color-primary)_7%,transparent)_0%,color-mix(in_srgb,var(--tech-color-surface)_92%,transparent)_100%)] px-6 py-6">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
                Что объединяет ассортимент
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Актуальные гаджеты",
                  "Полезные аксессуары",
                  "Техника для ежедневного быта",
                  "Товары, которые легко выбрать и использовать",
                ].map(item => (
                  <div
                    key={item}
                    className="rounded-[1.2rem] bg-background/80 px-4 py-3 text-sm font-semibold text-foreground/80"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categoryCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="group rounded-[1.9rem] bg-card/82 px-6 py-6 transition-colors duration-200 hover:bg-card motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] text-[#05C3D4] transition-colors duration-200 group-hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,transparent)]">
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
          <SectionHeading
            eyebrow="Преимущества"
            title="Почему выбирают ТЕХАКС"
            description="Нам важно, чтобы покупка техники ощущалась понятной, полезной и спокойной на всех этапах — от выбора до получения."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {advantages.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-[1.9rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tech-color-surface)_92%,transparent)_0%,color-mix(in_srgb,var(--tech-color-primary)_5%,var(--tech-color-surface))_100%)] px-6 py-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/82 text-[#05C3D4]">
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
          <div className="relative overflow-hidden rounded-[2.35rem] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--tech-color-primary)_11%,var(--tech-color-surface))_0%,var(--tech-color-surface)_56%,color-mix(in_srgb,var(--tech-color-primary)_8%,var(--tech-color-surface-muted))_100%)] px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
            <div className="absolute left-[-4rem] bottom-[-3rem] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.16)_0%,rgba(5,195,212,0.02)_60%,transparent_80%)]" />
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
