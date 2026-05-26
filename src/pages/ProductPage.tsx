import { useParams, Link, useLocation, useNavigate } from "react-router";
import { Star, ArrowLeft } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import LeadForm from "@/components/LeadForm";
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { buildCanonical, useSeo } from "@/lib/seo";
import { formatRussianCount } from "@/lib/russian-plurals";
import { useAuth } from "@/hooks/use-auth";
import ReservationConfirmDialog from "@/components/product/ReservationConfirmDialog";
import OneClickOrderDialog from "@/components/product/OneClickOrderDialog";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import ProductVariantSelector from "@/components/product/ProductVariantSelector";
import ProductServices from "@/components/product/ProductServices";
import ProductMobileStickyBuy from "@/components/product/ProductMobileStickyBuy";
import ProductPurchasePanel from "@/components/product/ProductPurchasePanel";
import ProductDetailsTabs, {
  type ProductDetailsTabKey,
} from "@/components/product/ProductDetailsTabs";
import ProductAboutTab from "@/components/product/ProductAboutTab";
import ProductSpecsTab from "@/components/product/ProductSpecsTab";
import ProductStockTab from "@/components/product/ProductStockTab";
import ProductDeliveryTab from "@/components/product/ProductDeliveryTab";
import ProductReviewsTab from "@/components/product/ProductReviewsTab";
import ProductWarrantyTab from "@/components/product/ProductWarrantyTab";
import ProductBreadcrumbsCompact, {
  shortenProductName,
  type CompactBreadcrumbItem,
} from "@/components/product/ProductBreadcrumbsCompact";
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

const PRODUCT_TAB_KEYS = ["about", "specs", "stock", "delivery", "reviews", "warranty"] as const;

function isProductTabKey(value: string | null): value is ProductDetailsTabKey {
  return Boolean(value && PRODUCT_TAB_KEYS.includes(value as ProductDetailsTabKey));
}

export default function ProductPage() {
  const { id: slug } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [showMobileStickyBuy, setShowMobileStickyBuy] = useState(false);
  const reviewSort: "newest" | "highest" | "lowest" | "verified" = "newest";
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [oneClickDialogOpen, setOneClickDialogOpen] = useState(false);
  const [selectedReservationStore, setSelectedReservationStore] =
    useState<ProductStoreAvailability | null>(null);
  const [reservedStoreId, setReservedStoreId] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [variantChosenManually, setVariantChosenManually] = useState(false);
  const detailsTabsRef = useRef<HTMLDivElement | null>(null);
  const { addItem, items: cartItems } = useCart();
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
  const availableStores = typedStock.filter(store => store.availableQty > 0);
  const selectedVariantAvailableQty = availableStores.reduce(
    (sum, store) => sum + Math.max(0, Number(store.availableQty ?? 0)),
    0
  );
  const requestedTab = useMemo(() => {
    const rawHash = location.hash.replace(/^#/, "");
    if (isProductTabKey(rawHash)) return rawHash;
    const rawTab = new URLSearchParams(location.search).get("tab");
    if (isProductTabKey(rawTab)) return rawTab;
    if (location.hash === "#reviews" || location.hash === "#review-composer") {
      return "reviews";
    }
    return "about" as ProductDetailsTabKey;
  }, [location.hash, location.search]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const target = document.getElementById("about");
    if (!target) {
      setShowMobileStickyBuy(false);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setShowMobileStickyBuy(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const passedAboutSection =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setShowMobileStickyBuy(passedAboutSection);
      },
      {
        threshold: [0, 0.2, 0.45],
        rootMargin: "0px 0px -96px 0px",
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [product?.id]);

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
            className="mt-4 inline-flex items-center gap-2 text-[var(--tech-color-primary)] hover:underline"
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
  const isInStock = hasVariants
    ? selectedVariantAvailableQty > 0
    : Boolean(product.inStock);
  const manufacturer = productManufacturer ?? null;
  const hasManufacturer = Boolean(manufacturer);
  const merchandisingBadges = normalizeMerchandisingBadges(
    (product as { merchandisingBadges?: unknown }).merchandisingBadges
  ).slice(0, 4);
  const hasPublishedReviews = (product.reviewCount ?? 0) > 0 && Number(product.rating ?? 0) > 0;
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
  const displayedStockCount = hasVariants
    ? selectedVariantAvailableQty
    : selectedVariant?.stock ?? availableStores.length;
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
  const compactPickupText = topStore
    ? availableStores
        .map(store => {
          const address = store.storeAddress || store.storeName;
          return store.storeName && store.storeName !== address
            ? `${store.storeName}: ${address}`
            : address;
        })
        .join("; ")
    : "Уточняйте у менеджера";
  const compactDeliveryText = "По Пензе и России";
  const availabilitySummary = availableStores.length
    ? `Доступно в ${availableStores.length} ${availableStores.length === 1 ? "точке" : "точках"}`
    : "Сейчас нет доступного остатка";
  const compactDetailSpecs = quickSpecs.slice(0, 3);
  const selectedVariantSummary = selectedVariant
    ? Object.values(selectedVariant.attributes ?? {}).filter(Boolean).join(" · ") ||
      selectedVariant.name
    : null;
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
  const selectedCartKey = `${product.id}:${selectedVariant?.id ?? 0}`;
  const isSelectedProductInCart = cartItems.some(
    item => item.cartKey === selectedCartKey
  );
  const aboutBenefits = [
    ...merchandisingBadges.map(getMerchandisingBadgeLabel),
    ...(product.badge ? [product.badge] : []),
  ];

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

  const handleAddToCart = ({
    redirectToCheckout = true,
  }: { redirectToCheckout?: boolean } = {}) => {
    if (hasVariants && !selectedVariant) {
      toast.error("Выберите вариант товара");
      return false;
    }

    if (
      selectedVariant &&
      (!selectedVariant.isActive || selectedVariantAvailableQty <= 0)
    ) {
      toast.error("Выбранный вариант сейчас недоступен");
      return false;
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
    if (redirectToCheckout) {
      // CRO: Redirecting directly to checkout/cart page to reduce steps.
      window.location.href = "/checkout";
    }
    return true;
  };

  const handleMobileStickyAddToCart = () =>
    handleAddToCart({ redirectToCheckout: false });

  const openReservationDialog = (store: ProductStoreAvailability) => {
    setSelectedReservationStore(store);
    setReservationDialogOpen(true);
  };

  const setProductTab = (tab: ProductDetailsTabKey) => {
    const currentParams = new URLSearchParams(location.search);
    currentParams.delete("tab");

    navigate(
      {
        pathname: location.pathname,
        search: currentParams.toString() ? `?${currentParams.toString()}` : "",
        hash: tab === "about" ? "" : `#${tab}`,
      },
      { replace: true }
    );
  };

  const scrollToDetailsTabs = () => {
    if (typeof window === "undefined") return;
    const target = detailsTabsRef.current;
    if (!target) return;

    const rawHeaderHeight = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue("--header-height");
    const headerHeight = Number.parseInt(rawHeaderHeight, 10);
    const offset = Number.isFinite(headerHeight) ? headerHeight : 78;
    const nextTop = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: Math.max(0, nextTop),
      behavior: "smooth",
    });
  };

  const openStockTab = () => {
    setProductTab("stock");
    window.setTimeout(scrollToDetailsTabs, 0);
  };

  return (
    <div className="min-h-screen bg-background pb-36 text-foreground md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <ProductBreadcrumbsCompact
        rootTo="/catalog"
        rootLabel="Каталог"
        compactRootLabel="Кат."
        items={breadcrumbs.map(
          breadcrumb =>
            ({
              id: breadcrumb.id,
              label: String(breadcrumb.name),
              to: `/catalog?cat=${breadcrumb.slug}`,
            }) satisfies CompactBreadcrumbItem
        )}
        currentLabel={product.name}
        shortenCurrentLabel={shortenProductName}
      />

      {/* Product Detail */}
      <section className="py-6 md:py-12">
        <div className="container-main">
          <div className="space-y-3 lg:hidden">
            {hasManufacturer ? (
              <Link
                to={manufacturer?.href || "#"}
                className="inline-flex w-fit items-center gap-2 text-[var(--tech-color-text-main)] transition hover:opacity-80"
              >
                {manufacturer?.logo ? (
                  <img
                    src={manufacturer.logo}
                    alt={manufacturer.title || "Бренд"}
                    className="h-8 max-w-[176px] object-contain"
                  />
                ) : (
                  <span className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--tech-color-text-main)]">
                    {manufacturer?.title}
                  </span>
                )}
              </Link>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={`inline-flex items-center gap-2 font-medium ${
                  isInStock ? "text-emerald-500" : "text-[var(--tech-color-text-muted)]"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isInStock ? "bg-emerald-500" : "bg-[var(--tech-color-border)]"
                  }`}
                />
                {isInStock ? "В наличии" : "Нет в наличии"}
              </span>
              {displayedArticle ? (
                <span className="text-[var(--tech-color-text-muted)]">Код: {displayedArticle}</span>
              ) : null}
            </div>

            <h1>{product.name}</h1>

            {hasPublishedReviews ? (
              <div className="flex min-h-6 flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1 text-[var(--tech-color-primary)]">
                  <Star size={15} className="fill-current" />
                  <span className="font-black text-[var(--tech-color-text-main)]">{product.rating}</span>
                </div>
                <span className="text-[var(--tech-color-text-muted)]">{reviewCountLabel}</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-10 lg:grid-cols-[minmax(480px,1.08fr)_minmax(420px,0.92fr)] lg:items-start xl:grid-cols-[minmax(560px,1.12fr)_minmax(460px,0.88fr)] xl:gap-14">
            <div className="order-1 lg:order-1 lg:sticky lg:top-24">
              <ProductImageGallery
                images={displayedImages}
                productName={product.name}
                badges={
                  merchandisingBadges.length > 0 || product.badge ? (
                    <div className="absolute left-5 top-5 z-20 flex max-w-[220px] flex-wrap gap-2">
                      {merchandisingBadges.map(itemBadge => (
                        <span
                          key={itemBadge}
                          className={`${getMerchandisingBadgeStyle(itemBadge)} rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wide opacity-75`}
                        >
                          {getMerchandisingBadgeLabel(itemBadge)}
                        </span>
                      ))}
                      {product.badge ? (
                        <span className="rounded-xl bg-[var(--tech-color-surface-muted)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[var(--tech-color-text-main)] opacity-75">
                          {product.badge}
                        </span>
                      ) : null}
                    </div>
                  ) : null
                }
              />
            </div>

            <div className="order-2 space-y-5 lg:space-y-8 lg:order-2">
              <div className="hidden space-y-5 lg:block">
                {hasManufacturer ? (
                  <Link
                    to={manufacturer?.href || "#"}
                    className="inline-flex w-fit items-center gap-3 text-[var(--tech-color-text-main)] transition hover:opacity-80"
                  >
                    {manufacturer?.logo ? (
                      <img
                        src={manufacturer.logo}
                        alt={manufacturer.title || "Бренд"}
                        className="h-10 max-w-[240px] object-contain"
                      />
                    ) : (
                      <span className="text-sm font-black uppercase tracking-[0.28em] text-[var(--tech-color-text-main)]">
                        {manufacturer?.title}
                      </span>
                    )}
                  </Link>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span
                    className={`inline-flex items-center gap-2 font-medium ${
                      isInStock ? "text-emerald-500" : "text-[var(--tech-color-text-muted)]"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isInStock ? "bg-emerald-500" : "bg-[var(--tech-color-border)]"
                      }`}
                    />
                    {isInStock ? "В наличии" : "Нет в наличии"}
                  </span>
                  {displayedArticle ? (
                    <span className="text-[var(--tech-color-text-muted)]">Код: {displayedArticle}</span>
                  ) : null}
                </div>

                <h1>{product.name}</h1>

                {hasPublishedReviews ? (
                  <div className="flex min-h-6 flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 text-[var(--tech-color-primary)]">
                      <Star size={15} className="fill-current" />
                      <span className="font-black text-[var(--tech-color-text-main)]">{product.rating}</span>
                    </div>
                    <span className="text-[var(--tech-color-text-muted)]">{reviewCountLabel}</span>
                  </div>
                ) : null}
              </div>

              <ProductPurchasePanel
                priceLabel={displayedPriceLabel}
                oldPriceLabel={oldPriceLabel}
                discountLabel={discountLabel}
                onAddToCart={() => {
                  handleAddToCart();
                }}
                onOpenOneClick={() => setOneClickDialogOpen(true)}
                disableCart={!canPurchase}
                disableOneClick={!canPurchase}
              />

              <div className="space-y-2 lg:hidden">
                {selectedVariantSummary ? (
                  <div className="text-sm leading-6 text-[var(--tech-color-text-muted)]">
                    Выбрано: <span className="font-medium text-[var(--tech-color-text-main)]">{selectedVariantSummary}</span>
                  </div>
                ) : null}
              </div>

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
                  <div className="text-lg font-semibold text-[var(--tech-color-text-main)]">О товаре</div>
                  <div className="grid gap-3">
                    {compactDetailSpecs.map(([key, value]) => (
                      <div
                        key={key}
                        className="grid grid-cols-[auto_minmax(28px,1fr)_auto] items-baseline gap-2 text-[15px] leading-6"
                      >
                        <span className="font-medium text-[var(--tech-color-text-muted)]">{key}</span>
                        <span className="translate-y-[-3px] border-b border-dotted border-[var(--tech-color-border)]" />
                        <span className="max-w-[48vw] text-right font-semibold text-[var(--tech-color-text-main)] lg:max-w-[220px]">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

            <ProductServices
              pickupText={compactPickupText}
              deliveryText={compactDeliveryText}
              storeText={availabilitySummary}
              compactMobile
              onPickupClick={openStockTab}
            />
          </div>
          </div>

          <div ref={detailsTabsRef}>
          <ProductDetailsTabs
            activeTab={requestedTab}
            onTabChange={setProductTab}
            about={
              <ProductAboutTab
                description={normalizedDescription}
                quickSpecs={quickSpecs}
                benefits={aboutBenefits}
              />
            }
            aboutMobile={
              <ProductAboutTab
                description={normalizedDescription}
                quickSpecs={quickSpecs}
                benefits={aboutBenefits}
                mobile
              />
            }
            specs={
              <ProductSpecsTab
                specs={productSpecs}
                isManufacturerSpec={isManufacturerSpec}
              />
            }
            specsMobile={
              <ProductSpecsTab
                specs={productSpecs}
                isManufacturerSpec={isManufacturerSpec}
                mobile
              />
            }
            stock={
              <div data-section="product-store-availability">
                <ProductStockTab
                  stores={typedStock}
                  reservedStoreId={reservedStoreId}
                  onReserve={openReservationDialog}
                  onNotify={() => setShowForm(true)}
                />
              </div>
            }
            stockMobile={
              <div data-section="product-store-availability">
                <ProductStockTab
                  stores={typedStock}
                  reservedStoreId={reservedStoreId}
                  onReserve={openReservationDialog}
                  onNotify={() => setShowForm(true)}
                  mobile
                />
              </div>
            }
            delivery={<ProductDeliveryTab />}
            deliveryMobile={<ProductDeliveryTab mobile />}
            reviews={
              <div data-section="reviews">
                <ProductReviewsTab
                  productId={product.id}
                  productName={product.name}
                  isAuthenticated={isAuthenticated}
                  summary={reviewFeed?.summary}
                  reviews={reviewFeed?.items ?? []}
                  existingReview={reviewEligibility?.existingReview}
                  verifiedPurchase={reviewEligibility?.verifiedPurchase}
                  onSuccess={async () => {
                    setProductTab("reviews");
                  }}
                />
              </div>
            }
            reviewsMobile={
              <div data-section="reviews">
                <ProductReviewsTab
                  productId={product.id}
                  productName={product.name}
                  isAuthenticated={isAuthenticated}
                  summary={reviewFeed?.summary}
                  reviews={reviewFeed?.items ?? []}
                  existingReview={reviewEligibility?.existingReview}
                  verifiedPurchase={reviewEligibility?.verifiedPurchase}
                  onSuccess={async () => {
                    setProductTab("reviews");
                  }}
                  mobile
                />
              </div>
            }
            warranty={
              <ProductWarrantyTab manufacturerName={productManufacturer?.title} />
            }
            warrantyMobile={
              <ProductWarrantyTab
                manufacturerName={productManufacturer?.title}
                mobile
              />
            }
          />
          </div>
        </div>
      </section>

      <ProductMobileStickyBuy
        disabled={!canPurchase}
        inCart={isSelectedProductInCart}
        onAddToCart={handleMobileStickyAddToCart}
        visible={canPurchase && showMobileStickyBuy}
      />

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
