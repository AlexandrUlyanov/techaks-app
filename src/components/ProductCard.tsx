import { Link } from "react-router";
import { useCart } from "@/hooks/use-cart";
import { Heart, Minus, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { CartIcon } from "@/components/product/ProductActionIcons";
import {
  getMerchandisingBadgeLabel,
  getMerchandisingBadgeStyle,
  normalizeMerchandisingBadges,
} from "@/lib/merchandising-badges";
import { formatRussianCount } from "@/lib/russian-plurals";
import { applyProductImageFallback, getProductCardImageProps } from "@/lib/product-images";

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
    categoryId: number;
    categoryName?: string;
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
  const cartItem = items.find(
    item => item.id === product.id && (item.variantId ?? null) === null
  );
  const isInStock = Boolean(product.inStock);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  };

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
    image: product.image,
    imageVariants: product.imageVariants,
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
      <div className="overflow-hidden rounded-[28px] bg-white">
        <Link
          to={`/product/${product.slug}`}
          onClick={handleNavigate}
          className="grid grid-cols-[112px_1fr] gap-4 p-3 sm:grid-cols-[148px_1fr] sm:p-4"
        >
          <div className="relative flex h-[112px] items-center justify-center overflow-hidden rounded-[1.35rem] bg-white p-3 sm:h-[132px]">
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
            <img
              src={productImage.src}
              srcSet={productImage.srcSet}
              sizes={productImage.sizes}
              alt={product.name}
              className="h-full w-full object-contain transition-all duration-300"
              loading={productImage.loading}
              fetchPriority={productImage.fetchPriority}
              decoding={productImage.decoding}
              onError={applyProductImageFallback}
            />
          </div>

          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex items-center justify-start gap-3">
              <span className={!isInStock ? "text-[11px] font-medium text-muted-foreground" : "text-[11px] font-medium text-green-600"}>
                {!isInStock ? "Нет в наличии" : "В наличии"}
              </span>
            </div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
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
                  className="hidden h-11 w-11 items-center justify-center rounded-full bg-[var(--tech-color-surface-muted)] text-muted-foreground transition-colors hover:text-[var(--tech-color-primary)] sm:flex"
                  aria-label="В избранное"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <Heart size={15} />
                </button>
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white">
      <Link to={`/product/${product.slug}`} onClick={handleNavigate} className="flex flex-1 flex-col">
        <div className="relative flex h-[170px] items-center justify-center overflow-hidden rounded-[22px] bg-white p-4 sm:h-[210px]">
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
          <img
            src={productImage.src}
            srcSet={productImage.srcSet}
            sizes={productImage.sizes}
            alt={product.name}
            className="h-full w-full object-contain"
            loading={productImage.loading}
            fetchPriority={productImage.fetchPriority}
            decoding={productImage.decoding}
            onError={applyProductImageFallback}
          />
        </div>

        <div className="flex flex-1 flex-col px-3 pb-2 pt-3 sm:px-4">
          <h3 className="text-center text-[15px] font-medium leading-snug text-foreground line-clamp-2 min-h-[2.7rem]">
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
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tech-color-surface-muted)] text-muted-foreground transition-colors hover:text-[var(--tech-color-primary)]"
          aria-label="В избранное"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Heart size={15} />
        </button>
          {cartControl}
        </div>
      </div>
    </div>
  );
}
