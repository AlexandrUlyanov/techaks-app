import Hero from "@/components/Hero";
import HeroInteractive from "@/components/HeroInteractive";
import { trpc } from "@/providers/trpc";

export default function HomeHero() {
  const { data } = trpc.settings.getHomepageHeroSettings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (data?.variant === "interactive") {
    return <HeroInteractive />;
  }

  return <Hero />;
}
