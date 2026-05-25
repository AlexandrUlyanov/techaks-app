import { Link } from "react-router";
import { useCart } from "@/hooks/use-cart";
import { Heart, Minus, Plus, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
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
        className="flex h-10 items-center justify-center gap-2 rounded-[var(--tech-radius-button)] bg-[var(--tech-color-surface-muted)] px-4 text-[10px] font-black uppercase tracking-widest text-[var(--tech-color-text-muted)] cursor-not-allowed shadow-none"
        aria-label="Нет в наличии"
      >
      <ShoppingCart size={14} className="hidden sm:block opacity-70" />
      Нет в наличии
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
      className="magnetic flex h-10 items-center justify-center gap-2 rounded-[var(--tech-radius-button)] bg-[var(--tech-color-primary)] px-4 text-[10px] font-black uppercase tracking-widest text-[var(--tech-color-primary-foreground)] transition-all duration-300 hover:brightness-95 active:scale-95 relative overflow-hidden group shadow-[var(--tech-shadow-button)]"
    >
      <ShoppingCart size={14} className="hidden sm:block" />
      В корзину
    </button>
  );

  if (variant === "list") {
    return (
      <div className="group relative overflow-hidden rounded-[var(--tech-radius-card)] bg-transparent transition-transform duration-300 hover:-translate-y-0.5">
        <Link
          to={`/product/${product.slug}`}
          onClick={handleNavigate}
          className="grid grid-cols-[112px_1fr] gap-4 rounded-[var(--tech-radius-card)] p-2 sm:grid-cols-[148px_1fr] sm:p-3"
        >
          <div className="relative flex h-[112px] items-center justify-center overflow-hidden rounded-[1.35rem] bg-white p-3 sm:h-[132px]">
            {merchandisingBadges.length > 0 && (
              <div className="absolute left-2 top-2 z-10 flex max-w-[130px] flex-wrap gap-1">
                {merchandisingBadges.map(itemBadge => (
                  <span
                    key={itemBadge}
                    className={`${getMerchandisingBadgeStyle(itemBadge)} rounded px-2 py-0.5 text-[9px] font-black uppercase`}
                  >
                    {getMerchandisingBadgeLabel(itemBadge)}
                  </span>
                ))}
              </div>
            )}
            {product.badge && (
              <span
                className={`absolute ${merchandisingBadges.length > 0 ? "left-2 top-11" : "left-2 top-2"} z-10 ${badgeColors[product.badge] || "bg-gray-500"} rounded px-2 py-0.5 text-[9px] font-black uppercase`}
              >
                {product.badge}
              </span>
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
            <div className="flex items-center justify-end gap-3">
              <span className={!isInStock ? "text-[10px] font-bold text-muted-foreground" : "text-[10px] font-bold text-green-600"}>
                {!isInStock ? "Нет в наличии" : "В наличии"}
              </span>
            </div>
            <h3 className="line-clamp-2 text-sm sm:text-base font-bold leading-snug text-foreground">
              {product.name}
            </h3>
            {hasRating && (
              <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <Star size={12} className="fill-[var(--tech-color-primary)] text-[var(--tech-color-primary)]" />
                {rating.toFixed(1)} · {reviewCountLabel}
              </div>
            )}
            <div className="mt-auto flex items-end justify-between gap-3">
              <div>
                <div className="text-lg sm:text-xl font-black text-[var(--tech-color-primary)]">
                  {formatPrice(product.price)}
                </div>
                {product.oldPrice && (
                  <div className="text-xs text-muted-foreground/60 line-through font-bold">
                    {formatPrice(product.oldPrice)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cartControl}
                <button
                  type="button"
                  className="hidden h-10 w-10 items-center justify-center rounded-[calc(var(--tech-radius-button)-4px)] bg-[var(--tech-color-surface-muted)] text-muted-foreground transition-colors hover:text-[var(--tech-color-primary)] sm:flex"
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
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[var(--tech-radius-card)] bg-transparent transition-transform duration-300 hover:-translate-y-0.5">
      <Link to={`/product/${product.slug}`} onClick={handleNavigate} className="flex flex-1 flex-col">
        <div className="relative flex h-[150px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-white p-3 transition-all duration-300 sm:h-[180px] sm:p-4">
          {merchandisingBadges.length > 0 && (
            <div className="absolute left-2 top-2 z-10 flex max-w-[150px] flex-wrap gap-1">
              {merchandisingBadges.map(itemBadge => (
                <span
                  key={itemBadge}
                  className={`${getMerchandisingBadgeStyle(itemBadge)} rounded px-2 py-0.5 text-[9px] font-black uppercase`}
                >
                  {getMerchandisingBadgeLabel(itemBadge)}
                </span>
              ))}
            </div>
          )}
          {product.badge && (
            <span
              className={`absolute ${merchandisingBadges.length > 0 ? "left-2 top-11" : "left-2 top-2"} z-10 ${badgeColors[product.badge] || "bg-gray-500"} rounded px-2 py-0.5 text-[9px] font-black uppercase`}
            >
              {product.badge}
            </span>
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

        <div className="flex flex-1 flex-col px-1 pb-1 pt-3 sm:px-2 sm:pt-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={!isInStock ? "shrink-0 text-[10px] font-bold text-muted-foreground" : "shrink-0 text-[10px] font-bold text-green-600"}>
              {!isInStock ? "Нет в наличии" : "В наличии"}
            </span>
          </div>
          <h3 className="text-sm sm:text-[15px] font-bold text-foreground line-clamp-2 leading-snug min-h-[2.55rem]">
            {product.name}
          </h3>
          {hasRating && (
            <div className="mt-2 flex items-center gap-1">
                <Star size={10} className="fill-[var(--tech-color-primary)] text-[var(--tech-color-primary)]" />
                <span className="text-[10px] font-bold text-muted-foreground">
                  {rating.toFixed(1)} · {reviewCountLabel}
                </span>
            </div>
          )}
          <div className="mt-auto pt-3 flex items-end gap-2">
            <span className="text-lg sm:text-xl font-black text-[var(--tech-color-primary)] leading-none">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground/60 line-through font-bold">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-[1fr_40px] gap-2 px-1 pb-1 pt-3 sm:px-2 sm:pb-2 sm:pt-0">
        {cartControl}
        <button
          type="button"
          className="flex h-10 items-center justify-center rounded-[calc(var(--tech-radius-button)-4px)] bg-[var(--tech-color-surface-muted)] text-muted-foreground transition-colors hover:text-[var(--tech-color-primary)]"
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
  );
}
