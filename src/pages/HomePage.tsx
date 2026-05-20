import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
} from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/providers/trpc";
import Hero from "@/components/Hero";
import { CategoryIcon } from "@/lib/category-icons";
import { useSeo } from "@/lib/seo";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const HOME_QUERY_OPTIONS = {
  staleTime: 2 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

const HomeSecondarySections = lazy(
  () => import("@/components/home/HomeSecondarySections")
);

function SecondarySectionsFallback() {
  return (
    <div className="space-y-16 py-16">
      <div className="container-main">
        <div className="h-12 w-72 max-w-full rounded-xl bg-card animate-pulse" />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-3xl bg-card animate-pulse" />
          <div className="h-64 rounded-3xl bg-card animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  useSeo({
    title: "ТЕХАКС — интернет-магазин техники и аксессуаров",
    description:
      "Техника и аксессуары: смартфоны, наушники, зарядные устройства, кабели, чехлы и гаджеты. Актуальные цены, наличие и доставка.",
    canonicalPath: "/",
  });

  const { data: homepageData } = trpc.home.getPageData.useQuery(
    undefined,
    HOME_QUERY_OPTIONS
  );
  const categories = homepageData?.critical.categories ?? [];
  const weekProducts = homepageData?.critical.weekProducts ?? [];
  const secondary = homepageData?.secondary;
  const now = new Date();
  const isStoreOpen = now.getHours() >= 9 && now.getHours() < 21;
  const [showSecondarySections, setShowSecondarySections] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const reveal = () => {
      if (!cancelled) {
        setShowSecondarySections(true);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(reveal, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timeoutId = setTimeout(reveal, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="pb-16 md:pb-0 bg-background text-foreground transition-colors duration-500">
      <Hero />
      {/* <HeroInteractive /> */}

      {/* Category Grid */}
      <section className="py-16 bg-card border-t border-border">
        <div className="container-main">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                КАТЕГОРИИ <span className="text-foreground/20">ТОВАРОВ</span>
              </h2>
            </div>
            <Link
              to="/catalog"
              className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-[#05C3D4] transition-colors mb-2"
            >
              Смотреть все разделы
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.slice(0, 8).map(cat => (
                <Link
                  key={cat.slug}
                  to={`/catalog?cat=${cat.slug}`}
                  className="group relative bg-background border border-border rounded-2xl p-8 overflow-hidden hover:border-[#05C3D4]/30 transition-all duration-300 shadow-sm hover:shadow-xl"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-100 group-hover:text-[#05C3D4] transition-all duration-500 transform group-hover:scale-110 group-hover:-rotate-12 pointer-events-none">
                    <CategoryIcon name={cat.name} slug={cat.slug} size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-xl bg-foreground/5 flex items-center justify-center text-[#05C3D4] mb-8 group-hover:bg-[#05C3D4] group-hover:text-white dark:group-hover:text-black transition-all duration-300">
                      <CategoryIcon name={cat.name} slug={cat.slug} size={28} />
                    </div>
                    <h3 className="text-xl font-black uppercase font-heading tracking-tight text-foreground">
                      {cat.name}
                    </h3>
                    <p className="mt-3 text-sm text-muted-foreground font-medium leading-relaxed line-clamp-2">
                      {cat.description}
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#05C3D4] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      Перейти <ArrowRight size={12} />
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Products of the Week */}
      {weekProducts.length > 0 && (
        <section className="py-20 bg-card/50 relative overflow-hidden">
          <div className="container-main relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
                  Выбор недели
                </span>
                <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                  ТОВАРЫ <span className="text-foreground/20">НЕДЕЛИ</span>
                </h2>
              </div>
              <Link
                to="/catalog"
                className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-[#05C3D4] transition-colors mb-2"
              >
                Смотреть весь каталог
              </Link>
            </div>

            <Carousel
              opts={{
                align: "start",
                loop: weekProducts.length > 4,
              }}
              className="relative"
            >
              <CarouselContent className="-ml-3 sm:-ml-5">
                {weekProducts.map(product => (
                  <CarouselItem
                    key={product.id}
                    className="pl-3 sm:pl-5 basis-[72%] min-[520px]:basis-1/2 md:basis-1/3 xl:basis-1/4"
                  >
                    <ProductCard product={product as any} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex -left-4 top-1/2 h-11 w-11 border border-border bg-background text-foreground hover:border-[#05C3D4] hover:bg-[#05C3D4] hover:text-black" />
              <CarouselNext className="hidden md:flex -right-4 top-1/2 h-11 w-11 border border-border bg-background text-foreground hover:border-[#05C3D4] hover:bg-[#05C3D4] hover:text-black" />
            </Carousel>
          </div>
        </section>
      )}

      {showSecondarySections && secondary ? (
        <Suspense fallback={<SecondarySectionsFallback />}>
          <HomeSecondarySections
            featuredManufacturers={secondary.featuredManufacturers}
            banners={secondary.banners}
            stores={secondary.stores}
            latestPosts={secondary.latestPosts}
            popularProducts={secondary.popularProducts}
            isStoreOpen={isStoreOpen}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
