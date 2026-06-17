import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FolderKanban,
  MoveRight,
  Package2,
  Sparkles,
  Store,
} from "lucide-react";
import { Link } from "react-router";

type HeroCard = {
  id: number;
  slug: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string;
  badge: string | null;
  inStock: boolean;
  categoryName?: string | null;
};

type HeroCategoryCard = {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  icon: string | null;
  productCount: number;
  href: string;
};

type HeroBrandCard = {
  id: number;
  slug: string;
  title: string;
  logo: string;
  productCount: number;
  href: string;
};

type HeroSlide =
  | {
      id: string;
      type: "products";
      theme: "light" | "soft-cyan" | "mesh" | "dark";
      eyebrow: string;
      title: string;
      subtitle: string;
      description: string;
      accent: string;
      primaryCtaLabel: string;
      primaryCtaHref: string;
      secondaryCtaLabel: string;
      secondaryCtaHref: string;
      cards: HeroCard[];
    }
  | {
      id: string;
      type: "promo";
      theme: "light" | "soft-cyan" | "mesh" | "dark";
      eyebrow: string;
      title: string;
      subtitle: string;
      description: string;
      accent: string;
      primaryCtaLabel: string;
      primaryCtaHref: string;
      secondaryCtaLabel: string;
      secondaryCtaHref: string;
    }
  | {
      id: string;
      type: "categories";
      theme: "light" | "soft-cyan" | "mesh" | "dark";
      eyebrow: string;
      title: string;
      subtitle: string;
      description: string;
      accent: string;
      primaryCtaLabel: string;
      primaryCtaHref: string;
      secondaryCtaLabel: string;
      secondaryCtaHref: string;
      categories: HeroCategoryCard[];
    }
  | {
      id: string;
      type: "brands";
      theme: "light" | "soft-cyan" | "mesh" | "dark";
      eyebrow: string;
      title: string;
      subtitle: string;
      description: string;
      accent: string;
      primaryCtaLabel: string;
      primaryCtaHref: string;
      secondaryCtaLabel: string;
      secondaryCtaHref: string;
      brands: HeroBrandCard[];
    };

type HeroData = {
  slides: HeroSlide[];
};

const bubbleLayout = [
  "left-[5%] top-[7%] h-[208px] w-[208px]",
  "right-[8%] top-[10%] h-[152px] w-[152px]",
  "left-[20%] bottom-[11%] h-[248px] w-[248px]",
  "right-[4%] bottom-[15%] h-[184px] w-[184px]",
  "left-[40%] top-[22%] h-[120px] w-[120px]",
  "right-[28%] bottom-[6%] h-[128px] w-[128px]",
];

const themeShellClasses: Record<HeroSlide["theme"], string> = {
  light:
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] text-foreground",
  "soft-cyan":
    "bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(5,195,212,0.08),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] text-foreground",
  mesh:
    "bg-[radial-gradient(circle_at_14%_16%,rgba(5,195,212,0.16),transparent_18%),radial-gradient(circle_at_82%_18%,rgba(5,195,212,0.11),transparent_18%),radial-gradient(circle_at_74%_78%,rgba(5,195,212,0.10),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,253,0.98))] text-foreground",
  dark:
    "bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.22),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(5,195,212,0.16),transparent_24%),linear-gradient(180deg,#111827,#0f172a)] text-white",
};

const themeStageClasses: Record<HeroSlide["theme"], string> = {
  light: "bg-white/80",
  "soft-cyan": "bg-white/74",
  mesh: "bg-white/72",
  dark: "bg-slate-950/30",
};

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function formatProductCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} товара`;
  }
  return `${count} товаров`;
}

function StageShell({
  slide,
  children,
}: {
  slide: HeroSlide;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative h-[420px] overflow-hidden rounded-[34px] p-6 md:h-[520px] md:p-8 ${themeStageClasses[slide.theme]}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-[12%] top-[10%] h-36 w-36 rounded-full bg-[#05C3D4]/10 blur-[70px]" />
        <div className="absolute bottom-[10%] right-[8%] h-40 w-40 rounded-full bg-sky-200/35 blur-[90px] dark:bg-cyan-500/10" />
      </div>
      {children}
    </div>
  );
}

function ProductsStage({ slide }: { slide: Extract<HeroSlide, { type: "products" }> }) {
  return (
    <StageShell slide={slide}>
      <div className="relative h-full">
        {slide.cards.slice(0, 6).map((card, index) => (
          <Link
            key={card.id}
            to={`/product/${card.slug}`}
            className={`group absolute flex items-center justify-center rounded-full bg-white/96 p-5 transition-transform duration-300 hover:scale-[1.02] dark:bg-white ${bubbleLayout[index % bubbleLayout.length]}`}
            style={{
              animation: `heroStageFloat ${11 + index * 0.55}s ease-in-out ${index * -1.1}s infinite`,
            }}
          >
            <img
              src={card.image}
              alt={card.name}
              className="max-h-full max-w-full object-contain"
              loading={index < 2 ? "eager" : "lazy"}
            />

            <div className="pointer-events-none absolute -bottom-2 left-1/2 w-[220px] -translate-x-1/2 rounded-[24px] bg-white/92 p-4 opacity-0 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-opacity duration-300 group-hover:opacity-100">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#05C3D4]">
                {card.badge || (card.inStock ? "В наличии" : "Под заказ")}
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-900">
                {card.name}
              </div>
              <div className="mt-3 text-lg font-black text-slate-900">
                {formatPrice(card.price)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </StageShell>
  );
}

function PromoStage({ slide }: { slide: Extract<HeroSlide, { type: "promo" }> }) {
  const badges = [slide.accent, "Свежая витрина", "Подборки Techaks"].filter(Boolean).slice(0, 3);

  return (
    <StageShell slide={slide}>
      <div className="relative flex h-full flex-col justify-between">
        <div className="grid gap-3 md:max-w-[70%]">
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map(item => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full bg-white/82 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#05C3D4] dark:bg-slate-900/72"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          <div className="max-w-[12ch] text-[clamp(2.4rem,4vw,4.1rem)] font-black leading-[0.92] tracking-[-0.05em]">
            {slide.title || "Промо-витрина Techaks"}
          </div>
          {slide.subtitle ? (
            <div className="max-w-[28rem] text-base font-semibold leading-7 text-foreground/75 dark:text-white/80">
              {slide.subtitle}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            slide.description || "Показывайте акции, запуск новых категорий и сезонные подборки.",
            "Меняйте контент без релиза через админку.",
            "Комбинируйте CTA, тексты и расписание показа.",
          ].map((item, index) => (
            <div
              key={`${slide.id}-${index}`}
              className="rounded-[26px] bg-white/78 p-4 text-sm font-medium leading-6 text-foreground/80 dark:bg-slate-900/64 dark:text-white/82"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </StageShell>
  );
}

function CategoriesStage({
  slide,
}: {
  slide: Extract<HeroSlide, { type: "categories" }>;
}) {
  return (
    <StageShell slide={slide}>
      <div className="grid h-full gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {slide.categories.map(category => (
          <Link
            key={category.id}
            to={category.href}
            className="group flex flex-col rounded-[28px] bg-white/94 p-4 transition-colors hover:bg-white dark:bg-slate-900/82 dark:hover:bg-slate-900"
          >
            <div className="flex h-28 items-center justify-center rounded-[24px] bg-white">
              {category.imageUrl ? (
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#05C3D4]/10 text-[#05C3D4]">
                  <FolderKanban size={22} />
                </div>
              )}
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-black leading-6 text-foreground dark:text-white">
                  {category.name}
                </div>
                <div className="mt-2 text-sm text-muted-foreground dark:text-white/70">
                  {formatProductCount(category.productCount)}
                </div>
              </div>
              <MoveRight
                size={18}
                className="mt-1 shrink-0 text-[#05C3D4] transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>
        ))}
      </div>
    </StageShell>
  );
}

function BrandsStage({ slide }: { slide: Extract<HeroSlide, { type: "brands" }> }) {
  return (
    <StageShell slide={slide}>
      <div className="grid h-full gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {slide.brands.map(brand => (
          <Link
            key={brand.id}
            to={brand.href}
            className="group flex flex-col items-center justify-center rounded-[28px] bg-white/92 px-4 py-6 text-center transition-colors hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900"
          >
            <div className="flex h-16 w-24 items-center justify-center">
              <img
                src={brand.logo}
                alt={brand.title}
                className="max-h-14 max-w-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="mt-4 text-base font-black text-foreground dark:text-white">
              {brand.title}
            </div>
            <div className="mt-2 rounded-full bg-[#05C3D4]/8 px-3 py-1 text-xs font-bold text-muted-foreground dark:text-white/75">
              {formatProductCount(brand.productCount)}
            </div>
          </Link>
        ))}
      </div>
    </StageShell>
  );
}

function getSlideVisualLabel(slide: HeroSlide) {
  if (slide.type === "products") return "Товары";
  if (slide.type === "promo") return "Промо";
  if (slide.type === "categories") return "Категории";
  return "Бренды";
}

function getSlideIcon(slide: HeroSlide) {
  if (slide.type === "products") return Package2;
  if (slide.type === "promo") return Sparkles;
  if (slide.type === "categories") return FolderKanban;
  return Store;
}

function getFallbackTitle(slide: HeroSlide) {
  if (slide.title.trim()) return slide.title;
  if (slide.type === "products") return "Актуальные товары";
  if (slide.type === "promo") return "Новые акценты на главной";
  if (slide.type === "categories") return "Открывайте разделы быстрее";
  return "Проверенные бренды";
}

export default function HeroPromoDynamic({ hero }: { hero: HeroData }) {
  const slides = hero.slides;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex(prev => (prev + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const activeSlide = slides[activeIndex] ?? slides[0];
  const SlideIcon = useMemo(() => (activeSlide ? getSlideIcon(activeSlide) : Sparkles), [
    activeSlide,
  ]);

  if (!activeSlide) return null;

  return (
    <section className={`relative overflow-hidden transition-colors duration-500 ${themeShellClasses[activeSlide.theme]}`}>
      <style>{`
        @keyframes heroStageFloat {
          0% { transform: translate3d(0, 0, 0); }
          25% { transform: translate3d(0, -8px, 0); }
          50% { transform: translate3d(5px, -2px, 0); }
          75% { transform: translate3d(-4px, 6px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
      `}</style>

      <div className="container-main py-12 md:py-16 lg:py-20">
        <div className="overflow-hidden rounded-[42px] bg-white/62 p-5 backdrop-blur-xl dark:bg-slate-950/30 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/82 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4] dark:bg-slate-900/72">
              <SlideIcon size={14} />
              {getSlideVisualLabel(activeSlide)}
            </div>

            {slides.length > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex(prev => (prev - 1 + slides.length) % slides.length)
                  }
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/84 text-foreground transition-colors hover:bg-white dark:bg-slate-900/74 dark:text-white dark:hover:bg-slate-900"
                  aria-label="Предыдущий слайд"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex(prev => (prev + 1) % slides.length)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/84 text-foreground transition-colors hover:bg-white dark:bg-slate-900/74 dark:text-white dark:hover:bg-slate-900"
                  aria-label="Следующий слайд"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:items-center">
            <div className="flex h-full flex-col justify-between">
              <div>
                {activeSlide.eyebrow ? (
                  <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
                    {activeSlide.eyebrow}
                  </div>
                ) : null}
                <h1 className="mt-4 max-w-[12ch] text-[clamp(2.7rem,5vw,4.8rem)] font-black leading-[0.92] tracking-[-0.06em]">
                  {getFallbackTitle(activeSlide)}
                </h1>
                {activeSlide.subtitle ? (
                  <p className="mt-5 max-w-[34rem] text-lg font-semibold leading-relaxed text-foreground/78 dark:text-white/82">
                    {activeSlide.subtitle}
                  </p>
                ) : null}
                {activeSlide.description ? (
                  <p className="mt-4 max-w-[34rem] text-sm leading-7 text-muted-foreground dark:text-white/72 md:text-base">
                    {activeSlide.description}
                  </p>
                ) : null}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {activeSlide.primaryCtaLabel ? (
                  <Link
                    to={activeSlide.primaryCtaHref}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#05C3D4] px-6 text-sm font-black text-black transition-colors hover:bg-[#27d8e8]"
                  >
                    {activeSlide.primaryCtaLabel}
                    <ArrowRight size={16} />
                  </Link>
                ) : null}
                {activeSlide.secondaryCtaLabel ? (
                  <Link
                    to={activeSlide.secondaryCtaHref}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/80 px-6 text-sm font-bold text-foreground transition-colors hover:bg-white dark:bg-slate-900/72 dark:text-white dark:hover:bg-slate-900"
                  >
                    {activeSlide.secondaryCtaLabel}
                  </Link>
                ) : null}
              </div>
            </div>

            <div key={activeSlide.id} className="animate-in fade-in duration-500">
              {activeSlide.type === "products" ? <ProductsStage slide={activeSlide} /> : null}
              {activeSlide.type === "promo" ? <PromoStage slide={activeSlide} /> : null}
              {activeSlide.type === "categories" ? <CategoriesStage slide={activeSlide} /> : null}
              {activeSlide.type === "brands" ? <BrandsStage slide={activeSlide} /> : null}
            </div>
          </div>

          {slides.length > 1 ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {slides.map((slide, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors ${
                      isActive
                        ? "bg-[#05C3D4]/14 text-[#05C3D4]"
                        : "bg-transparent text-muted-foreground hover:bg-white/60 dark:text-white/60 dark:hover:bg-slate-900/52"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${isActive ? "bg-[#05C3D4]" : "bg-current/35"}`} />
                    {slide.title || getSlideVisualLabel(slide)}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
