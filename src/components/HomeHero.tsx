import Hero from "@/components/Hero";
import HeroPromoDynamic from "@/components/HeroPromoDynamic";

type HomeHeroProps = {
  loading?: boolean;
  hero?: {
    variant: "classic" | "interactive";
    slides: Array<
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
          cards: Array<{
            id: number;
            slug: string;
            name: string;
            price: number;
            oldPrice: number | null;
            image: string;
            badge: string | null;
            inStock: boolean;
            categoryName?: string | null;
          }>;
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
          categories: Array<{
            id: number;
            slug: string;
            name: string;
            imageUrl: string | null;
            icon: string | null;
            productCount: number;
            href: string;
          }>;
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
          brands: Array<{
            id: number;
            slug: string;
            title: string;
            logo: string;
            productCount: number;
            href: string;
          }>;
        }
    >;
  } | null;
};

function HomeHeroSkeleton() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(5,195,212,0.06),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,1))] transition-colors duration-500 dark:bg-[radial-gradient(circle_at_top_right,rgba(5,195,212,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(5,195,212,0.06),transparent_30%),linear-gradient(180deg,#111827,#0f172a)]">
      <div className="container-main relative z-10 grid gap-10 py-14 md:gap-12 md:py-16 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center lg:py-20">
        <div className="max-w-[680px] animate-pulse">
          <div className="h-9 w-40 rounded-full bg-card/80 dark:bg-white/10" />
          <div className="mt-6 space-y-3">
            <div className="h-16 w-full max-w-[32rem] rounded-3xl bg-card/80 dark:bg-white/10" />
            <div className="h-16 w-full max-w-[28rem] rounded-3xl bg-card/80 dark:bg-white/10" />
            <div className="h-16 w-full max-w-[24rem] rounded-3xl bg-card/80 dark:bg-white/10" />
          </div>
          <div className="mt-6 h-8 w-full max-w-[34rem] rounded-2xl bg-card/70 dark:bg-white/10" />
          <div className="mt-4 h-20 w-full max-w-[38rem] rounded-[28px] bg-card/70 dark:bg-white/10" />
          <div className="mt-8 flex flex-wrap gap-3 md:gap-4">
            <div className="h-12 w-48 rounded-2xl bg-card/80 dark:bg-white/10" />
            <div className="h-12 w-44 rounded-2xl bg-card/80 dark:bg-white/10" />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex min-h-14 items-center gap-3 rounded-[24px] bg-card/70 px-4 py-3 dark:bg-white/10"
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-card dark:bg-white/10" />
                <div className="h-5 flex-1 rounded-full bg-card dark:bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block lg:justify-self-end lg:w-full lg:max-w-[640px]">
          <div className="relative min-h-[560px] animate-pulse">
            <div className="absolute left-[4%] top-[6%] h-[198px] w-[198px] rounded-full bg-card/80 dark:bg-white/10" />
            <div className="absolute right-[6%] top-[5%] h-[148px] w-[148px] rounded-full bg-card/80 dark:bg-white/10" />
            <div className="absolute left-[16%] bottom-[8%] h-[242px] w-[242px] rounded-full bg-card/80 dark:bg-white/10" />
            <div className="absolute right-[0%] bottom-[13%] h-[178px] w-[178px] rounded-full bg-card/80 dark:bg-white/10" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomeHero({ hero, loading = false }: HomeHeroProps) {
  if (loading) {
    return <HomeHeroSkeleton />;
  }

  if (hero?.variant === "interactive" && hero.slides.length > 0) {
    return <HeroPromoDynamic hero={hero} />;
  }

  return <Hero />;
}
