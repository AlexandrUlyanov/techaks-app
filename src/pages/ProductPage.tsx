import { useParams, Link, useLocation } from "react-router";
import { Star, MessageCircle, ArrowLeft } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import LeadForm from "@/components/LeadForm";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { buildCanonical, useSeo } from "@/lib/seo";
import { formatRussianCount } from "@/lib/russian-plurals";
import { useAuth } from "@/hooks/use-auth";
import ReviewComposer from "@/components/reviews/ReviewComposer";
import ProductActionButtons from "@/components/product/ProductActionButtons";
import StoreAvailabilityList from "@/components/product/StoreAvailabilityList";
import ReservationConfirmDialog from "@/components/product/ReservationConfirmDialog";
import OneClickOrderDialog from "@/components/product/OneClickOrderDialog";
import type { ProductStoreAvailability } from "@/components/product/StoreAvailabilityItem";
import {
  getMerchandisingBadgeLabel,
  getMerchandisingBadgeStyle,
  normalizeMerchandisingBadges,
} from "@/lib/merchandising-badges";

export default function ProductPage() {
  const { id: slug } = useParams<{ id: string }>();
  const location = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [reviewSort, setReviewSort] = useState<"newest" | "highest" | "lowest" | "verified">("newest");
  const [showReviewSection, setShowReviewSection] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [oneClickDialogOpen, setOneClickDialogOpen] = useState(false);
  const [selectedReservationStore, setSelectedReservationStore] =
    useState<ProductStoreAvailability | null>(null);
  const [reservedStoreId, setReservedStoreId] = useState<number | null>(null);
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();

  const { data: product, isLoading } = trpc.product.getBySlug.useQuery({
    slug: slug || "",
  });
  const { data: stock = [] } = trpc.product.getStockBySlug.useQuery({
    slug: slug || "",
  });
  const typedStock = stock as ProductStoreAvailability[];
  const { data: productManufacturer } =
    trpc.manufacturer.getByProductSlug.useQuery(
      { slug: slug || "" },
      { enabled: Boolean(slug) }
    );
  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: merchandisingRelated = [] } =
    trpc.merchandising.recommendations.useQuery(
      {
        placement: "product_related",
        limit: 4,
        categoryId: product?.categoryId,
        excludeProductId: product?.id,
      },
      { enabled: Boolean(product) }
    );
  const { data: reviewFeed } = trpc.reviews.listProductReviews.useQuery(
    {
      productId: product?.id ?? 0,
      page: 1,
      limit: 8,
      sort: reviewSort,
    },
    { enabled: Boolean(product?.id) }
  );
  const { data: reviewEligibility } = trpc.reviews.getEligibility.useQuery(
    { productId: product?.id ?? 0 },
    {
      enabled: Boolean(product?.id) && isAuthenticated,
      retry: false,
    }
  );
  const hasReviewItems = (reviewFeed?.items ?? []).length > 0;
  const availableStores = typedStock.filter(store => store.availableQty > 0);
  const lowAvailabilityStores = availableStores.filter(store => store.availableQty <= 3);

  const breadcrumbs = useMemo(() => {
    if (!product || !categories.length) return [];
    const trail = [];
    let curr: any = categories.find(c => c.id === product.categoryId);
    while (curr) {
      trail.unshift(curr);
      const pid = curr.parentId;
      curr = categories.find(c => c.id === pid);
    }
    return trail;
  }, [categories, product]);

  const seoTitle = product
    ? `${product.name} — купить в ТЕХАКС`
    : "Товар — ТЕХАКС";
  const seoDescription = product
    ? (product.description || "").trim().slice(0, 220) ||
      `${product.name}: цена, характеристики, фото, наличие и доставка. Купить в интернет-магазине ТЕХАКС.`
    : "Карточка товара интернет-магазина ТЕХАКС.";
  const seoCanonicalPath = product?.slug ? `/product/${product.slug}` : "/catalog";

  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonicalPath: seoCanonicalPath,
    noindex: !product,
  });

  useEffect(() => {
    if (hasReviewItems) {
      setShowReviewSection(true);
      return;
    }

    if (location.hash === "#reviews" || location.hash === "#review-composer") {
      setShowReviewSection(true);
    }
  }, [hasReviewItems, location.hash]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Загрузка товара...
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Товар временно недоступен
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Возможно, товар снят с витрины или для него пока не указана актуальная цена.
          </p>
          <Link
            to="/catalog"
            className="mt-4 inline-flex items-center gap-2 text-[#05C3D4] hover:underline"
          >
            <ArrowLeft size={16} />
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const relatedProducts = merchandisingRelated.slice(0, 4);
  const canonicalPath = `/product/${product.slug}`;
  const descriptionForSeo = (product.description || "").trim().slice(0, 220);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-RU").format(price) + " ₽";

  const isManufacturerSpec = (key: string) =>
    ["производитель", "бренд"].includes(key.trim().toLowerCase());
  const normalizedDescription = (product.description || "").trim();
  const hasDescription = normalizedDescription.length > 0;
  const isInStock = Boolean(product.inStock);
  const manufacturer = productManufacturer ?? null;
  const hasManufacturer = Boolean(manufacturer);
  const merchandisingBadges = normalizeMerchandisingBadges(
    (product as { merchandisingBadges?: unknown }).merchandisingBadges
  ).slice(0, 4);
  const hasPublishedReviews = (product.reviewCount ?? 0) > 0 && Number(product.rating ?? 0) > 0;
  const shouldShowReviewSection = hasReviewItems || showReviewSection;
  const reviewCountLabel = formatRussianCount(product.reviewCount ?? 0, [
    "отзыв",
    "отзыва",
    "отзывов",
  ]);
  const hasOldPrice =
    typeof product.oldPrice === "number" && product.oldPrice > product.price;
  const productSpecs =
    product.specs && typeof product.specs === "object"
      ? (product.specs as Record<string, unknown>)
      : null;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [buildCanonical(product.image)],
    description:
      descriptionForSeo ||
      `${product.name}. Купить в интернет-магазине ТЕХАКС.`,
    sku: product.slug.toUpperCase(),
    brand: {
      "@type": "Brand",
      name: productManufacturer?.title || "ТЕХАКС",
    },
    offers: {
      "@type": "Offer",
      url: buildCanonical(canonicalPath),
      priceCurrency: "RUB",
      price: String(product.price),
      availability: isInStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    toast.success("Товар добавлен в корзину");
    // CRO: Redirecting directly to checkout/cart page to reduce steps
    window.location.href = "/checkout";
  };

  const revealReviewSection = () => {
    setShowReviewSection(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        document
          .getElementById("review-composer")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    });
  };

  const openReservationDialog = (store: ProductStoreAvailability) => {
    setSelectedReservationStore(store);
    setReservationDialogOpen(true);
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {/* Breadcrumbs */}
      <section className="bg-muted/30 py-4 border-b border-border">
        <div className="container-main">
          <div className="flex items-center flex-wrap gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
            <Link
              to="/catalog"
              className="hover:text-[#05C3D4] transition-colors"
            >
              Каталог
            </Link>
            {breadcrumbs.map(bc => (
              <div key={bc.id} className="flex items-center gap-2">
                <span className="text-muted-foreground/20">/</span>
                <Link 
                  to={`/catalog?cat=${bc.slug}`}
                  className="hover:text-[#05C3D4] transition-colors"
                >
                  {String(bc.name)}
                </Link>
              </div>
            ))}
            <span className="text-muted-foreground/20">/</span>
            <span className="text-muted-foreground truncate max-w-[150px] sm:max-w-[300px]">
              {product.name}
            </span>
          </div>
        </div>
      </section>

      {/* Header Title */}
      <section className="pt-12 pb-4">
        <div className="container-main">
          <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
            {product.name}
          </h1>
        </div>
      </section>

      {/* Product Detail */}
      <section className="py-12 md:py-20">
        <div className="container-main">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            {/* Gallery */}
            <div className="lg:w-[50%]">
              <div className="relative group bg-white border border-border rounded-[2rem] p-8 md:p-16 flex items-center justify-center overflow-hidden shadow-sm">
                {merchandisingBadges.length > 0 && (
                  <div className="absolute left-5 top-5 z-20 flex max-w-[220px] flex-wrap gap-2">
                    {merchandisingBadges.map(itemBadge => (
                      <span
                        key={itemBadge}
                        className={`${getMerchandisingBadgeStyle(itemBadge)} rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-sm`}
                      >
                        {getMerchandisingBadgeLabel(itemBadge)}
                      </span>
                    ))}
                  </div>
                )}
                {hasManufacturer && (
                  <Link
                    to={manufacturer?.href || "#"}
                    className="absolute top-5 right-5 z-20 inline-flex items-center gap-2 rounded-xl border border-[#05C3D4]/50 bg-white/95 px-3 py-2 !text-[#15171A] shadow-sm transition-all hover:border-[#05C3D4] hover:bg-white hover:!text-[#15171A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/40"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white p-1">
                      {manufacturer?.logo ? (
                        <img
                          src={manufacturer?.logo}
                          alt={manufacturer?.title || "Бренд"}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-[9px] font-black text-[#05C3D4]">
                          {String(manufacturer?.title || "").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="max-w-[160px] truncate text-[11px] font-black uppercase tracking-wide !text-[#15171A]">
                      {String(manufacturer?.title || "")}
                    </span>
                  </Link>
                )}
                <img
                  src={product.image}
                  alt={product.name}
                  className="relative z-10 max-h-[450px] object-contain transform group-hover:scale-110 transition-transform duration-700"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-8">
              {/* Rating */}
              {hasPublishedReviews ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-muted px-3 py-1.5">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={
                            i < Math.round(Number(product.rating))
                              ? "fill-[#05C3D4] text-[#05C3D4]"
                              : "text-muted-foreground/20"
                          }
                        />
                      ))}
                    </div>
                    <span className="ml-2 text-sm font-black text-foreground">
                      {product.rating}
                    </span>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    ({reviewCountLabel})
                  </span>
                </div>
              ) : null}

              {/* Price */}
              <div className={hasPublishedReviews ? "" : "-mt-1"}>
                <div
                  className="p-6 bg-card border border-border rounded-3xl relative overflow-hidden shadow-sm"
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-[#05C3D4]/5 blur-3xl rounded-full" />
                  <div className="relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                      Актуальная цена
                    </span>
                    <div className="flex items-center gap-5">
                      <span className="text-4xl md:text-[42px] font-black text-[#05C3D4] font-heading leading-none">
                        {formatPrice(product.price)}
                      </span>
                      {hasOldPrice && (
                        <div className="flex flex-col">
                          <span className="text-lg text-muted-foreground/40 line-through font-bold">
                            {formatPrice(product.oldPrice as number)}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#22c55e] mt-1">
                            Выгода {formatPrice((product.oldPrice as number) - product.price)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CTA moved here */}
                <div className="mt-5 flex flex-col gap-4">
                  <ProductActionButtons
                    onAddToCart={handleAddToCart}
                    onOpenOneClick={() => setOneClickDialogOpen(true)}
                    disableCart={availableStores.length === 0}
                    disableOneClick={availableStores.length === 0}
                  />
                </div>
              </div>

              {/* Stock & FOMO */}
              <div className="rounded-[1.75rem] border border-border bg-card/70 p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                    Наличие в магазинах
                  </h3>
                  {typedStock.length > 0 ? (
                    <span className="rounded-full border border-border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      {availableStores.length} точк{availableStores.length === 1 ? "а" : "и"}
                    </span>
                  ) : null}
                </div>

                {typedStock.length > 0 ? (
                  <StoreAvailabilityList
                    stores={typedStock}
                    reservedStoreId={reservedStoreId}
                    onReserve={openReservationDialog}
                  />
                ) : (
                  <div className="col-span-full py-4 px-6 bg-muted/20 border border-dashed border-border rounded-xl text-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase">
                      Информацию о наличии уточняйте у менеджера
                    </span>
                  </div>
                )}
                {isInStock &&
                  lowAvailabilityStores.length > 0 && (
                    <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2.5 animate-in fade-in slide-in-from-left duration-700">
                      <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                        Товар заканчивается в некоторых магазинах
                      </span>
                    </div>
                  )}
              </div>

              {/* Description */}
              {hasDescription && (
                <div className="rounded-[1.75rem] border border-border bg-card/70 p-5 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-4">
                    Описание
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed font-medium">
                    {normalizedDescription}
                  </p>
                </div>
              )}

              {/* Specs */}
              {productSpecs && (
                <div className="rounded-[1.75rem] border border-border bg-card/70 p-5 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-4">
                    Характеристики
                  </h3>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(
                      productSpecs
                    )
                      .filter(([key]) => !isManufacturerSpec(key))
                      .map(([key, value]) => {
                        return (
                        <div
                          key={key}
                          className="flex justify-between items-center gap-6 py-3 border-b border-border px-1 group"
                        >
                          <span className="text-sm font-bold text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                            {key}
                          </span>
                          <span className="text-right text-sm font-black text-foreground/80">
                            {String(value)}
                          </span>
                        </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://t.me/tech_aks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-3 h-14 border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-[0.1em] hover:bg-muted transition-all active:scale-95"
                  >
                    <MessageCircle size={18} className="text-[#05C3D4]" />
                    ЗАДАТЬ ВОПРОС В TELEGRAM
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="reviews"
        className={`border-t border-border bg-card ${shouldShowReviewSection ? "py-20" : "py-10 md:py-12"}`}
      >
        <div className="container-main">
          {!shouldShowReviewSection ? (
            <div className="rounded-[1.75rem] border border-dashed border-[#05C3D4]/30 bg-[#F7FEFF] px-5 py-4 shadow-sm md:px-6 md:py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#05C3D4]">
                    Отзывы о товаре
                  </div>
                  <div className="mt-2 text-base font-black uppercase tracking-tight text-[#15171A] md:text-lg">
                    Пока отзывов нет
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Можно оставить первый отзыв и помочь следующему покупателю быстрее понять товар.
                  </p>
                </div>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={revealReviewSection}
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#05C3D4] px-5 text-sm font-black uppercase tracking-[0.12em] text-white"
                  >
                    Оставить первый отзыв
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#05C3D4] px-5 text-sm font-black uppercase tracking-[0.12em] text-white"
                  >
                    Войти и оставить отзыв
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                <div>
                  <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-[#05C3D4]">
                    Доверие
                  </span>
                  <h2 className="text-4xl font-black uppercase font-heading leading-none tracking-tighter text-foreground md:text-5xl">
                    ОТЗЫВЫ <span className="text-muted-foreground/30">О ТОВАРЕ</span>
                  </h2>
                </div>

                <div className="rounded-[2rem] border border-border bg-white p-8 shadow-sm">
                  <div className="flex items-end gap-5">
                    <div className="text-6xl font-black text-[#05C3D4]">
                      {reviewFeed?.summary.avgRating?.toFixed(1) || "0.0"}
                    </div>
                    <div className="pb-2">
                      <div className="text-sm font-bold text-[#15171A]">
                        {formatRussianCount(reviewFeed?.summary.totalCount ?? 0, [
                          "отзыв",
                          "отзыва",
                          "отзывов",
                        ])}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Подтверждённых покупок: {reviewFeed?.summary.verifiedCount ?? 0}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 space-y-3">
                    {[5, 4, 3, 2, 1].map(stars => {
                      const total = reviewFeed?.summary.totalCount ?? 0;
                      const count = reviewFeed?.summary.ratingBreakdown?.[stars as 1 | 2 | 3 | 4 | 5] ?? 0;
                      const width = total > 0 ? `${(count / total) * 100}%` : "0%";
                      return (
                        <div key={stars} className="grid grid-cols-[42px_1fr_42px] items-center gap-3 text-sm">
                          <span className="font-bold text-[#15171A]">{stars}★</span>
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-[#05C3D4]" style={{ width }} />
                          </div>
                          <span className="text-right text-muted-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div id="review-composer">
                  {isAuthenticated ? (
                    <ReviewComposer
                      productId={product.id}
                      productName={product.name}
                      existingReview={reviewEligibility?.existingReview}
                      verifiedPurchase={reviewEligibility?.verifiedPurchase}
                    />
                  ) : (
                    <div className="rounded-[2rem] border border-border bg-white p-8 shadow-sm">
                      <div className="text-lg font-black text-[#15171A]">Оставить отзыв</div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Чтобы оставить отзыв, войдите в личный кабинет. Если товар уже был в заказе, мы пометим отзыв как подтверждённую покупку.
                      </p>
                      <Link
                        to="/login"
                        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#05C3D4] px-5 text-sm font-black uppercase tracking-[0.12em] text-white"
                      >
                        Войти и оставить отзыв
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-bold text-muted-foreground">
                    Реальные отзывы покупателей и ответы магазина
                  </div>
                  {hasReviewItems ? (
                    <select
                      value={reviewSort}
                      onChange={event => setReviewSort(event.target.value as typeof reviewSort)}
                      className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-[#05C3D4]"
                    >
                      <option value="newest">Сначала новые</option>
                      <option value="verified">Сначала подтверждённые</option>
                      <option value="highest">Сначала высокие оценки</option>
                      <option value="lowest">Сначала низкие оценки</option>
                    </select>
                  ) : null}
                </div>

                {!hasReviewItems ? (
                  <div className="rounded-[2rem] border border-dashed border-[#05C3D4]/30 bg-[#F7FEFF] p-8 shadow-sm">
                    <div className="text-lg font-black text-[#15171A]">Пока отзывов нет</div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                      У этого товара ещё нет отзывов. Первый честный отзыв помогает следующему покупателю быстрее понять, подходит ли ему товар в реальном использовании.
                    </p>
                  </div>
                ) : (
                  (reviewFeed?.items ?? []).map(review => (
                    <article key={review.id} className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-[#15171A]">{review.title}</h3>
                            {review.isVerifiedPurchase ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                Подтверждённая покупка
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {review.authorName} · {new Date(review.publishedAt || "").toLocaleDateString("ru-RU")}
                          </div>
                        </div>
                        <div className="text-lg font-black text-[#05C3D4]">{review.rating}/5</div>
                      </div>
                      {review.pros ? (
                        <p className="mt-4 text-sm text-emerald-700"><strong>Достоинства:</strong> {review.pros}</p>
                      ) : null}
                      {review.cons ? (
                        <p className="mt-2 text-sm text-rose-700"><strong>Недостатки:</strong> {review.cons}</p>
                      ) : null}
                      <p className="mt-4 text-sm leading-7 text-[#15171A]">{review.text}</p>
                      {(review.usageContext || review.usageDuration) ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {review.usageContext ? (
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                              Где использовали: {review.usageContext}
                            </span>
                          ) : null}
                          {review.usageDuration ? (
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                              Срок: {review.usageDuration}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {review.storeReply ? (
                        <div className="mt-5 rounded-2xl border border-[#05C3D4]/20 bg-[#F7FEFF] p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0099A8]">
                            Ответ магазина
                          </div>
                          <div className="mt-2 text-sm leading-6 text-[#15171A]">{review.storeReply}</div>
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <ReservationConfirmDialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
        product={{ id: product.id, name: product.name }}
        store={selectedReservationStore}
        onReserved={payload => {
          setReservedStoreId(payload.store.id);
        }}
      />

      <OneClickOrderDialog
        open={oneClickDialogOpen}
        onOpenChange={setOneClickDialogOpen}
        product={{ id: product.id, name: product.name }}
      />

      {/* Lead Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={() => setShowForm(false)}
          />
          <div className="relative w-full max-w-xl">
            <button
              onClick={() => setShowForm(false)}
              className="absolute -top-12 right-0 text-white/40 hover:text-white flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-colors"
            >
              Закрыть ✕
            </button>
            <LeadForm
              dark
              title={`ЗАЯВКА НА «${product.name.toUpperCase()}»`}
              subtitle="Оставьте контакты — мы проверим наличие и свяжемся с вами в течение 5 минут."
              type="availability"
              source="product_page"
              metadata={{
                productName: product.name,
                productSlug: product.slug,
                productId: product.id,
              }}
              buttonText="ПРОВЕРИТЬ НАЛИЧИЕ"
            />
          </div>
        </div>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-24 bg-card border-t border-border">
          <div className="container-main">
            <div className="flex items-end justify-between gap-6 mb-16">
              <div>
                <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
                  Рекомендации
                </span>
                <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                  ПОХОЖИЕ{" "}
                  <span className="text-muted-foreground/30">ТОВАРЫ</span>
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map(p => (
                <ProductCard key={p.id} product={p as any} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
