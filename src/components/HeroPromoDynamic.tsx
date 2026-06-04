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
    shell: "left-[6%] top-[3%] h-[188px] w-[188px]",
    panel: "left-[2%] top-[58%]",
    delay: "0s",
    duration: "7.8s",
  },
  {
    shell: "right-[9%] top-[8%] h-[170px] w-[170px]",
    panel: "right-[2%] top-[50%]",
    delay: "-1.2s",
    duration: "8.8s",
  },
  {
    shell: "left-[18%] bottom-[8%] h-[220px] w-[220px]",
    panel: "left-[10%] bottom-[-1%]",
    delay: "-2.1s",
    duration: "9.2s",
  },
  {
    shell: "right-[2%] bottom-[10%] h-[184px] w-[184px]",
    panel: "right-[0%] bottom-[1%]",
    delay: "-3.4s",
    duration: "8.4s",
  },
] as const;

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export default function HeroPromoDynamic({ hero }: { hero: HeroData }) {
  const cards = hero.cards.slice(0, 4);

  return (
    <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(5,195,212,0.08),transparent_32%)] bg-background transition-colors duration-500">
      <style>{`
        @keyframes heroBubbleFloat {
          0% { transform: translate3d(0, 0, 0); }
          25% { transform: translate3d(0, -12px, 0); }
          50% { transform: translate3d(8px, -4px, 0); }
          75% { transform: translate3d(-6px, 10px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,transparent_42%,rgba(5,195,212,0.18)_42.5%,transparent_43%,transparent_100%)] [background-size:22px_22px]" />
      </div>

      <div className="container-main relative z-10 grid gap-10 py-14 md:gap-12 md:py-16 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center lg:py-20">
        <div className="max-w-[680px]">
          <div className="inline-flex items-center rounded-full border border-[#05C3D4]/20 bg-[#05C3D4]/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
            {hero.eyebrow}
          </div>

          <h1 className="mt-6 max-w-[11ch] text-[clamp(2.7rem,5.4vw,4.9rem)] font-black leading-[0.94] tracking-[-0.055em] text-foreground">
            {hero.title}
          </h1>

          <p className="mt-5 max-w-[42rem] text-lg font-semibold leading-relaxed text-foreground/78 md:text-xl">
            {hero.subtitle}
          </p>

          <p className="mt-4 max-w-[40rem] text-sm leading-7 text-muted-foreground md:text-base">
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
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-card px-6 text-sm font-bold text-foreground transition-colors hover:border-[#05C3D4]/30 hover:text-[#05C3D4]"
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
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-card/75 px-4 py-3"
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
          <div className="hidden min-h-[560px] rounded-[36px] border border-border/60 bg-[radial-gradient(circle_at_center,rgba(5,195,212,0.07),transparent_54%)] p-6 lg:block">
            <div className="relative h-full overflow-hidden rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.28))] dark:bg-[linear-gradient(180deg,rgba(17,23,35,0.6),rgba(17,23,35,0.28))]">
              {cards.map((card, index) => {
                const layout = desktopBubbleLayout[index % desktopBubbleLayout.length];
                return (
                  <div key={card.id} className="group absolute inset-0">
                    <Link
                      to={`/product/${card.slug}`}
                      className={`absolute ${layout.shell} flex items-center justify-center rounded-full border border-border/70 bg-white p-5 transition-[border-color,transform] duration-300 hover:border-[#05C3D4]/35 dark:bg-slate-950/95`}
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
                      className={`pointer-events-none absolute ${layout.panel} w-[228px] rounded-[24px] border border-border/70 bg-background/96 p-4 opacity-0 shadow-none transition-all duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 motion-safe:translate-y-2 dark:bg-slate-950/96`}
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
                  className="min-w-[168px] rounded-[28px] border border-border/70 bg-card/85 p-4"
                >
                  <div className="mx-auto flex h-[122px] w-[122px] items-center justify-center rounded-full border border-border/70 bg-white p-4 dark:bg-slate-950/95">
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
