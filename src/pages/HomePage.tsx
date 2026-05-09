import { Link } from "react-router";
import {
  ArrowRight,
  Star,
} from "lucide-react";
import ProductCard from "@/components/ProductCard";
import StoreCard from "@/components/StoreCard";
import ReviewCard from "@/components/ReviewCard";
import { trpc } from "@/providers/trpc";
import Hero from "@/components/Hero";
import { CategoryIcon } from "@/lib/category-icons";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const defaultReviews = [
  {
    author: "Анна К.",
    rating: 5,
    text: "Отличный магазин! Помогли подобрать чехол для iPhone, цены приятные, персонал вежливый. Обязательно приду ещё.",
    createdAt: new Date("2024-04-15").toISOString(),
  },
  {
    author: "Михаил С.",
    rating: 5,
    text: "Клеил защитное стекло, сделали быстро и качественно. Широкий выбор аксессуаров, всё в наличии. Рекомендую!",
    createdAt: new Date("2024-04-10").toISOString(),
  },
  {
    author: "Елена В.",
    rating: 5,
    text: "Купила power bank HOCO, работает отлично. Продавец объяснил все характеристики, помог выбрать под мои задачи. Спасибо!",
    createdAt: new Date("2024-04-05").toISOString(),
  },
];

export default function HomePage() {
  const { data: products = [] } = trpc.product.getAll.useQuery();
  const { data: merchandisingProducts = [] } =
    trpc.merchandising.recommendations.useQuery({
      placement: "home_weekly",
      limit: 10,
    });
  const { data: popularMerchandisingProducts = [] } =
    trpc.merchandising.recommendations.useQuery({
      placement: "home_popular",
      limit: 8,
    });
  const { data: dbCategories = [] } = trpc.product.getCategories.useQuery();
  const categories = dbCategories.filter(c => !c.parentId);
  const { data: stores = [] } = trpc.store.getAll.useQuery();
  const { data: banners = [] } = trpc.banner.getActive.useQuery();
  const { data: posts = [] } = trpc.blog.getPublished.useQuery();

  const weekProductsSource = merchandisingProducts.length > 0 ? merchandisingProducts : products;
  const weekProducts = [...weekProductsSource]
    .sort((a, b) => {
      const badgeScore = (item: typeof a) =>
        item.badge === "Акция" ? 0 : item.badge === "Хит" ? 1 : item.badge === "Новинка" ? 2 : 3;
      return badgeScore(a) - badgeScore(b);
    })
    .slice(0, 10);
  const popularProducts =
    popularMerchandisingProducts.length > 0
      ? popularMerchandisingProducts
      : products.slice(0, 8);
  const now = new Date();
  const isStoreOpen = now.getHours() >= 9 && now.getHours() < 21;
  const activeBanners = banners.slice(0, 2);
  const latestPosts = posts.slice(0, 3);

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

      {/* Promo Banners */}
      {activeBanners.length > 0 && (
        <section id="promos" className="py-24 bg-background">
          <div className="container-main">
            <div className="text-center mb-16">
              <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
                Digital Витрина
              </span>
              <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                АКЦИИ{" "}
                <span className="text-foreground/20">И СПЕЦПРЕДЛОЖЕНИЯ</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {activeBanners.map(promo => (
                <div
                  key={promo.id}
                  className="group relative flex flex-col sm:flex-row items-center gap-10 bg-card border border-border rounded-3xl p-10 overflow-hidden hover:border-[#05C3D4]/20 transition-all duration-300 shadow-sm hover:shadow-xl"
                >
                  <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[#05C3D4]/5 blur-[60px] rounded-full" />
                  <div className="relative z-10 flex-1">
                    <span className="inline-block px-3 py-1 bg-[#05C3D4]/10 text-[#05C3D4] text-[10px] font-black uppercase tracking-widest rounded-md mb-4">
                      Акция
                    </span>
                    <h3 className="text-2xl font-black uppercase font-heading tracking-tight leading-tight text-foreground">
                      {promo.title}
                    </h3>
                    <p className="mt-4 text-sm text-muted-foreground font-medium leading-relaxed line-clamp-2">
                      {promo.subtitle}
                    </p>
                    <Link
                      to={`/promotions/${promo.slug}`}
                      className="mt-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground hover:text-[#05C3D4] transition-colors"
                    >
                      Подробнее
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                  <div className="relative z-10 flex-shrink-0 w-[160px] h-[160px] rounded-2xl overflow-hidden bg-white p-4 border border-border group-hover:border-[#05C3D4]/10 transition-all duration-500 transform group-hover:scale-105">
                    <img
                      src={promo.image}
                      alt={promo.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stores */}
      <section className="py-24 bg-card border-t border-border">
        <div className="container-main">
          <div className="text-center mb-16">
            <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
              Локации
            </span>
            <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
              НАШИ <span className="text-foreground/20">МАГАЗИНЫ</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {stores.map(store => (
              <StoreCard
                key={store.id}
                name={store.name}
                address={store.address}
                hours={store.hours}
                phone={store.phone}
                rating={store.rating}
                reviews={`${store.reviewCount} оценок`}
                image={store.image}
                isOpen={isStoreOpen}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-24 bg-background">
        <div className="container-main">
          <div className="text-center mb-16">
            <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
              Обратная связь
            </span>
            <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
              ОТЗЫВЫ <span className="text-white/20">ПОКУПАТЕЛЕЙ</span>
            </h2>
          </div>

          {/* Rating Summary */}
          <div className="flex flex-wrap justify-center gap-12 mb-16 pb-16 border-b border-border">
            {[
              { platform: "Яндекс Карты", rating: "4.9", count: "59 отзывов" },
              { platform: "2ГИС", rating: "4.8", count: "39 отзывов" },
            ].map(item => (
              <div key={item.platform} className="text-center group">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 group-hover:text-[#05C3D4] transition-colors">
                  {item.platform}
                </div>
                <div className="flex items-center gap-4 justify-center">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={20}
                        className="fill-[#05C3D4] text-[#05C3D4]"
                      />
                    ))}
                  </div>
                  <span className="text-4xl font-black font-heading text-foreground">
                    {item.rating}
                  </span>
                </div>
                <div className="mt-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {item.count}
                </div>
              </div>
            ))}
          </div>

          {/* Review Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {defaultReviews.map((review, i) => (
              <ReviewCard
                key={i}
                name={review.author}
                rating={review.rating}
                text={review.text}
                date={new Date(review.createdAt).toLocaleDateString("ru-RU")}
                source="Яндекс Карты"
              />
            ))}
          </div>

          <div className="mt-16 text-center">
            <a
              href="https://yandex.ru/maps/org/techaks/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:bg-card hover:border-[#05C3D4] transition-all"
            >
              Оставить отзыв
            </a>
          </div>
        </div>
      </section>

      {/* Blog Preview */}
      {latestPosts.length > 0 && (
        <section id="blog" className="py-24 bg-background">
          <div className="container-main">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
              <div>
                <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
                  Блог ТЕХАКС
                </span>
                <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                  СОВЕТЫ <span className="text-foreground/20">И ОБЗОРЫ</span>
                </h2>
              </div>
              <Link
                to="/blog"
                className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-[#05C3D4] transition-colors mb-2"
              >
                Читать все статьи
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {latestPosts.map(post => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group bg-card border border-border rounded-3xl overflow-hidden hover:border-[#05C3D4]/20 transition-all duration-300 shadow-sm hover:shadow-xl"
                >
                  <div className="h-[220px] overflow-hidden relative">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60 dark:from-[#15171A]" />
                    <span className="absolute bottom-4 left-4 px-3 py-1 bg-[#05C3D4] text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-md">
                      {post.category}
                    </span>
                  </div>
                  <div className="p-8">
                    <h3 className="text-xl font-black uppercase font-heading tracking-tight leading-tight line-clamp-2 min-h-[3.5rem] text-foreground">
                      {post.title}
                    </h3>
                    <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {new Date(post.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4] group-hover:translate-x-1 transition-transform">
                        Читать <ArrowRight size={12} className="inline ml-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-24 bg-card border-t border-border">
        <div className="container-main">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
                Витрина
              </span>
              <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                ПОПУЛЯРНЫЕ <span className="text-foreground/20">ТОВАРЫ</span>
              </h2>
            </div>
            <Link
              to="/catalog"
              className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-[#05C3D4] transition-colors mb-2"
            >
              Смотреть весь каталог
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularProducts.map(product => (
              <ProductCard key={product.id} product={product as any} />
            ))}
          </div>
          <div className="mt-16 text-center">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-3 px-10 py-5 bg-[#05C3D4] text-white dark:text-black rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all glow-cyan active:scale-95"
            >
              Смотреть все товары
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
