import { Link } from "react-router";
import { useCallback, useMemo, useState } from "react";
import { useCart } from "@/hooks/use-cart";
import { useFavorites } from "@/hooks/use-favorites";
import { Heart, Minus, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { CartIcon } from "@/components/product/ProductActionIcons";
import {
  getMerchandisingBadgeLabel,
  getMerchandisingBadgeStyle,
  normalizeMerchandisingBadges,
} from "@/lib/merchandising-badges";
import { formatRussianCount } from "@/lib/russian-plurals";
import {
  applyProductImageFallback,
  getProductCardImageProps,
  resolveProductImageCollection,
} from "@/lib/product-images";

interface ProductCardProps {
  product: {
    id: number;
    slug: string;
    name: string;
    price: number;
    oldPrice?: number | null;
    badge?: string | null;
    badges?: unknown;
    merchandisingBadges?: unknown;
    image: string;
    imageVariants?: unknown;
    images?: unknown;
    categoryId: number;
    categoryName?: string | null;
    rating?: string | number | null;
    reviewCount?: number | null;
    inStock?: boolean | null;
    specs?: Record<string, unknown> | null;
  };
  variant?: "grid" | "list";
  imagePriority?: boolean;
  onNavigate?: (url: string) => void | Promise<void>;
}

export default function ProductCard({
  product,
  variant = "grid",
  imagePriority = false,
  onNavigate,
}: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const cartItem = items.find(
    item => item.id === product.id && (item.variantId ?? null) === null
  );
  const isInStock = Boolean(product.inStock);
  const favoriteActive = isFavorite(product.id);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  };
  const productImages = useMemo(
    () =>
      resolveProductImageCollection(
        product.image,
        product.imageVariants,
        product.images
      ),
    [product.image, product.imageVariants, product.images]
  );
  const hasImagePreview = productImages.length > 1;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImagePreviewActive, setIsImagePreviewActive] = useState(false);

  const badgeColors: Record<string, string> = {
    Акция: "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]",
    Хит: "bg-white text-[var(--tech-color-text-main)]",
    Новинка: "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]",
  };
  const merchandisingBadges = normalizeMerchandisingBadges(
    product.merchandisingBadges ?? product.badges
  ).slice(0, 3);
  const topBadges = [
    ...merchandisingBadges.map(itemBadge => ({
      key: itemBadge,
      label: getMerchandisingBadgeLabel(itemBadge),
      className: getMerchandisingBadgeStyle(itemBadge),
    })),
    ...(product.badge
      ? [
          {
            key: `manual:${product.badge}`,
            label: product.badge,
            className: badgeColors[product.badge] || "bg-gray-500 text-white",
          },
        ]
      : []),
  ].slice(0, 2);
  const productImage = getProductCardImageProps({
    image: productImages[activeImageIndex]?.original ?? product.image,
    imageVariants: productImages[activeImageIndex] ?? product.imageVariants,
    priority: imagePriority,
    sizes:
      variant === "list"
        ? "(max-width: 640px) 112px, 148px"
        : "(max-width: 768px) 45vw, (max-width: 1280px) 30vw, 300px",
  });

  const rating = Number(product.rating ?? 0);
  const hasRating = Boolean(product.reviewCount && product.reviewCount > 0 && rating > 0);
  const reviewCountLabel = formatRussianCount(product.reviewCount ?? 0, [
    "отзыв",
    "отзыва",
    "отзывов",
  ]);

  const updatePreviewFromPointer = useCallback(
    (
      event:
        | React.MouseEvent<HTMLDivElement>
        | React.PointerEvent<HTMLDivElement>
    ) => {
      if (!hasImagePreview) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const offsetX = Math.min(
        Math.max(event.clientX - bounds.left, 0),
        bounds.width
      );
      const nextIndex = Math.min(
        productImages.length - 1,
        Math.floor((offsetX / bounds.width) * productImages.length)
      );
      setActiveImageIndex(nextIndex);
    },
    [hasImagePreview, productImages.length]
  );

  const handleImagePreviewLeave = useCallback(() => {
    setIsImagePreviewActive(false);
    setActiveImageIndex(0);
  }, []);

  const handleImagePreviewEnter = useCallback(() => {
    if (!hasImagePreview) return;
    setIsImagePreviewActive(true);
  }, [hasImagePreview]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInStock) {
      toast.error("Товара сейчас нет в наличии");
      return;
    }
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    toast.success("Товар добавлен в корзину");
  };

  const decreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem) updateQuantity(cartItem.cartKey, cartItem.quantity - 1);
  };

  const increaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem) updateQuantity(cartItem.cartKey, cartItem.quantity + 1);
  };

  const handleNavigate = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) return;
    event.preventDefault();
    await onNavigate(`/product/${product.slug}`);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite({
      id: product.id,
      name: product.name,
    });
  };

  const cartControl = !isInStock ? (
      <button
        type="button"
        disabled
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tech-color-surface-muted)] text-[var(--tech-color-text-muted)] cursor-not-allowed shadow-none"
        aria-label="Нет в наличии"
      >
      <CartIcon size={18} />
    </button>
  ) : cartItem ? (
    <div className="grid h-10 grid-cols-[36px_1fr_36px] overflow-hidden rounded-[calc(var(--tech-radius-button)-4px)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)]">
      <button
        type="button"
        onClick={decreaseQuantity}
        className="flex items-center justify-center text-[var(--tech-color-primary)] hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_15%,white)]"
        aria-label="Уменьшить количество"
      >
        <Minus size={14} />
      </button>
      <div className="flex items-center justify-center text-sm font-black text-foreground">
        {cartItem.quantity}
      </div>
      <button
        type="button"
        onClick={increaseQuantity}
        className="flex items-center justify-center text-[var(--tech-color-primary)] hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_15%,white)]"
        aria-label="Увеличить количество"
      >
        <Plus size={14} />
      </button>
    </div>
  ) : (
    <button
      onClick={handleAddToCart}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0642B] text-white transition-colors hover:bg-[#db5823]"
      aria-label="В корзину"
    >
      <CartIcon size={18} />
    </button>
  );

  if (variant === "list") {
    return (
      <div className="group overflow-hidden rounded-[28px] border border-transparent bg-white ring-1 ring-transparent transition-[border-color,ring-color] duration-200 ease-out hover:border-[#05C3D4]/20 hover:ring-[#05C3D4]/18">
        <Link
          to={`/product/${product.slug}`}
          onClick={handleNavigate}
          className="grid grid-cols-[112px_1fr] gap-4 p-3 sm:grid-cols-[148px_1fr] sm:p-4"
        >
          <div
            className="relative flex h-[112px] items-center justify-center overflow-hidden rounded-[1.35rem] bg-white p-3 sm:h-[132px]"
            onMouseEnter={handleImagePreviewEnter}
            onMouseMove={updatePreviewFromPointer}
            onMouseLeave={handleImagePreviewLeave}
            onPointerEnter={handleImagePreviewEnter}
            onPointerMove={updatePreviewFromPointer}
            onPointerLeave={handleImagePreviewLeave}
          >
            {topBadges.length > 0 && (
              <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-16px)] items-start gap-1.5 overflow-hidden whitespace-nowrap">
                {topBadges.map(itemBadge => (
                  <span
                    key={itemBadge.key}
                    className={`${itemBadge.className} truncate rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] opacity-75`}
                  >
                    {itemBadge.label}
                </span>
              ))}
            </div>
          )}
            {hasImagePreview ? (
              <>
                <div
                  className={`pointer-events-none absolute right-2 top-2 z-10 inline-flex items-center rounded-full bg-[rgba(255,255,255,0.92)] px-2 py-1 text-[10px] font-bold text-[#20262E] transition-opacity duration-200 ${
                    isImagePreviewActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {activeImageIndex + 1} / {productImages.length}
                </div>
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1.5 transition-opacity duration-200 ${
                    isImagePreviewActive ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {productImages.map((_, index) => (
                    <span
                      key={`list-dot-${product.id}-${index}`}
                      className={`h-1 rounded-full transition-all duration-200 ${
                        index === activeImageIndex
                          ? "w-4 bg-[var(--tech-color-primary)]"
                          : "w-2 bg-[rgba(148,163,184,0.55)]"
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : null}
            <img
              src={productImage.src}
              srcSet={productImage.srcSet}
              sizes={productImage.sizes}
              alt={product.name}
              className="h-full w-full object-contain"
              loading={productImage.loading}
              fetchPriority={productImage.fetchPriority}
              decoding={productImage.decoding}
              width={productImage.width}
              height={productImage.height}
              onError={applyProductImageFallback}
            />
          </div>

          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex items-center justify-start gap-3">
              <span className={!isInStock ? "text-[11px] font-medium text-muted-foreground" : "text-[11px] font-medium text-green-600"}>
                {!isInStock ? "Нет в наличии" : "В наличии"}
              </span>
            </div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[#20262E] sm:text-base">
              {product.name}
            </h3>
            {hasRating && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star size={12} className="fill-[var(--tech-color-primary)] text-[var(--tech-color-primary)]" />
                {rating.toFixed(1)} · {reviewCountLabel}
              </div>
            )}
            <div className="mt-auto flex items-end justify-between gap-3">
              <div>
                {product.oldPrice && (
                  <div className="mb-1 text-xs text-muted-foreground/60 line-through">
                    {formatPrice(product.oldPrice)}
                  </div>
                )}
                <div className="text-lg sm:text-xl font-black text-[var(--tech-color-primary)]">
                  {formatPrice(product.price)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cartControl}
                <button
                  type="button"
                  className={`hidden h-11 w-11 items-center justify-center rounded-full transition-colors sm:flex ${
                    favoriteActive
                      ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[var(--tech-color-primary)]"
                      : "bg-[var(--tech-color-surface-muted)] text-muted-foreground hover:text-[var(--tech-color-primary)]"
                  }`}
                  aria-label={favoriteActive ? "Убрать из избранного" : "В избранное"}
                  onClick={handleToggleFavorite}
                >
                  <Heart size={15} className={favoriteActive ? "fill-current" : ""} />
                </button>
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-transparent bg-white ring-1 ring-transparent transition-[border-color,ring-color] duration-200 ease-out hover:border-[#05C3D4]/20 hover:ring-[#05C3D4]/18">
      <Link to={`/product/${product.slug}`} onClick={handleNavigate} className="flex flex-1 flex-col">
        <div
          className="relative flex h-[170px] items-center justify-center overflow-hidden rounded-[22px] bg-white p-4 sm:h-[210px]"
          onMouseEnter={handleImagePreviewEnter}
          onMouseMove={updatePreviewFromPointer}
          onMouseLeave={handleImagePreviewLeave}
          onPointerEnter={handleImagePreviewEnter}
          onPointerMove={updatePreviewFromPointer}
          onPointerLeave={handleImagePreviewLeave}
        >
          {topBadges.length > 0 && (
            <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-16px)] items-start gap-1.5 overflow-hidden whitespace-nowrap">
              {topBadges.map(itemBadge => (
                <span
                  key={itemBadge.key}
                  className={`${itemBadge.className} truncate rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] opacity-75`}
                >
                  {itemBadge.label}
                </span>
              ))}
            </div>
          )}
          {hasImagePreview ? (
            <>
              <div
                className={`pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center rounded-full bg-[rgba(255,255,255,0.94)] px-2.5 py-1 text-[10px] font-bold text-[#20262E] transition-opacity duration-200 ${
                  isImagePreviewActive ? "opacity-100" : "opacity-0"
                }`}
              >
                {activeImageIndex + 1} / {productImages.length}
              </div>
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-1.5 transition-opacity duration-200 ${
                  isImagePreviewActive ? "opacity-100" : "opacity-0"
                }`}
              >
                {productImages.map((_, index) => (
                  <span
                    key={`grid-dot-${product.id}-${index}`}
                    className={`h-1 rounded-full transition-all duration-200 ${
                      index === activeImageIndex
                        ? "w-4 bg-[var(--tech-color-primary)]"
                        : "w-2 bg-[rgba(148,163,184,0.55)]"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
          <img
            src={productImage.src}
            srcSet={productImage.srcSet}
            sizes={productImage.sizes}
            alt={product.name}
            className="h-full w-full object-contain"
            loading={productImage.loading}
            fetchPriority={productImage.fetchPriority}
            decoding={productImage.decoding}
            width={productImage.width}
            height={productImage.height}
            onError={applyProductImageFallback}
          />
        </div>

        <div className="flex flex-1 flex-col px-3 pb-2 pt-3 sm:px-4">
          <h3 className="min-h-[2.7rem] line-clamp-2 text-center text-[15px] font-medium leading-snug text-[#20262E]">
            {product.name}
          </h3>
          {hasRating && (
            <div className="mt-2 flex items-center justify-center gap-1">
              <Star size={10} className="fill-[var(--tech-color-primary)] text-[var(--tech-color-primary)]" />
              <span className="text-[10px] text-muted-foreground">
                {rating.toFixed(1)}
              </span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className={!isInStock ? "text-[11px] font-medium text-muted-foreground" : "text-[11px] font-medium text-green-600"}>
              {!isInStock ? "Нет в наличии" : "В наличии"}
            </span>
          </div>
        </div>
      </Link>

      <div className="mt-auto grid grid-cols-[1fr_auto] items-end gap-2 px-3 pb-4 pt-2 sm:px-4">
        <div className="min-w-0">
          {product.oldPrice && (
            <div className="mb-1 text-xs text-muted-foreground/60 line-through">
              {formatPrice(product.oldPrice)}
            </div>
          )}
          <div className="text-[19px] font-black leading-none text-[#20262E] sm:text-[20px]">
            {formatPrice(product.price)}
          </div>
        </div>
        <div className="flex items-center gap-2 justify-self-end">
        <button
          type="button"
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
            favoriteActive
              ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[var(--tech-color-primary)]"
              : "bg-[var(--tech-color-surface-muted)] text-muted-foreground hover:text-[var(--tech-color-primary)]"
          }`}
          aria-label={favoriteActive ? "Убрать из избранного" : "В избранное"}
          onClick={handleToggleFavorite}
        >
          <Heart size={15} className={favoriteActive ? "fill-current" : ""} />
        </button>
          {cartControl}
        </div>
      </div>
    </div>
  );
}
