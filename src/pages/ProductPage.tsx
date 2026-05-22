import { useParams, Link, useLocation, useNavigate } from "react-router";
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
import StoreAvailabilityList from "@/components/product/StoreAvailabilityList";
import ReservationConfirmDialog from "@/components/product/ReservationConfirmDialog";
import OneClickOrderDialog from "@/components/product/OneClickOrderDialog";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import ProductVariantSelector from "@/components/product/ProductVariantSelector";
import ProductServices from "@/components/product/ProductServices";
import ProductDescription from "@/components/product/ProductDescription";
import ProductSpecifications from "@/components/product/ProductSpecifications";
import ProductMobileStickyBuy from "@/components/product/ProductMobileStickyBuy";
import ProductPurchasePanel from "@/components/product/ProductPurchasePanel";
import type { ProductStoreAvailability } from "@/components/product/StoreAvailabilityItem";
import {
  getMerchandisingBadgeLabel,
  getMerchandisingBadgeStyle,
  normalizeMerchandisingBadges,
} from "@/lib/merchandising-badges";
import {
  getProductLightboxImageSrc,
  resolveProductImageCollection,
} from "@/lib/product-images";

export default function ProductPage() {
  const { id: slug } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [reviewSort, setReviewSort] = useState<"newest" | "highest" | "lowest" | "verified">("newest");
  const [showReviewSection, setShowReviewSection] = useState(false);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [oneClickDialogOpen, setOneClickDialogOpen] = useState(false);
  const [selectedReservationStore, setSelectedReservationStore] =
    useState<ProductStoreAvailability | null>(null);
  const [reservedStoreId, setReservedStoreId] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [variantChosenManually, setVariantChosenManually] = useState(false);
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();

  const { data: product, isLoading } = trpc.product.getBySlug.useQuery({
    slug: slug || "",
  });
  const variants = useMemo(() => {
    const rawVariants = (product as { variants?: unknown } | undefined)?.variants;
    if (!Array.isArray(rawVariants)) return [];
    return rawVariants
      .map(variant => variant as {
        id: number;
        name: string;
        article?: string | null;
        image?: string | null;
        imageVariants?: unknown;
        price: number;
        stock: number;
        isActive: boolean;
        attributes?: Record<string, string>;
      })
      .sort((left, right) => {
        const leftRank = left.isActive && left.stock > 0 ? 0 : left.isActive ? 1 : 2;
        const rightRank = right.isActive && right.stock > 0 ? 0 : right.isActive ? 1 : 2;
        return leftRank - rightRank || left.price - right.price || left.id - right.id;
      });
  }, [product]);
  const defaultVariant = useMemo(
    () =>
      variants.find(variant => variant.isActive && variant.stock > 0) ||
      variants.find(variant => variant.isActive) ||
      variants[0] ||
      null,
    [variants]
  );
  const requestedVariantId = useMemo(() => {
    const rawValue = new URLSearchParams(location.search).get("variant");
    if (!rawValue) return null;
    const parsed = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [location.search]);
  const requestedVariant = useMemo(
    () =>
      requestedVariantId
        ? variants.find(variant => variant.id === requestedVariantId) ?? null
        : null,
    [requestedVariantId, variants]
  );
  const hasVariants = variants.length > 0;
  const selectedVariant =
    variants.find(variant => variant.id === selectedVariantId) ?? defaultVariant ?? null;

  useEffect(() => {
    setSelectedVariantId(requestedVariant?.id ?? defaultVariant?.id ?? null);
    setVariantChosenManually(Boolean(requestedVariant));
  }, [defaultVariant?.id, product?.id, requestedVariant]);

  useEffect(() => {
    if (!product) return;

    const currentParams = new URLSearchParams(location.search);
    const currentVariant = currentParams.get("variant");

    if (hasVariants && selectedVariant?.id) {
      const nextVariant = String(selectedVariant.id);
      if (currentVariant === nextVariant) return;
      currentParams.set("variant", nextVariant);
    } else if (!currentVariant) {
      return;
    } else {
      currentParams.delete("variant");
    }

    const nextSearch = currentParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
        hash: location.hash,
      },
      { replace: true }
    );
  }, [hasVariants, location.hash, location.pathname, location.search, navigate, product, selectedVariant?.id]);

  const { data: stock = [] } = trpc.product.getStockBySlug.useQuery({
    slug: slug || "",
    variantId: selectedVariant?.id ?? undefined,
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

  const productImages = useMemo(() => {
    if (!product) return [];

    return resolveProductImageCollection(
      product.image,
      (product as { imageVariants?: unknown }).imageVariants,
      (product as { images?: unknown }).images
    );
  }, [product]);
  const selectedVariantImage = useMemo(() => {
    if (!selectedVariant?.image && !selectedVariant?.imageVariants) return null;

    return resolveProductImageCollection(
      selectedVariant?.image || product?.image,
      selectedVariant?.imageVariants,
      []
    )[0] ?? null;
  }, [product?.image, selectedVariant?.image, selectedVariant?.imageVariants]);
  const displayedImages = useMemo(() => {
    if (!selectedVariantImage) return productImages;

    return [
      selectedVariantImage,
      ...productImages.filter(image => image.original !== selectedVariantImage.original),
    ];
  }, [productImages, selectedVariantImage]);

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
  const hasVariantPriceRange =
    hasVariants && new Set(variants.map(variant => variant.price)).size > 1;
  const displayedPrice = selectedVariant?.price ?? product.price;
  const displayedStockCount = selectedVariant?.stock ?? availableStores.length;
  const displayedArticle =
    selectedVariant?.article ||
    (product as { article?: string | null; externalCode?: string | null }).article ||
    (product as { article?: string | null; externalCode?: string | null }).externalCode ||
    null;
  const productSpecs =
    product.specs && typeof product.specs === "object"
      ? (product.specs as Record<string, unknown>)
      : null;
  const quickSpecs = productSpecs
    ? Object.entries(productSpecs)
        .filter(([key]) => !isManufacturerSpec(key))
        .slice(0, 4)
    : [];
  const topStore = availableStores[0] ?? null;
  const deliverySummary = topStore
    ? `Самовывоз сегодня из ${topStore.storeName}`
    : "Наличие уточняйте у менеджера";
  const availabilitySummary = availableStores.length
    ? `Доступно в ${availableStores.length} ${availableStores.length === 1 ? "точке" : "точках"}`
    : "Сейчас нет доступного остатка";
  const compactDetailSpecs = quickSpecs.slice(0, 3);
  const oldPriceLabel =
    hasOldPrice && !selectedVariant ? formatPrice(product.oldPrice as number) : null;
  const displayedPriceLabel =
    hasVariants && hasVariantPriceRange && !variantChosenManually
      ? `от ${formatPrice(displayedPrice)}`
      : formatPrice(displayedPrice);
  const discountLabel =
    oldPriceLabel && product.oldPrice
      ? `-${Math.round(((product.oldPrice - displayedPrice) / product.oldPrice) * 100)}%`
      : null;
  const canPurchase =
    hasVariants
      ? Boolean(
          selectedVariant &&
            selectedVariant.isActive &&
            displayedStockCount > 0 &&
            availableStores.length > 0
        )
      : availableStores.length > 0;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: productImages.map(image => buildCanonical(getProductLightboxImageSrc(image))),
    description:
      descriptionForSeo ||
      `${product.name}. Купить в интернет-магазине ТЕХАКС.`,
    sku: displayedArticle || product.slug.toUpperCase(),
    brand: {
      "@type": "Brand",
      name: productManufacturer?.title || "ТЕХАКС",
    },
    offers: {
      "@type": "Offer",
      url: buildCanonical(canonicalPath),
      priceCurrency: "RUB",
      price: String(displayedPrice),
      availability: isInStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariant) {
      toast.error("Выберите вариант товара");
      return;
    }

    if (selectedVariant && (!selectedVariant.isActive || selectedVariant.stock <= 0)) {
      toast.error("Выбранный вариант сейчас недоступен");
      return;
    }

    addItem({
      id: product.id,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
      article: displayedArticle,
      slug: product.slug,
      name: selectedVariant ? `${product.name} · ${selectedVariant.name}` : product.name,
      price: selectedVariant?.price ?? product.price,
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

  const handleReserveShortcut = () => {
    if (availableStores.length === 1 && availableStores[0]) {
      openReservationDialog(availableStores[0]);
      return;
    }

    document
      .getElementById("product-store-availability")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background pb-36 text-foreground md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {/* Breadcrumbs */}
      <section className="bg-white py-4">
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

      {/* Product Detail */}
      <section className="py-8 md:py-12">
        <div className="container-main">
          <div className="space-y-5 lg:hidden">
            {hasManufacturer ? (
              <div className="text-sm font-black uppercase tracking-[0.28em] text-[#1F2328]">
                {manufacturer?.title}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={`inline-flex items-center gap-2 font-medium ${
                  isInStock ? "text-emerald-600" : "text-[#6B7280]"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isInStock ? "bg-emerald-500" : "bg-[#BDC4CC]"
                  }`}
                />
                {isInStock ? "В наличии" : "Нет в наличии"}
              </span>
              {displayedArticle ? (
                <span className="text-[#6B7280]">Код: {displayedArticle}</span>
              ) : null}
            </div>

            {(merchandisingBadges.length > 0 || product.badge) ? (
              <div className="flex flex-wrap gap-2">
                {merchandisingBadges.map(itemBadge => (
                  <span
                    key={`mobile-${itemBadge}`}
                    className={`${getMerchandisingBadgeStyle(itemBadge)} rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide`}
                  >
                    {getMerchandisingBadgeLabel(itemBadge)}
                  </span>
                ))}
                {product.badge ? (
                  <span className="rounded-full bg-[#F4F5F6] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#464A50]">
                    {product.badge}
                  </span>
                ) : null}
              </div>
            ) : null}

            <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-[#1F2328]">
              {product.name}
            </h1>

            <div className="flex min-h-6 flex-wrap items-center gap-3 text-sm">
              {hasPublishedReviews ? (
                <>
                  <div className="flex items-center gap-1 text-[#05C3D4]">
                    <Star size={15} className="fill-current" />
                    <span className="font-black text-[#1F2328]">{product.rating}</span>
                  </div>
                  <span className="text-[#6B7280]">{reviewCountLabel}</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-[#1F2328]">Пока без отзывов</span>
                  <span className="text-[#6B7280]">
                    Новый товар, можно заказать с проверкой перед выдачей.
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-[minmax(480px,1.08fr)_minmax(420px,0.92fr)] lg:items-start xl:grid-cols-[minmax(560px,1.12fr)_minmax(460px,0.88fr)] xl:gap-14">
            <div className="order-1 lg:order-1 lg:sticky lg:top-24">
              <ProductImageGallery
                images={displayedImages}
                productName={product.name}
                badges={
                  merchandisingBadges.length > 0 ? (
                    <div className="absolute left-5 top-5 z-20 flex max-w-[220px] flex-wrap gap-2">
                      {merchandisingBadges.map(itemBadge => (
                        <span
                          key={itemBadge}
                          className={`${getMerchandisingBadgeStyle(itemBadge)} rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wide`}
                        >
                          {getMerchandisingBadgeLabel(itemBadge)}
                        </span>
                      ))}
                    </div>
                  ) : null
                }
                manufacturerBadge={
                  hasManufacturer ? (
                    <Link
                      to={manufacturer?.href || "#"}
                      className="absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 !text-[#15171A] transition-all hover:bg-[#F6F7F8] hover:!text-[#15171A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/40"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white p-0.5">
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
                  ) : null
                }
              />
            </div>

            <div className="order-2 space-y-8 lg:order-2">
              <div className="hidden space-y-5 lg:block">
                {hasManufacturer ? (
                  <div className="text-sm font-black uppercase tracking-[0.28em] text-[#1F2328]">
                    {manufacturer?.title}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span
                    className={`inline-flex items-center gap-2 font-medium ${
                      isInStock ? "text-emerald-600" : "text-[#6B7280]"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isInStock ? "bg-emerald-500" : "bg-[#BDC4CC]"
                      }`}
                    />
                    {isInStock ? "В наличии" : "Нет в наличии"}
                  </span>
                  {displayedArticle ? (
                    <span className="text-[#6B7280]">Код: {displayedArticle}</span>
                  ) : null}
                </div>

                {(merchandisingBadges.length > 0 || product.badge) ? (
                  <div className="flex flex-wrap gap-2">
                    {merchandisingBadges.map(itemBadge => (
                      <span
                        key={itemBadge}
                        className={`${getMerchandisingBadgeStyle(itemBadge)} rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide`}
                      >
                        {getMerchandisingBadgeLabel(itemBadge)}
                      </span>
                    ))}
                    {product.badge ? (
                      <span className="rounded-full bg-[#F4F5F6] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#464A50]">
                        {product.badge}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-[#1F2328] md:text-5xl xl:text-[3.6rem]">
                  {product.name}
                </h1>

                <div className="flex min-h-6 flex-wrap items-center gap-3 text-sm">
                  {hasPublishedReviews ? (
                    <>
                      <div className="flex items-center gap-1 text-[#05C3D4]">
                        <Star size={15} className="fill-current" />
                        <span className="font-black text-[#1F2328]">{product.rating}</span>
                      </div>
                      <span className="text-[#6B7280]">{reviewCountLabel}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-[#1F2328]">Пока без отзывов</span>
                      <span className="text-[#6B7280]">
                        Новый товар, можно заказать с проверкой перед выдачей.
                      </span>
                    </>
                  )}
                </div>
              </div>

              <ProductPurchasePanel
                priceLabel={displayedPriceLabel}
                oldPriceLabel={oldPriceLabel}
                discountLabel={discountLabel}
                summaryTitle="Самовывоз и доставка"
                summaryText={`${deliverySummary}. Доставка по Пензе и России после подтверждения заказа.`}
                onAddToCart={handleAddToCart}
                onOpenOneClick={() => setOneClickDialogOpen(true)}
                onReserveClick={handleReserveShortcut}
                disableCart={!canPurchase}
                disableOneClick={!canPurchase}
                disableReserve={availableStores.length === 0}
              />

              {hasVariants ? (
                <ProductVariantSelector
                  variants={variants}
                  selectedVariantId={selectedVariant?.id ?? null}
                  fallbackImage={product.image}
                  fallbackImageVariants={(product as { imageVariants?: unknown }).imageVariants}
                  onSelect={variantId => {
                    setSelectedVariantId(variantId);
                    setVariantChosenManually(true);
                  }}
                />
              ) : null}

              {compactDetailSpecs.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-lg font-semibold text-[#1F2328]">О товаре</div>
                  <div className="grid gap-2">
                    {compactDetailSpecs.map(([key, value]) => (
                      <div key={key} className="text-[15px] leading-6 text-[#1F2328]">
                        <span className="font-medium text-[#7A7F87]">{key}:</span>{" "}
                        <span className="font-semibold">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

            <ProductServices
              pickupText={deliverySummary}
              deliveryText="По Пензе и регионам России после подтверждения менеджером."
              storeText={availabilitySummary}
            />
          </div>
          </div>

          <div className="mt-20">
            <ProductSpecifications
              specs={productSpecs}
              isManufacturerSpec={isManufacturerSpec}
            />
            <ProductDescription description={normalizedDescription} />

            <section id="product-store-availability" className="mt-16">
              <h2 className="text-3xl font-black tracking-tight text-[#1F2328] md:text-4xl">
                Наличие в магазинах
              </h2>
              <div className="mt-6">
                {typedStock.length > 0 ? (
                  <StoreAvailabilityList
                    stores={typedStock}
                    reservedStoreId={reservedStoreId}
                    onReserve={openReservationDialog}
                  />
                ) : (
                  <div className="py-6 text-sm font-medium text-[#6B7280]">
                    Информацию о наличии уточняйте у менеджера.
                  </div>
                )}
              </div>
              {isInStock && lowAvailabilityStores.length > 0 ? (
                <div className="mt-5 inline-flex items-center gap-3 rounded-full bg-orange-50 px-4 py-2.5">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-500">
                    Товар заканчивается в некоторых магазинах
                  </span>
                </div>
              ) : null}
            </section>

            <section className="mt-12">
              <a
                href="https://t.me/tech_aks"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-sm font-medium text-[#464A50] transition hover:text-[#1F2328]"
              >
                <MessageCircle size={18} className="text-[#05C3D4]" />
                Задать вопрос в Telegram
              </a>
            </section>
          </div>
        </div>
      </section>

      <ProductMobileStickyBuy
        priceLabel={displayedPriceLabel}
        disabled={!canPurchase}
        onAddToCart={handleAddToCart}
      />
      <section
        id="reviews"
        className={`bg-white ${shouldShowReviewSection ? "py-20" : "py-10 md:py-12"}`}
      >
        <div className="container-main">
          {!shouldShowReviewSection ? (
            <div className="rounded-[1.75rem] bg-[#F7FEFF] px-5 py-4 md:px-6 md:py-5">
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

                <div className="rounded-[2rem] bg-[#F6F7F8] p-8">
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
                    <div className="rounded-[2rem] bg-[#F6F7F8] p-8">
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
                  <div className="rounded-[2rem] bg-[#F7FEFF] p-8">
                    <div className="text-lg font-black text-[#15171A]">Пока отзывов нет</div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                      У этого товара ещё нет отзывов. Первый честный отзыв помогает следующему покупателю быстрее понять, подходит ли ему товар в реальном использовании.
                    </p>
                  </div>
                ) : (
                  <div className="border-t border-[#F1F2F3]">
                    {(reviewFeed?.items ?? []).map(review => (
                    <article key={review.id} className="border-b border-[#F1F2F3] py-6">
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
                        <div className="mt-5 rounded-2xl bg-[#F7FEFF] p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0099A8]">
                            Ответ магазина
                          </div>
                          <div className="mt-2 text-sm leading-6 text-[#15171A]">{review.storeReply}</div>
                        </div>
                      ) : null}
                    </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <ReservationConfirmDialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
        product={{
          id: product.id,
          name: product.name,
          variantId: selectedVariant?.id ?? null,
          variantName: selectedVariant?.name ?? null,
          article: displayedArticle,
        }}
        store={selectedReservationStore}
        onReserved={payload => {
          setReservedStoreId(payload.store.id);
        }}
      />

      <OneClickOrderDialog
        open={oneClickDialogOpen}
        onOpenChange={setOneClickDialogOpen}
        product={{
          id: product.id,
          name: product.name,
          variantId: selectedVariant?.id ?? null,
          variantName: selectedVariant?.name ?? null,
          article: displayedArticle,
        }}
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
