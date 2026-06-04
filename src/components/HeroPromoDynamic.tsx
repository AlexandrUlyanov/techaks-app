import { ArrowRight, BadgeCheck, Headphones, ShieldCheck, Sparkles } from "lucide-react";
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

type HeroData = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  benefits: string[];
  cards: HeroCard[];
};

const benefitIcons = [BadgeCheck, Sparkles, ShieldCheck, Headphones];

const desktopBubbleLayout = [
  {
    shell: "left-[4%] top-[6%] h-[198px] w-[198px]",
    panel: "left-[1%] top-[52%]",
    delay: "0s",
    duration: "11s",
  },
  {
    shell: "right-[6%] top-[5%] h-[148px] w-[148px]",
    panel: "right-[2%] top-[35%]",
    delay: "-1.4s",
    duration: "12.4s",
  },
  {
    shell: "left-[16%] bottom-[8%] h-[242px] w-[242px]",
    panel: "left-[8%] bottom-[7%]",
    delay: "-2.2s",
    duration: "12.8s",
  },
  {
    shell: "right-[0%] bottom-[13%] h-[178px] w-[178px]",
    panel: "right-[3%] bottom-[2%]",
    delay: "-3.6s",
    duration: "11.8s",
  },
] as const;

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export default function HeroPromoDynamic({ hero }: { hero: HeroData }) {
  const cards = hero.cards.slice(0, 4);

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(5,195,212,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,1))] transition-colors duration-500 dark:bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(5,195,212,0.08),transparent_30%),linear-gradient(180deg,#111827,#0f172a)]">
      <style>{`
        @keyframes heroBubbleFloat {
          0% { transform: translate3d(0, 0, 0); }
          25% { transform: translate3d(0, -6px, 0); }
          50% { transform: translate3d(4px, -2px, 0); }
          75% { transform: translate3d(-3px, 5px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 opacity-[0.045] dark:opacity-[0.08]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(5,195,212,0.32),transparent_18%),radial-gradient(circle_at_84%_16%,rgba(5,195,212,0.22),transparent_16%),radial-gradient(circle_at_78%_80%,rgba(5,195,212,0.16),transparent_18%),radial-gradient(circle_at_18%_82%,rgba(5,195,212,0.14),transparent_20%)]" />
      </div>

      <div className="container-main relative z-10 grid gap-10 py-14 md:gap-12 md:py-16 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center lg:py-20">
        <div className="max-w-[680px]">
          <div className="inline-flex items-center rounded-full bg-white/75 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4] backdrop-blur-sm dark:bg-slate-900/70">
            {hero.eyebrow}
          </div>

          <h1 className="mt-6 max-w-[9.6ch] text-[clamp(2.7rem,5vw,4.65rem)] font-black leading-[0.93] tracking-[-0.06em] text-foreground">
            {hero.title}
          </h1>

          <p className="mt-5 max-w-[38rem] text-lg font-semibold leading-relaxed text-foreground/76 md:text-[1.18rem]">
            {hero.subtitle}
          </p>

          <p className="mt-4 max-w-[39rem] text-sm leading-7 text-muted-foreground/95 md:text-base">
            {hero.description}
          </p>

          <div className="mt-8 flex flex-wrap gap-3 md:gap-4">
            <Link
              to={hero.primaryCtaHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#05C3D4] px-6 text-sm font-black text-black transition-colors hover:bg-[#27d8e8]"
            >
              {hero.primaryCtaLabel}
              <ArrowRight size={16} />
            </Link>
            <Link
              to={hero.secondaryCtaHref}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/80 px-6 text-sm font-bold text-foreground transition-colors hover:bg-white dark:bg-slate-900/75 dark:hover:bg-slate-900"
            >
              {hero.secondaryCtaLabel}
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {hero.benefits.slice(0, 4).map((benefit, index) => {
              const Icon = benefitIcons[index % benefitIcons.length];
              return (
                <div
                  key={benefit}
                  className="flex min-h-14 items-center gap-3 rounded-[24px] bg-white/72 px-4 py-3 backdrop-blur-sm dark:bg-slate-900/62"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#05C3D4]/10 text-[#05C3D4]">
                    <Icon size={18} />
                  </div>
                  <span className="text-sm font-semibold leading-5 text-foreground/88">
                    {benefit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:justify-self-end lg:w-full lg:max-w-[640px]">
          <div className="relative hidden min-h-[560px] lg:block">
            <div className="pointer-events-none absolute left-[16%] top-[10%] h-[210px] w-[210px] rounded-full bg-[#05C3D4]/12 blur-[90px]" />
            <div className="pointer-events-none absolute right-[12%] top-[20%] h-[160px] w-[160px] rounded-full bg-[#05C3D4]/10 blur-[76px]" />
            <div className="pointer-events-none absolute bottom-[10%] left-[34%] h-[240px] w-[240px] rounded-full bg-sky-100/70 blur-[110px] dark:bg-cyan-500/10" />

            <div className="relative h-full overflow-hidden rounded-[40px]">
              {cards.map((card, index) => {
                const layout = desktopBubbleLayout[index % desktopBubbleLayout.length];
                return (
                  <div key={card.id} className="group absolute inset-0">
                    <Link
                      to={`/product/${card.slug}`}
                      className={`absolute ${layout.shell} flex items-center justify-center rounded-full bg-white/96 p-5 dark:bg-slate-900/92`}
                      style={{
                        animation: `heroBubbleFloat ${layout.duration} ease-in-out ${layout.delay} infinite`,
                      }}
                    >
                      <img
                        src={card.image}
                        alt={card.name}
                        className="max-h-full max-w-full object-contain"
                        loading="eager"
                      />
                    </Link>

                    <div
                      className={`pointer-events-none absolute ${layout.panel} w-[230px] rounded-[24px] bg-white/84 p-4 opacity-0 backdrop-blur-xl transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100 dark:bg-slate-950/78`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#05C3D4]">
                        {card.badge || (card.inStock ? "В наличии" : "Под заказ")}
                      </div>
                      <div className="mt-2 line-clamp-3 text-base font-black leading-6 text-foreground">
                        {card.name}
                      </div>
                      {card.categoryName ? (
                        <div className="mt-3 text-xs font-medium text-muted-foreground">
                          {card.categoryName}
                        </div>
                      ) : null}
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-xl font-black text-foreground">
                          {formatPrice(card.price)}
                        </span>
                        {card.oldPrice && card.oldPrice > card.price ? (
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(card.oldPrice)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 lg:hidden">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {cards.map((card, index) => (
                <Link
                  key={card.id}
                  to={`/product/${card.slug}`}
                  className="min-w-[168px] rounded-[28px] bg-white/74 p-4 backdrop-blur-sm dark:bg-slate-900/72"
                >
                  <div className="mx-auto flex h-[122px] w-[122px] items-center justify-center rounded-full bg-white/96 p-4 dark:bg-slate-950/92">
                    <img
                      src={card.image}
                      alt={card.name}
                      className="max-h-full max-w-full object-contain"
                      loading={index < 2 ? "eager" : "lazy"}
                    />
                  </div>
                  <div className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-[#05C3D4]">
                    {card.badge || (card.inStock ? "В наличии" : "Под заказ")}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-black leading-5 text-foreground">
                    {card.name}
                  </div>
                  <div className="mt-3 text-lg font-black text-foreground">
                    {formatPrice(card.price)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
