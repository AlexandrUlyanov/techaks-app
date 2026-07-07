import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, ExternalLink, Sparkles, Star, X } from "lucide-react";
import { useTheme } from "next-themes";
import ProductCard from "@/components/ProductCard";
import StoreCard from "@/components/StoreCard";
import ReviewCard from "@/components/ReviewCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import HomeSectionHeading from "./HomeSectionHeading";
import HomeSectionActionLink from "./HomeSectionActionLink";

type HomepageReviewItem = {
  id: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorBadge: string | null;
  rating: number;
  text: string;
  createdAt: string;
  photoUrl: string | null;
  source: string;
  reviewUrl: string;
  replyText: string | null;
  replyUpdatedAt: string | null;
};

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

function formatReviewCount(count: number) {
  const safeCount = Math.max(0, Number(count) || 0);
  const mod10 = safeCount % 10;
  const mod100 = safeCount % 100;

  if (mod10 === 1 && mod100 !== 11) return `${safeCount} отзыв`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${safeCount} отзыва`;
  }

  return `${safeCount} отзывов`;
}

export type HomeSecondarySectionsProps = {
  featuredManufacturers: any[];
  banners: any[];
  stores: any[];
  latestPosts: any[];
  popularProducts: any[];
  reviews: HomepageReviewItem[];
  reviewsSummary: {
    totalCount: number;
    sourceUrl: string | null;
    fetchedAt: string | null;
  };
  isStoreOpen: boolean;
};

export default function HomeSecondarySections({
  featuredManufacturers,
  banners,
  stores,
  latestPosts,
  popularProducts,
  reviews,
  reviewsSummary,
  isStoreOpen,
}: HomeSecondarySectionsProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [activeReviewPhotoVisible, setActiveReviewPhotoVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const yandexBadgeSrc =
    mounted && resolvedTheme === "dark"
      ? "https://yandex.ru/sprav/widget/rating-badge/81538152780?type=rating&theme=dark"
      : "https://yandex.ru/sprav/widget/rating-badge/81538152780?type=rating";

  const reviewsWithPhotos = useMemo(
    () => reviews.filter(review => Boolean(review.photoUrl)),
    [reviews]
  );

  const activeReviewIndex = reviewsWithPhotos.findIndex(review => review.id === activeReviewId);
  const activeReview =
    activeReviewIndex >= 0 ? reviewsWithPhotos[activeReviewIndex] : null;

  useEffect(() => {
    setActiveReviewPhotoVisible(Boolean(activeReview?.photoUrl));
  }, [activeReview?.id, activeReview?.photoUrl]);

  const handleOpenReviewGallery = (reviewId: string) => {
    setActiveReviewId(reviewId);
  };

  const handleShiftReview = (direction: -1 | 1) => {
    if (activeReviewIndex < 0 || reviewsWithPhotos.length <= 1) return;
    const nextIndex =
      (activeReviewIndex + direction + reviewsWithPhotos.length) %
      reviewsWithPhotos.length;
    setActiveReviewId(reviewsWithPhotos[nextIndex]?.id ?? null);
  };

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
                <HomeSectionActionLink
                  to="/catalog?view=brands"
                  label="Все производители"
                />
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-5">
            {stores.map(store => (
              <StoreCard
                key={store.id}
                name={store.name}
                address={store.address}
                hours={store.hours}
                phone={store.phone}
                rating={store.rating}
                image={store.image}
                isOpen={isStoreOpen}
                showReviewsCount={false}
              />
            ))}
          </div>
        </div>
      </section>

      {reviews.length > 0 ? (
        <section id="reviews" className="py-24 bg-background">
          <div className="container-main">
            <HomeSectionHeading
              eyebrow="Обратная связь"
              title="Отзывы покупателей"
              accent="покупателей"
              action={
                <div className="inline-flex items-center gap-4 rounded-full bg-card/70 px-4 py-3 transition-colors dark:bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Яндекс Карты
                    </div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {formatReviewCount(reviewsSummary.totalCount)}
                    </div>
                  </div>
                  <iframe
                    src={yandexBadgeSrc}
                    width="150"
                    height="50"
                    frameBorder="0"
                    loading="lazy"
                    title="Рейтинг ТЕХАКС в Яндекс Картах"
                    className="overflow-hidden rounded-xl"
                  />
                </div>
              }
              className="mb-16"
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  name={review.authorName}
                  avatarUrl={review.authorAvatarUrl}
                  authorBadge={review.authorBadge}
                  rating={review.rating}
                  text={review.text}
                  date={new Date(review.createdAt).toLocaleDateString("ru-RU")}
                  source={review.source}
                  photoUrl={review.photoUrl}
                  reviewUrl={review.reviewUrl}
                  replyText={review.replyText}
                  photoClickable={Boolean(review.photoUrl)}
                  onPhotoClick={
                    review.photoUrl ? () => handleOpenReviewGallery(review.id) : undefined
                  }
                />
              ))}
            </div>
            <div className="mt-16 text-center">
              <a
                href={
                  reviewsSummary.sourceUrl ??
                  "https://yandex.ru/maps/org/tekhaks/81538152780/reviews/?indoorLevel=1&ll=44.920956%2C53.222379&z=17"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-xl border border-border px-8 py-4 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-[#05C3D4] hover:bg-card"
              >
                Оставить отзыв
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <Dialog
        open={Boolean(activeReview)}
        onOpenChange={open => {
          if (!open) setActiveReviewId(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[min(1180px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-[32px] border border-border/70 bg-background p-0 shadow-2xl sm:max-w-none"
          overlayClassName="bg-black/72 backdrop-blur-md"
        >
          {activeReview ? (
            <div className="grid min-h-[min(720px,82vh)] grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_380px] xl:grid-cols-[minmax(0,1.2fr)_420px]">
              <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden bg-[#F4F7FA] p-4 dark:bg-[#14191E] sm:min-h-[460px] sm:p-8 lg:p-10">
                {activeReview.photoUrl && activeReviewPhotoVisible ? (
                  <img
                    key={activeReview.id}
                    src={activeReview.photoUrl}
                    alt={`Фото к отзыву ${activeReview.authorName}`}
                    className="max-h-[68vh] w-full rounded-[28px] object-contain"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onError={() => setActiveReviewPhotoVisible(false)}
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] w-full items-center justify-center rounded-[28px] bg-white/70 px-6 text-center text-sm font-medium leading-6 text-muted-foreground dark:bg-white/[0.04]">
                    Фото к отзыву сейчас недоступно. Попробуйте открыть оригинал в Яндекс Картах.
                  </div>
                )}

                {reviewsWithPhotos.length > 1 ? (
                  <>
                    <button
                      type="button"
                      aria-label="Предыдущий отзыв"
                      onClick={() => handleShiftReview(-1)}
                      className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/92 text-foreground shadow-sm transition-colors hover:bg-background sm:left-6"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Следующий отзыв"
                      onClick={() => handleShiftReview(1)}
                      className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/92 text-foreground shadow-sm transition-colors hover:bg-background sm:right-6"
                    >
                      <ArrowRight size={18} />
                    </button>
                  </>
                ) : null}

                <div className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-background/92 px-3 py-1.5 text-xs font-bold text-foreground/70">
                  <span>{activeReviewIndex + 1}</span>
                  <span className="text-foreground/30">/</span>
                  <span>{reviewsWithPhotos.length}</span>
                </div>
              </div>

              <div className="flex min-h-0 flex-col bg-background p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <DialogTitle className="text-left text-2xl font-black tracking-tight text-foreground sm:text-[2rem]">
                      Отзыв покупателя
                    </DialogTitle>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Фото и текст из Яндекс Карт. Можно перелистывать реальные отзывы с фотографиями.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Закрыть просмотр"
                    onClick={() => setActiveReviewId(null)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-6 flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted text-base font-black uppercase text-[#05C3D4]">
                    {activeReview.authorAvatarUrl ? (
                      <img
                        src={activeReview.authorAvatarUrl}
                        alt={activeReview.authorName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      activeReview.authorName
                        .split(" ")
                        .map(word => word[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-black tracking-tight text-foreground">
                      {activeReview.authorName}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                      <span>
                        {new Date(activeReview.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                      {activeReview.authorBadge ? (
                        <span className="normal-case tracking-normal">
                          {activeReview.authorBadge}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-black text-foreground">
                    <Star size={14} className="fill-[#05C3D4] text-[#05C3D4]" />
                    <span>{activeReview.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="mt-5 inline-flex w-fit items-center gap-1 rounded-full border border-border bg-muted px-3 py-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={
                        i < activeReview.rating
                          ? "fill-[#05C3D4] text-[#05C3D4]"
                          : "text-foreground/10 dark:text-white/10"
                      }
                    />
                  ))}
                </div>

                <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
                  <p className="text-[15px] leading-8 text-foreground/88">
                    {activeReview.text}
                  </p>

                  {activeReview.replyText ? (
                    <div className="mt-6 rounded-[24px] bg-muted/75 px-5 py-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                        Ответ ТЕХАКС
                      </div>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {activeReview.replyText}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                  <div className="flex items-center gap-2">
                    <span className="h-px w-6 bg-border" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">
                      {activeReview.source}
                    </span>
                  </div>
                  {activeReview.reviewUrl ? (
                    <a
                      href={activeReview.reviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-[#05C3D4]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#05C3D4] transition-colors hover:bg-[#05C3D4]/16"
                    >
                      Читать в источнике
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {latestPosts.length > 0 && (
        <section id="blog" className="py-24 bg-background">
          <div className="container-main">
            <HomeSectionHeading
              eyebrow="Блог ТЕХАКС"
              title="Советы и обзоры"
              accent="обзоры"
              className="mb-16"
              action={
                <HomeSectionActionLink to="/blog" label="Читать все статьи" />
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
              <HomeSectionActionLink to="/catalog" label="Смотреть весь каталог" />
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
