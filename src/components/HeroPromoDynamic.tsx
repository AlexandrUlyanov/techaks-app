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

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export default function HeroPromoDynamic({ hero }: { hero: HeroData }) {
  const cards = hero.cards.slice(0, 4);

  return (
    <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(5,195,212,0.08),transparent_32%)] bg-background transition-colors duration-500">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,transparent_42%,rgba(5,195,212,0.18)_42.5%,transparent_43%,transparent_100%)] [background-size:22px_22px]" />
      </div>

      <div className="container-main relative z-10 grid gap-10 py-14 md:gap-12 md:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:py-20">
        <div className="max-w-[680px]">
          <div className="inline-flex items-center rounded-full border border-[#05C3D4]/20 bg-[#05C3D4]/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
            {hero.eyebrow}
          </div>

          <h1 className="mt-6 max-w-[12ch] text-[clamp(2.8rem,6vw,5rem)] font-black leading-[0.94] tracking-[-0.05em] text-foreground">
            {hero.title}
          </h1>

          <p className="mt-5 max-w-[48rem] text-lg font-semibold leading-relaxed text-foreground/78 md:text-xl">
            {hero.subtitle}
          </p>

          <p className="mt-4 max-w-[42rem] text-sm leading-7 text-muted-foreground md:text-base">
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#05C3D4]/10 text-[#05C3D4]">
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

        <div className="space-y-4 lg:justify-self-end lg:w-full lg:max-w-[620px]">
          <div className="hidden gap-4 md:grid md:grid-cols-2">
            {cards.map((card, index) => (
              <Link
                key={card.id}
                to={`/product/${card.slug}`}
                className={`group flex min-h-[230px] flex-col rounded-[28px] border border-border/70 bg-card p-5 transition-colors hover:border-[#05C3D4]/35 ${
                  index === 0 ? "md:translate-y-6" : ""
                } ${index === 3 ? "md:-translate-y-4" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#05C3D4]">
                      {card.badge || (card.inStock ? "В наличии" : "Под заказ")}
                    </div>
                    <div className="mt-2 line-clamp-2 text-base font-black leading-6 text-foreground">
                      {card.name}
                    </div>
                  </div>
                  <ArrowRight
                    size={16}
                    className="mt-1 shrink-0 text-muted-foreground transition-colors group-hover:text-[#05C3D4]"
                  />
                </div>

                <div className="mt-5 flex flex-1 items-center justify-center rounded-[24px] bg-background/80 p-4">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="max-h-32 w-full object-contain"
                    loading="eager"
                  />
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    {card.categoryName ? (
                      <div className="truncate text-xs font-medium text-muted-foreground">
                        {card.categoryName}
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center gap-2">
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
              </Link>
            ))}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 md:hidden">
            {cards.map(card => (
              <Link
                key={card.id}
                to={`/product/${card.slug}`}
                className="min-w-[260px] snap-start rounded-[26px] border border-border/70 bg-card p-4"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#05C3D4]">
                  {card.badge || (card.inStock ? "В наличии" : "Под заказ")}
                </div>
                <div className="mt-2 line-clamp-2 text-base font-black leading-6 text-foreground">
                  {card.name}
                </div>
                <div className="mt-4 flex h-36 items-center justify-center rounded-[22px] bg-background/80 p-4">
                  <img src={card.image} alt={card.name} className="max-h-28 w-full object-contain" />
                </div>
                <div className="mt-4">
                  <div className="text-lg font-black text-foreground">{formatPrice(card.price)}</div>
                  {card.oldPrice && card.oldPrice > card.price ? (
                    <div className="text-sm text-muted-foreground line-through">
                      {formatPrice(card.oldPrice)}
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
