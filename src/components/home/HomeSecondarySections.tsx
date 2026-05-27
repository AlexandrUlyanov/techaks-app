import { Link } from "react-router";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import StoreCard from "@/components/StoreCard";
import ReviewCard from "@/components/ReviewCard";
import HomeSectionHeading from "./HomeSectionHeading";

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

function formatProductCount(count: number) {
  const safeCount = Math.max(0, Number(count) || 0);
  const mod10 = safeCount % 10;
  const mod100 = safeCount % 100;

  if (mod10 === 1 && mod100 !== 11) return `${safeCount} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${safeCount} товара`;
  }

  return `${safeCount} товаров`;
}

export type HomeSecondarySectionsProps = {
  featuredManufacturers: any[];
  banners: any[];
  stores: any[];
  latestPosts: any[];
  popularProducts: any[];
  isStoreOpen: boolean;
};

export default function HomeSecondarySections({
  featuredManufacturers,
  banners,
  stores,
  latestPosts,
  popularProducts,
  isStoreOpen,
}: HomeSecondarySectionsProps) {
  return (
    <>
      {featuredManufacturers.length > 0 && (
        <section className="relative overflow-hidden bg-[#F8FAFC] py-[72px] sm:py-[84px] lg:py-[104px] dark:bg-[#171A1E]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.12)_0%,rgba(5,195,212,0.04)_34%,transparent_72%)] opacity-90 dark:bg-[radial-gradient(circle,rgba(5,195,212,0.16)_0%,rgba(5,195,212,0.03)_38%,transparent_74%)] dark:opacity-60" />
            <div className="absolute right-[-72px] top-[-56px] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.12)_0%,rgba(5,195,212,0.03)_42%,transparent_75%)] opacity-80 dark:bg-[radial-gradient(circle,rgba(5,195,212,0.18)_0%,rgba(5,195,212,0.02)_46%,transparent_78%)] dark:opacity-55" />
            <div className="absolute left-[18%] top-[14%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.28)_38%,transparent_78%)] opacity-90 blur-3xl dark:bg-[radial-gradient(circle,rgba(5,195,212,0.08)_0%,rgba(255,255,255,0.02)_42%,transparent_78%)] dark:opacity-80" />
            <div className="absolute right-[14%] top-[10%] h-32 w-40 opacity-[0.12] [background-image:radial-gradient(circle,rgba(5,195,212,0.8)_1.4px,transparent_1.4px)] [background-position:0_0] [background-size:14px_14px] dark:opacity-[0.08]" />
          </div>

          <div className="container-main relative z-10 max-w-[1440px]">
            <HomeSectionHeading
              eyebrow="Производители"
              title="Бренды в наличии"
              accent="в наличии"
              description="Выбирайте технику и аксессуары от проверенных производителей"
              action={
                <Link
                  to="/catalog?view=brands"
                  className="group inline-flex w-fit items-center gap-3 self-start rounded-full border border-[rgba(5,195,212,0.22)] bg-white/65 px-6 py-4 text-sm font-bold text-[#111827] transition-[transform,background-color,border-color,opacity] duration-200 hover:-translate-y-0.5 hover:border-[rgba(5,195,212,0.35)] hover:bg-[rgba(5,195,212,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/60 focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8FAFC] motion-reduce:transform-none motion-reduce:transition-none dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.06] dark:hover:border-[#05C3D4]/35 dark:focus-visible:ring-offset-[#171A1E]"
                >
                  <span>Все производители</span>
                  <ArrowRight
                    size={18}
                    className="text-[#05C3D4] transition-transform duration-200 group-hover:translate-x-0.5 dark:text-[#27E6F2] motion-reduce:transform-none motion-reduce:transition-none"
                  />
                </Link>
              }
            />

            <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:mt-16 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3 md:gap-y-12 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-16 xl:grid-cols-6 xl:gap-x-12 xl:gap-y-[4.5rem]">
              {featuredManufacturers.map(manufacturer => (
                <Link
                  key={manufacturer.id}
                  to={`/catalog?view=brands&brand=${manufacturer.slug}`}
                  className="group flex min-h-[128px] flex-col items-center justify-center rounded-[28px] px-3 py-4 text-center text-[#111827] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-1 hover:bg-white/70 hover:shadow-[0_22px_70px_rgba(15,23,42,0.045)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgba(5,195,212,0.6)] motion-reduce:transform-none motion-reduce:transition-none dark:text-white dark:hover:bg-white/[0.04] dark:hover:shadow-none sm:min-h-[138px] sm:px-4 sm:py-5 lg:min-h-[150px]"
                >
                  <span className="flex h-[60px] w-[60px] items-center justify-center sm:h-[68px] sm:w-[68px] lg:h-[72px] lg:w-[72px]">
                    {manufacturer.logo ? (
                      <img
                        src={manufacturer.logo}
                        alt={manufacturer.title}
                        className="max-h-[42px] max-w-[58px] object-contain transition-transform duration-200 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none sm:max-h-[46px] sm:max-w-[64px] lg:max-h-[52px] lg:max-w-[74px]"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-[58px] w-[58px] items-center justify-center rounded-[22px] bg-[rgba(5,195,212,0.1)] text-lg font-black text-[#05C3D4] dark:bg-[#05C3D4]/10 dark:text-[#7DE7F0] sm:h-[64px] sm:w-[64px] lg:h-[72px] lg:w-[72px]">
                        {manufacturer.title.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="mt-4 max-w-[14ch] text-sm font-bold leading-tight text-[#111827] transition-colors group-hover:text-[#0F172A] dark:text-white dark:group-hover:text-[#D8FBFF] sm:text-[15px] lg:text-[16px]">
                    {manufacturer.title}
                  </span>
                  <span className="mt-2.5 inline-flex items-center justify-center rounded-full bg-[rgba(5,195,212,0.07)] px-2.5 py-1 text-[11px] font-semibold text-[#64748B] transition-colors duration-200 group-hover:bg-[rgba(5,195,212,0.11)] group-hover:text-[#087987] dark:bg-white/[0.06] dark:text-white/65 dark:group-hover:bg-[#05C3D4]/15 dark:group-hover:text-[#9DECF3] sm:px-3 sm:text-xs">
                    {formatProductCount(manufacturer.productCount)}
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-14 flex items-center justify-center gap-3 text-center text-sm font-medium text-[#64748B] dark:text-white/60 sm:mt-16">
              <Sparkles size={16} className="shrink-0 text-[#05C3D4] dark:text-[#27E6F2]" />
              <span>
                Только <strong className="font-semibold text-[#05C3D4] dark:text-[#27E6F2]">оригинальная</strong> продукция
              </span>
            </div>
          </div>
        </section>
      )}

      {banners.length > 0 && (
        <section id="promos" className="py-24 bg-background">
          <div className="container-main">
            <div className="text-center mb-16">
              <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
                Digital Витрина
              </span>
              <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                АКЦИИ <span className="text-foreground/20">И СПЕЦПРЕДЛОЖЕНИЯ</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {banners.map(promo => (
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
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-24 bg-card border-t border-border">
        <div className="container-main">
          <HomeSectionHeading
            eyebrow="Локации"
            title="Наши магазины"
            accent="магазины"
            className="mb-16"
          />
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

      <section id="reviews" className="py-24 bg-background">
        <div className="container-main">
          <HomeSectionHeading
            eyebrow="Обратная связь"
            title="Отзывы покупателей"
            accent="покупателей"
            className="mb-16"
          />

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

      {latestPosts.length > 0 && (
        <section id="blog" className="py-24 bg-background">
          <div className="container-main">
            <HomeSectionHeading
              eyebrow="Блог ТЕХАКС"
              title="Советы и обзоры"
              accent="обзоры"
              className="mb-16"
              action={
                <Link
                  to="/blog"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-[#05C3D4] transition-colors"
                >
                  Читать все статьи
                </Link>
              }
            />

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
                        {new Date(post.publishedAt || post.createdAt).toLocaleDateString("ru-RU")}
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
          <HomeSectionHeading
            eyebrow="Витрина"
            title="Популярные товары"
            accent="товары"
            className="mb-16"
            action={
              <Link
                to="/catalog"
                className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-[#05C3D4] transition-colors"
              >
                Смотреть весь каталог
              </Link>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product as any}
                imagePriority={index < 4}
              />
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
    </>
  );
}
