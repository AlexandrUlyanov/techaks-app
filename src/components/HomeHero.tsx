import Hero from "@/components/Hero";
import HeroPromoDynamic from "@/components/HeroPromoDynamic";

type HomeHeroProps = {
  hero?: {
    variant: "classic" | "interactive";
    mode: "manual" | "automatic";
    eyebrow: string;
    title: string;
    subtitle: string;
    description: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    benefits: string[];
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
  } | null;
};

export default function HomeHero({ hero }: HomeHeroProps) {
  if (hero?.variant === "interactive" && hero.cards.length > 0) {
    return <HeroPromoDynamic hero={hero} />;
  }

  return <Hero />;
}
